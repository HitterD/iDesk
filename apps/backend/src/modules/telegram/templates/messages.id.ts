export const messagesId = {
    welcome: {
        title: 'Selamat Datang di iDesk!',
        subtitle: 'Saya dapat membantu Anda:',
        features: [
            '• Membuat tiket support',
            '• Melacak status tiket',
            '• Mencari artikel bantuan',
        ],
        linkedGreeting: (name: string, activeTickets: number, waitingReply: number) =>
            `🏠 <b>Menu Utama iDesk</b>\n\n` +
            `Halo, ${name}! 👋\n\n` +
            `📊 Tiket Aktif: <b>${activeTickets}</b>\n` +
            (waitingReply > 0 ? `   └ ${waitingReply} menunggu balasan\n` : '') +
            `\n━━━━━━━━━━━━━━━━━━━━━━`,
        unlinkedGreeting:
            `👋 <b>Selamat Datang di iDesk!</b>\n\n` +
            `Untuk menggunakan bot ini, hubungkan akun Anda:\n\n` +
            `1️⃣ Login ke <b>iDesk web</b>\n` +
            `2️⃣ Buka <b>Settings → Telegram</b>\n` +
            `3️⃣ Klik <b>"Generate Link Code"</b>\n` +
            `4️⃣ Kirim kode 6 digit ke sini`,
    },
    btn: {
        newTicket: '🎫 Buat Tiket',
        myTickets: '📋 Tiket Saya',
        chat: '💬 Chat',
        searchKb: '🔍 Cari KB',
        settings: '⚙️ Pengaturan',
        help: '❓ Bantuan',
        back: '◀️ Kembali',
        home: '🏠 Menu',
        cancel: '❌ Batal',
        send: '✅ Kirim',
        edit: '✏️ Edit',
        link: '🔗 Hubungkan',
        unlink: '🔓 Putuskan',
    },
    ticket: {
        createTitle: '📝 <b>Buat Tiket</b>\n\nPilih cara:',
        quickGuide: 
            `⚡ <b>Quick Ticket</b>\n\n` +
            `Ketik langsung:\n` +
            `<code>/tiket [masalah anda]</code>\n\n` +
            `<i>Contoh: /tiket Laptop tidak bisa connect WiFi</i>`,
        wizardStep1: '📝 Judul tiket? (min. 5 karakter)',
        wizardStep2: (title: string) => 
            `✅ Judul: <b>${title}</b>\n\n📝 Jelaskan masalah secara detail:`,
        wizardStep3: (title: string) =>
            `✅ Judul: <b>${title}</b>\n\n📁 Pilih kategori:`,
        wizardStep4: (title: string, category: string) =>
            `✅ Judul: <b>${title}</b>\n` +
            `✅ Kategori: <b>${category}</b>\n\n` +
            `⚡ Pilih prioritas:`,
        created: (ticketNumber: string, title: string, category: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `🎫 <b>Tiket Dibuat!</b>\n\n` +
                `<b>#${ticketNumber}</b>\n` +
                `📌 ${title}\n\n` +
                `${priorityEmoji[priority] || '🟡'} Prioritas: ${priority}\n` +
                `📁 Kategori: ${category}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Tim support akan segera merespon.`;
        },
        quickCreated: (ticketNumber: string, title: string, category: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `🎫 <b>Tiket Express Dibuat!</b>\n\n` +
                `<b>#${ticketNumber}</b>\n` +
                `📌 ${title}\n\n` +
                `${priorityEmoji[priority] || '🟡'} Prioritas: ${priority} (auto)\n` +
                `📁 Kategori: ${category} (auto)\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Tim support akan segera merespon.`;
        },
        notFound: '❌ Tiket tidak ditemukan',
        listEmpty: '📭 Anda belum memiliki tiket.\n\nGunakan /tiket untuk membuat tiket baru.',
        listHeader: '📋 <b>Tiket Saya</b>\n\n',
        detail: (ticket: {
            ticketNumber: string;
            title: string;
            status: string;
            priority: string;
            category: string;
            assignedTo?: string;
            createdAt: string;
            description?: string;
        }) => {
            const statusEmoji: Record<string, string> = {
                TODO: '🔵', IN_PROGRESS: '🟡', WAITING_VENDOR: '🟠', 
                RESOLVED: '🟢', CANCELLED: '🔴'
            };
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `📋 <b>Detail Tiket</b>\n\n` +
                `<b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n\n` +
                `${statusEmoji[ticket.status] || '⚪'} Status: ${ticket.status}\n` +
                `${priorityEmoji[ticket.priority] || '🟡'} Prioritas: ${ticket.priority}\n` +
                `📁 Kategori: ${ticket.category}\n` +
                `👤 Agent: ${ticket.assignedTo || 'Belum ada'}\n` +
                `📅 Dibuat: ${ticket.createdAt}\n` +
                (ticket.description ? `\n📝 <b>Deskripsi:</b>\n${ticket.description.substring(0, 200)}${ticket.description.length > 200 ? '...' : ''}` : '');
        },
        // Compact ticket card (17.5 Redesign)
        ticketCard: (ticket: {
            ticketNumber: string;
            title: string;
            status: string;
            priority: string;
            assignedTo?: string;
            timeAgo: string;
        }) => {
            const statusEmoji: Record<string, string> = {
                TODO: '🔵', IN_PROGRESS: '🟡', WAITING_VENDOR: '🟠',
                RESOLVED: '🟢', CANCELLED: '🔴'
            };
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            const statusText: Record<string, string> = {
                TODO: 'Open', IN_PROGRESS: 'In Progress', WAITING_VENDOR: 'Waiting',
                RESOLVED: 'Resolved', CANCELLED: 'Cancelled'
            };
            return `🎫 <b>#${ticket.ticketNumber}</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 ${ticket.title.substring(0, 50)}${ticket.title.length > 50 ? '...' : ''}\n\n` +
                `${statusEmoji[ticket.status] || '⚪'} ${statusText[ticket.status] || ticket.status}  ` +
                `${priorityEmoji[ticket.priority] || '🟡'} ${ticket.priority}\n` +
                `👤 ${ticket.assignedTo || '-'}  🕐 ${ticket.timeAgo}`;
        },
    },
    chat: {
        modeActive: (ticketNumber: string, title: string) =>
            `💬 <b>Mode Chat Aktif</b>\n\n` +
            `📋 Tiket: <b>#${ticketNumber}</b>\n` +
            `${title}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✏️ Ketik pesan Anda langsung\n` +
            `📎 Kirim foto/dokumen jika perlu\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `<i>Pesan akan diteruskan ke tim support</i>`,
        modeEnded: (ticketNumber: string) =>
            `✅ <b>Chat Diakhiri</b>\n\n` +
            `Mode chat untuk tiket <b>#${ticketNumber}</b> telah diakhiri.\n\n` +
            `<i>Tiket tetap aktif dan Anda akan menerima notifikasi jika ada balasan.</i>`,
        noActiveChat: 'ℹ️ Tidak ada chat aktif.\n\nGunakan /chat untuk memulai chat.',
        noActiveTickets: '📭 <b>Tidak Ada Tiket Aktif</b>\n\nBuat tiket baru untuk memulai chat dengan tim support.',
        selectTicket: '💬 <b>Pilih Tiket untuk Chat</b>\n\nPilih tiket yang ingin Anda chat:',
    },
    link: {
        enterCode: '🔗 <b>Masukkan Kode</b>\n\nKirim kode 6 digit dari iDesk web:',
        instructions: 
            `🔗 <b>Hubungkan Akun</b>\n\n` +
            `Langkah-langkah:\n\n` +
            `1️⃣ Login ke <b>iDesk web</b>\n` +
            `2️⃣ Buka <b>Settings → Telegram</b>\n` +
            `3️⃣ Klik <b>"Generate Link Code"</b>\n` +
            `4️⃣ Kirim kode 6 digit ke sini\n\n` +
            `⏱️ <i>Kode berlaku 5 menit</i>`,
        success: (name: string) =>
            `🎉 <b>Berhasil!</b>\n\n` +
            `Akun Telegram Anda sekarang terhubung dengan <b>${name}</b>.\n\n` +
            `Sekarang Anda bisa menggunakan semua fitur bot.`,
        failed: 'Kode tidak valid atau sudah kadaluarsa.',
        alreadyLinked: '✅ <b>Akun Sudah Terhubung</b>\n\nAkun Telegram Anda sudah terhubung dengan akun iDesk.',
        unlinked: '✅ Akun Telegram berhasil diputus dari akun iDesk.',
        invalidFormat: '❌ <b>Format Tidak Valid</b>\n\nMasukkan 6 digit angka.',
    },
    priority: {
        select: (ticketNumber: string, currentPriority: string) =>
            `⚡ <b>Ubah Prioritas</b>\n\n` +
            `Tiket: <b>#${ticketNumber}</b>\n` +
            `Prioritas saat ini: <b>${currentPriority}</b>\n\n` +
            `Pilih prioritas baru:`,
        changed: (ticketNumber: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴', URGENT: '🔴'
            };
            return `✅ <b>Prioritas Diubah</b>\n\n` +
                `Tiket <b>#${ticketNumber}</b> sekarang:\n` +
                `${priorityEmoji[priority] || '🟡'} <b>${priority}</b>`;
        },
    },
    category: {
        hardware: '💻 Hardware',
        software: '🖥️ Software',
        network: '🌐 Network',
        account: '👤 Account',
        email: '📧 Email',
        general: '🔧 Lainnya',
    },
    settings: {
        title: '⚙️ <b>Pengaturan</b>',
        notifications: (enabled: boolean) =>
            `🔔 Notifikasi: ${enabled ? '✅ Aktif' : '❌ Nonaktif'}`,
        language: (lang: string) =>
            `🌐 Bahasa: ${lang === 'en' ? 'English' : 'Indonesia'}`,
        toggleNotifications: (enabled: boolean): string =>
            enabled ? '🔕 Matikan Notifikasi' : '🔔 Aktifkan Notifikasi',
    },
    help: 
        `📚 <b>Bantuan iDesk Bot</b>\n\n` +
        `<b>🎫 Tiket</b>\n` +
        `• <code>/tiket [masalah]</code> - Buat tiket cepat\n` +
        `• <code>/tiket</code> - Buat tiket wizard\n` +
        `• <code>/list</code> - Lihat tiket saya\n` +
        `• <code>/status [nomor]</code> - Cek status\n\n` +
        `<b>💬 Chat</b>\n` +
        `• <code>/chat</code> - Mode chat\n` +
        `• <code>/end</code> - Keluar chat\n\n` +
        `<b>🔧 Lainnya</b>\n` +
        `• <code>/link</code> - Hubungkan akun\n` +
        `• <code>/unlink</code> - Putuskan akun\n` +
        `• <code>/cari [query]</code> - Cari KB\n` +
        `• <code>/bahasa</code> - Ganti bahasa\n` +
        `• <code>/settings</code> - Pengaturan\n\n` +
        `<b>💡 Tips</b>\n` +
        `Dalam mode chat, kirim pesan langsung untuk berkomunikasi dengan tim support.`,
    errors: {
        notLinked: '⚠️ <b>Akun Belum Terhubung</b>\n\nHubungkan akun terlebih dahulu.',
        unauthorized: '❌ Anda tidak memiliki akses',
        serverError: '❌ Terjadi kesalahan server. Silakan coba lagi.',
        cancelled: '✅ <b>Dibatalkan</b>\n\nKembali ke menu utama.',
        titleTooShort: '❌ <b>Judul Terlalu Pendek</b>\n\nMinimal 5 karakter. Coba lagi:',
        descTooShort: '❌ <b>Deskripsi Terlalu Pendek</b>\n\nMinimal 10 karakter. Jelaskan lebih detail:',
        sessionExpired: '❌ Sesi tidak valid. Silakan mulai ulang.',
    },
    notifications: {
        newReply: (ticketNumber: string, agentName: string, content: string) =>
            `💬 <b>${agentName}</b> membalas tiket #${ticketNumber}:\n\n${content}`,
        statusChanged: (ticketNumber: string, newStatus: string) => {
            const statusEmoji: Record<string, string> = {
                TODO: '🔵', IN_PROGRESS: '🟡', WAITING_VENDOR: '🟠',
                RESOLVED: '🟢', CANCELLED: '🔴'
            };
            const statusText: Record<string, string> = {
                TODO: 'Open', IN_PROGRESS: 'Sedang Dikerjakan',
                WAITING_VENDOR: 'Menunggu Vendor', RESOLVED: 'Selesai', CANCELLED: 'Dibatalkan'
            };
            return `${statusEmoji[newStatus] || '⚪'} <b>Status Tiket Berubah</b>\n\n` +
                `Tiket #${ticketNumber}\n` +
                `Status: <b>${statusText[newStatus] || newStatus}</b>`;
        },
        assigned: (ticketNumber: string, agentName: string) =>
            `👤 <b>Tiket Diassign</b>\n\n` +
            `Tiket #${ticketNumber} telah ditangani oleh <b>${agentName}</b>.`,
        resolved: (ticketNumber: string) =>
            `✅ <b>Tiket Selesai</b>\n\nTiket #${ticketNumber} telah diselesaikan!`,
    },
    agent: {
        newTicket: (ticket: {
            ticketNumber: string;
            title: string;
            userName: string;
            department: string;
            priority: string;
            category: string;
        }) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `🎫 <b>Tiket Baru Masuk!</b>\n\n` +
                `<b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n` +
                `👤 ${ticket.userName} (${ticket.department})\n` +
                `${priorityEmoji[ticket.priority] || '🟡'} ${ticket.priority} | 📁 ${ticket.category}`;
        },
        assigned: (ticketNumber: string, agentName: string) =>
            `✅ <b>Tiket Diambil</b>\n\n` +
            `Tiket #${ticketNumber} sekarang ditangani oleh <b>${agentName}</b>.`,
        quickReplies: '📝 <b>Quick Replies</b>\n\nPilih template:',
        queueEmpty: '📭 Tidak ada tiket dalam antrian.',
        queueHeader: '📋 <b>Antrian Tiket</b>\n\n',
    },
    survey: {
        prompt: (ticketNumber: string, title: string, agentName: string) =>
            `✅ Tiket #${ticketNumber} Selesai!\n\n` +
            `"${title}"\n` +
            `Ditangani oleh: ${agentName}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `Bagaimana pengalaman Anda?`,
        thanks: '✅ <b>Terima Kasih!</b>\n\nFeedback Anda sangat berharga untuk meningkatkan layanan kami.',
        ratings: {
            excellent: '😍 Sangat Puas',
            good: '😊 Puas',
            neutral: '😐 Cukup',
            poor: '😕 Kurang',
        },
        skip: '⏭️ Lewati Survey',
    },
};

export type MessagesType = typeof messagesId;
