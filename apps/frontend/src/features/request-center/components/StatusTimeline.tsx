import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusLog } from '../api/lost-item.api';
import { StatusBadge } from './StatusBadge';

const STATUS_DOT_COLOR: Record<string, string> = {
    REPORTED:    'bg-amber-400',
    SEARCHING:   'bg-blue-400',
    CLAIMED:     'bg-purple-400',
    VERIFIED:    'bg-emerald-400',
    RETURNED:    'bg-green-400',
    CLOSED_LOST: 'bg-slate-400',
};

interface StatusTimelineProps {
    logs: StatusLog[];
    className?: string;
}

export const StatusTimeline = ({ logs, className }: StatusTimelineProps) => {
    if (!logs || logs.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center py-8 text-slate-400', className)}>
                <p className="text-xs font-bold">Belum ada riwayat status</p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-0', className)}>
            {logs.map((log, idx) => (
                <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3"
                >
                    <div className="flex flex-col items-center">
                        <div className={cn('w-2.5 h-2.5 rounded-full mt-1 shrink-0', STATUS_DOT_COLOR[log.toStatus] || 'bg-slate-400')} />
                        {idx < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                        <StatusBadge status={log.toStatus} showIcon={false} className="mb-1" />
                        <p className="text-xs text-slate-400 font-medium">
                            {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                            {log.changedBy ? ` · ${log.changedBy.fullName}` : ' · System'}
                        </p>
                        {log.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">
                                "{log.notes}"
                            </p>
                        )}
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
