import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek, differenceInHours, isThisYear } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Format a date to a unified, human-friendly format
 * - Within 1 hour: "5 menit lalu"
 * - Today: "Hari ini 14:30"
 * - Yesterday: "Kemarin 10:15"
 * - This week: "Senin 08:00"
 * - Older: "05 Des 16:45"
 */
export function formatRelativeDate(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const hoursDiff = differenceInHours(now, d);

    // Within the last hour - show relative time
    if (hoursDiff < 1) {
        return formatDistanceToNow(d, { addSuffix: true, locale: id });
    }

    // Today
    if (isToday(d)) {
        return `Hari ini ${format(d, 'HH:mm')}`;
    }

    // Yesterday
    if (isYesterday(d)) {
        return `Kemarin ${format(d, 'HH:mm')}`;
    }

    // This week - show day name
    if (isThisWeek(d)) {
        return format(d, 'EEEE HH:mm', { locale: id });
    }

    // Older - show date
    return format(d, 'dd MMM HH:mm');
}

/**
 * Format a date for display in tables - compact version
 * Uses relative time for recent items, absolute for older
 */
export function formatTableDate(date: string | Date): string {
    const d = new Date(date);
    const now = new Date();
    const hoursDiff = differenceInHours(now, d);

    // Within 24 hours - show relative
    if (hoursDiff < 24) {
        if (hoursDiff < 1) {
            return formatDistanceToNow(d, { addSuffix: true, locale: id });
        }
        return `${hoursDiff}j lalu`;
    }

    // Within 7 days
    const daysDiff = Math.floor(hoursDiff / 24);
    if (daysDiff < 7) {
        return `${daysDiff}h lalu`;
    }

    // Older - show compact date
    return format(d, 'dd MMM');
}

/**
 * Format SLA target date with urgency indication
 */
export function formatSlaDate(date: string | Date, status: string): {
    text: string;
    isOverdue: boolean;
    isApproaching: boolean;
} {
    if (status === 'RESOLVED' || status === 'CANCELLED') {
        return { text: '-', isOverdue: false, isApproaching: false };
    }

    const d = new Date(date);
    const now = new Date();
    const hoursDiff = (d.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isOverdue = hoursDiff < 0;
    const isApproaching = hoursDiff > 0 && hoursDiff <= 4;

    let text: string;
    if (isOverdue) {
        const overdueHours = Math.abs(Math.floor(hoursDiff));
        if (overdueHours < 24) {
            text = `${overdueHours}j terlambat`;
        } else {
            text = `${Math.floor(overdueHours / 24)}h terlambat`;
        }
    } else if (isApproaching) {
        text = `${Math.floor(hoursDiff)}j lagi`;
    } else {
        text = format(d, 'dd MMM HH:mm');
    }

    return { text, isOverdue, isApproaching };
}

/**
 * Format a date with smart year display
 * - Current year: "05 Des" (no year shown)
 * - Other years: "05 Des 23" (short year format)
 */
export function formatSmartDate(date: string | Date): string {
    const d = new Date(date);

    if (isThisYear(d)) {
        return format(d, 'dd MMM');
    }

    return format(d, 'dd MMM yy');
}

/**
 * Format a date with smart year display (full variant with time)
 * - Current year: "05 Des 14:30"
 * - Other years: "05 Des 23 14:30"
 */
export function formatSmartDateTime(date: string | Date): string {
    const d = new Date(date);

    if (isThisYear(d)) {
        return format(d, 'dd MMM HH:mm');
    }

    return format(d, 'dd MMM yy HH:mm');
}

/**
 * Format a date using Intl.DateTimeFormat for consistent locale-aware display
 * Primarily used in ticket detail components
 * 
 * @param dateString - ISO date string or empty
 * @param locale - Locale for formatting (default: 'en-US')
 * @param options - Optional Intl.DateTimeFormatOptions
 * @returns Formatted date string or 'N/A' if invalid
 */
export function formatDateTime(
    dateString: string | Date | null | undefined,
    locale: string = 'en-US',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!dateString) return 'N/A';

    const defaultOptions: Intl.DateTimeFormatOptions = {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
        ...options
    };

    try {
        return new Intl.DateTimeFormat(locale, defaultOptions).format(new Date(dateString));
    } catch {
        return 'N/A';
    }
}

/**
 * Format a date for Indonesia locale (id-ID)
 * Commonly used in SLA cards and Indonesian-facing UIs
 */
export function formatDateTimeID(dateString: string | Date | null | undefined): string {
    return formatDateTime(dateString, 'id-ID');
}

/**
 * Format a date as compact relative time
 * - Less than 1 hour: "5m"
 * - Less than 24 hours: "2h"
 * - Less than 7 days: "3d"
 * - Older: "Dec 5"
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
    if (!date) return '-';

    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return format(d, 'MMM d');
}
