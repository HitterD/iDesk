import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, User, AlertCircle } from 'lucide-react';
import api from '../../../lib/api';
import { AuditLog, AUDIT_ACTION_CONFIG, AuditAction } from '../../../types/audit.types';

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
                    <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-red-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Failed to load timeline data</p>
            </div>
        );
    }

    if (!timeline || timeline.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No activity logged for this date</p>
            </div>
        );
    }

    return (
        <div className="relative space-y-4">
            {/* Vertical timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-500/50 via-purple-500/30 to-transparent" />

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
                        <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <span className="text-xs font-bold text-white">{group.hour}</span>
                        </div>
                        <div className="flex-1 flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-white">
                                    {group.logs.length} {group.logs.length === 1 ? 'event' : 'events'}
                                </span>
                                <div className="flex -space-x-1">
                                    {group.logs.slice(0, 4).map((log, i) => {
                                        const config = AUDIT_ACTION_CONFIG[log.action as AuditAction];
                                        return (
                                            <span
                                                key={log.id}
                                                className={`w-6 h-6 rounded-full ${config?.bgColor || 'bg-gray-500/20'} flex items-center justify-center text-xs`}
                                            >
                                                {config?.icon || '📄'}
                                            </span>
                                        );
                                    })}
                                    {group.logs.length > 4 && (
                                        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs text-white/60">
                                            +{group.logs.length - 4}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {expandedHours.has(group.hour) ? (
                                <ChevronUp className="w-5 h-5 text-white/40" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-white/40" />
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
                                            className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/5"
                                        >
                                            <span className={`p-1.5 rounded-lg ${config?.bgColor || 'bg-gray-500/20'}`}>
                                                <span className="text-sm">{config?.icon || '📄'}</span>
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className={`font-medium ${config?.color || 'text-white'}`}>
                                                        {config?.label || log.action}
                                                    </span>
                                                    <span className="text-white/40">•</span>
                                                    <span className="text-white/60">
                                                        {new Date(log.createdAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-white/70 truncate mt-0.5">
                                                    {log.description || `${log.entityType} ${log.entityId || ''}`}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
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
