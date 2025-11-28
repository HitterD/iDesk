import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { TelegramSession } from './entities/telegram-session.entity';
import { TelegramState } from './enums/telegram-state.enum';
import { User } from '../users/entities/user.entity';
import { Ticket, TicketStatus, TicketPriority, TicketSource } from '../ticketing/entities/ticket.entity';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { CacheService } from '../../shared/core/cache';

// Cache key prefix for link codes
const LINK_CODE_PREFIX = 'telegram:linkcode:';

@Injectable()
export class TelegramService {
    private readonly logger = new Logger(TelegramService.name);

    constructor(
        @InjectRepository(TelegramSession)
        private sessionRepo: Repository<TelegramSession>,
        @InjectRepository(User)
        private userRepo: Repository<User>,
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private messageRepo: Repository<TicketMessage>,
        @InjectBot() private bot: Telegraf<Context>,
        // SECURITY: Use CacheService instead of in-memory Map (supports Redis)
        private cacheService: CacheService,
    ) {}

    // =====================
    // Session Management
    // =====================
    
    async getOrCreateSession(telegramId: string, chatId: string, userData: any): Promise<TelegramSession> {
        let session = await this.sessionRepo.findOne({
            where: { telegramId },
            relations: ['user'],
        });

        if (!session) {
            session = this.sessionRepo.create({
                telegramId,
                chatId,
                telegramUsername: userData.username,
                telegramFirstName: userData.first_name,
                state: TelegramState.IDLE,
            });
            await this.sessionRepo.save(session);
        } else {
            // Update chat info if changed
            session.chatId = chatId;
            session.telegramUsername = userData.username;
            session.telegramFirstName = userData.first_name;
            await this.sessionRepo.save(session);
        }

        return session;
    }

    async getSession(telegramId: string): Promise<TelegramSession | null> {
        return this.sessionRepo.findOne({
            where: { telegramId },
            relations: ['user'],
        });
    }

    async setState(telegramId: string, state: TelegramState, data?: any): Promise<void> {
        await this.sessionRepo.update(
            { telegramId },
            { state, stateData: data }
        );
    }

    async clearState(telegramId: string): Promise<void> {
        await this.sessionRepo.update(
            { telegramId },
            { state: TelegramState.IDLE, stateData: null }
        );
    }

    // =====================
    // Account Linking
    // =====================

    async generateLinkCode(userId: string): Promise<string> {
        // Generate 6-digit code
        const code = Math.random().toString().slice(2, 8);

        // SECURITY: Store in CacheService with 5 minute TTL (supports Redis)
        const cacheKey = `${LINK_CODE_PREFIX}${code}`;
        this.cacheService.set(cacheKey, { userId }, 300); // 5 minutes TTL

        this.logger.debug(`Generated link code ${code} for user ${userId}`);
        return code;
    }

    async verifyAndLink(telegramId: string, code: string): Promise<{ success: boolean; message: string }> {
        const cacheKey = `${LINK_CODE_PREFIX}${code}`;
        const linkData = this.cacheService.get<{ userId: string }>(cacheKey);

        if (!linkData) {
            return { success: false, message: 'Kode tidak valid atau sudah kadaluarsa.' };
        }

        // Get session
        const session = await this.sessionRepo.findOne({ where: { telegramId } });
        if (!session) {
            return { success: false, message: 'Sesi tidak ditemukan.' };
        }

        // Check if user already linked to another telegram
        const existingUser = await this.userRepo.findOne({
            where: { telegramId }
        });
        if (existingUser && existingUser.id !== linkData.userId) {
            return { success: false, message: 'Akun Telegram ini sudah terhubung dengan akun lain.' };
        }

        // Update user with telegram info
        await this.userRepo.update(linkData.userId, {
            telegramId,
            telegramChatId: session.chatId,
        });

        // Update session
        await this.sessionRepo.update(
            { telegramId },
            { 
                userId: linkData.userId, 
                linkedAt: new Date(),
                state: TelegramState.IDLE,
                stateData: null,
            }
        );

        // Remove used code from cache
        this.cacheService.del(cacheKey);

        // Get user name for welcome message
        const user = await this.userRepo.findOne({ where: { id: linkData.userId } });

        this.logger.log(`User ${linkData.userId} linked to Telegram ${telegramId}`);
        return { 
            success: true, 
            message: `✅ Berhasil! Akun Telegram Anda sekarang terhubung dengan ${user?.fullName || 'akun iDesk'}.` 
        };
    }

    async unlinkAccount(telegramId: string): Promise<{ success: boolean; message: string }> {
        const session = await this.sessionRepo.findOne({
            where: { telegramId },
            relations: ['user'],
        });

        if (!session || !session.userId) {
            return { success: false, message: 'Akun Telegram tidak terhubung dengan akun iDesk manapun.' };
        }

        // Remove telegram info from user
        await this.userRepo.update(session.userId, {
            telegramId: null,
            telegramChatId: null,
        });

        // Update session
        await this.sessionRepo.update(
            { telegramId },
            { userId: null, linkedAt: null }
        );

        return { success: true, message: '✅ Akun Telegram berhasil diputus dari akun iDesk.' };
    }

    async getLinkedStatus(userId: string): Promise<{ linked: boolean; telegramUsername?: string }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user || !user.telegramId) {
            return { linked: false };
        }

        const session = await this.sessionRepo.findOne({
            where: { telegramId: user.telegramId }
        });

        return {
            linked: true,
            telegramUsername: session?.telegramUsername,
        };
    }

    // =====================
    // Ticket Operations
    // =====================

    async createTicket(
        session: TelegramSession, 
        title: string, 
        description: string, 
        category: string = 'GENERAL',
        priority: string = 'MEDIUM',
    ): Promise<Ticket> {
        if (!session.userId) {
            throw new Error('Akun tidak terhubung');
        }

        // Get user with department
        const user = await this.userRepo.findOne({
            where: { id: session.userId },
            relations: ['department'],
        });

        const ticketNumber = await this.generateTicketNumber(user || undefined);

        // Map priority string to enum
        const priorityMap: Record<string, TicketPriority> = {
            'LOW': TicketPriority.LOW,
            'MEDIUM': TicketPriority.MEDIUM,
            'HIGH': TicketPriority.HIGH,
            'CRITICAL': TicketPriority.CRITICAL,
        };

        const ticket = this.ticketRepo.create({
            ticketNumber,
            title,
            description,
            category,
            priority: priorityMap[priority] || TicketPriority.MEDIUM,
            status: TicketStatus.TODO,
            source: TicketSource.TELEGRAM,
            userId: session.userId,
        });

        // Save ticket
        const savedTicket = await this.ticketRepo.save(ticket);

        // Create initial message
        const message = this.messageRepo.create({
            ticketId: savedTicket.id,
            senderId: session.userId,
            content: description,
        });
        await this.messageRepo.save(message);

        return savedTicket;
    }

    async getMyTickets(userId: string): Promise<Ticket[]> {
        return this.ticketRepo.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: 10,
        });
    }

    async getTicketById(ticketId: string): Promise<Ticket | null> {
        return this.ticketRepo.findOne({
            where: { id: ticketId },
            relations: ['user', 'assignedTo', 'messages'],
        });
    }

    async replyToTicket(ticketId: string, userId: string, content: string): Promise<TicketMessage> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new Error('Tiket tidak ditemukan');
        }

        const message = this.messageRepo.create({
            ticketId,
            senderId: userId,
            content,
        });

        return this.messageRepo.save(message);
    }

    private async generateTicketNumber(user?: User): Promise<string> {
        const date = new Date();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        const dateStr = `${day}${month}${year}`;
        
        // Get division from user's department or default
        const division = user?.department?.name 
            ? user.department.name.substring(0, 3).toUpperCase() 
            : 'TLG'; // TLG = Telegram
        
        // Count tickets from today
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const count = await this.ticketRepo.count({
            where: {
                createdAt: MoreThanOrEqual(startOfDay),
            },
        });

        const number = (count + 1).toString().padStart(4, '0');
        return `${dateStr}-${division}-${number}`;
    }

    // =====================
    // Notifications
    // =====================

    async sendNotification(chatId: string, message: string, options?: any): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                ...options,
            });
        } catch (error) {
            this.logger.error(`Failed to send notification to ${chatId}:`, error);
        }
    }

    async notifyTicketUpdate(userId: string, ticket: Ticket, updateType: string): Promise<void> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user || !user.telegramChatId || !user.telegramNotifications) {
            return;
        }

        let message = '';
        switch (updateType) {
            case 'NEW_REPLY':
                message = `💬 <b>Balasan Baru</b>\n\nTiket #${ticket.ticketNumber} mendapat balasan baru.\n\n<i>${ticket.title}</i>`;
                break;
            case 'STATUS_CHANGED':
                message = `🔄 <b>Status Berubah</b>\n\nTiket #${ticket.ticketNumber} status berubah menjadi: <b>${ticket.status}</b>`;
                break;
            case 'ASSIGNED':
                message = `👤 <b>Tiket Diassign</b>\n\nTiket #${ticket.ticketNumber} telah ditangani oleh tim support.`;
                break;
            case 'RESOLVED':
                message = `✅ <b>Tiket Selesai</b>\n\nTiket #${ticket.ticketNumber} telah diselesaikan!`;
                break;
            default:
                message = `📢 <b>Update Tiket</b>\n\nAda update pada tiket #${ticket.ticketNumber}.`;
        }

        await this.sendNotification(user.telegramChatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 Lihat Tiket', callback_data: `view_ticket:${ticket.id}` }],
                ],
            },
        });
    }

    async notifyNewTicketToAgents(ticket: Ticket): Promise<void> {
        // Get all agents with telegram linked
        const agents = await this.userRepo.find({
            where: [
                { role: 'ADMIN' as any, telegramNotifications: true },
                { role: 'AGENT' as any, telegramNotifications: true },
            ],
        });

        const message = `🎫 <b>Tiket Baru</b>\n\n#${ticket.ticketNumber}\n<b>${ticket.title}</b>\n\nKategori: ${ticket.category}\nPrioritas: ${ticket.priority}`;

        for (const agent of agents) {
            if (agent.telegramChatId) {
                await this.sendNotification(agent.telegramChatId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Lihat', callback_data: `view_ticket:${ticket.id}` }],
                            [{ text: '✋ Ambil', callback_data: `assign_ticket:${ticket.id}` }],
                        ],
                    },
                });
            }
        }
    }

    // =====================
    // Helpers
    // =====================

    getMainMenuKeyboard() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('🎫 Buat Tiket', 'new_ticket'),
                Markup.button.callback('📋 Tiket Saya', 'my_tickets'),
            ],
            [
                Markup.button.callback('💬 Chat', 'start_chat'),
                Markup.button.callback('🔍 Cek Status', 'check_status'),
            ],
            [
                Markup.button.callback('❓ Bantuan', 'help'),
            ],
        ]);
    }

    getBackHomeKeyboard(backAction: string = 'main_menu') {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('◀️ Kembali', backAction),
                Markup.button.callback('🏠 Menu Utama', 'main_menu'),
            ],
        ]);
    }

    getTicketActionsKeyboard(ticketId: string) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('💬 Chat', `enter_chat:${ticketId}`),
                Markup.button.callback('📜 Detail', `view_ticket:${ticketId}`),
            ],
            [
                Markup.button.callback('⚡ Prioritas', `change_priority:${ticketId}`),
            ],
            [
                Markup.button.callback('◀️ Kembali', 'my_tickets'),
                Markup.button.callback('🏠 Menu', 'main_menu'),
            ],
        ]);
    }

    formatTicketStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'TODO': '🔵 Open',
            'IN_PROGRESS': '🟡 In Progress',
            'WAITING_VENDOR': '🟠 Waiting',
            'RESOLVED': '🟢 Resolved',
            'CANCELLED': '🔴 Cancelled',
        };
        return statusMap[status] || status;
    }

    formatPriority(priority: string): string {
        const priorityMap: Record<string, string> = {
            'LOW': '⬜ Low',
            'MEDIUM': '🟨 Medium',
            'HIGH': '🟧 High',
            'CRITICAL': '🟥 Critical',
        };
        return priorityMap[priority] || priority;
    }
}
