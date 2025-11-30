import { Update, Start, Help, Command, On, Ctx, Action, InlineQuery } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { TelegramService } from './telegram.service';
import { TelegramChatBridgeService } from './telegram-chat-bridge.service';
import { TelegramState } from './enums/telegram-state.enum';
import { Logger } from '@nestjs/common';
import { getTemplates } from './templates';

@Update()
export class TelegramUpdate {
    private readonly logger = new Logger(TelegramUpdate.name);

    constructor(
        private readonly telegramService: TelegramService,
        private readonly chatBridge: TelegramChatBridgeService,
    ) {
        this.logger.log('TelegramUpdate initialized');
    }

    // ========================================
    // SECTION 1: MAIN MENU & START
    // ========================================

    @Start()
    async onStart(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        try {
            await this.telegramService.getOrCreateSession(
                String(from.id),
                String(ctx.chat?.id),
                from
            );
            await this.showMainMenu(ctx);
        } catch (error) {
            this.logger.error('Error in onStart:', error);
            await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
        }
    }

    private async showMainMenu(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (session?.userId) {
            // User sudah terhubung - tampilkan menu lengkap
            const stats = await this.telegramService.getUserStats(session.userId);
            
            // Gunakan nama dari akun iDesk yang terhubung, bukan nama Telegram
            const userName = session.user?.fullName || session.telegramFirstName || 'User';
            
            await ctx.replyWithHTML(
                t.welcome.linkedGreeting(
                    userName,
                    stats.activeTickets,
                    stats.waitingReply
                ),
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🎫 Buat Tiket', 'new_ticket'),
                        Markup.button.callback('📋 Tiket Saya', 'my_tickets'),
                    ],
                    [
                        Markup.button.callback('💬 Chat Support', 'start_chat'),
                        Markup.button.callback('🔍 Cari KB', 'search_kb'),
                    ],
                    [
                        Markup.button.callback('⚙️ Pengaturan', 'settings'),
                        Markup.button.callback('❓ Bantuan', 'help'),
                    ],
                ])
            );
        } else {
            // User belum terhubung - minta link akun
            await ctx.replyWithHTML(
                t.welcome.unlinkedGreeting,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
                    [Markup.button.callback('❓ Bantuan', 'help')],
                ])
            );
        }
    }

    @Action('main_menu')
    async onMainMenu(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (from) {
            await this.telegramService.clearState(String(from.id));
            await this.chatBridge.exitChatMode(String(from.id));
        }
        await this.showMainMenu(ctx);
    }

    // ========================================
    // SECTION 2: HELP & INFO
    // ========================================

    @Command('help')
    @Help()
    async onHelp(@Ctx() ctx: Context) {
        const from = ctx.from;
        const session = from ? await this.telegramService.getSession(String(from.id)) : null;
        const t = getTemplates(session?.language || 'id');
        
        await ctx.replyWithHTML(t.help, Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
        ]));
    }

    @Action('help')
    async onHelpAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onHelp(ctx);
    }

    // ========================================
    // SECTION 3: ACCOUNT LINKING
    // ========================================

    @Command('link')
    async onLink(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (session?.userId) {
            await ctx.replyWithHTML(t.link.alreadyLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
            return;
        }

        await this.telegramService.setState(String(from.id), TelegramState.AWAITING_LINK_CODE);
        await ctx.replyWithHTML(t.link.instructions, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batal', 'main_menu')],
        ]));
    }

    @Action('enter_code')
    async onEnterCode(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        await this.telegramService.setState(String(from.id), TelegramState.AWAITING_LINK_CODE);
        await ctx.replyWithHTML(t.link.enterCode, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batal', 'main_menu')],
        ]));
    }

    @Command('unlink')
    async onUnlink(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.reply('ℹ️ Akun belum terhubung.');
            return;
        }

        await this.telegramService.unlinkAccount(String(from.id));
        await ctx.replyWithHTML(t.link.unlinked, Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Hubungkan Lagi', 'enter_code')],
        ]));
    }

    // ========================================
    // SECTION 4: TICKET CREATION
    // ========================================

    @Command('tiket')
    @Command('ticket')
    async onQuickTicket(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
            ]));
            return;
        }

        // Ambil teks setelah command
        const text = ((ctx.message as any)?.text || '').replace(/^\/(tiket|ticket)\s*/i, '').trim();

        if (!text) {
            // Tampilkan pilihan buat tiket
            await ctx.replyWithHTML(
                `📝 <b>Buat Tiket Baru</b>\n\nPilih cara membuat tiket:`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('⚡ Quick (1 pesan)', 'ticket_quick_guide')],
                    [Markup.button.callback('📝 Step-by-step', 'ticket_wizard')],
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
            return;
        }

        // Quick ticket dengan auto-kategorisasi
        try {
            const { category, priority } = this.analyzeTicketText(text);
            const ticket = await this.telegramService.createTicket(
                session,
                text.length > 100 ? text.substring(0, 97) + '...' : text,
                text,
                category,
                priority
            );

            await ctx.replyWithHTML(
                t.ticket.quickCreated(ticket.ticketNumber, ticket.title, ticket.category, ticket.priority),
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('💬 Chat', `enter_chat:${ticket.id}`),
                        Markup.button.callback('📋 Detail', `view_ticket:${ticket.id}`),
                    ],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );

            await this.telegramService.notifyNewTicketToAgents(ticket);
        } catch (error) {
            this.logger.error('Quick ticket error:', error);
            await ctx.reply(t.errors.serverError);
        }
    }

    @Action('new_ticket')
    async onNewTicketAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
            ]));
            return;
        }

        await ctx.replyWithHTML(
            `📝 <b>Buat Tiket Baru</b>\n\nPilih cara membuat tiket:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('⚡ Quick (1 pesan)', 'ticket_quick_guide')],
                [Markup.button.callback('📝 Step-by-step', 'ticket_wizard')],
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    @Action('ticket_quick_guide')
    async onTicketQuickGuide(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        const session = from ? await this.telegramService.getSession(String(from.id)) : null;
        const t = getTemplates(session?.language || 'id');

        await ctx.replyWithHTML(t.ticket.quickGuide, Markup.inlineKeyboard([
            [Markup.button.callback('📝 Step-by-step', 'ticket_wizard')],
            [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
        ]));
    }

    @Action('ticket_wizard')
    async onTicketWizard(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_TITLE);
        await ctx.replyWithHTML(t.ticket.wizardStep1, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batal', 'main_menu')],
        ]));
    }

    // ========================================
    // SECTION 5: TICKET LIST & DETAILS
    // ========================================

    @Command('list')
    @Command('mytickets')
    async onMyTickets(@Ctx() ctx: Context) {
        await this.showMyTickets(ctx);
    }

    @Action('my_tickets')
    async onMyTicketsAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.showMyTickets(ctx);
    }

    private async showMyTickets(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
            ]));
            return;
        }

        const tickets = await this.telegramService.getMyTickets(session.userId);

        if (tickets.length === 0) {
            await ctx.replyWithHTML(t.ticket.listEmpty, Markup.inlineKeyboard([
                [Markup.button.callback('🎫 Buat Tiket', 'new_ticket')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
            return;
        }

        let message = `📋 <b>Tiket Saya</b> (${tickets.length})\n\n`;
        const buttons: any[][] = [];

        tickets.slice(0, 10).forEach((ticket, i) => {
            const statusEmoji = this.getStatusEmoji(ticket.status);
            message += `${i + 1}. ${statusEmoji} <b>#${ticket.ticketNumber}</b>\n`;
            message += `   ${ticket.title.substring(0, 40)}${ticket.title.length > 40 ? '...' : ''}\n\n`;
            
            buttons.push([
                Markup.button.callback(`${statusEmoji} #${ticket.ticketNumber}`, `view_ticket:${ticket.id}`)
            ]);
        });

        buttons.push([
            Markup.button.callback('🎫 Buat Tiket Baru', 'new_ticket'),
        ]);
        buttons.push([
            Markup.button.callback('🏠 Menu Utama', 'main_menu'),
        ]);

        await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
    }

    @Action(/view_ticket:(.+)/)
    async onViewTicket(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const ticketId = (ctx as any).match[1];

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) {
            await ctx.reply('❌ Tiket tidak ditemukan.');
            return;
        }

        const statusEmoji = this.getStatusEmoji(ticket.status);
        const priorityEmoji = this.getPriorityEmoji(ticket.priority);
        const createdAt = new Date(ticket.createdAt).toLocaleDateString('id-ID');

        await ctx.replyWithHTML(
            `📋 <b>Detail Tiket</b>\n\n` +
            `<b>#${ticket.ticketNumber}</b>\n` +
            `📌 ${ticket.title}\n\n` +
            `${statusEmoji} Status: <b>${ticket.status}</b>\n` +
            `${priorityEmoji} Prioritas: <b>${ticket.priority}</b>\n` +
            `📁 Kategori: ${ticket.category}\n` +
            `👤 Agent: ${ticket.assignedTo?.fullName || 'Belum ada'}\n` +
            `📅 Dibuat: ${createdAt}\n\n` +
            (ticket.description ? `📝 ${ticket.description.substring(0, 200)}${ticket.description.length > 200 ? '...' : ''}` : ''),
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('💬 Chat', `enter_chat:${ticket.id}`),
                    Markup.button.callback('⚡ Prioritas', `change_priority:${ticket.id}`),
                ],
                [
                    Markup.button.callback('◀️ Kembali', 'my_tickets'),
                    Markup.button.callback('🏠 Menu', 'main_menu'),
                ],
            ])
        );
    }

    @Action(/change_priority:(.+)/)
    async onChangePriority(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const ticketId = (ctx as any).match[1];

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) {
            await ctx.reply('❌ Tiket tidak ditemukan.');
            return;
        }

        await ctx.replyWithHTML(
            `⚡ <b>Ubah Prioritas</b>\n\n` +
            `Tiket: <b>#${ticket.ticketNumber}</b>\n` +
            `Saat ini: <b>${ticket.priority}</b>`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🟢 Low', `set_priority:${ticketId}:LOW`),
                    Markup.button.callback('🟡 Medium', `set_priority:${ticketId}:MEDIUM`),
                ],
                [
                    Markup.button.callback('🟠 High', `set_priority:${ticketId}:HIGH`),
                    Markup.button.callback('🔴 Critical', `set_priority:${ticketId}:CRITICAL`),
                ],
                [Markup.button.callback('❌ Batal', `view_ticket:${ticketId}`)],
            ])
        );
    }

    @Action(/set_priority:(.+):(.+)/)
    async onSetPriority(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const [ticketId, priority] = (ctx as any).match.slice(1);

        const result = await this.telegramService.updateTicketPriority(ticketId, priority);
        if (result.success) {
            await ctx.replyWithHTML(
                `✅ Prioritas tiket diubah ke <b>${priority}</b>`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('📋 Lihat Tiket', `view_ticket:${ticketId}`)],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        } else {
            await ctx.reply(`❌ ${result.message || 'Gagal mengubah prioritas'}`);
        }
    }

    // ========================================
    // SECTION 6: CHAT MODE
    // ========================================

    @Command('chat')
    async onChat(@Ctx() ctx: Context) {
        await this.startChatMode(ctx);
    }

    @Action('start_chat')
    async onStartChatAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.startChatMode(ctx);
    }

    private async startChatMode(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
            ]));
            return;
        }

        const tickets = await this.chatBridge.getActiveTickets(session.userId);

        if (tickets.length === 0) {
            await ctx.replyWithHTML(t.chat.noActiveTickets, Markup.inlineKeyboard([
                [Markup.button.callback('🎫 Buat Tiket', 'new_ticket')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
            return;
        }

        if (tickets.length === 1) {
            // Langsung masuk chat jika hanya ada 1 tiket
            await this.enterChat(ctx, tickets[0].id);
            return;
        }

        // Pilih tiket untuk chat
        const buttons = tickets.slice(0, 5).map(ticket => [
            Markup.button.callback(
                `${this.getStatusEmoji(ticket.status)} #${ticket.ticketNumber}`,
                `enter_chat:${ticket.id}`
            )
        ]);
        buttons.push([Markup.button.callback('🏠 Menu Utama', 'main_menu')]);

        await ctx.replyWithHTML(t.chat.selectTicket, Markup.inlineKeyboard(buttons));
    }

    @Action(/enter_chat:(.+)/)
    async onEnterChat(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const ticketId = (ctx as any).match[1];
        await this.enterChat(ctx, ticketId);
    }

    private async enterChat(ctx: Context, ticketId: string) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        const result = await this.chatBridge.enterChatMode(String(from.id), ticketId);
        if (!result.success) {
            await ctx.reply(`❌ ${result.message}`);
            return;
        }

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) return;

        await ctx.replyWithHTML(
            t.chat.modeActive(ticket.ticketNumber, ticket.title),
            Markup.inlineKeyboard([
                [Markup.button.callback('🛑 Keluar Chat', 'exit_chat')],
                [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticketId}`)],
            ])
        );
    }

    @Command('end')
    @Command('endchat')
    async onEndChat(@Ctx() ctx: Context) {
        await this.exitChat(ctx);
    }

    @Action('exit_chat')
    async onExitChat(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.exitChat(ctx);
    }

    private async exitChat(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        const activeTicket = await this.chatBridge.getActiveChatTicket(String(from.id));
        if (!activeTicket) {
            await ctx.replyWithHTML(t.chat.noActiveChat, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
            return;
        }

        await this.chatBridge.exitChatMode(String(from.id));
        await ctx.replyWithHTML(
            t.chat.modeEnded(activeTicket.ticketNumber),
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 Tiket Saya', 'my_tickets')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    // ========================================
    // SECTION 7: SETTINGS
    // ========================================

    @Command('settings')
    async onSettings(@Ctx() ctx: Context) {
        await this.showSettings(ctx);
    }

    @Action('settings')
    async onSettingsAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.showSettings(ctx);
    }

    private async showSettings(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!session?.userId) {
            await ctx.replyWithHTML(t.errors.notLinked, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
            ]));
            return;
        }

        const notifEnabled = session.notificationsEnabled ?? true;
        const lang = session.language || 'id';

        await ctx.replyWithHTML(
            `⚙️ <b>Pengaturan</b>\n\n` +
            `🔔 Notifikasi: ${notifEnabled ? '✅ Aktif' : '❌ Nonaktif'}\n` +
            `🌐 Bahasa: ${lang === 'en' ? 'English' : 'Indonesia'}`,
            Markup.inlineKeyboard([
                [Markup.button.callback(notifEnabled ? '🔕 Matikan Notif' : '🔔 Aktifkan Notif', 'toggle_notifications')],
                [Markup.button.callback('🌐 Ganti Bahasa', 'change_language')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    @Action('toggle_notifications')
    async onToggleNotifications(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const newValue = !(session?.notificationsEnabled ?? true);

        await this.telegramService.updateSessionPreferences(String(from.id), {
            notificationsEnabled: newValue
        });

        await ctx.replyWithHTML(
            newValue ? '🔔 Notifikasi <b>diaktifkan</b>' : '🔕 Notifikasi <b>dinonaktifkan</b>',
            Markup.inlineKeyboard([
                [Markup.button.callback('⚙️ Kembali ke Pengaturan', 'settings')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    @Action('change_language')
    async onChangeLanguage(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await ctx.replyWithHTML(
            `🌐 <b>Pilih Bahasa / Select Language</b>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🇮🇩 Indonesia', 'set_language:id')],
                [Markup.button.callback('🇬🇧 English', 'set_language:en')],
                [Markup.button.callback('❌ Batal', 'settings')],
            ])
        );
    }

    @Action(/set_language:(.+)/)
    async onSetLanguage(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const lang = (ctx as any).match[1];
        await this.telegramService.updateSessionPreferences(String(from.id), { language: lang });

        const t = getTemplates(lang);
        await ctx.replyWithHTML(
            `✅ ${lang === 'en' ? 'Language changed to English' : 'Bahasa diubah ke Indonesia'}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('⚙️ ' + t.btn.settings, 'settings')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    @Command('bahasa')
    @Command('language')
    async onLanguageCommand(@Ctx() ctx: Context) {
        await ctx.replyWithHTML(
            `🌐 <b>Pilih Bahasa / Select Language</b>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🇮🇩 Indonesia', 'set_language:id')],
                [Markup.button.callback('🇬🇧 English', 'set_language:en')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    // ========================================
    // SECTION 8: SEARCH
    // ========================================

    @Command('cari')
    @Command('search')
    async onSearch(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const query = ((ctx.message as any)?.text || '').replace(/^\/(cari|search)\s*/i, '').trim();
        
        if (!query) {
            await ctx.replyWithHTML(
                `🔍 <b>Cari Knowledge Base</b>\n\n` +
                `Ketik: <code>/cari [kata kunci]</code>\n\n` +
                `<i>Contoh: /cari reset password</i>`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        const results = await this.telegramService.searchKnowledgeBase(query);
        
        if (results.length === 0) {
            await ctx.replyWithHTML(
                `🔍 Tidak ditemukan hasil untuk "<b>${query}</b>"`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🎫 Buat Tiket', 'new_ticket')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        let message = `🔍 <b>Hasil Pencarian: "${query}"</b>\n\n`;
        results.forEach((r, i) => {
            message += `${i + 1}. 📄 ${r.title}\n`;
            if (r.excerpt) message += `   ${r.excerpt.substring(0, 50)}...\n`;
            message += '\n';
        });

        await ctx.replyWithHTML(message, Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
        ]));
    }

    @Action('search_kb')
    async onSearchKbAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await ctx.replyWithHTML(
            `🔍 <b>Cari Knowledge Base</b>\n\n` +
            `Ketik: <code>/cari [kata kunci]</code>\n\n` +
            `<i>Contoh: /cari reset password</i>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    // ========================================
    // SECTION 9: AGENT COMMANDS
    // ========================================

    @Command('queue')
    async onQueue(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Hubungkan akun terlebih dahulu dengan /link');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const tickets = await this.telegramService.getUnassignedTickets();
        if (tickets.length === 0) {
            await ctx.reply('📭 Tidak ada tiket dalam antrian.');
            return;
        }

        let message = `📋 <b>Antrian Tiket</b> (${tickets.length})\n\n`;
        const buttons: any[][] = [];

        tickets.slice(0, 10).forEach((ticket, i) => {
            const priorityEmoji = this.getPriorityEmoji(ticket.priority);
            message += `${i + 1}. ${priorityEmoji} <b>#${ticket.ticketNumber}</b>\n`;
            message += `   ${ticket.title.substring(0, 40)}...\n\n`;
            
            buttons.push([
                Markup.button.callback(`✋ Ambil #${ticket.ticketNumber}`, `assign_ticket:${ticket.id}`)
            ]);
        });

        buttons.push([Markup.button.callback('🏠 Menu Utama', 'main_menu')]);
        await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
    }

    @Action(/assign_ticket:(.+)/)
    async onAssignTicketAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const ticketId = (ctx as any).match[1];
        const session = await this.telegramService.getSession(String(from.id));

        if (!session?.userId) {
            await ctx.reply('⚠️ Hubungkan akun terlebih dahulu.');
            return;
        }

        const result = await this.telegramService.assignTicketToAgentById(ticketId, session.userId);
        if (result.success) {
            await ctx.replyWithHTML(
                `✅ <b>Tiket Diambil!</b>\n\n#${result.ticketNumber} sekarang Anda tangani.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('💬 Balas', `enter_chat:${ticketId}`)],
                    [Markup.button.callback('📋 Antrian', 'queue_action')],
                ])
            );
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    @Command('stats')
    async onStats(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Hubungkan akun terlebih dahulu.');
            return;
        }

        const isAgent = await this.telegramService.checkIsAgent(session.userId);
        if (!isAgent) {
            await ctx.reply('❌ Perintah ini hanya untuk Agent/Admin.');
            return;
        }

        const stats = await this.telegramService.getAgentStats(session.userId);
        await ctx.replyWithHTML(
            `📊 <b>Statistik Hari Ini</b>\n\n` +
            `📋 Tiket Ditangani: <b>${stats.ticketsHandled}</b>\n` +
            `✅ Tiket Selesai: <b>${stats.ticketsResolved}</b>\n` +
            `💬 Pesan Dibalas: <b>${stats.messagesReplied}</b>\n` +
            `📈 Belum Diassign: <b>${stats.unassignedCount}</b>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 Lihat Antrian', 'queue_action')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    @Action('queue_action')
    async onQueueAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onQueue(ctx);
    }

    // ========================================
    // SECTION 10: TEXT & MEDIA HANDLERS
    // ========================================

    @On('text')
    async onText(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const text = (ctx.message as any).text;
        if (text.startsWith('/')) return; // Ignore commands

        const session = await this.telegramService.getSession(String(from.id));
        if (!session) return;

        // Handle based on state
        switch (session.state) {
            case TelegramState.AWAITING_LINK_CODE:
                await this.handleLinkCode(ctx, text);
                break;

            case TelegramState.CREATING_TICKET_TITLE:
                await this.handleTicketTitle(ctx, text);
                break;

            case TelegramState.CREATING_TICKET_DESCRIPTION:
                await this.handleTicketDescription(ctx, text);
                break;

            case TelegramState.CHAT_MODE:
                await this.handleChatMessage(ctx, text);
                break;

            default:
                // Jika tidak ada state, abaikan atau tampilkan menu
                break;
        }
    }

    private async handleLinkCode(ctx: Context, code: string) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (!/^\d{6}$/.test(code)) {
            await ctx.replyWithHTML(t.link.invalidFormat);
            return;
        }

        const result = await this.telegramService.linkAccountByCode(String(from.id), code);
        await this.telegramService.clearState(String(from.id));

        if (result.success) {
            await ctx.replyWithHTML(t.link.success(result.userName || 'User'), Markup.inlineKeyboard([
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
        } else {
            await ctx.replyWithHTML(`❌ ${result.message || t.link.failed}`, Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Coba Lagi', 'enter_code')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ]));
        }
    }

    private async handleTicketTitle(ctx: Context, title: string) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (title.length < 5) {
            await ctx.replyWithHTML(t.errors.titleTooShort);
            return;
        }

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_DESCRIPTION, { title });
        await ctx.replyWithHTML(t.ticket.wizardStep2(title), Markup.inlineKeyboard([
            [Markup.button.callback('❌ Batal', 'main_menu')],
        ]));
    }

    private async handleTicketDescription(ctx: Context, description: string) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        if (description.length < 10) {
            await ctx.replyWithHTML(t.errors.descTooShort);
            return;
        }

        const stateData = session?.stateData || {};
        const title = stateData.title || description.substring(0, 100);

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_CATEGORY, {
            title,
            description
        });

        await ctx.replyWithHTML(
            `✅ Judul: <b>${title}</b>\n\n📁 Pilih kategori:`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('💻 Hardware', 'select_category:HARDWARE'),
                    Markup.button.callback('🖥️ Software', 'select_category:SOFTWARE'),
                ],
                [
                    Markup.button.callback('🌐 Network', 'select_category:NETWORK'),
                    Markup.button.callback('📧 Email', 'select_category:EMAIL'),
                ],
                [
                    Markup.button.callback('👤 Account', 'select_category:ACCOUNT'),
                    Markup.button.callback('🔧 Lainnya', 'select_category:GENERAL'),
                ],
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    @Action(/select_category:(.+)/)
    async onSelectCategory(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const category = (ctx as any).match[1];
        const session = await this.telegramService.getSession(String(from.id));
        const stateData = session?.stateData || {};

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_PRIORITY, {
            ...stateData,
            category
        });

        await ctx.replyWithHTML(
            `✅ Kategori: <b>${category}</b>\n\n⚡ Pilih prioritas:`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🟢 Low', 'select_priority:LOW'),
                    Markup.button.callback('🟡 Medium', 'select_priority:MEDIUM'),
                ],
                [
                    Markup.button.callback('🟠 High', 'select_priority:HIGH'),
                    Markup.button.callback('🔴 Critical', 'select_priority:CRITICAL'),
                ],
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    @Action(/select_priority:(.+)/)
    async onSelectPriority(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const priority = (ctx as any).match[1];
        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');
        const stateData = session?.stateData || {};

        if (!session?.userId) {
            await ctx.reply(t.errors.notLinked);
            return;
        }

        try {
            const ticket = await this.telegramService.createTicket(
                session,
                stateData.title || 'Tiket Baru',
                stateData.description || stateData.title || 'Tiket Baru',
                stateData.category || 'GENERAL',
                priority
            );

            await this.telegramService.clearState(String(from.id));

            await ctx.replyWithHTML(
                t.ticket.created(ticket.ticketNumber, ticket.title, ticket.category, ticket.priority),
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('💬 Chat', `enter_chat:${ticket.id}`),
                        Markup.button.callback('📋 Detail', `view_ticket:${ticket.id}`),
                    ],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );

            await this.telegramService.notifyNewTicketToAgents(ticket);
        } catch (error) {
            this.logger.error('Ticket creation error:', error);
            await ctx.reply(t.errors.serverError);
        }
    }

    private async handleChatMessage(ctx: Context, message: string) {
        const from = ctx.from;
        if (!from) return;

        const messageId = (ctx.message as any).message_id;
        const result = await this.chatBridge.forwardToTicket(
            String(from.id),
            String(ctx.chat?.id),
            message,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    @On('photo')
    async onPhoto(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (session?.state !== TelegramState.CHAT_MODE) {
            await ctx.reply('ℹ️ Foto hanya dapat dikirim dalam mode chat. Gunakan /chat');
            return;
        }

        const photo = (ctx.message as any).photo;
        const caption = (ctx.message as any).caption || '';
        const fileId = photo[photo.length - 1].file_id;
        const messageId = (ctx.message as any).message_id;

        const result = await this.chatBridge.forwardPhotoToTicket(
            String(from.id),
            String(ctx.chat?.id),
            fileId,
            caption,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    @On('document')
    async onDocument(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (session?.state !== TelegramState.CHAT_MODE) {
            await ctx.reply('ℹ️ Dokumen hanya dapat dikirim dalam mode chat. Gunakan /chat');
            return;
        }

        const document = (ctx.message as any).document;
        const caption = (ctx.message as any).caption || '';
        const messageId = (ctx.message as any).message_id;

        const result = await this.chatBridge.forwardDocumentToTicket(
            String(from.id),
            String(ctx.chat?.id),
            document.file_id,
            document.file_name,
            caption,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    @On('voice')
    async onVoice(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (session?.state !== TelegramState.CHAT_MODE) {
            await ctx.replyWithHTML(
                `🎤 <b>Pesan Suara</b>\n\nPesan suara hanya dapat dikirim dalam mode chat.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('💬 Mulai Chat', 'start_chat')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        const voice = (ctx.message as any).voice;
        const messageId = (ctx.message as any).message_id;

        const result = await this.chatBridge.handleVoice(
            String(from.id),
            String(ctx.chat?.id),
            voice.file_id,
            voice.duration,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    @Command('cancel')
    async onCancel(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const t = getTemplates(session?.language || 'id');

        await this.telegramService.clearState(String(from.id));
        await this.chatBridge.exitChatMode(String(from.id));

        await ctx.replyWithHTML(t.errors.cancelled, Markup.inlineKeyboard([
            [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
        ]));
    }

    // ========================================
    // HELPER METHODS
    // ========================================

    private analyzeTicketText(text: string): { category: string; priority: string } {
        const lowerText = text.toLowerCase();
        
        let category = 'GENERAL';
        if (/printer|laptop|komputer|mouse|keyboard|monitor|pc|hardware/i.test(lowerText)) {
            category = 'HARDWARE';
        } else if (/wifi|internet|network|jaringan|koneksi|vpn|lan/i.test(lowerText)) {
            category = 'NETWORK';
        } else if (/email|outlook|gmail|mail/i.test(lowerText)) {
            category = 'EMAIL';
        } else if (/password|login|akun|account|lupa|reset|user/i.test(lowerText)) {
            category = 'ACCOUNT';
        } else if (/aplikasi|software|install|update|error|crash|app/i.test(lowerText)) {
            category = 'SOFTWARE';
        }

        let priority = 'MEDIUM';
        if (/urgent|segera|darurat|critical|penting|emergency|asap/i.test(lowerText)) {
            priority = 'HIGH';
        } else if (/tidak bisa|error|gagal|rusak|mati|down|broken/i.test(lowerText)) {
            priority = 'MEDIUM';
        } else if (/tolong|mohon|bisa|request|minta|pertanyaan/i.test(lowerText)) {
            priority = 'LOW';
        }

        return { category, priority };
    }

    private getStatusEmoji(status: string): string {
        const map: Record<string, string> = {
            'TODO': '🔵',
            'IN_PROGRESS': '🟡',
            'WAITING_VENDOR': '🟠',
            'RESOLVED': '🟢',
            'CANCELLED': '🔴',
        };
        return map[status] || '⚪';
    }

    private getPriorityEmoji(priority: string): string {
        const map: Record<string, string> = {
            'LOW': '🟢',
            'MEDIUM': '🟡',
            'HIGH': '🟠',
            'CRITICAL': '🔴',
        };
        return map[priority] || '⚪';
    }
}
