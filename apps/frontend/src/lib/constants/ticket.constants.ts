import { Inbox, CircleDot, Hourglass, CheckCircle2, AlertCircle, Ban, Flame, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TICKET_STATUS = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_VENDOR: 'WAITING_VENDOR',
    RESOLVED: 'RESOLVED',
    CANCELLED: 'CANCELLED',
} as const;

export const TICKET_PRIORITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
} as const;

interface StatusConfig {
    label: string;
    color: string;
    icon: LucideIcon;
    bgColor: string;
    textColor: string;
    columnColor: string;
}

interface PriorityConfig {
    label: string;
    color: string;
    dot: string;
    barColor: string;
    badgeColor: string;
    icon: LucideIcon | null;
    iconClass?: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    TODO: {
        label: 'Open',
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        icon: Inbox,
        bgColor: 'bg-slate-100 dark:bg-slate-700',
        textColor: 'text-slate-600 dark:text-slate-300',
        columnColor: 'bg-slate-500',
    },
    IN_PROGRESS: {
        label: 'In Progress',
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        icon: CircleDot,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-600 dark:text-blue-400',
        columnColor: 'bg-blue-500',
    },
    WAITING_VENDOR: {
        label: 'Waiting Vendor',
        color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        icon: Hourglass,
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        textColor: 'text-orange-600 dark:text-orange-400',
        columnColor: 'bg-orange-500',
    },
    RESOLVED: {
        label: 'Resolved',
        color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle2,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600 dark:text-green-400',
        columnColor: 'bg-green-500',
    },
    CANCELLED: {
        label: 'Cancelled',
        color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        icon: Ban,
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-600 dark:text-red-400',
        columnColor: 'bg-red-500',
    },
} as const;

export const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
    LOW: {
        label: 'Low',
        color: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
        dot: 'bg-slate-400',
        barColor: 'bg-slate-400',
        badgeColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        icon: null,
    },
    MEDIUM: {
        label: 'Medium',
        color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
        dot: 'bg-yellow-500',
        barColor: 'bg-yellow-500',
        badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: null,
    },
    HIGH: {
        label: 'High',
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
        dot: 'bg-orange-500',
        barColor: 'bg-orange-500',
        badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        icon: AlertTriangle,
        iconClass: 'text-orange-500',
    },
    CRITICAL: {
        label: 'Critical',
        color: 'text-red-600 bg-red-50 dark:bg-red-900/20',
        dot: 'bg-red-500 animate-pulse',
        barColor: 'bg-red-500',
        badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: Flame,
        iconClass: 'text-red-500 animate-pulse',
    },
} as const;

export const KANBAN_COLUMNS = [
    { id: 'TODO', title: 'Open', ...STATUS_CONFIG.TODO },
    { id: 'IN_PROGRESS', title: 'In Progress', ...STATUS_CONFIG.IN_PROGRESS },
    { id: 'WAITING_VENDOR', title: 'Waiting Vendor', ...STATUS_CONFIG.WAITING_VENDOR },
    { id: 'RESOLVED', title: 'Resolved', ...STATUS_CONFIG.RESOLVED },
] as const;

export type TicketStatus = keyof typeof STATUS_CONFIG;
export type TicketPriority = keyof typeof PRIORITY_CONFIG;
