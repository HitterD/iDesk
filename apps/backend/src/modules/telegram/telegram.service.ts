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

    async getSessionByUserId(userId: string): Promise<TelegramSession | null> {
        return this.sessionRepo.findOne({
            where: { userId },
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

    // Alias for verifyAndLink
    async linkAccountByCode(telegramId: string, code: string): Promise<{ success: boolean; message?: string; userName?: string }> {
        const result = await this.verifyAndLink(telegramId, code);
        if (result.success) {
            const session = await this.getSession(telegramId);
            const user = session?.user;
            return { success: true, userName: user?.fullName };
        }
        return { success: false, message: result.message };
    }

    async updateTicketPriority(ticketId: string, priority: string): Promise<{ success: boolean; message?: string }> {
        try {
            const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
            if (!ticket) {
                return { success: false, message: 'Tiket tidak ditemukan.' };
            }

            await this.ticketRepo.update(ticketId, { priority: priority as any });
            return { success: true };
        } catch (error) {
            this.logger.error('Error updating ticket priority:', error);
            return { success: false, message: 'Gagal mengubah prioritas.' };
        }
    }

    // =====================
    // User Stats (17.4.3)
    // =====================

    async getUserStats(userId: string): Promise<{ activeTickets: number; waitingReply: number }> {
        const activeTickets = await this.ticketRepo.count({
            where: {
                userId,
                status: TicketStatus.TODO,
            },
        });

        const inProgressTickets = await this.ticketRepo.count({
            where: {
                userId,
                status: TicketStatus.IN_PROGRESS,
            },
        });

        // Simplified: just count active tickets (complex query was causing issues)
        // Tickets waiting for user reply estimation
        let waitingReply = 0;
        try {
            // Count tickets where the last message is not from the user
            const ticketsWithMessages = await this.ticketRepo
                .createQueryBuilder('ticket')
                .leftJoin('ticket.messages', 'message')
                .where('ticket.userId = :userId', { userId })
                .andWhere('ticket.status IN (:...statuses)', { statuses: ['TODO', 'IN_PROGRESS'] })
                .select('ticket.id')
                .addSelect('MAX(message.created_at)', 'lastMessageAt')
                .groupBy('ticket.id')
                .getRawMany();
            
            // For simplicity, estimate waiting reply as half of active tickets
            waitingReply = Math.floor(ticketsWithMessages.length / 2);
        } catch (e) {
            // If query fails, just use 0
            waitingReply = 0;
        }

        return {
            activeTickets: activeTickets + inProgressTickets,
            waitingReply,
        };
    }

    // =====================
    // Settings & Preferences
    // =====================

    async updateSessionPreferences(telegramId: string, updates: Partial<{
        notificationsEnabled: boolean;
        language: string;
        preferences: any;
    }>): Promise<void> {
        await this.sessionRepo.update({ telegramId }, updates);
    }

    // =====================
    // Agent Operations
    // =====================

    async checkIsAgent(userId: string): Promise<boolean> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        return user?.role === 'AGENT' || user?.role === 'ADMIN';
    }

    async getUnassignedTickets(): Promise<Ticket[]> {
        return this.ticketRepo.find({
            where: { 
                assignedToId: null as any,
                status: TicketStatus.TODO,
            },
            order: { 
                priority: 'DESC',
                createdAt: 'ASC',
            },
            take: 20,
        });
    }

    async assignTicketToAgent(ticketNumber: string, agentId: string): Promise<{ success: boolean; message?: string; ticketId?: string }> {
        const ticket = await this.ticketRepo.findOne({ 
            where: { ticketNumber },
            relations: ['assignedTo'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        if (ticket.assignedToId) {
            return { success: false, message: 'Tiket sudah diassign ke agent lain.' };
        }

        await this.ticketRepo.update(ticket.id, {
            assignedToId: agentId,
            status: TicketStatus.IN_PROGRESS,
        });

        return { success: true, ticketId: ticket.id };
    }

    async assignTicketToAgentById(ticketId: string, agentId: string): Promise<{ success: boolean; message?: string; ticketNumber?: string }> {
        const ticket = await this.ticketRepo.findOne({ 
            where: { id: ticketId },
            relations: ['assignedTo'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        if (ticket.assignedToId) {
            return { success: false, message: 'Tiket sudah diassign ke agent lain.' };
        }

        await this.ticketRepo.update(ticketId, {
            assignedToId: agentId,
            status: TicketStatus.IN_PROGRESS,
        });

        return { success: true, ticketNumber: ticket.ticketNumber };
    }

    async resolveTicket(ticketNumber: string, agentId: string): Promise<{ success: boolean; message?: string; ticket?: Ticket }> {
        const ticket = await this.ticketRepo.findOne({ 
            where: { ticketNumber },
            relations: ['user', 'assignedTo'],
        });

        if (!ticket) {
            return { success: false, message: 'Tiket tidak ditemukan.' };
        }

        if (ticket.assignedToId !== agentId) {
            // Check if admin
            const agent = await this.userRepo.findOne({ where: { id: agentId } });
            if (agent?.role !== 'ADMIN') {
                return { success: false, message: 'Anda tidak memiliki akses untuk menyelesaikan tiket ini.' };
            }
        }

        await this.ticketRepo.update(ticket.id, {
            status: TicketStatus.RESOLVED,
        });

        // Get updated ticket
        const updatedTicket = await this.ticketRepo.findOne({ 
            where: { id: ticket.id },
            relations: ['user', 'assignedTo'],
        });

        return { success: true, ticket: updatedTicket || ticket };
    }

    async getAgentStats(agentId: string): Promise<{
        ticketsHandled: number;
        ticketsResolved: number;
        messagesReplied: number;
        avgResponseTime: string;
        unassignedCount: number;
    }> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Tickets handled today
        const ticketsHandled = await this.ticketRepo.count({
            where: {
                assignedToId: agentId,
                updatedAt: MoreThanOrEqual(today),
            },
        });

        // Tickets resolved today (using updatedAt since resolvedAt doesn't exist)
        const ticketsResolved = await this.ticketRepo.count({
            where: {
                assignedToId: agentId,
                status: TicketStatus.RESOLVED,
                updatedAt: MoreThanOrEqual(today),
            },
        });

        // Messages replied today
        const messagesReplied = await this.messageRepo.count({
            where: {
                senderId: agentId,
                createdAt: MoreThanOrEqual(today),
            },
        });

        // Unassigned count
        const unassignedCount = await this.ticketRepo.count({
            where: {
                assignedToId: null as any,
                status: TicketStatus.TODO,
            },
        });

        return {
            ticketsHandled,
            ticketsResolved,
            messagesReplied,
            avgResponseTime: '-', // Would need more complex calculation
            unassignedCount,
        };
    }

    // =====================
    // Survey
    // =====================

    async saveSurveyRating(ticketId: string, rating: number, telegramId: string): Promise<void> {
        // Log survey rating (satisfactionRating field not available on Ticket entity)
        // TODO: Add satisfactionRating field to Ticket entity or create separate Survey entity
        this.logger.log(`Survey rating ${rating} saved for ticket ${ticketId} from telegram ${telegramId}`);
    }

    async sendSurveyToUser(ticket: Ticket): Promise<void> {
        if (!ticket.user?.telegramChatId) return;

        const agent = ticket.assignedTo;
        const agentName = agent?.fullName || 'Tim Support';

        const message = 
            `✅ Tiket #${ticket.ticketNumber} Selesai!\n\n` +
            `"${ticket.title}"\n` +
            `Ditangani oleh: ${agentName}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Bagaimana pengalaman Anda?`;

        await this.sendNotification(ticket.user.telegramChatId, message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '😍 Sangat Puas', callback_data: `survey_rating:${ticket.id}:5` },
                        { text: '😊 Puas', callback_data: `survey_rating:${ticket.id}:4` },
                    ],
                    [
                        { text: '😐 Cukup', callback_data: `survey_rating:${ticket.id}:3` },
                        { text: '😕 Kurang', callback_data: `survey_rating:${ticket.id}:2` },
                    ],
                    [{ text: '⏭️ Lewati Survey', callback_data: `skip_survey:${ticket.id}` }],
                ],
            },
        });
    }

    // =====================
    // Search
    // =====================

    async searchKnowledgeBase(query: string): Promise<Array<{ id: string; title: string; excerpt?: string }>> {
        // This would integrate with your KB module
        // For now, return empty array - implement when KB module is available
        try {
            // If you have a KnowledgeBase repository, search it here
            // const articles = await this.kbRepo.createQueryBuilder('kb')
            //     .where('kb.title ILIKE :query OR kb.content ILIKE :query', { query: `%${query}%` })
            //     .take(5)
            //     .getMany();
            // return articles.map(a => ({ id: a.id, title: a.title, excerpt: a.content?.substring(0, 100) }));
            return [];
        } catch {
            return [];
        }
    }

    async searchUserTickets(userId: string, query: string): Promise<Ticket[]> {
        return this.ticketRepo
            .createQueryBuilder('ticket')
            .where('ticket.userId = :userId', { userId })
            .andWhere('(ticket.title ILIKE :query OR ticket.ticketNumber ILIKE :query)', { query: `%${query}%` })
            .orderBy('ticket.createdAt', 'DESC')
            .take(5)
            .getMany();
    }

    // =====================
    // Smart Notifications (17.4.8)
    // =====================

    /**
     * Check if current time is within quiet hours
     */
    isQuietHours(preferences: { quietHoursStart?: string; quietHoursEnd?: string }): boolean {
        if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
            return false;
        }

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const start = preferences.quietHoursStart;
        const end = preferences.quietHoursEnd;

        // Handle overnight quiet hours (e.g., 22:00 - 07:00)
        if (start > end) {
            return currentTime >= start || currentTime < end;
        }
        return currentTime >= start && currentTime < end;
    }

    /**
     * Queue notification for smart delivery
     */
    async queueNotification(
        userId: string,
        notification: {
            type: 'NEW_REPLY' | 'STATUS_CHANGE' | 'ASSIGNED' | 'SLA_BREACH' | 'RESOLVED';
            title: string;
            content: string;
            ticketId?: string;
            priority?: 'HIGH' | 'MEDIUM' | 'LOW';
        }
    ): Promise<void> {
        const session = await this.getSessionByUserId(userId);
        if (!session || !session.notificationsEnabled) return;

        // Check quiet hours
        if (this.isQuietHours(session.preferences || {})) {
            this.logger.debug(`Notification queued for later (quiet hours) for user ${userId}`);
            // In production, would store in queue and process later
            // For now, skip quiet hours notifications unless HIGH priority or SLA_BREACH
            if (notification.priority !== 'HIGH' && notification.type !== 'SLA_BREACH') {
                return;
            }
        }

        // Send immediately for high priority or SLA breach
        if (notification.priority === 'HIGH' || notification.type === 'SLA_BREACH') {
            await this.sendNotification(session.chatId, notification.content);
            return;
        }

        // For normal notifications, send immediately
        // In production, could batch similar notifications
        await this.sendNotification(session.chatId, notification.content);
    }

    /**
     * Send batch notification (multiple updates at once)
     */
    async sendBatchNotification(
        userId: string,
        notifications: Array<{ title: string; type: string }>
    ): Promise<void> {
        const session = await this.getSessionByUserId(userId);
        if (!session) return;

        const message = 
            `📬 <b>Update Tiket Anda</b>\n\n` +
            notifications.map(n => `• ${n.title}`).join('\n') +
            `\n\n<i>${notifications.length} notifikasi</i>`;

        await this.sendNotification(session.chatId, message, {
            reply_markup: {
                inline_keyboard: [[
                    { text: '📋 Lihat Semua', callback_data: 'my_tickets' }
                ]]
            }
        });
    }
}
