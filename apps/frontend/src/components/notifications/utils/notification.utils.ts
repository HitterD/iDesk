/**
 * Strips emoji characters from a given string.
 * This ensures that existing database records with emojis do not display them
 * in the UI, keeping the presentation clean and professional.
 */
export const stripEmoji = (text: string): string => {
    if (!text) return text;
    
    return text
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
        .trim();
};

const DATE_ONLY = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });

/** Relative time in Indonesian: "Baru saja", "5 mnt lalu", "2 jam lalu", "3 hari lalu", then the date. */
export const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} mnt lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    if (days < 28) return `${Math.floor(days / 7)} mgg lalu`;
    return DATE_ONLY.format(date);
};

/**
 * Groups an array of notifications by date strings (e.g. "Today", "Yesterday", "Earlier This Week")
 */
import { Notification } from '../types/notification.types';

export const groupNotificationsByDate = (notifications: Notification[]): Record<string, Notification[]> => {
    if (!notifications || notifications.length === 0) return {};

    return notifications.reduce((acc, notification) => {
        const date = new Date(notification.createdAt);
        const now = new Date();
        const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        let groupKey = 'Earlier';
        if (diffInDays === 0 && date.getDate() === now.getDate()) {
            groupKey = 'Today';
        } else if (diffInDays <= 1) {
            groupKey = 'Yesterday';
        } else if (diffInDays < 7) {
            groupKey = 'Earlier This Week';
        } else if (diffInDays < 30) {
            groupKey = 'Earlier This Month';
        }

        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(notification);
        return acc;
    }, {} as Record<string, Notification[]>);
};
