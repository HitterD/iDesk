import React, { useState, useEffect } from 'react';
import { Timer, CheckCircle2, AlertCircle, Pause, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import { TicketDetail } from './types';

interface SlaStatusCardProps {
    ticket: TicketDetail & {
        slaStartedAt?: string;
        firstResponseAt?: string;
        firstResponseTarget?: string;
        isFirstResponseBreached?: boolean;
        resolvedAt?: string;
    };
}

const formatTimeRemaining = (diffMs: number): string => {
    if (diffMs <= 0) return 'Overdue';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(' ');
};

const formatDuration = (diffMs: number): string => {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(' ');
};

export const SlaStatusCard: React.FC<SlaStatusCardProps> = ({ ticket }) => {
    const [resolutionTimeRemaining, setResolutionTimeRemaining] = useState<string>('');
    const [firstResponseTimeRemaining, setFirstResponseTimeRemaining] = useState<string>('');
    const [percentRemaining, setPercentRemaining] = useState<number>(100);

    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED';
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const slaNotStarted = !ticket.slaStartedAt;

    useEffect(() => {
        const calculateTimes = () => {
            const now = new Date();

            // Calculate Resolution Time
            if (ticket.slaTarget && !isResolved) {
                const target = new Date(ticket.slaTarget);
                const diff = target.getTime() - now.getTime();
                setResolutionTimeRemaining(formatTimeRemaining(diff));

                // Calculate percentage based on slaStartedAt
                if (ticket.slaStartedAt) {
                    const started = new Date(ticket.slaStartedAt);
                    const totalTime = target.getTime() - started.getTime();
                    const elapsed = now.getTime() - started.getTime();
                    const percent = Math.max(0, Math.min(100, ((totalTime - elapsed) / totalTime) * 100));
                    setPercentRemaining(percent);
                }
            }

            // Calculate First Response Time
            if (ticket.firstResponseTarget && !ticket.firstResponseAt && !isResolved) {
                const target = new Date(ticket.firstResponseTarget);
                const diff = target.getTime() - now.getTime();
                setFirstResponseTimeRemaining(formatTimeRemaining(diff));
            }
        };

        calculateTimes();
        const interval = setInterval(calculateTimes, 60000);

        return () => clearInterval(interval);
    }, [ticket, isResolved]);

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        return new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(dateString));
    };

    // Get Resolution Status
    const getResolutionStatus = () => {
        if (isResolved) return { status: 'resolved', text: 'Selesai', color: 'green' };
        if (isPaused) return { status: 'paused', text: 'Paused (Menunggu Vendor)', color: 'orange' };
        if (slaNotStarted) return { status: 'pending', text: 'Belum Dimulai', color: 'gray' };
        if (!ticket.slaTarget) return { status: 'none', text: 'SLA Tidak Diset', color: 'gray' };

        const now = new Date();
        const target = new Date(ticket.slaTarget);
        const diff = target.getTime() - now.getTime();

        if (diff <= 0) return { status: 'overdue', text: 'OVERDUE', color: 'red' };
        if (diff < 4 * 60 * 60 * 1000) return { status: 'warning', text: resolutionTimeRemaining, color: 'yellow' };
        return { status: 'ok', text: resolutionTimeRemaining, color: 'blue' };
    };

    // Get First Response Status
    const getFirstResponseStatus = () => {
        if (ticket.firstResponseAt) {
            const responseTime = new Date(ticket.firstResponseAt).getTime() - new Date(ticket.createdAt).getTime();
            const withinSla = !ticket.isFirstResponseBreached;
            return {
                status: withinSla ? 'met' : 'breached',
                text: withinSla ? `Direspon dalam ${formatDuration(responseTime)}` : 'SLA Dilanggar',
                color: withinSla ? 'green' : 'red',
            };
        }

        if (!ticket.firstResponseTarget) return null;

        if (isPaused) return { status: 'paused', text: 'Paused', color: 'orange' };

        const now = new Date();
        const target = new Date(ticket.firstResponseTarget);
        const diff = target.getTime() - now.getTime();

        if (diff <= 0) return { status: 'breached', text: 'DILANGGAR - Belum Ada Respon', color: 'red' };
        if (diff < 1 * 60 * 60 * 1000) return { status: 'warning', text: firstResponseTimeRemaining, color: 'yellow' };
        return { status: 'pending', text: firstResponseTimeRemaining, color: 'blue' };
    };

    const resolution = getResolutionStatus();
    const firstResponse = getFirstResponseStatus();

    const getColorClasses = (color: string) => {
        switch (color) {
            case 'red':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    border: 'border-red-200 dark:border-red-800',
                    text: 'text-red-700 dark:text-red-400',
                };
            case 'orange':
                return {
                    bg: 'bg-orange-50 dark:bg-orange-900/20',
                    border: 'border-orange-200 dark:border-orange-800',
                    text: 'text-orange-700 dark:text-orange-400',
                };
            case 'yellow':
                return {
                    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                    border: 'border-yellow-200 dark:border-yellow-800',
                    text: 'text-yellow-700 dark:text-yellow-400',
                };
            case 'green':
                return {
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    border: 'border-green-200 dark:border-green-800',
                    text: 'text-green-700 dark:text-green-400',
                };
            case 'gray':
                return {
                    bg: 'bg-slate-50 dark:bg-slate-900',
                    border: 'border-slate-200 dark:border-slate-700',
                    text: 'text-slate-500 dark:text-slate-400',
                };
            default:
                return {
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                    border: 'border-blue-200 dark:border-blue-800',
                    text: 'text-blue-700 dark:text-blue-400',
                };
        }
    };

    const resolutionColors = getColorClasses(resolution.color);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Status SLA
            </h3>

            <div className="space-y-4">
                {/* Resolution Time SLA */}
                <div className={`p-4 rounded-xl border ${resolutionColors.bg} ${resolutionColors.border}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            Waktu Resolusi
                        </span>
                        {resolution.status === 'overdue' && (
                            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                        )}
                        {resolution.status === 'paused' && (
                            <Pause className="w-5 h-5 text-orange-500" />
                        )}
                        {resolution.status === 'resolved' && (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        )}
                    </div>
                    <p className={`text-xl font-bold ${resolutionColors.text}`}>
                        {resolution.text}
                    </p>

                    {/* Progress Bar - only show if SLA started and not resolved/paused */}
                    {!isResolved && !isPaused && !slaNotStarted && ticket.slaTarget && (
                        <div className="mt-3">
                            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${
                                        resolution.color === 'red' ? 'bg-red-500' :
                                        resolution.color === 'yellow' ? 'bg-yellow-500' :
                                        'bg-blue-500'
                                    }`}
                                    style={{ width: `${percentRemaining}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Show SLA started time */}
                    {ticket.slaStartedAt && !isResolved && (
                        <p className="text-xs text-slate-500 mt-2">
                            Dimulai: {formatDate(ticket.slaStartedAt)}
                        </p>
                    )}

                    {/* Show target time */}
                    {ticket.slaTarget && !isResolved && (
                        <p className="text-xs text-slate-500">
                            Target: {formatDate(ticket.slaTarget)}
                        </p>
                    )}

                    {/* Show resolved time */}
                    {isResolved && ticket.resolvedAt && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Selesai: {formatDate(ticket.resolvedAt)}
                        </p>
                    )}

                    {/* Show paused info */}
                    {isPaused && (
                        <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            Timer di-pause selama menunggu vendor
                        </p>
                    )}

                    {/* Show not started info */}
                    {slaNotStarted && !isResolved && (
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            SLA akan dimulai saat agent mengambil tiket
                        </p>
                    )}
                </div>

                {/* First Response SLA */}
                {firstResponse && (
                    <div className={`p-4 rounded-xl border ${getColorClasses(firstResponse.color).bg} ${getColorClasses(firstResponse.color).border}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                First Response
                            </span>
                            {firstResponse.status === 'met' && (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                            {firstResponse.status === 'breached' && (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            )}
                        </div>
                        <p className={`text-lg font-bold ${getColorClasses(firstResponse.color).text}`}>
                            {firstResponse.text}
                        </p>

                        {/* Show first response time if responded */}
                        {ticket.firstResponseAt && (
                            <p className="text-xs text-slate-500 mt-2">
                                Direspon pada: {formatDate(ticket.firstResponseAt)}
                            </p>
                        )}

                        {/* Show target if not responded */}
                        {!ticket.firstResponseAt && ticket.firstResponseTarget && (
                            <p className="text-xs text-slate-500 mt-2">
                                Target: {formatDate(ticket.firstResponseTarget)}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
