/**
 * Message formatter utilities for Telegram bot (17.5)
 */

export interface TicketData {
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    assignedTo?: string;
    createdAt?: string | Date;
    description?: string;
}

export class MessageFormatter {
    private static readonly STATUS_EMOJI: Record<string, string> = {
        'TODO': '🔵',
        'IN_PROGRESS': '🟡',
        'WAITING_VENDOR': '🟠',
        'RESOLVED': '🟢',
        'CLOSED': '⚫',
        'CANCELLED': '🔴',
    };

    private static readonly PRIORITY_EMOJI: Record<string, string> = {
        'LOW': '🟢',
        'MEDIUM': '🟡',
        'HIGH': '🟠',
        'CRITICAL': '🔴',
        'URGENT': '🔴',
    };

    /**
     * Format ticket card for display
     */
    static formatTicketCard(ticket: TicketData): string {
        const statusEmoji = this.STATUS_EMOJI[ticket.status] || '⚪';
        const priorityEmoji = this.PRIORITY_EMOJI[ticket.priority] || '🟡';
        const createdAt = ticket.createdAt 
            ? new Date(ticket.createdAt).toLocaleString('id-ID')
            : '-';

        return `┌─────────────────────────────────────┐
│ 🎫 <b>#${ticket.ticketNumber}</b>
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
│ 📌 ${this.truncate(ticket.title, 35)}
│
│ ${statusEmoji} ${ticket.status}  ${priorityEmoji} ${ticket.priority}
│ 👤 ${ticket.assignedTo || 'Belum ada'}  🕐 ${createdAt}
└─────────────────────────────────────┘`;
    }

    /**
     * Format ticket list item (compact)
     */
    static formatTicketListItem(ticket: TicketData): string {
        const statusEmoji = this.STATUS_EMOJI[ticket.status] || '⚪';
        return `${statusEmoji} <b>#${ticket.ticketNumber}</b>\n└ ${this.truncate(ticket.title, 35)}`;
    }

    /**
     * Format quick ticket created message
     */
    static formatQuickTicketCreated(ticket: TicketData, lang: string = 'id'): string {
        const priorityEmoji = this.PRIORITY_EMOJI[ticket.priority] || '🟡';
        
        return `🎫 <b>${lang === 'en' ? 'Express Ticket Created!' : 'Tiket Express Dibuat!'}</b>

<b>#${ticket.ticketNumber}</b>
📌 ${ticket.title}

${priorityEmoji} ${lang === 'en' ? 'Priority' : 'Prioritas'}: ${ticket.priority} (auto)
📁 ${lang === 'en' ? 'Category' : 'Kategori'}: ${ticket.category || 'GENERAL'} (auto)

━━━━━━━━━━━━━━━━━━━━━━
${lang === 'en' ? 'Support team will respond shortly.' : 'Tim support akan segera merespon.'}`;
    }

    /**
     * Format notification message
     */
    static formatNotification(type: string, data: any, lang: string = 'id'): string {
        switch (type) {
            case 'NEW_REPLY':
                return `💬 <b>${data.agentName}</b> ${lang === 'en' ? 'replied to ticket' : 'membalas tiket'} #${data.ticketNumber}:\n\n${this.truncate(data.content, 200)}`;
            
            case 'STATUS_CHANGED':
                const statusEmoji = this.STATUS_EMOJI[data.newStatus] || '⚪';
                return `${statusEmoji} <b>${lang === 'en' ? 'Ticket Status Changed' : 'Status Tiket Berubah'}</b>\n\n${lang === 'en' ? 'Ticket' : 'Tiket'} #${data.ticketNumber}\nStatus: <b>${data.newStatus}</b>`;
            
            case 'ASSIGNED':
                return `👤 <b>${lang === 'en' ? 'Ticket Assigned' : 'Tiket Diassign'}</b>\n\n${lang === 'en' ? 'Ticket' : 'Tiket'} #${data.ticketNumber} ${lang === 'en' ? 'is now being handled by' : 'sedang ditangani oleh'} <b>${data.agentName}</b>.`;
            
            case 'RESOLVED':
                return `✅ <b>${lang === 'en' ? 'Ticket Resolved' : 'Tiket Selesai'}</b>\n\n${lang === 'en' ? 'Ticket' : 'Tiket'} #${data.ticketNumber} ${lang === 'en' ? 'has been resolved!' : 'telah diselesaikan!'}`;
            
            default:
                return `📢 <b>Update</b>\n\n${lang === 'en' ? 'There is an update on ticket' : 'Ada update pada tiket'} #${data.ticketNumber}.`;
        }
    }

    /**
     * Escape HTML special characters
     */
    static escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Truncate text with ellipsis
     */
    static truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format date for display
     */
    static formatDate(date: Date | string, lang: string = 'id'): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleString(lang === 'en' ? 'en-US' : 'id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * Format time ago
     */
    static formatTimeAgo(date: Date | string, lang: string = 'id'): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return lang === 'en' ? 'just now' : 'baru saja';
        if (diffMins < 60) return `${diffMins} ${lang === 'en' ? 'min ago' : 'menit lalu'}`;
        if (diffHours < 24) return `${diffHours} ${lang === 'en' ? 'hours ago' : 'jam lalu'}`;
        return `${diffDays} ${lang === 'en' ? 'days ago' : 'hari lalu'}`;
    }
}
