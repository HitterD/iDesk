import React from 'react';
import { Clock, Search, UserCheck, CheckCircle2, PackageCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LostItemStatus } from '../api/lost-item.api';
import { FoundClaimStatus } from '../api/found-claim.api';

type AnyStatus = LostItemStatus | FoundClaimStatus | string;

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    REPORTED:    { label: 'Dilaporkan',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       icon: Clock },
    SEARCHING:   { label: 'Dicari',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',           icon: Search },
    CLAIMED:     { label: 'Ada Penemu',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',   icon: UserCheck },
    VERIFIED:    { label: 'Terverifikasi',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    RETURNED:    { label: 'Dikembalikan',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',       icon: PackageCheck },
    CLOSED_LOST: { label: 'Tidak Ditemukan', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',          icon: XCircle },
    PENDING:     { label: 'Pending',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       icon: Clock },
    MATCHED:     { label: 'Matched',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    REJECTED:    { label: 'Rejected',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',               icon: XCircle },
};

interface StatusBadgeProps {
    status: AnyStatus;
    showIcon?: boolean;
    className?: string;
}

export const StatusBadge = ({ status, showIcon = true, className }: StatusBadgeProps) => {
    const cfg = STATUS_MAP[status] || STATUS_MAP.REPORTED;
    const Icon = cfg.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider', cfg.color, className)}>
            {showIcon && <Icon className="w-3 h-3" />}
            {cfg.label}
        </span>
    );
};
