import { Update, Start, Help, Command, On, Ctx, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { TelegramService } from './telegram.service';
import { TelegramChatBridgeService } from './telegram-chat-bridge.service';
import { TelegramState } from './enums/telegram-state.enum';
import { Logger } from '@nestjs/common';

@Update()
export class TelegramUpdate {
    private readonly logger = new Logger(TelegramUpdate.name);

    constructor(
        private readonly telegramService: TelegramService,
        private readonly chatBridge: TelegramChatBridgeService,
    ) {
        this.logger.log('TelegramUpdate handler registered');
    }

    // =====================
    // Main Menu & Navigation
    // =====================

    @Start()
    async onStart(@Ctx() ctx: Context) {
        this.logger.log('Received /start command');
        
        try {
            const from = ctx.from;
            if (!from) return;

            await this.telegramService.getOrCreateSession(
                String(from.id),
                String(ctx.chat?.id),
                from
            );

            await this.showMainMenu(ctx);
        } catch (error) {
            this.logger.error('Error in onStart:', error);
            await ctx.reply('❌ Maaf, terjadi kesalahan. Silakan coba lagi.');
        }
    }

    private async showMainMenu(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        const isLinked = session?.userId;

        if (isLinked) {
            const message = 
                `🏠 <b>Menu Utama</b>\n\n` +
                `Halo! Selamat datang di <b>iDesk Support</b>.\n\n` +
                `Pilih menu di bawah untuk melanjutkan:`;

            await ctx.replyWithHTML(message, this.telegramService.getMainMenuKeyboard());
        } else {
            const message = 
                `👋 <b>Selamat Datang di iDesk!</b>\n\n` +
                `Untuk menggunakan bot ini, hubungkan akun Anda:\n\n` +
                `1️⃣ Login ke <b>iDesk web</b>\n` +
                `2️⃣ Buka <b>Settings → Telegram</b>\n` +
                `3️⃣ Klik <b>"Generate Link Code"</b>\n` +
                `4️⃣ Kirim kode 6 digit ke sini`;

            await ctx.replyWithHTML(message, Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Masukkan Kode', 'enter_code')],
                [Markup.button.callback('❓ Bantuan', 'help')],
            ]));
        }
    }

    @Action('main_menu')
    async onMainMenu(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        // Clear any ongoing state
        const from = ctx.from;
        if (from) {
            await this.chatBridge.exitChatMode(String(from.id));
            await this.telegramService.clearState(String(from.id));
        }
        await this.showMainMenu(ctx);
    }

    @Help()
    async onHelp(@Ctx() ctx: Context) {
        const helpMessage = 
            `📚 <b>Bantuan iDesk Bot</b>\n\n` +
            `<b>🎫 Tiket</b>\n` +
            `• Buat tiket untuk melaporkan masalah\n` +
            `• Lihat dan kelola tiket Anda\n` +
            `• Chat langsung dengan tim support\n\n` +
            `<b>⌨️ Perintah Cepat</b>\n` +
            `<code>/start</code> - Menu utama\n` +
            `<code>/newticket</code> - Buat tiket baru\n` +
            `<code>/mytickets</code> - Lihat tiket\n` +
            `<code>/chat</code> - Mode chat\n` +
            `<code>/endchat</code> - Keluar chat\n` +
            `<code>/cancel</code> - Batalkan\n\n` +
            `<b>💡 Tips</b>\n` +
            `Dalam mode chat, kirim pesan langsung untuk berkomunikasi dengan tim support.`;

        await ctx.replyWithHTML(helpMessage, this.telegramService.getBackHomeKeyboard());
    }

    // =====================
    // Account Linking
    // =====================

    @Command('link')
    async onLink(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        
        if (session?.userId) {
            await ctx.replyWithHTML(
                `✅ <b>Akun Sudah Terhubung</b>\n\n` +
                `Akun Telegram Anda sudah terhubung dengan akun iDesk.`,
                this.telegramService.getBackHomeKeyboard()
            );
            return;
        }

        await this.telegramService.setState(String(from.id), TelegramState.AWAITING_LINK_CODE);
        
        await ctx.replyWithHTML(
            `🔗 <b>Hubungkan Akun</b>\n\n` +
            `Langkah-langkah:\n\n` +
            `1️⃣ Login ke <b>iDesk web</b>\n` +
            `2️⃣ Buka <b>Settings → Telegram</b>\n` +
            `3️⃣ Klik <b>"Generate Link Code"</b>\n` +
            `4️⃣ Kirim kode 6 digit ke sini\n\n` +
            `⏱️ <i>Kode berlaku 5 menit</i>`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('❌ Batal', 'main_menu'),
                ],
            ])
        );
    }

    @Command('unlink')
    async onUnlink(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const result = await this.telegramService.unlinkAccount(String(from.id));
        await ctx.replyWithHTML(result.message, this.telegramService.getBackHomeKeyboard());
    }

    // =====================
    // Ticket Management
    // =====================

    @Command('newticket')
    async onNewTicket(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        
        if (!session?.userId) {
            await ctx.replyWithHTML(
                `⚠️ <b>Akun Belum Terhubung</b>\n\n` +
                `Hubungkan akun terlebih dahulu untuk membuat tiket.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        await this.telegramService.setState(String(from.id), TelegramState.CREATING_TICKET_TITLE);
        
        await ctx.replyWithHTML(
            `🎫 <b>Buat Tiket Baru</b>\n\n` +
            `📝 <b>Langkah 1/2</b>\n` +
            `Masukkan judul tiket:\n\n` +
            `<i>💡 Contoh: "Laptop tidak bisa connect WiFi"</i>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    @Command('mytickets')
    async onMyTickets(@Ctx() ctx: Context) {
        await this.showMyTickets(ctx);
    }

    private async showMyTickets(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        
        if (!session?.userId) {
            await ctx.replyWithHTML(
                `⚠️ <b>Akun Belum Terhubung</b>\n\n` +
                `Hubungkan akun terlebih dahulu.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        const tickets = await this.telegramService.getMyTickets(session.userId);
        
        if (tickets.length === 0) {
            await ctx.replyWithHTML(
                `📋 <b>Tiket Saya</b>\n\n` +
                `📭 Anda belum memiliki tiket.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🎫 Buat Tiket Baru', 'new_ticket')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        let message = `📋 <b>Tiket Saya</b>\n\n`;
        const buttons: any[] = [];

        for (const ticket of tickets) {
            const status = this.telegramService.formatTicketStatus(ticket.status);
            message += `${status} <b>#${ticket.ticketNumber}</b>\n`;
            message += `└ ${ticket.title.substring(0, 35)}${ticket.title.length > 35 ? '...' : ''}\n\n`;
            
            buttons.push([
                Markup.button.callback(
                    `📋 #${ticket.ticketNumber} - ${ticket.title.substring(0, 20)}...`,
                    `ticket_actions:${ticket.id}`
                )
            ]);
        }

        buttons.push([
            Markup.button.callback('🎫 Buat Baru', 'new_ticket'),
            Markup.button.callback('🏠 Menu', 'main_menu'),
        ]);

        await ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
    }

    @Command('cancel')
    async onCancel(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        await this.chatBridge.exitChatMode(String(from.id));
        await this.telegramService.clearState(String(from.id));
        await ctx.replyWithHTML(
            `✅ <b>Dibatalkan</b>\n\n` +
            `Operasi dibatalkan. Kembali ke menu utama.`,
            this.telegramService.getMainMenuKeyboard()
        );
    }

    // =====================
    // Status & Chat Commands
    // =====================

    @Command('status')
    async onStatus(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const args = (ctx.message as any).text.split(' ').slice(1);
        const ticketNumber = args[0];

        if (!ticketNumber) {
            await ctx.replyWithHTML(
                `🔍 <b>Cek Status Tiket</b>\n\n` +
                `Cara penggunaan:\n` +
                `<code>/status [nomor_tiket]</code>\n\n` +
                `<i>💡 Contoh: /status 271124-IT-0001</i>`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('📋 Lihat Tiket Saya', 'my_tickets')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        const ticket = await this.chatBridge.getTicketByNumber(ticketNumber);

        if (!ticket) {
            await ctx.replyWithHTML(
                `❌ <b>Tiket Tidak Ditemukan</b>\n\n` +
                `Tiket dengan nomor <code>${ticketNumber}</code> tidak ditemukan.`,
                this.telegramService.getBackHomeKeyboard('my_tickets')
            );
            return;
        }

        await this.showTicketDetail(ctx, ticket);
    }

    private async showTicketDetail(ctx: Context, ticket: any) {
        const status = this.telegramService.formatTicketStatus(ticket.status);
        const priority = this.telegramService.formatPriority(ticket.priority);
        const lastUpdate = new Date(ticket.updatedAt).toLocaleString('id-ID');
        const messageCount = ticket.messages?.length || 0;

        await ctx.replyWithHTML(
            `📋 <b>Detail Tiket</b>\n\n` +
            `<b>#${ticket.ticketNumber}</b>\n` +
            `${ticket.title}\n\n` +
            `┌ 📊 Status: ${status}\n` +
            `├ ⚡ Prioritas: ${priority}\n` +
            `├ 👤 Agent: ${ticket.assignedTo?.fullName || 'Belum ada'}\n` +
            `├ 💬 Pesan: ${messageCount}\n` +
            `└ 🕐 Update: ${lastUpdate}`,
            this.telegramService.getTicketActionsKeyboard(ticket.id)
        );
    }

    @Command('chat')
    async onChat(@Ctx() ctx: Context) {
        await this.startChatMode(ctx);
    }

    private async startChatMode(ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));

        if (!session?.userId) {
            await ctx.replyWithHTML(
                `⚠️ <b>Akun Belum Terhubung</b>\n\n` +
                `Hubungkan akun terlebih dahulu.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔗 Hubungkan Akun', 'enter_code')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        const tickets = await this.chatBridge.getActiveTickets(session.userId);

        if (tickets.length === 0) {
            await ctx.replyWithHTML(
                `📭 <b>Tidak Ada Tiket Aktif</b>\n\n` +
                `Buat tiket baru untuk memulai chat dengan tim support.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🎫 Buat Tiket Baru', 'new_ticket')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        if (tickets.length === 1) {
            await this.enterChatModeForTicket(ctx, tickets[0].id);
            return;
        }

        // Multiple tickets - show selection
        const buttons = tickets.map(t => [
            Markup.button.callback(
                `${this.telegramService.formatTicketStatus(t.status).split(' ')[0]} #${t.ticketNumber}`,
                `enter_chat:${t.id}`
            )
        ]);

        buttons.push([
            Markup.button.callback('◀️ Kembali', 'my_tickets'),
            Markup.button.callback('🏠 Menu', 'main_menu'),
        ]);

        await ctx.replyWithHTML(
            `💬 <b>Pilih Tiket untuk Chat</b>\n\n` +
            `Pilih tiket yang ingin Anda chat:`,
            Markup.inlineKeyboard(buttons)
        );
    }

    private async enterChatModeForTicket(ctx: Context, ticketId: string) {
        const from = ctx.from;
        if (!from) return;

        const result = await this.chatBridge.enterChatMode(String(from.id), ticketId);
        
        if (!result.success) {
            await ctx.replyWithHTML(
                `❌ ${result.message}`,
                this.telegramService.getBackHomeKeyboard('my_tickets')
            );
            return;
        }

        const ticket = await this.chatBridge.getActiveChatTicket(String(from.id));

        await ctx.replyWithHTML(
            `💬 <b>Mode Chat Aktif</b>\n\n` +
            `📋 Tiket: <b>#${ticket?.ticketNumber}</b>\n` +
            `${ticket?.title}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✏️ Ketik pesan Anda langsung\n` +
            `📎 Kirim foto/dokumen jika perlu\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            `<i>Pesan akan diteruskan ke tim support</i>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('🛑 Keluar Chat', 'exit_chat')],
                [Markup.button.callback('📋 Lihat Detail', `view_ticket:${ticket?.id}`)],
            ])
        );
    }

    @Command('endchat')
    async onEndChat(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const activeTicket = await this.chatBridge.getActiveChatTicket(String(from.id));

        if (!activeTicket) {
            await ctx.replyWithHTML(
                `ℹ️ <b>Tidak Ada Chat Aktif</b>\n\n` +
                `Anda tidak sedang dalam mode chat.`,
                this.telegramService.getMainMenuKeyboard()
            );
            return;
        }

        await this.chatBridge.exitChatMode(String(from.id));
        await ctx.replyWithHTML(
            `✅ <b>Chat Diakhiri</b>\n\n` +
            `Mode chat untuk tiket <b>#${activeTicket.ticketNumber}</b> telah diakhiri.\n\n` +
            `<i>Tiket tetap aktif dan Anda akan menerima notifikasi jika ada balasan.</i>`,
            this.telegramService.getMainMenuKeyboard()
        );
    }

    @Command('priority')
    async onPriority(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session?.userId) {
            await ctx.reply('⚠️ Anda belum menghubungkan akun. Gunakan /link terlebih dahulu.');
            return;
        }

        const args = (ctx.message as any)?.text?.split(' ').slice(1) || [];
        
        if (args.length === 0) {
            // Show help for priority command
            await ctx.replyWithHTML(
                `⚡ <b>Ubah Prioritas Tiket</b>\n\n` +
                `<b>Format:</b>\n` +
                `<code>/priority [nomor_tiket] [prioritas]</code>\n\n` +
                `<b>Contoh:</b>\n` +
                `<code>/priority TKT-001 high</code>\n\n` +
                `<b>Prioritas tersedia:</b>\n` +
                `• <code>low</code> - Rendah\n` +
                `• <code>medium</code> - Sedang\n` +
                `• <code>high</code> - Tinggi\n` +
                `• <code>urgent</code> - Mendesak`
            );
            return;
        }

        if (args.length === 1) {
            // Only ticket number provided, show priority options
            const ticketNumber = args[0].toUpperCase();
            const ticket = await this.chatBridge.getTicketByNumber(ticketNumber);
            
            if (!ticket) {
                await ctx.reply(`❌ Tiket ${ticketNumber} tidak ditemukan.`);
                return;
            }

            // Check if user owns the ticket
            if (ticket.userId !== session.userId) {
                await ctx.reply(`⚠️ Anda tidak memiliki akses ke tiket ini.`);
                return;
            }

            await ctx.replyWithHTML(
                `⚡ <b>Ubah Prioritas Tiket #${ticket.ticketNumber}</b>\n\n` +
                `Prioritas saat ini: <b>${ticket.priority}</b>\n\n` +
                `Pilih prioritas baru:`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🟢 Low', `set_priority:${ticket.id}:LOW`),
                        Markup.button.callback('🟡 Medium', `set_priority:${ticket.id}:MEDIUM`),
                    ],
                    [
                        Markup.button.callback('🟠 High', `set_priority:${ticket.id}:HIGH`),
                        Markup.button.callback('🔴 Urgent', `set_priority:${ticket.id}:URGENT`),
                    ],
                    [Markup.button.callback('❌ Batal', 'cancel')],
                ])
            );
            return;
        }

        // Both ticket number and priority provided
        const ticketNumber = args[0].toUpperCase();
        const priorityArg = args[1].toUpperCase();
        
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        if (!validPriorities.includes(priorityArg)) {
            await ctx.reply(`❌ Prioritas tidak valid. Gunakan: low, medium, high, atau urgent`);
            return;
        }

        const result = await this.chatBridge.requestPriorityChange(
            String(from.id),
            ticketNumber,
            priorityArg
        );

        if (result.success) {
            await ctx.replyWithHTML(
                `✅ <b>Prioritas Diubah</b>\n\n` +
                `Tiket #${ticketNumber} sekarang memiliki prioritas <b>${priorityArg}</b>.`
            );
        } else {
            await ctx.reply(`❌ ${result.message}`);
        }
    }

    // =====================
    // Callback Actions
    // =====================

    @Action('enter_code')
    async onEnterCode(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        await this.telegramService.setState(String(from.id), TelegramState.AWAITING_LINK_CODE);
        await ctx.replyWithHTML(
            `🔗 <b>Masukkan Kode</b>\n\n` +
            `Kirim kode 6 digit dari iDesk web:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    @Action('new_ticket')
    async onNewTicketAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onNewTicket(ctx);
    }

    @Action('my_tickets')
    async onMyTicketsAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.showMyTickets(ctx);
    }

    @Action('start_chat')
    async onStartChatAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.startChatMode(ctx);
    }

    @Action('check_status')
    async onCheckStatusAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await ctx.replyWithHTML(
            `🔍 <b>Cek Status Tiket</b>\n\n` +
            `Kirim nomor tiket dengan format:\n` +
            `<code>/status NOMOR_TIKET</code>\n\n` +
            `<i>💡 Contoh: /status 271124-IT-0001</i>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('📋 Lihat Tiket Saya', 'my_tickets')],
                [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
            ])
        );
    }

    @Action('help')
    async onHelpAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onHelp(ctx);
    }

    @Action('cancel')
    async onCancelAction(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onCancel(ctx);
    }

    @Action(/ticket_actions:(.+)/)
    async onTicketActions(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const match = (ctx as any).match;
        const ticketId = match[1];

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) {
            await ctx.replyWithHTML(
                `❌ <b>Tiket Tidak Ditemukan</b>`,
                this.telegramService.getBackHomeKeyboard('my_tickets')
            );
            return;
        }

        await this.showTicketDetail(ctx, ticket);
    }

    @Action(/view_ticket:(.+)/)
    async onViewTicket(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const match = (ctx as any).match;
        const ticketId = match[1];

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) {
            await ctx.replyWithHTML(
                `❌ <b>Tiket Tidak Ditemukan</b>`,
                this.telegramService.getBackHomeKeyboard('my_tickets')
            );
            return;
        }

        const status = this.telegramService.formatTicketStatus(ticket.status);
        const priority = this.telegramService.formatPriority(ticket.priority);
        const createdAt = new Date(ticket.createdAt).toLocaleString('id-ID');

        await ctx.replyWithHTML(
            `📜 <b>Detail Lengkap Tiket</b>\n\n` +
            `<b>#${ticket.ticketNumber}</b>\n` +
            `${ticket.title}\n\n` +
            `┌ 📊 Status: ${status}\n` +
            `├ ⚡ Prioritas: ${priority}\n` +
            `├ 📁 Kategori: ${ticket.category}\n` +
            `├ 👤 Agent: ${ticket.assignedTo?.fullName || 'Belum ada'}\n` +
            `└ 📅 Dibuat: ${createdAt}\n\n` +
            `📝 <b>Deskripsi:</b>\n${ticket.description?.substring(0, 300)}${ticket.description?.length > 300 ? '...' : ''}`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('💬 Chat', `enter_chat:${ticketId}`),
                    Markup.button.callback('⚡ Prioritas', `change_priority:${ticketId}`),
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
        const match = (ctx as any).match;
        const ticketId = match[1];

        const ticket = await this.telegramService.getTicketById(ticketId);
        if (!ticket) {
            await ctx.reply('❌ Tiket tidak ditemukan.');
            return;
        }

        await ctx.replyWithHTML(
            `⚡ <b>Ubah Prioritas</b>\n\n` +
            `Tiket: <b>#${ticket.ticketNumber}</b>\n` +
            `Prioritas saat ini: <b>${this.telegramService.formatPriority(ticket.priority)}</b>\n\n` +
            `Pilih prioritas baru:`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('🟢 Low', `set_priority:${ticketId}:LOW`),
                    Markup.button.callback('🟡 Medium', `set_priority:${ticketId}:MEDIUM`),
                ],
                [
                    Markup.button.callback('🟠 High', `set_priority:${ticketId}:HIGH`),
                    Markup.button.callback('🔴 Urgent', `set_priority:${ticketId}:URGENT`),
                ],
                [
                    Markup.button.callback('◀️ Kembali', `ticket_actions:${ticketId}`),
                    Markup.button.callback('🏠 Menu', 'main_menu'),
                ],
            ])
        );
    }

    @Action(/enter_chat:(.+)/)
    async onEnterChat(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const match = (ctx as any).match;
        const ticketId = match[1];
        await this.enterChatModeForTicket(ctx, ticketId);
    }

    @Action('exit_chat')
    async onExitChat(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        await this.onEndChat(ctx);
    }

    @Action(/quick_reply:(.+)/)
    async onQuickReply(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const match = (ctx as any).match;
        const ticketId = match[1];
        await this.enterChatModeForTicket(ctx, ticketId);
    }

    @Action(/set_priority:(.+):(.+)/)
    async onSetPriority(@Ctx() ctx: Context) {
        await ctx.answerCbQuery();
        const from = ctx.from;
        if (!from) return;

        const match = (ctx as any).match;
        const ticketId = match[1];
        const priority = match[2];

        const result = await this.chatBridge.changePriorityById(
            String(from.id),
            ticketId,
            priority
        );

        if (result.success) {
            const priorityEmoji: Record<string, string> = {
                'LOW': '🟢',
                'MEDIUM': '🟡',
                'HIGH': '🟠',
                'URGENT': '🔴',
            };
            await ctx.replyWithHTML(
                `✅ <b>Prioritas Diubah</b>\n\n` +
                `Tiket <b>#${result.ticketNumber}</b> sekarang:\n` +
                `${priorityEmoji[priority] || ''} <b>${priority}</b>`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('📋 Lihat Tiket', `ticket_actions:${ticketId}`)],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        } else {
            await ctx.replyWithHTML(
                `❌ ${result.message}`,
                this.telegramService.getBackHomeKeyboard('my_tickets')
            );
        }
    }

    // =====================
    // Text Message Handler
    // =====================

    @On('text')
    async onText(@Ctx() ctx: Context) {
        const from = ctx.from;
        const message = (ctx.message as any)?.text;
        if (!from || !message) return;

        // Ignore commands
        if (message.startsWith('/')) return;

        const session = await this.telegramService.getSession(String(from.id));
        if (!session) return;

        // Handle chat mode first (highest priority)
        if (session.state === TelegramState.CHAT_MODE && session.activeTicketId) {
            await this.handleChatMessage(ctx, message, session);
            return;
        }

        switch (session.state) {
            case TelegramState.AWAITING_LINK_CODE:
                await this.handleLinkCode(ctx, message);
                break;

            case TelegramState.CREATING_TICKET_TITLE:
                await this.handleTicketTitle(ctx, message);
                break;

            case TelegramState.CREATING_TICKET_DESCRIPTION:
                await this.handleTicketDescription(ctx, message, session);
                break;

            case TelegramState.REPLYING_TO_TICKET:
                await this.handleTicketReply(ctx, message, session);
                break;

            default:
                // Default response for unlinked users
                if (!session.userId) {
                    await ctx.reply(
                        'Silakan hubungkan akun Anda terlebih dahulu dengan /link'
                    );
                }
                break;
        }
    }

    // =====================
    // Photo & Document Handlers
    // =====================

    @On('photo')
    async onPhoto(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const photos = (ctx.message as any).photo;
        const largestPhoto = photos[photos.length - 1]; // Get highest resolution
        const caption = (ctx.message as any).caption || '';
        const messageId = (ctx.message as any).message_id;

        const result = await this.chatBridge.handlePhoto(
            String(from.id),
            String(ctx.chat?.id),
            largestPhoto.file_id,
            caption,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(result.message);
        }
    }

    @On('document')
    async onDocument(@Ctx() ctx: Context) {
        const from = ctx.from;
        if (!from) return;

        const document = (ctx.message as any).document;
        const caption = (ctx.message as any).caption || '';
        const messageId = (ctx.message as any).message_id;

        const result = await this.chatBridge.handleDocument(
            String(from.id),
            String(ctx.chat?.id),
            document.file_id,
            document.file_name,
            caption,
            messageId
        );

        if (!result.success && result.message) {
            await ctx.reply(result.message);
        }
    }

    // =====================
    // State Handlers
    // =====================

    /**
     * Handle message in chat mode - forward to ticket
     */
    private async handleChatMessage(ctx: Context, message: string, session: any) {
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
            await ctx.replyWithHTML(
                `❌ ${result.message}`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );

            // Exit chat mode if ticket is closed or error
            if (result.message.includes('ditutup') || result.message.includes('tidak ditemukan')) {
                await this.chatBridge.exitChatMode(String(from.id));
            }
        }
        // Message sent successfully - no confirmation needed to avoid spam
    }

    private async handleLinkCode(ctx: Context, code: string) {
        const from = ctx.from;
        if (!from) return;

        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(code.trim())) {
            await ctx.replyWithHTML(
                `❌ <b>Format Tidak Valid</b>\n\n` +
                `Masukkan 6 digit angka.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
            return;
        }

        const result = await this.telegramService.verifyAndLink(String(from.id), code.trim());
        
        if (result.success) {
            await ctx.replyWithHTML(
                `🎉 <b>Berhasil!</b>\n\n` +
                `${result.message}\n\n` +
                `Sekarang Anda bisa menggunakan semua fitur bot.`,
                this.telegramService.getMainMenuKeyboard()
            );
        } else {
            await ctx.replyWithHTML(
                `❌ <b>Gagal</b>\n\n` +
                `${result.message}`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Coba Lagi', 'enter_code')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        }
    }

    private async handleTicketTitle(ctx: Context, title: string) {
        const from = ctx.from;
        if (!from) return;

        if (title.length < 5) {
            await ctx.replyWithHTML(
                `❌ <b>Judul Terlalu Pendek</b>\n\n` +
                `Minimal 5 karakter. Coba lagi:`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
            return;
        }

        await this.telegramService.setState(
            String(from.id),
            TelegramState.CREATING_TICKET_DESCRIPTION,
            { title }
        );

        await ctx.replyWithHTML(
            `🎫 <b>Buat Tiket Baru</b>\n\n` +
            `✅ Judul: <b>${title}</b>\n\n` +
            `📝 <b>Langkah 2/4</b>\n` +
            `Jelaskan masalah Anda secara detail:`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Batal', 'main_menu')],
            ])
        );
    }

    private async handleTicketDescription(ctx: Context, description: string, session: any) {
        const from = ctx.from;
        if (!from) return;

        if (description.length < 10) {
            await ctx.replyWithHTML(
                `❌ <b>Deskripsi Terlalu Pendek</b>\n\n` +
                `Minimal 10 karakter. Jelaskan lebih detail:`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'main_menu')],
                ])
            );
            return;
        }

        const title = session.stateData?.title;
        if (!title) {
            await this.telegramService.clearState(String(from.id));
            await ctx.replyWithHTML(
                `❌ <b>Terjadi Kesalahan</b>\n\n` +
                `Silakan mulai ulang.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🎫 Buat Tiket Baru', 'new_ticket')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
            return;
        }

        // Move to category selection
        await this.telegramService.setState(
            String(from.id),
            TelegramState.CREATING_TICKET_CATEGORY,
            { title, description }
        );

        await ctx.replyWithHTML(
            `🎫 <b>Buat Tiket Baru</b>\n\n` +
            `✅ Judul: <b>${title}</b>\n` +
            `✅ Deskripsi: <i>${description.substring(0, 50)}...</i>\n\n` +
            `📁 <b>Langkah 3/4</b>\n` +
            `Pilih kategori tiket:`,
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('💻 Hardware', 'select_category:HARDWARE'),
                    Markup.button.callback('🖥️ Software', 'select_category:SOFTWARE'),
                ],
                [
                    Markup.button.callback('🌐 Network', 'select_category:NETWORK'),
                    Markup.button.callback('👤 Account', 'select_category:ACCOUNT'),
                ],
                [
                    Markup.button.callback('📧 Email', 'select_category:EMAIL'),
                    Markup.button.callback('🔧 Other', 'select_category:GENERAL'),
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

        const match = (ctx as any).match;
        const category = match[1];

        const session = await this.telegramService.getSession(String(from.id));
        if (!session || session.state !== TelegramState.CREATING_TICKET_CATEGORY) {
            await ctx.reply('❌ Sesi tidak valid. Silakan mulai ulang.');
            return;
        }

        const { title, description } = session.stateData || {};
        if (!title || !description) {
            await this.telegramService.clearState(String(from.id));
            await ctx.reply('❌ Data tidak lengkap. Silakan mulai ulang.');
            return;
        }

        // Move to priority selection
        await this.telegramService.setState(
            String(from.id),
            TelegramState.CREATING_TICKET_PRIORITY,
            { title, description, category }
        );

        await ctx.replyWithHTML(
            `🎫 <b>Buat Tiket Baru</b>\n\n` +
            `✅ Judul: <b>${title}</b>\n` +
            `✅ Kategori: <b>${category}</b>\n\n` +
            `⚡ <b>Langkah 4/4</b>\n` +
            `Pilih tingkat prioritas:`,
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

        const match = (ctx as any).match;
        const priority = match[1];

        const session = await this.telegramService.getSession(String(from.id));
        if (!session || session.state !== TelegramState.CREATING_TICKET_PRIORITY) {
            await ctx.reply('❌ Sesi tidak valid. Silakan mulai ulang.');
            return;
        }

        const { title, description, category } = session.stateData || {};
        if (!title || !description) {
            await this.telegramService.clearState(String(from.id));
            await ctx.reply('❌ Data tidak lengkap. Silakan mulai ulang.');
            return;
        }

        try {
            const ticket = await this.telegramService.createTicket(
                session, 
                title, 
                description, 
                category || 'GENERAL',
                priority
            );
            await this.telegramService.clearState(String(from.id));

            const priorityEmoji: Record<string, string> = {
                'LOW': '🟢',
                'MEDIUM': '🟡',
                'HIGH': '🟠',
                'CRITICAL': '🔴',
            };

            await ctx.replyWithHTML(
                `🎉 <b>Tiket Berhasil Dibuat!</b>\n\n` +
                `🎫 <b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n\n` +
                `┌ 📁 Kategori: <b>${ticket.category}</b>\n` +
                `└ ${priorityEmoji[priority] || '🟡'} Prioritas: <b>${priority}</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Tim support akan segera merespon.\n` +
                `Anda akan menerima notifikasi update.`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('💬 Chat', `enter_chat:${ticket.id}`),
                        Markup.button.callback('📋 Detail', `view_ticket:${ticket.id}`),
                    ],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );

            // Notify agents
            await this.telegramService.notifyNewTicketToAgents(ticket);

        } catch (error) {
            this.logger.error('Failed to create ticket:', error);
            await ctx.replyWithHTML(
                `❌ <b>Gagal Membuat Tiket</b>\n\n` +
                `Silakan coba lagi.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Coba Lagi', 'new_ticket')],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        }
    }

    private async handleTicketReply(ctx: Context, content: string, session: any) {
        const from = ctx.from;
        if (!from) return;

        const ticketId = session.stateData?.ticketId;
        if (!ticketId || !session.userId) {
            await this.telegramService.clearState(String(from.id));
            await ctx.replyWithHTML(
                `❌ <b>Terjadi Kesalahan</b>\n\n` +
                `Silakan coba lagi.`,
                this.telegramService.getMainMenuKeyboard()
            );
            return;
        }

        try {
            await this.telegramService.replyToTicket(ticketId, session.userId, content);
            await this.telegramService.clearState(String(from.id));

            await ctx.replyWithHTML(
                `✅ <b>Balasan Terkirim!</b>`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('� Lanjut Chat', `enter_chat:${ticketId}`),
                        Markup.button.callback('�� Lihat Tiket', `view_ticket:${ticketId}`),
                    ],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        } catch (error) {
            this.logger.error('Failed to reply to ticket:', error);
            await ctx.replyWithHTML(
                `❌ <b>Gagal Mengirim</b>\n\n` +
                `Silakan coba lagi.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Coba Lagi', `reply_ticket:${ticketId}`)],
                    [Markup.button.callback('🏠 Menu Utama', 'main_menu')],
                ])
            );
        }
    }
}
