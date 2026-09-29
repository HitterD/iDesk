import { Inbox, CircleDot, Hourglass, CheckCircle2, AlertCircle, Ban, Flame, AlertTriangle, Wrench, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const TICKET_STATUS = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    WAITING_VENDOR: 'WAITING_VENDOR',
    RESOLVED: 'RESOLVED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED',
} as const;

/** Statuses an agent must never pick manually (CLOSED is set by requester/system only). */
export const NON_SELECTABLE_STATUSES: readonly string[] = [TICKET_STATUS.CANCELLED, TICKET_STATUS.CLOSED];

export const TICKET_PRIORITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL',
    HARDWARE_INSTALLATION: 'HARDWARE_INSTALLATION',
    ORACLE_REQUEST: 'ORACLE_REQUEST',
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
    shortLabel?: string;
    color: string;
    dot: string;
    barColor: string;
    badgeColor: string;
    icon: LucideIcon | null;
    iconClass?: string;
    isSystemLocked?: boolean;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    TODO: {
        label: 'Open',
        color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: Inbox,
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        textColor: 'text-slate-700 dark:text-slate-300',
        columnColor: 'bg-slate-400',
    },
    IN_PROGRESS: {
        label: 'In Progress',
        color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        icon: CircleDot,
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        textColor: 'text-blue-600 dark:text-blue-400',
        columnColor: 'bg-blue-500',
    },
    WAITING_VENDOR: {
        label: 'Waiting Vendor',
        color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        icon: Hourglass,
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-600 dark:text-amber-400',
        columnColor: 'bg-amber-500',
    },
    RESOLVED: {
        label: 'Resolved',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        icon: CheckCircle2,
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        textColor: 'text-green-600 dark:text-green-400',
        columnColor: 'bg-green-500',
    },
    CLOSED: {
        label: 'Closed',
        color: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
        icon: Lock,
        bgColor: 'bg-slate-200 dark:bg-slate-700',
        textColor: 'text-slate-700 dark:text-slate-300',
        columnColor: 'bg-slate-500',
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
        label: 'Low (Minor/Cosmetic)',
        shortLabel: 'Low',
        color: 'text-slate-500 bg-slate-50 dark:bg-slate-800',
        dot: 'bg-slate-400',
        barColor: 'bg-slate-400',
        badgeColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
        icon: null,
    },
    MEDIUM: {
        label: 'Normal (Moderate)',
        shortLabel: 'Normal',
        color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
        dot: 'bg-yellow-500',
        barColor: 'bg-yellow-500',
        badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        icon: null,
    },
    HIGH: {
        label: 'Urgent (Major Impact)',
        shortLabel: 'Urgent',
        color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
        dot: 'bg-orange-500',
        barColor: 'bg-orange-500',
        badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
        icon: AlertTriangle,
        iconClass: 'text-orange-500',
    },
    CRITICAL: {
        label: 'Blocker (Critical)',
        shortLabel: 'Blocker',
        color: 'text-red-600 bg-red-50 dark:bg-red-900/20',
        dot: 'bg-red-500 animate-pulse',
        barColor: 'bg-red-500',
        badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: Flame,
        iconClass: 'text-red-500 animate-pulse',
    },
    HARDWARE_INSTALLATION: {
        label: 'Hardware Installation',
        shortLabel: 'Hardware',
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
        dot: 'bg-amber-500',
        barColor: 'bg-amber-500',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: Wrench,
        iconClass: 'text-amber-500',
        isSystemLocked: true,
    },
    ORACLE_REQUEST: {
        label: 'Oracle/K2',
        shortLabel: 'Oracle/K2',
        color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
        dot: 'bg-blue-500',
        barColor: 'bg-blue-500',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        icon: null,
        isSystemLocked: true,
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
