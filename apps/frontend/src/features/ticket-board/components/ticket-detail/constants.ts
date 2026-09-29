import { Inbox, CircleDot, Hourglass, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    TODO: { label: 'Open', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: Inbox },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/30', icon: CircleDot },
    WAITING_VENDOR: { label: 'Waiting Vendor', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', icon: Hourglass },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
    RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    CLOSED: { label: 'Closed', color: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: Lock },
};

/** Statuses where agent-side controls (status, assign, cancel) are locked. */
export const TERMINAL_STATUSES: readonly string[] = ['RESOLVED', 'CLOSED', 'CANCELLED'];
export const isTerminalStatus = (status: string): boolean => TERMINAL_STATUSES.includes(status);

/** Statuses from which the requester may close the ticket themselves. */
export const SELF_RESOLVABLE_STATUSES: readonly string[] = ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR'];

export const CLOSED_TICKET_NOTICE = 'Tiket sudah ditutup. Buat tiket baru jika masih ada kendala.';

export const PRIORITY_CONFIG: Record<string, { label: string; shortLabel?: string; color: string; dot: string }> = {
    LOW: { label: 'Low (Minor/Cosmetic)', shortLabel: 'Low', color: 'text-slate-500', dot: 'bg-slate-400' },
    MEDIUM: { label: 'Normal (Moderate)', shortLabel: 'Normal', color: 'text-yellow-600', dot: 'bg-yellow-500' },
    HIGH: { label: 'Urgent (Major Impact)', shortLabel: 'Urgent', color: 'text-orange-600', dot: 'bg-orange-500' },
    CRITICAL: { label: 'Blocker (Critical)', shortLabel: 'Blocker', color: 'text-red-600', dot: 'bg-red-500 animate-pulse' },
};

export const STATUS_OPTIONS = [
    { value: 'TODO', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'WAITING_VENDOR', label: 'Waiting Vendor' },
    { value: 'RESOLVED', label: 'Resolved' },
];
