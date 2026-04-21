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

/**
 * Formats a date string into a relative time ago format (e.g. "5m ago", "2h ago")
 */
export const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
        return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
        return `${diffInWeeks}w ago`;
    }

    return date.toLocaleDateString();
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
