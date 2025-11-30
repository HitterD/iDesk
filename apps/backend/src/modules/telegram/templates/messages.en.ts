import { MessagesType } from './messages.id';

export const messagesEn: MessagesType = {
    welcome: {
        title: 'Welcome to iDesk!',
        subtitle: 'I can help you:',
        features: [
            '• Create support tickets',
            '• Track ticket status',
            '• Search help articles',
        ],
        linkedGreeting: (name: string, activeTickets: number, waitingReply: number) =>
            `🏠 <b>iDesk Main Menu</b>\n\n` +
            `Hello, ${name}! 👋\n\n` +
            `📊 Active Tickets: <b>${activeTickets}</b>\n` +
            (waitingReply > 0 ? `   └ ${waitingReply} awaiting reply\n` : '') +
            `\n━━━━━━━━━━━━━━━━━━━━━━`,
        unlinkedGreeting:
            `👋 <b>Welcome to iDesk!</b>\n\n` +
            `To use this bot, link your account:\n\n` +
            `1️⃣ Login to <b>iDesk web</b>\n` +
            `2️⃣ Go to <b>Settings → Telegram</b>\n` +
            `3️⃣ Click <b>"Generate Link Code"</b>\n` +
            `4️⃣ Send the 6-digit code here`,
    },
    btn: {
        newTicket: '🎫 New Ticket',
        myTickets: '📋 My Tickets',
        chat: '💬 Chat',
        searchKb: '🔍 Search KB',
        settings: '⚙️ Settings',
        help: '❓ Help',
        back: '◀️ Back',
        home: '🏠 Menu',
        cancel: '❌ Cancel',
        send: '✅ Send',
        edit: '✏️ Edit',
        link: '🔗 Link',
        unlink: '🔓 Unlink',
    },
    ticket: {
        createTitle: '📝 <b>Create Ticket</b>\n\nChoose method:',
        quickGuide:
            `⚡ <b>Quick Ticket</b>\n\n` +
            `Type directly:\n` +
            `<code>/ticket [your issue]</code>\n\n` +
            `<i>Example: /ticket Laptop cannot connect to WiFi</i>`,
        wizardStep1: '📝 Ticket title? (min. 5 characters)',
        wizardStep2: (title: string) =>
            `✅ Title: <b>${title}</b>\n\n📝 Describe the issue in detail:`,
        wizardStep3: (title: string) =>
            `✅ Title: <b>${title}</b>\n\n📁 Select category:`,
        wizardStep4: (title: string, category: string) =>
            `✅ Title: <b>${title}</b>\n` +
            `✅ Category: <b>${category}</b>\n\n` +
            `⚡ Select priority:`,
        created: (ticketNumber: string, title: string, category: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `🎫 <b>Ticket Created!</b>\n\n` +
                `<b>#${ticketNumber}</b>\n` +
                `📌 ${title}\n\n` +
                `${priorityEmoji[priority] || '🟡'} Priority: ${priority}\n` +
                `📁 Category: ${category}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Support team will respond shortly.`;
        },
        quickCreated: (ticketNumber: string, title: string, category: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴'
            };
            return `🎫 <b>Express Ticket Created!</b>\n\n` +
                `<b>#${ticketNumber}</b>\n` +
                `📌 ${title}\n\n` +
                `${priorityEmoji[priority] || '🟡'} Priority: ${priority} (auto)\n` +
                `📁 Category: ${category} (auto)\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Support team will respond shortly.`;
        },
        notFound: '❌ Ticket not found',
        listEmpty: '📭 You have no tickets yet.\n\nUse /ticket to create a new ticket.',
        listHeader: '📋 <b>My Tickets</b>\n\n',
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
            return `📋 <b>Ticket Details</b>\n\n` +
                `<b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n\n` +
                `${statusEmoji[ticket.status] || '⚪'} Status: ${ticket.status}\n` +
                `${priorityEmoji[ticket.priority] || '🟡'} Priority: ${ticket.priority}\n` +
                `📁 Category: ${ticket.category}\n` +
                `👤 Agent: ${ticket.assignedTo || 'Not assigned'}\n` +
                `📅 Created: ${ticket.createdAt}\n` +
                (ticket.description ? `\n📝 <b>Description:</b>\n${ticket.description.substring(0, 200)}${ticket.description.length > 200 ? '...' : ''}` : '');
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
            `💬 <b>Chat Mode Active</b>\n\n` +
            `📋 Ticket: <b>#${ticketNumber}</b>\n` +
            `${title}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `✏️ Type your message directly\n` +
            `📎 Send photos/documents if needed\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `<i>Messages will be forwarded to support team</i>`,
        modeEnded: (ticketNumber: string) =>
            `✅ <b>Chat Ended</b>\n\n` +
            `Chat mode for ticket <b>#${ticketNumber}</b> has ended.\n\n` +
            `<i>Ticket remains active and you will receive notifications for replies.</i>`,
        noActiveChat: 'ℹ️ No active chat.\n\nUse /chat to start chatting.',
        noActiveTickets: '📭 <b>No Active Tickets</b>\n\nCreate a new ticket to start chatting with support team.',
        selectTicket: '💬 <b>Select Ticket to Chat</b>\n\nSelect the ticket you want to chat about:',
    },
    link: {
        enterCode: '🔗 <b>Enter Code</b>\n\nSend the 6-digit code from iDesk web:',
        instructions:
            `🔗 <b>Link Account</b>\n\n` +
            `Steps:\n\n` +
            `1️⃣ Login to <b>iDesk web</b>\n` +
            `2️⃣ Go to <b>Settings → Telegram</b>\n` +
            `3️⃣ Click <b>"Generate Link Code"</b>\n` +
            `4️⃣ Send the 6-digit code here\n\n` +
            `⏱️ <i>Code valid for 5 minutes</i>`,
        success: (name: string) =>
            `🎉 <b>Success!</b>\n\n` +
            `Your Telegram account is now linked to <b>${name}</b>.\n\n` +
            `You can now use all bot features.`,
        failed: 'Invalid or expired code.',
        alreadyLinked: '✅ <b>Account Already Linked</b>\n\nYour Telegram account is already linked to iDesk.',
        unlinked: '✅ Telegram account successfully unlinked from iDesk.',
        invalidFormat: '❌ <b>Invalid Format</b>\n\nEnter 6 digits.',
    },
    priority: {
        select: (ticketNumber: string, currentPriority: string) =>
            `⚡ <b>Change Priority</b>\n\n` +
            `Ticket: <b>#${ticketNumber}</b>\n` +
            `Current priority: <b>${currentPriority}</b>\n\n` +
            `Select new priority:`,
        changed: (ticketNumber: string, priority: string) => {
            const priorityEmoji: Record<string, string> = {
                LOW: '🟢', MEDIUM: '🟡', HIGH: '🟠', CRITICAL: '🔴', URGENT: '🔴'
            };
            return `✅ <b>Priority Changed</b>\n\n` +
                `Ticket <b>#${ticketNumber}</b> is now:\n` +
                `${priorityEmoji[priority] || '🟡'} <b>${priority}</b>`;
        },
    },
    category: {
        hardware: '💻 Hardware',
        software: '🖥️ Software',
        network: '🌐 Network',
        account: '👤 Account',
        email: '📧 Email',
        general: '🔧 Other',
    },
    settings: {
        title: '⚙️ <b>Settings</b>',
        notifications: (enabled: boolean) =>
            `🔔 Notifications: ${enabled ? '✅ On' : '❌ Off'}`,
        language: (lang: string) =>
            `🌐 Language: ${lang === 'en' ? 'English' : 'Indonesia'}`,
        toggleNotifications: (enabled: boolean): string =>
            enabled ? '🔕 Turn Off Notifications' : '🔔 Turn On Notifications',
    },
    help:
        `📚 <b>iDesk Bot Help</b>\n\n` +
        `<b>🎫 Tickets</b>\n` +
        `• <code>/ticket [issue]</code> - Quick ticket\n` +
        `• <code>/ticket</code> - Ticket wizard\n` +
        `• <code>/list</code> - My tickets\n` +
        `• <code>/status [number]</code> - Check status\n\n` +
        `<b>💬 Chat</b>\n` +
        `• <code>/chat</code> - Chat mode\n` +
        `• <code>/end</code> - Exit chat\n\n` +
        `<b>🔧 Other</b>\n` +
        `• <code>/link</code> - Link account\n` +
        `• <code>/unlink</code> - Unlink account\n` +
        `• <code>/search [query]</code> - Search KB\n` +
        `• <code>/language</code> - Change language\n` +
        `• <code>/settings</code> - Settings\n\n` +
        `<b>💡 Tips</b>\n` +
        `In chat mode, send messages directly to communicate with support team.`,
    errors: {
        notLinked: '⚠️ <b>Account Not Linked</b>\n\nPlease link your account first.',
        unauthorized: '❌ You do not have access',
        serverError: '❌ Server error occurred. Please try again.',
        cancelled: '✅ <b>Cancelled</b>\n\nBack to main menu.',
        titleTooShort: '❌ <b>Title Too Short</b>\n\nMinimum 5 characters. Try again:',
        descTooShort: '❌ <b>Description Too Short</b>\n\nMinimum 10 characters. Please provide more detail:',
        sessionExpired: '❌ Session invalid. Please start over.',
    },
    notifications: {
        newReply: (ticketNumber: string, agentName: string, content: string) =>
            `💬 <b>${agentName}</b> replied to ticket #${ticketNumber}:\n\n${content}`,
        statusChanged: (ticketNumber: string, newStatus: string) => {
            const statusEmoji: Record<string, string> = {
                TODO: '🔵', IN_PROGRESS: '🟡', WAITING_VENDOR: '🟠',
                RESOLVED: '🟢', CANCELLED: '🔴'
            };
            const statusText: Record<string, string> = {
                TODO: 'Open', IN_PROGRESS: 'In Progress',
                WAITING_VENDOR: 'Waiting Vendor', RESOLVED: 'Resolved', CANCELLED: 'Cancelled'
            };
            return `${statusEmoji[newStatus] || '⚪'} <b>Ticket Status Changed</b>\n\n` +
                `Ticket #${ticketNumber}\n` +
                `Status: <b>${statusText[newStatus] || newStatus}</b>`;
        },
        assigned: (ticketNumber: string, agentName: string) =>
            `👤 <b>Ticket Assigned</b>\n\n` +
            `Ticket #${ticketNumber} is now being handled by <b>${agentName}</b>.`,
        resolved: (ticketNumber: string) =>
            `✅ <b>Ticket Resolved</b>\n\nTicket #${ticketNumber} has been resolved!`,
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
            return `🎫 <b>New Ticket!</b>\n\n` +
                `<b>#${ticket.ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n` +
                `👤 ${ticket.userName} (${ticket.department})\n` +
                `${priorityEmoji[ticket.priority] || '🟡'} ${ticket.priority} | 📁 ${ticket.category}`;
        },
        assigned: (ticketNumber: string, agentName: string) =>
            `✅ <b>Ticket Taken</b>\n\n` +
            `Ticket #${ticketNumber} is now handled by <b>${agentName}</b>.`,
        quickReplies: '📝 <b>Quick Replies</b>\n\nSelect template:',
        queueEmpty: '📭 No tickets in queue.',
        queueHeader: '📋 <b>Ticket Queue</b>\n\n',
    },
    survey: {
        prompt: (ticketNumber: string, title: string, agentName: string) =>
            `✅ Ticket #${ticketNumber} Resolved!\n\n` +
            `"${title}"\n` +
            `Handled by: ${agentName}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `How was your experience?`,
        thanks: '✅ <b>Thank You!</b>\n\nYour feedback is valuable for improving our service.',
        ratings: {
            excellent: '😍 Excellent',
            good: '😊 Good',
            neutral: '😐 Neutral',
            poor: '😕 Poor',
        },
        skip: '⏭️ Skip Survey',
    },
};
