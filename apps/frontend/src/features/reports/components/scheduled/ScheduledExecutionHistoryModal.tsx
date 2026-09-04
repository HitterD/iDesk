import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
    X,
    History,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Mail,
    Users,
    Clock,
    AlertCircle,
    Loader2
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { ScheduledReportConfig, ScheduledReportExecution } from './types';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface ScheduledExecutionHistoryModalProps {
    config: ScheduledReportConfig | null;
    onClose: () => void;
}

export const ScheduledExecutionHistoryModal: React.FC<ScheduledExecutionHistoryModalProps> = ({
    config,
    onClose,
}) => {
    // Body scroll lock on open
    useEffect(() => {
        if (config) {
            lockBodyScroll();
            return () => {
                unlockBodyScroll();
            };
        }
    }, [config]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const {
        data: historyData,
        isLoading,
        isError,
    } = useQuery<{ success: boolean; data: ScheduledReportExecution[] }>({
        queryKey: ['reports', 'scheduled', 'executions', config?.id],
        queryFn: async () => {
            if (!config) return { success: true, data: [] };
            const response = await api.get(`/reports/scheduled/${config.id}/executions`);
            return response.data;
        },
        enabled: !!config?.id,
        staleTime: 15000,
    });

    const executions = historyData?.data || [];

    // Calculate quick metrics
    const totalRuns = executions.length;
    const successfulRuns = executions.filter(e => e.status === 'SUCCESS').length;
    const totalEmailsSent = executions.reduce((acc, e) => acc + (e.emailsSent || 0), 0);
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

    if (!config) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Box */}
            <div className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden z-10 animate-scale-in">
                {/* Modal Header (Fixed) */}
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                            <History className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    Execution History
                                </h3>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {config.schedule} • {config.sendTime} WIB
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Audit logs and delivery metrics for <strong className="text-slate-700 dark:text-slate-200">{config.name}</strong>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Summary Stat Chips (Fixed) */}
                <div className="shrink-0 grid grid-cols-3 gap-3 p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                            Total Executions
                        </span>
                        <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                            {totalRuns}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                            Success Rate
                        </span>
                        <div className={cn(
                            "text-xl font-extrabold",
                            successRate >= 90 ? "text-emerald-600 dark:text-emerald-400" :
                            successRate >= 50 ? "text-amber-600 dark:text-amber-400" :
                            "text-red-600 dark:text-red-400"
                        )}>
                            {totalRuns === 0 ? '—' : `${successRate}%`}
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-0.5">
                            Total Emails Sent
                        </span>
                        <div className="text-xl font-extrabold text-primary">
                            {totalEmailsSent}
                        </div>
                    </div>
                </div>

                {/* Executions Content (Scrollable with min-h-0) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                            <span className="text-sm">Loading execution logs...</span>
                        </div>
                    ) : isError ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>Failed to load execution logs. Please try again.</span>
                        </div>
                    ) : executions.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                No Executions Yet
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                                This scheduled report has not been triggered yet. It will run according to its cadence or when triggered manually.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {executions.map((ex) => {
                                const execDate = new Date(ex.executedAt);
                                const isSuccess = ex.status === 'SUCCESS';
                                const isPartial = ex.status === 'PARTIAL';
                                const isFailed = ex.status === 'FAILED';

                                return (
                                    <div
                                        key={ex.id}
                                        className={cn(
                                            "p-3.5 rounded-xl border transition-colors flex flex-col gap-2",
                                            isSuccess
                                                ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/50"
                                                : isPartial
                                                ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                                                : "bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                                        )}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                {isSuccess ? (
                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </div>
                                                ) : isPartial ? (
                                                    <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                                                        <XCircle className="w-3.5 h-3.5" />
                                                    </div>
                                                )}

                                                <div>
                                                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                                                        {format(execDate, 'dd MMM yyyy, HH:mm:ss')} WIB
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-2">
                                                        ({formatDistanceToNow(execDate, { addSuffix: true, locale: idLocale })})
                                                    </span>
                                                </div>
                                            </div>

                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                    isSuccess && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
                                                    isPartial && "bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60",
                                                    isFailed && "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800/60"
                                                )}
                                            >
                                                {ex.status}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                                            <div className="flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Target Recipients: <strong>{ex.recipientsCount}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Emails Delivered: <strong>{ex.emailsSent}</strong></span>
                                            </div>
                                        </div>

                                        {ex.errorMessage && (
                                            <div className="mt-1 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-600 dark:text-red-400 font-mono break-all">
                                                <div className="font-semibold mb-0.5 text-red-700 dark:text-red-300 font-sans">
                                                    Failure Details:
                                                </div>
                                                {ex.errorMessage}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Footer (Fixed) */}
                <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50/80 dark:bg-slate-900/90">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
