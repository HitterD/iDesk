import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { TelegramSession } from './entities/telegram-session.entity';
import { User } from '../users/entities/user.entity';
import { Ticket, TicketStatus } from '../ticketing/entities/ticket.entity';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { TelegramState } from './enums/telegram-state.enum';
import { UploadService } from '../../shared/upload';
import { EventsGateway } from '../ticketing/presentation/gateways/events.gateway';

export interface TelegramMessagePayload {
    ticketId: string;
    content: string;
    senderId: string;
    senderName: string;
    senderRole: 'user' | 'agent' | 'admin';
    attachments?: string[];
    telegramMessageId?: number;
}

@Injectable()
export class TelegramChatBridgeService {
    private readonly logger = new Logger(TelegramChatBridgeService.name);

    constructor(
        @InjectBot() private bot: Telegraf<Context>,
        @InjectRepository(TelegramSession)
        private sessionRepo: Repository<TelegramSession>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private messageRepo: Repository<TicketMessage>,
        private uploadService: UploadService,
        @Inject(forwardRef(() => EventsGateway))
        private eventsGateway: EventsGateway,
    ) {
        this.logger.log('TelegramChatBridgeService initialized');
    }

    // =====================
    // Chat Mode Management
    // =====================

    /**
     * Enter chat mode for a specific ticket
     */
    async enterChatMode(telegramId: string, ticketId: string): Promise<{ success: boolean; message: string }> {
        const session = await this.sessionRepo.findOne({
            where: { telegramId },
            relations: ['user'],
        });

        if (!session?.userId) {
            return { success: false, message: 'Akun tidak terhubung. Gunakan /link terlebih dahulu.' };
        }

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user', 'assignedTo'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        // Verify user owns this ticket or is agent/admin
        const user = await this.userRepo.findOne({ where: { id: session.userId } });
        const isOwner = ticket.userId === session.userId;
        const isAgentOrAdmin = user?.role === 'AGENT' || user?.role === 'ADMIN';

        if (!isOwner && !isAgentOrAdmin) {
            return { success: false, message: 'Anda tidak memiliki akses ke tiket ini.' };
        }

        // Set active ticket and state
        await this.sessionRepo.update(
            { telegramId },
            { 
                activeTicketId: ticketId,
                state: TelegramState.CHAT_MODE,
                lastActivityAt: new Date(),
            }
        );

        return { 
            success: true, 
            message: `Mode chat aktif untuk tiket #${ticket.ticketNumber}. Ketik pesan Anda langsung, akan diteruskan ke support. Gunakan /endchat untuk keluar.`
        };
    }

    /**
     * Exit chat mode
     */
    async exitChatMode(telegramId: string): Promise<void> {
        await this.sessionRepo.update(
            { telegramId },
            { 
                activeTicketId: null,
                state: TelegramState.IDLE,
            }
        );
    }

    /**
     * Get active ticket for chat mode
     */
    async getActiveChatTicket(telegramId: string): Promise<Ticket | null> {
        const session = await this.sessionRepo.findOne({ where: { telegramId } });
        if (!session?.activeTicketId) return null;

        return this.ticketRepo.findOne({
            where: { id: session.activeTicketId },
            relations: ['user', 'assignedTo', 'messages', 'messages.sender'],
        });
    }

    // =====================
    // Message Bridging: Telegram → Ticket System
    // =====================

    /**
     * Forward a message from Telegram to the ticket system
     */
    async forwardToTicket(
        telegramId: string,
        chatId: string,
        text: string,
        messageId: number,
        attachments?: string[]
    ): Promise<{ success: boolean; message?: string }> {
        const session = await this.sessionRepo.findOne({
            where: { telegramId },
            relations: ['user'],
        });

        if (!session?.userId) {
            return { success: false, message: 'Akun tidak terhubung.' };
        }

        if (!session.activeTicketId) {
            return { success: false, message: 'Tidak ada tiket aktif. Gunakan /chat untuk memilih tiket.' };
        }

        const ticket = await this.ticketRepo.findOne({
            where: { id: session.activeTicketId },
        });

        if (!ticket) {
            await this.exitChatMode(telegramId);
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        // Check if ticket is closed
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
            await this.exitChatMode(telegramId);
            return { success: false, message: 'Tiket sudah ditutup. Chat mode diakhiri.' };
        }

        // Create ticket message with TELEGRAM source
        const ticketMessage = this.messageRepo.create({
            ticketId: session.activeTicketId,
            senderId: session.userId,
            content: text,
            attachments: attachments || [],
            source: 'TELEGRAM',
        });

        const savedMessage = await this.messageRepo.save(ticketMessage);

        // Update session activity
        await this.sessionRepo.update({ telegramId }, { lastActivityAt: new Date() });

        // Get sender info for WebSocket event
        const user = await this.userRepo.findOne({ where: { id: session.userId } });
        
        // Emit WebSocket event for real-time updates to agents
        const messageWithSender = {
            ...savedMessage,
            sender: user ? {
                id: user.id,
                fullName: user.fullName,
                role: user.role,
            } : null,
        };
        
        this.eventsGateway.notifyNewMessage(session.activeTicketId, messageWithSender);
        this.logger.debug(`Message forwarded to ticket ${session.activeTicketId} from Telegram`);

        return { success: true };
    }

    // =====================
    // Message Bridging: Ticket System → Telegram
    // =====================

    /**
     * Forward agent/admin reply to Telegram user
     * Called directly from TicketService when agent replies
     */
    async forwardAgentReplyToTelegram(payload: {
        ticketId: string;
        message: TicketMessage;
        sender: User;
    }): Promise<void> {
        const { ticketId, message, sender } = payload;

        // Skip if message is from user (not agent/admin)
        if (sender.role === 'USER') return;

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user'],
        });

        if (!ticket?.user?.telegramChatId) return;

        // Format agent message
        const agentName = sender.fullName || 'Support';
        const roleBadge = sender.role === 'ADMIN' ? '👑' : '👤';
        const formattedMessage = 
            `${roleBadge} <b>${agentName}</b> membalas tiket #${ticket.ticketNumber}:\n\n` +
            `${message.content}`;

        try {
            await this.bot.telegram.sendMessage(
                ticket.user.telegramChatId,
                formattedMessage,
                {
                    parse_mode: 'HTML',
                    reply_markup: Markup.inlineKeyboard([
                        [Markup.button.callback('💬 Balas', `quick_reply:${ticketId}`)],
                        [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticketId}`)],
                    ]).reply_markup,
                }
            );

            this.logger.log(`Forwarded agent reply to user ${ticket.user.id} for ticket ${ticketId}`);
        } catch (error) {
            this.logger.error(`Failed to forward message to Telegram:`, error);
        }
    }

    /**
     * Notify user when ticket status changes
     * Called directly from TicketService when status changes
     */
    async notifyTicketStatusChange(payload: {
        ticket: Ticket;
        oldStatus: TicketStatus;
        newStatus: TicketStatus;
        changedBy: User;
    }): Promise<void> {
        const { ticket, newStatus, changedBy } = payload;

        const user = await this.userRepo.findOne({ where: { id: ticket.userId } });
        if (!user?.telegramChatId) return;

        const statusEmoji = this.getStatusEmoji(newStatus);
        const statusText = this.getStatusText(newStatus);

        const message = 
            `${statusEmoji} <b>Status Tiket Berubah</b>\n\n` +
            `Tiket #${ticket.ticketNumber}\n` +
            `Status: <b>${statusText}</b>\n` +
            `Diubah oleh: ${changedBy.fullName}`;

        try {
            await this.bot.telegram.sendMessage(user.telegramChatId, message, {
                parse_mode: 'HTML',
                reply_markup: Markup.inlineKeyboard([
                    [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticket.id}`)],
                ]).reply_markup,
            });
        } catch (error) {
            this.logger.error(`Failed to send status change notification:`, error);
        }
    }

    // =====================
    // Media Handling
    // =====================

    /**
     * Handle photo sent via Telegram
     * Downloads the file from Telegram and stores it locally
     */
    async handlePhoto(
        telegramId: string,
        chatId: string,
        fileId: string,
        caption: string | undefined,
        messageId: number
    ): Promise<{ success: boolean; message?: string }> {
        const session = await this.sessionRepo.findOne({ where: { telegramId } });

        if (!session?.activeTicketId) {
            return { 
                success: false, 
                message: '💡 Masuk ke mode chat terlebih dahulu dengan /chat untuk mengirim gambar.' 
            };
        }

        try {
            // Get file URL from Telegram
            const fileLink = await this.bot.telegram.getFileLink(fileId);
            const telegramUrl = fileLink.href;

            // Download and store file locally
            const uploadedFile = await this.uploadService.downloadFromUrl({
                url: telegramUrl,
                originalName: `photo_${Date.now()}.jpg`,
                folder: 'telegram',
            });

            this.logger.log(`Photo downloaded and saved: ${uploadedFile.url}`);

            // Forward to ticket with local attachment URL
            return this.forwardToTicket(
                telegramId,
                chatId,
                caption || '📷 [Photo]',
                messageId,
                [uploadedFile.url]
            );
        } catch (error) {
            this.logger.error('Failed to handle photo:', error);
            return { success: false, message: 'Gagal memproses gambar.' };
        }
    }

    /**
     * Handle document sent via Telegram
     * Downloads the file from Telegram and stores it locally
     */
    async handleDocument(
        telegramId: string,
        chatId: string,
        fileId: string,
        fileName: string,
        caption: string | undefined,
        messageId: number
    ): Promise<{ success: boolean; message?: string }> {
        const session = await this.sessionRepo.findOne({ where: { telegramId } });

        if (!session?.activeTicketId) {
            return { 
                success: false, 
                message: '💡 Masuk ke mode chat terlebih dahulu dengan /chat untuk mengirim file.' 
            };
        }

        try {
            const fileLink = await this.bot.telegram.getFileLink(fileId);
            const telegramUrl = fileLink.href;

            // Download and store file locally
            const uploadedFile = await this.uploadService.downloadFromUrl({
                url: telegramUrl,
                originalName: fileName,
                folder: 'telegram',
            });

            this.logger.log(`Document downloaded and saved: ${uploadedFile.url}`);

            return this.forwardToTicket(
                telegramId,
                chatId,
                caption || `📎 [${fileName}]`,
                messageId,
                [uploadedFile.url]
            );
        } catch (error) {
            this.logger.error('Failed to handle document:', error);
            return { success: false, message: 'Gagal memproses file.' };
        }
    }

    // =====================
    // Ticket Queries
    // =====================

    /**
     * Get user's active (non-closed) tickets
     */
    async getActiveTickets(userId: string): Promise<Ticket[]> {
        return this.ticketRepo.find({
            where: {
                userId,
                status: Not(In([TicketStatus.RESOLVED, TicketStatus.CANCELLED])),
            },
            order: { updatedAt: 'DESC' },
            take: 10,
        });
    }

    /**
     * Get ticket by number
     */
    async getTicketByNumber(ticketNumber: string): Promise<Ticket | null> {
        return this.ticketRepo.findOne({
            where: { ticketNumber },
            relations: ['user', 'assignedTo', 'messages'],
        });
    }

    /**
     * Request priority change for a ticket
     */
    async requestPriorityChange(
        telegramId: string,
        ticketNumber: string,
        priority: string
    ): Promise<{ success: boolean; message: string }> {
        const session = await this.sessionRepo.findOne({ where: { telegramId } });
        
        if (!session?.userId) {
            return { success: false, message: 'Akun tidak terhubung.' };
        }

        const ticket = await this.ticketRepo.findOne({
            where: { ticketNumber },
            relations: ['user'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        // Check if user owns the ticket
        if (ticket.userId !== session.userId) {
            return { success: false, message: 'Anda tidak memiliki akses ke tiket ini.' };
        }

        // Update priority
        ticket.priority = priority as any;
        await this.ticketRepo.save(ticket);

        this.logger.log(`Priority changed for ticket ${ticketNumber} to ${priority} by Telegram user ${telegramId}`);
        
        return { success: true, message: 'Prioritas berhasil diubah.' };
    }

    /**
     * Change priority by ticket ID (for inline button callbacks)
     */
    async changePriorityById(
        telegramId: string,
        ticketId: string,
        priority: string
    ): Promise<{ success: boolean; message: string; ticketNumber?: string }> {
        const session = await this.sessionRepo.findOne({ where: { telegramId } });
        
        if (!session?.userId) {
            return { success: false, message: 'Akun tidak terhubung.' };
        }

        const ticket = await this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        if (ticket.userId !== session.userId) {
            return { success: false, message: 'Anda tidak memiliki akses ke tiket ini.' };
        }

        ticket.priority = priority as any;
        await this.ticketRepo.save(ticket);
        
        return { success: true, message: 'Prioritas berhasil diubah.', ticketNumber: ticket.ticketNumber };
    }

    // =====================
    // Helpers
    // =====================

    private getStatusEmoji(status: TicketStatus): string {
        const emojiMap: Record<TicketStatus, string> = {
            [TicketStatus.TODO]: '🔵',
            [TicketStatus.IN_PROGRESS]: '🟡',
            [TicketStatus.WAITING_VENDOR]: '🟠',
            [TicketStatus.RESOLVED]: '🟢',
            [TicketStatus.CANCELLED]: '🔴',
        };
        return emojiMap[status] || '⚪';
    }

    private getStatusText(status: TicketStatus): string {
        const textMap: Record<TicketStatus, string> = {
            [TicketStatus.TODO]: 'Open',
            [TicketStatus.IN_PROGRESS]: 'Sedang Dikerjakan',
            [TicketStatus.WAITING_VENDOR]: 'Menunggu Vendor',
            [TicketStatus.RESOLVED]: 'Selesai',
            [TicketStatus.CANCELLED]: 'Dibatalkan',
        };
        return textMap[status] || status;
    }
}
