import { Inbox, CircleDot, Hourglass, AlertCircle, CheckCircle2 } from 'lucide-react';

export const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    TODO: { label: 'Open', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: Inbox },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: CircleDot },
    WAITING_VENDOR: { label: 'Waiting Vendor', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', icon: Hourglass },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
    RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    LOW: { label: 'Low', color: 'text-slate-500', dot: 'bg-slate-400' },
    MEDIUM: { label: 'Medium', color: 'text-yellow-600', dot: 'bg-yellow-500' },
    HIGH: { label: 'High', color: 'text-orange-600', dot: 'bg-orange-500' },
    CRITICAL: { label: 'Critical', color: 'text-red-600', dot: 'bg-red-500 animate-pulse' },
};
