import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Pause,
    AlertTriangle,
    Clock,
    MessageSquare,
    ChevronDown,
    ChevronUp,
    History,
    CalendarPlus,
    User,
    ArrowRight,
} from 'lucide-react';
import { TicketDetail, SlaAdjustment } from './types';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { cn } from '@/lib/utils';
import { isTerminalStatus } from './constants';
import { offHoursLabel, slaCountdown, SlaCountdown, useSlaClock } from '@/lib/slaCountdown';

interface SlaStatusCardProps {
    ticket: TicketDetail & {
        slaStartedAt?: string;
        firstResponseAt?: string;
        firstResponseTarget?: string;
        isFirstResponseBreached?: boolean;
        resolvedAt?: string;
        slaAdjustments?: SlaAdjustment[];
    };
    onOpenExtendSla?: () => void;
    canExtend?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
    WAITING_USER: 'Menunggu User',
    WAITING_VENDOR: 'Menunggu Vendor',
    WAITING_APPROVAL: 'Persetujuan Manajerial',
    TECHNICAL_COMPLEXITY: 'Kompleksitas Teknis',
    EXTERNAL_DEPENDENCY: 'Dependensi Eksternal',
    OTHER: 'Alasan Lainnya',
};

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

export const SlaStatusCard: React.FC<SlaStatusCardProps> = ({
    ticket,
    onOpenExtendSla,
    canExtend = false,
}) => {
    const [resolutionTimeRemaining, setResolutionTimeRemaining] = useState<string>('');
    const [firstResponseTimeRemaining, setFirstResponseTimeRemaining] = useState<string>('');
    const [percentRemaining, setPercentRemaining] = useState<number>(100);
    const [resolutionClock, setResolutionClock] = useState<SlaCountdown | null>(null);
    const [responseClock, setResponseClock] = useState<SlaCountdown | null>(null);
    const [now, setNow] = useState<Date>(() => new Date());
    const slaClock = useSlaClock();
    const [showHistory, setShowHistory] = useState<boolean>(false);

    const isResolved = isTerminalStatus(ticket.status);
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const slaNotStarted = !ticket.slaStartedAt;
    const adjustments = ticket.slaAdjustments || [];

    useEffect(() => {
        const calculateTimes = () => {
            const now = new Date();
            setNow(now);

            // Calculate Resolution Time (working time only for business-hours priorities)
            if (ticket.slaTarget && !isResolved) {
                const clock = slaCountdown(ticket.slaTarget, now, ticket.priority, slaClock);
                setResolutionClock(clock);
                setResolutionTimeRemaining(formatTimeRemaining(clock.remainingMs));

                // Calculate percentage based on slaStartedAt
                if (ticket.slaStartedAt) {
                    const total = slaCountdown(ticket.slaTarget, new Date(ticket.slaStartedAt), ticket.priority, slaClock).remainingMs;
                    const percent = total > 0 ? Math.max(0, Math.min(100, (clock.remainingMs / total) * 100)) : 0;
                    setPercentRemaining(percent);
                }
            }

            // Calculate First Response Time
            if (ticket.firstResponseTarget && !ticket.firstResponseAt && !isResolved) {
                const clock = slaCountdown(ticket.firstResponseTarget, now, ticket.priority, slaClock);
                setResponseClock(clock);
                setFirstResponseTimeRemaining(formatTimeRemaining(clock.remainingMs));
            }
        };

        calculateTimes();
        const interval = setInterval(calculateTimes, 60000);

        return () => clearInterval(interval);
    }, [ticket, isResolved, slaClock]);

    // Get Resolution Status
    const getResolutionStatus = () => {
        if (isResolved) return { status: 'resolved', text: 'Selesai', color: 'green' };
        if (isPaused) return { status: 'paused', text: 'Paused (Menunggu Vendor)', color: 'orange' };
        if (slaNotStarted) return { status: 'pending', text: 'Belum Dimulai', color: 'gray' };
        if (!ticket.slaTarget || !resolutionClock) return { status: 'none', text: 'SLA Tidak Diset', color: 'gray' };

        const diff = resolutionClock.remainingMs;

        if (diff <= 0) return { status: 'overdue', text: 'OVERDUE', color: 'red' };
        if (resolutionClock.offHours) return { status: 'offhours', text: resolutionTimeRemaining, color: 'gray' };
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

        if (!responseClock) return null;
        const diff = responseClock.remainingMs;

        if (diff <= 0) return { status: 'breached', text: 'DILANGGAR - Belum Ada Respon', color: 'red' };
        if (responseClock.offHours) return { status: 'offhours', text: firstResponseTimeRemaining, color: 'gray' };
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
                    bg: 'bg-primary/10 dark:bg-primary/20',
                    border: 'border-primary/20 dark:border-primary/30',
                    text: 'text-primary',
                };
        }
    };

    const resolutionColors = getColorClasses(resolution.color);

    return (
        <div className="bg-white dark:bg-slate-800/95 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-primary" />
                    Status SLA
                </h3>

                {adjustments.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 shadow-2xs hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                        title="Klik untuk melihat riwayat perpanjangan SLA"
                    >
                        <History className="w-3 h-3" />
                        <span>Diperpanjang ({adjustments.length}x)</span>
                        {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {/* Resolution Time SLA */}
                <div className={`p-3 rounded-xl border ${resolutionColors.bg} ${resolutionColors.border}`}>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Resolution Time
                        </span>
                        {resolution.status === 'overdue' && (
                            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                        )}
                        {resolution.status === 'paused' && (
                            <Pause className="w-4 h-4 text-orange-500" />
                        )}
                        {resolution.status === 'resolved' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                    </div>
                    <p className={`text-lg font-bold ${resolutionColors.text}`}>
                        {resolution.text}
                    </p>

                    {/* Progress Bar - only show if SLA started and not resolved/paused */}
                    {!isResolved && !isPaused && !slaNotStarted && ticket.slaTarget && (
                        <div className="mt-2.5">
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-[opacity,transform,colors] duration-200 ease-out ${resolution.color === 'red' ? 'bg-red-500' :
                                        resolution.color === 'yellow' ? 'bg-yellow-500' :
                                            'bg-primary'
                                        }`}
                                    style={{ width: `${percentRemaining}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Show SLA started time */}
                    {ticket.slaStartedAt && !isResolved && (
                        <p className="text-xs text-slate-500 mt-1.5">
                            Started: {formatDateTimeID(ticket.slaStartedAt)}
                        </p>
                    )}

                    {/* Show target time */}
                    {ticket.slaTarget && !isResolved && !isPaused && (
                        <p className="text-xs text-slate-500">
                            Target: {formatDateTimeID(ticket.slaTarget)}
                        </p>
                    )}

                    {/* Show resolved time */}
                    {isResolved && ticket.resolvedAt && (
                        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Finished: {formatDateTimeID(ticket.resolvedAt)}
                        </p>
                    )}

                    {/* Show paused info */}
                    {isPaused && (
                        <p className="text-xs text-orange-600 mt-1.5 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            {ticket.lastPausedAt ? `Dijeda sejak ${formatDateTimeID(ticket.lastPausedAt)}` : 'Dijeda'}
                            {ticket.slaRemainingMinutes != null && ` — sisa ${formatDuration(ticket.slaRemainingMinutes * 60000)} jam kerja`}
                        </p>
                    )}

                    {resolution.status === 'offhours' && resolutionClock && (
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                            <Pause className="w-3 h-3" />
                            {offHoursLabel(resolutionClock, now, slaClock)}
                        </p>
                    )}

                    {/* Show not started info */}
                    {slaNotStarted && !isResolved && (
                        <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pending Start
                        </p>
                    )}
                </div>

                {/* First Response SLA */}
                {firstResponse && (
                    <div className={`p-3 rounded-xl border ${getColorClasses(firstResponse.color).bg} ${getColorClasses(firstResponse.color).border}`}>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                <MessageSquare className="w-3.5 h-3.5" />
                                1st Response
                            </span>
                            {firstResponse?.status === 'met' && (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                            {firstResponse?.status === 'breached' && (
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            )}
                        </div>
                        <p className={`text-base font-bold ${firstResponse ? getColorClasses(firstResponse.color).text : ''}`}>
                            {firstResponse?.text}
                        </p>

                        {/* Show first response time if responded */}
                        {ticket.firstResponseAt && (
                            <p className="text-xs text-slate-500 mt-1.5">
                                Responded: {formatDateTimeID(ticket.firstResponseAt)}
                            </p>
                        )}

                        {firstResponse.status === 'offhours' && responseClock && (
                            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                                <Pause className="w-3 h-3" />
                                {offHoursLabel(responseClock, now, slaClock)}
                            </p>
                        )}

                        {/* Show target if not responded */}
                        {!isPaused && !ticket.firstResponseAt && ticket.firstResponseTarget && (
                            <p className="text-xs text-slate-500 mt-1.5">
                                Target: {formatDateTimeID(ticket.firstResponseTarget)}
                            </p>
                        )}
                    </div>
                )}

                {/* Action: Extend SLA Button */}
                {canExtend && onOpenExtendSla && !isResolved && (
                    <button
                        type="button"
                        onClick={onOpenExtendSla}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                    >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Perpanjang Target SLA</span>
                    </button>
                )}

                {/* Expandable SLA Extension History */}
                {showHistory && adjustments.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <History className="w-3.5 h-3.5 text-primary" />
                            <span>Riwayat Perpanjangan SLA</span>
                        </div>

                        <div className="space-y-2 divide-y divide-slate-200/60 dark:divide-slate-800">
                            {adjustments.map((adj, index) => {
                                const categoryLabel = CATEGORY_LABELS[adj.reasonCategory] || adj.reasonCategory;
                                return (
                                    <div key={adj.id || index} className={cn("text-xs space-y-1", index > 0 && "pt-2")}>
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold px-1.5 py-0.5 rounded bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/30">
                                                {categoryLabel}
                                            </span>
                                            <span className="text-slate-400 font-mono">
                                                +{adj.minutes}m
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                            <span className="truncate">
                                                {adj.previousTarget ? formatDateTimeID(adj.previousTarget) : '-'}
                                            </span>
                                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span className="font-bold text-primary truncate">
                                                {adj.newTarget ? formatDateTimeID(adj.newTarget) : '-'}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                                            "{adj.reasonText}"
                                        </p>

                                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-400" />
                                                {adj.actor?.fullName || 'Teknisi'}
                                            </span>
                                            <span>
                                                {formatDateTimeID(adj.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

