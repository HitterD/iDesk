import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DeepPartial } from 'typeorm';
import { IChatPlatform } from './domain/ports/chat-platform.interface';
import { Ticket, TicketStatus, TicketSource, TicketPriority } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { CustomerSession } from '../users/entities/customer-session.entity';
import { EventsGateway } from './presentation/gateways/events.gateway';

import { MailerService } from '@nestjs-modules/mailer';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { SurveysService } from './surveys.service';

@Injectable()
export class TicketService {
    constructor(
        @Inject('ChatPlatform')
        private readonly chatPlatform: IChatPlatform,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(CustomerSession)
        private readonly sessionRepo: Repository<CustomerSession>,
        private readonly eventsGateway: EventsGateway,
        private readonly mailerService: MailerService,
        private readonly kbService: KnowledgeBaseService,
        private readonly surveysService: SurveysService,
    ) { }

    async handleTelegramWebhook(update: any) {
        const { message, callback_query } = update;

        if (callback_query) {
            await this.handleCallbackQuery(callback_query);
            return;
        }

        if (!message || !message.text) return;

        const chatId = message.chat.id.toString();
        const text = message.text;

        let session = await this.sessionRepo.findOne({ where: { telegramId: chatId }, relations: ['user'] });

        if (!session) {
            // Check if user exists by telegramId (if stored in user table) or create new guest session
            // For now, simple session creation
            session = this.sessionRepo.create({
                telegramId: chatId,
                state: 'INIT',
                tempData: {},
            });
            await this.sessionRepo.save(session);
        }

        // State Machine
        switch (session.state) {
            case 'INIT':
                if (text === '/start') {
                    await this.chatPlatform.sendMessage(chatId, '👋 Selamat datang di Helpdesk! Ada yang bisa kami bantu?', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🆕 Buat Tiket Baru', callback_data: 'MENU_CREATE_TICKET' }],
                                [{ text: '🔍 Cek Status Tiket', callback_data: 'CHECK_STATUS' }],
                                [{ text: '❓ Bantuan', callback_data: 'HELP_FAQ' }],
                            ],
                        },
                    });
                } else {
                    await this.chatPlatform.sendMessage(chatId, 'Ketik /start untuk memulai menu utama.');
                }
                break;

            case 'WAITING_FOR_DESCRIPTION':
                await this.handleTicketCreation(session, text, chatId);
                break;

            default:
                await this.chatPlatform.sendMessage(chatId, 'Perintah tidak dikenali. Ketik /start.');
                break;
        }
    }

    private async resetSession(session: CustomerSession) {
        session.state = 'INIT';
        session.tempData = {};
        await this.sessionRepo.save(session);
    }

    private async handleCallbackQuery(callbackQuery: any) {
        const chatId = callbackQuery.message.chat.id.toString();
        const action = callbackQuery.data;
        const session = await this.sessionRepo.findOne({ where: { telegramId: chatId }, relations: ['user'] });

        if (!session) return;

        switch (action) {
            case 'MENU_CREATE_TICKET':
                await this.chatPlatform.sendMessage(chatId, 'Pilih kategori masalah Anda:', {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🖥️ Hardware', callback_data: 'CAT_HARDWARE' }],
                            [{ text: '💾 Software', callback_data: 'CAT_SOFTWARE' }],
                            [{ text: '🌐 Jaringan', callback_data: 'CAT_NETWORK' }],
                            [{ text: '❌ Batal', callback_data: 'MENU_MAIN' }],
                        ],
                    },
                });
                break;

            case 'CAT_HARDWARE':
            case 'CAT_SOFTWARE':
            case 'CAT_NETWORK':
                session.state = 'WAITING_FOR_DESCRIPTION';
                session.tempData = { category: action.replace('CAT_', '') };
                await this.sessionRepo.save(session);
                await this.chatPlatform.sendMessage(chatId, 'Silakan ketik detail masalah Anda sekarang. 📝');
                break;

            case 'CHECK_STATUS':
                const tickets = await this.ticketRepo.find({
                    where: { userId: session.user.id, status: Not(TicketStatus.RESOLVED) },
                    take: 5,
                    order: { createdAt: 'DESC' }
                });

                if (tickets.length === 0) {
                    await this.chatPlatform.sendMessage(chatId, 'Anda tidak memiliki tiket aktif saat ini. ✅');
                } else {
                    let msg = '📂 **Tiket Aktif Anda:**\n';
                    tickets.forEach(t => {
                        msg += `\n🆔 #${t.id.split('-')[0]}\n📌 ${t.title}\nstat: ${t.status}\n`;
                    });
                    await this.chatPlatform.sendMessage(chatId, msg);
                }
                break;

            case 'HELP_FAQ':
                await this.chatPlatform.sendMessage(chatId, '❓ **Bantuan**\n\nHubungi admin di admin@antigravity.com jika butuh bantuan mendesak.');
                break;
        }
    }

    private async handleTicketCreation(session: CustomerSession, text: string, chatId: string) {
        const category = session.tempData?.category || 'GENERAL';

        const ticket = this.ticketRepo.create({
            title: `[${category}] ${text.substring(0, 30)}...`,
            description: text,
            status: TicketStatus.TODO,
            priority: TicketPriority.MEDIUM,
            source: TicketSource.TELEGRAM,
            user: session.user,
        });
        await this.ticketRepo.save(ticket);

        // Save initial message
        const message = this.messageRepo.create({
            content: text,
            ticket,
            senderId: session.user.id,
        });
        await this.messageRepo.save(message);

        // Notify Frontend
        this.eventsGateway.server.emit('NEW_MESSAGE', message);

        // Reset Session
        await this.resetSession(session);

        // Send Success Message
        await this.chatPlatform.sendMessage(chatId, `✅ **Tiket Berhasil Dibuat!**\n\n🆔 ID: #${ticket.id.split('-')[0]}\n📂 Kategori: ${category}\n\nTim kami akan segera memprosesnya.`);
    }

    async findMessages(ticketId: string) {
        return this.messageRepo.find({
            where: { ticketId },
            relations: ['sender'],
            order: { createdAt: 'ASC' },
        });
    }

    async updateTicket(ticketId: string, updateData: Partial<Ticket>, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        const changes: string[] = [];

        if (updateData.status && updateData.status !== ticket.status) {
            changes.push(`Status changed from ${ticket.status} to ${updateData.status}`);
        }

        if (updateData.priority && updateData.priority !== ticket.priority) {
            changes.push(`Priority changed from ${ticket.priority} to ${updateData.priority}`);
        }

        // Apply updates
        Object.assign(ticket, updateData);
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log changes as system messages
        if (changes.length > 0) {
            const systemMessageContent = `System: ${changes.join(', ')} by ${user.fullName}`;
            const systemMessage = this.messageRepo.create({
                content: systemMessageContent,
                ticket: savedTicket,
                senderId: user.id,
                isSystemMessage: true,
            });
            await this.messageRepo.save(systemMessage);

            this.eventsGateway.server.emit('ticket:updated', { ticketId });

            // Send Email Notification
            if (ticket.user && ticket.user.email) {
                try {
                    await this.mailerService.sendMail({
                        to: ticket.user.email,
                        subject: `Ticket Updated: #${ticket.id}`,
                        template: 'ticket-update',
                        context: {
                            name: ticket.user.fullName,
                            ticketId: ticket.id,
                            status: ticket.status,
                            title: ticket.title,
                        },
                    });
                } catch (emailError) {
                    console.error(`Failed to send ticket update email to ${ticket.user.email}:`, emailError);
                }
            }

            // Send Telegram Notification
            const session = await this.sessionRepo.findOne({ where: { userId: ticket.user.id } });
            if (session) {
                let emoji = 'ℹ️';
                if (ticket.status === TicketStatus.RESOLVED) emoji = '✅';
                if (ticket.status === TicketStatus.IN_PROGRESS) emoji = '🚧';

                const msg = `${emoji} **Status Tiket Diperbarui**\n\n🆔 #${ticket.id.split('-')[0]}\n📌 ${ticket.title}\nSTAT: ${ticket.status}\n\n${changes.join('\n')}`;
                await this.chatPlatform.sendMessage(session.telegramId, msg);
            }

            // Trigger Survey if Resolved
            if (ticket.status === TicketStatus.RESOLVED) {
                const survey = await this.surveysService.createSurvey(ticket);
                // Notify User with Survey Link
                if (ticket.user && ticket.user.email) {
                    // Email logic already handled in createSurvey (mocked)
                }
                if (session) {
                    const surveyLink = `http://localhost:5173/feedback?token=${survey.token}`;
                    await this.chatPlatform.sendMessage(session.telegramId, `🌟 **Kami Butuh Masukan Anda!**\n\nTiket Anda telah selesai. Seberapa puas Anda dengan layanan kami?\n\nKlik link ini untuk memberi rating:\n${surveyLink}`);
                }
            }
        }

        return savedTicket;
    }
    async createTicket(userId: string, createTicketDto: any): Promise<Ticket> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        const ticket = this.ticketRepo.create({
            ...createTicketDto,
            user,
            status: TicketStatus.TODO,
            source: TicketSource.WEB,
        } as DeepPartial<Ticket>);

        return this.ticketRepo.save(ticket);
    }

    async findAll(userId: string, role: UserRole): Promise<Ticket[]> {
        if (role === UserRole.ADMIN || role === UserRole.AGENT) {
            return this.ticketRepo.find({ relations: ['user'], order: { createdAt: 'DESC' } });
        }
        return this.ticketRepo.find({
            where: { user: { id: userId } },
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
    }

    async getMessages(ticketId: string): Promise<TicketMessage[]> {
        return this.findMessages(ticketId);
    }

    async replyToTicket(ticketId: string, userId: string, content: string, files: string[] = [], mentionedUserIds: string[] = []) {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Create Message
        const message = this.messageRepo.create({
            ticketId,
            senderId: userId,
            content,
            attachments: files,
        });

        await this.messageRepo.save(message);

        // Update Ticket Status if Agent replies
        if (user.role === UserRole.AGENT && ticket.status === TicketStatus.TODO) {
            ticket.status = TicketStatus.IN_PROGRESS;
            await this.ticketRepo.save(ticket);
        }

        // Notify frontend
        this.eventsGateway.server.emit('NEW_MESSAGE', message);

        // Handle Mentions (Explicit IDs)
        if (mentionedUserIds && mentionedUserIds.length > 0) {
            for (const mentionedUserId of mentionedUserIds) {
                // Don't notify self
                if (mentionedUserId === userId) continue;

                const mentionedUser = await this.userRepo.findOne({ where: { id: mentionedUserId } });
                if (mentionedUser && mentionedUser.email) {
                    try {
                        await this.mailerService.sendMail({
                            to: mentionedUser.email,
                            subject: `You were mentioned in Ticket #${ticket.id}`,
                            template: 'mention-notification',
                            context: {
                                name: mentionedUser.fullName,
                                ticketId: ticket.id,
                                mentionedBy: user.fullName,
                                link: `http://localhost:5173/admin/tickets/${ticket.id}`,
                            },
                        });
                        console.log(`[Mention] Notification sent to ${mentionedUser.email}`);
                    } catch (error) {
                        console.error(`Failed to send mention email to ${mentionedUser.email}`, error);
                    }
                }
            }
        }

        // Send email if agent replied (Standard notification)
        if (user.role === UserRole.AGENT || user.role === UserRole.ADMIN) {
            if (ticket.user && ticket.user.email && (!mentionedUserIds || !mentionedUserIds.includes(ticket.user.id))) {
                try {
                    await this.mailerService.sendMail({
                        to: ticket.user.email,
                        subject: `New Reply on Ticket #${ticket.id}`,
                        template: 'ticket-update',
                        context: {
                            name: ticket.user.fullName,
                            ticketId: ticket.id,
                            status: ticket.status,
                            title: ticket.title,
                        },
                    });
                } catch (emailError) {
                    console.error(`Failed to send reply email to ${ticket.user.email}:`, emailError);
                }
            }
        }

        return message;
    }

    async assignTicket(ticketId: string, assigneeId: string, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new Error('Ticket not found');
        }

        const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
        if (!assignee) {
            throw new Error('Assignee not found');
        }

        if (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN) {
            throw new Error('Assignee must be an AGENT or ADMIN');
        }

        const assigner = await this.userRepo.findOne({ where: { id: userId } });
        if (!assigner) {
            throw new Error('Assigner not found');
        }

        const oldAssigneeName = ticket.assignedTo ? ticket.assignedTo.fullName : 'Unassigned';
        ticket.assignedTo = assignee;
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log system message
        const systemMessageContent = `System: Ticket assigned to ${assignee.fullName} (was ${oldAssigneeName}) by ${assigner.fullName}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: assigner.id,
            isSystemMessage: true,
        });
        await this.messageRepo.save(systemMessage);

        this.eventsGateway.server.emit('ticket:updated', { ticketId });
        this.eventsGateway.server.emit('NEW_MESSAGE', systemMessage);

        // Notify Assignee via Email
        if (assignee.email) {
            try {
                await this.mailerService.sendMail({
                    to: assignee.email,
                    subject: `Ticket Assigned to You: #${ticket.id}`,
                    template: 'ticket-update',
                    context: {
                        name: assignee.fullName,
                        ticketId: ticket.id,
                        status: ticket.status,
                        title: ticket.title,
                        message: `You have been assigned to this ticket by ${assigner.fullName}.`,
                    },
                });
            } catch (error) {
                console.error(`Failed to send assignment email to ${assignee.email}`, error);
            }
        }

        return savedTicket;
    }
}
