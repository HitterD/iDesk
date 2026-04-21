import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, User, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';
import { AuditLog, AUDIT_ACTION_CONFIG, AuditAction } from '../../../types/audit.types';
import { cn } from '@/lib/utils';

interface TimelineGroup {
    hour: string;
    logs: AuditLog[];
}

interface AuditTimelineViewProps {
    date: string; // ISO date string (YYYY-MM-DD)
}

export function AuditTimelineView({ date }: AuditTimelineViewProps) {
    const [expandedHours, setExpandedHours] = useState<Set<string>>(new Set());

    const { data: timeline, isLoading, isError } = useQuery<TimelineGroup[]>({
        queryKey: ['audit-timeline', date],
        queryFn: async () => {
            const response = await api.get(`/audit/timeline/${date}`);
            return response.data;
        },
        enabled: !!date,
        retry: 1,
    });

    const toggleHour = (hour: string) => {
        setExpandedHours(prev => {
            const next = new Set(prev);
            if (next.has(hour)) {
                next.delete(hour);
            } else {
                next.add(hour);
            }
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-[hsl(var(--border))]" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--error-500))] opacity-50" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Failed to load timeline data</p>
            </div>
        );
    }

    if (!timeline || timeline.length === 0) {
        return (
            <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No activity logged for this date</p>
            </div>
        );
    }

    return (
        <div className="relative space-y-4">
            {/* Vertical timeline line — using border token */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-[hsl(var(--border))]" />

            {timeline.map((group, index) => (
                <motion.div
                    key={group.hour}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="relative"
                >
                    {/* Hour marker */}
                    <button
                        onClick={() => toggleHour(group.hour)}
                        className="flex items-center gap-4 w-full text-left group"
                    >
                        <div className="relative z-10 w-12 h-12 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center shadow-sm">
                            <span className="text-xs font-bold text-primary-foreground">{group.hour}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded-xl border border-[hsl(var(--border))] transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-slate-800 dark:text-white">
                                    {group.logs.length} {group.logs.length === 1 ? 'event' : 'events'}
                                </span>
                                <div className="flex -space-x-1">
                                    {group.logs.slice(0, 4).map((log) => {
                                        const config = AUDIT_ACTION_CONFIG[log.action as AuditAction];
                                        return (
                                            <span
                                                key={log.id}
                                                className={cn(
                                                    "w-6 h-6 rounded-lg flex items-center justify-center text-xs",
                                                    config?.bgColor || 'bg-slate-200 dark:bg-slate-700'
                                                )}
                                            >
                                                {config?.icon || '📄'}
                                            </span>
                                        );
                                    })}
                                    {group.logs.length > 4 && (
                                        <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                            +{group.logs.length - 4}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {expandedHours.has(group.hour) ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </div>
                    </button>

                    {/* Expanded details */}
                    <AnimatePresence>
                        {expandedHours.has(group.hour) && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="ml-16 mt-2 space-y-2 overflow-hidden"
                            >
                                {group.logs.map(log => {
                                    const config = AUDIT_ACTION_CONFIG[log.action as AuditAction];
                                    return (
                                        <motion.div
                                            key={log.id}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="flex items-start gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-[hsl(var(--border))]"
                                        >
                                            <span className={cn(
                                                "p-1.5 rounded-lg",
                                                config?.bgColor || 'bg-slate-200 dark:bg-slate-700'
                                            )}>
                                                <span className="text-sm">{config?.icon || '📄'}</span>
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={cn(
                                                        "font-semibold",
                                                        config?.color || 'text-slate-800 dark:text-white'
                                                    )}>
                                                        {config?.label || log.action}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                                                        {new Date(log.createdAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                                    {log.description || `${log.entityType} ${log.entityId || ''}`}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                                    <User className="w-3 h-3" />
                                                    {log.user?.fullName || 'System'}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            ))}
        </div>
    );
}
