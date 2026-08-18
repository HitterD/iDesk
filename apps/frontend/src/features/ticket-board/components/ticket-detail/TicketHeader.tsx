import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Pause,
    MessageSquare,
    Copy,
    Check,
    PanelRightOpen,
    PanelRightClose,
    Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './constants';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface TicketHeaderProps {
    ticket: TicketDetail & {
        slaStartedAt?: string;
        firstResponseAt?: string;
        firstResponseTarget?: string;
        isFirstResponseBreached?: boolean;
    };
    onCancel?: () => void;
    isCancelling?: boolean;
    onResolve?: () => void;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
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

export const TicketHeader: React.FC<TicketHeaderProps> = ({
    ticket,
    onCancel,
    isCancelling = false,
    onResolve,
    isSidebarOpen = true,
    onToggleSidebar,
}) => {
    const navigate = useNavigate();
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [resolutionTime, setResolutionTime] = useState<string>('');
    const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'overdue' | 'resolved' | 'paused'>('ok');
    const [copied, setCopied] = useState(false);

    const isResolved = ticket.status === 'RESOLVED';
    const isCancelled = ticket.status === 'CANCELLED';
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const isTerminal = isResolved || isCancelled;

    // Calculate SLA time
    useEffect(() => {
        const calculateSla = () => {
            if (isResolved || isCancelled) {
                setSlaStatus('resolved');
                setResolutionTime('Done');
                return;
            }
            if (isPaused) {
                setSlaStatus('paused');
                setResolutionTime('Paused');
                return;
            }
            if (!ticket.slaTarget) {
                setResolutionTime('No SLA');
                return;
            }

            const now = new Date();
            const target = new Date(ticket.slaTarget);
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
                setSlaStatus('overdue');
                setResolutionTime('Overdue');
            } else if (diff < 4 * 60 * 60 * 1000) {
                setSlaStatus('warning');
                setResolutionTime(formatTimeRemaining(diff));
            } else {
                setSlaStatus('ok');
                setResolutionTime(formatTimeRemaining(diff));
            }
        };

        calculateSla();
        const interval = setInterval(calculateSla, 60000);
        return () => clearInterval(interval);
    }, [ticket, isResolved, isCancelled, isPaused]);

    // First response status
    const getFirstResponseStatus = () => {
        if (ticket.firstResponseAt) return { text: 'Responded', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50' };
        if (ticket.isFirstResponseBreached) return { text: 'FR Breached', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50' };
        return null;
    };
    const firstResponse = getFirstResponseStatus();

    const handleCopyNumber = () => {
        const num = ticket.ticketNumber || ticket.id;
        navigator.clipboard.writeText(num);
        setCopied(true);
        toast.success(`Copied ticket #${num}`);
        setTimeout(() => setCopied(false), 2000);
    };

    const confirmCancel = () => {
        if (onCancel) onCancel();
        setShowCancelConfirm(false);
    };

    const getSlaColors = () => {
        switch (slaStatus) {
            case 'overdue':
                return {
                    bg: 'bg-rose-50 dark:bg-rose-950/40',
                    text: 'text-rose-700 dark:text-rose-400',
                    border: 'border-rose-200 dark:border-rose-900/60',
                    icon: AlertTriangle,
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50 dark:bg-amber-950/40',
                    text: 'text-amber-700 dark:text-amber-400',
                    border: 'border-amber-200 dark:border-amber-900/60',
                    icon: Clock,
                };
            case 'paused':
                return {
                    bg: 'bg-orange-50 dark:bg-orange-950/40',
                    text: 'text-orange-700 dark:text-orange-400',
                    border: 'border-orange-200 dark:border-orange-900/60',
                    icon: Pause,
                };
            case 'resolved':
                return {
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                    text: 'text-emerald-700 dark:text-emerald-400',
                    border: 'border-emerald-200 dark:border-emerald-900/60',
                    icon: CheckCircle2,
                };
            default:
                return {
                    bg: 'bg-blue-50 dark:bg-blue-950/40',
                    text: 'text-blue-700 dark:text-blue-400',
                    border: 'border-blue-200 dark:border-blue-900/60',
                    icon: Clock,
                };
        }
    };

    const slaColors = getSlaColors();
    const SlaIcon = slaColors.icon;

    return (
        <>
            <header className={cn(
                "px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 transition-all",
                isTerminal && 'bg-slate-50/50 dark:bg-slate-900/50'
            )}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Back + Breadcrumbs + Ticket Title */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => navigate('/tickets/list')}
                            className="mt-1 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                            title="Back to tickets list"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Badges & Meta Row */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyNumber}
                                    className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                    title="Click to copy ticket number"
                                >
                                    <span>#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                    {copied ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                        <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                    )}
                                </button>

                                <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border shadow-2xs",
                                    statusConfig.color
                                )}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    {statusConfig.label}
                                </span>

                                <span className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                                    priorityConfig.color
                                )}>
                                    <span className={cn("w-2 h-2 rounded-full", priorityConfig.dot)} />
                                    {priorityConfig.label}
                                </span>

                                {ticket.category && (
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
                                        {ticket.category.replace(/_/g, ' ')}
                                    </span>
                                )}
                            </div>

                            {/* Ticket Title */}
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug break-words">
                                {ticket.title}
                            </h1>
                        </div>
                    </div>

                    {/* Right: SLA Indicators + Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
                        {/* SLA Resolution Pill */}
                        <div className={cn(
                            "px-3 py-1.5 rounded-xl border inline-flex items-center gap-2 text-xs font-bold shadow-2xs transition-all",
                            slaColors.bg,
                            slaColors.text,
                            slaColors.border
                        )}>
                            <SlaIcon className={cn("w-3.5 h-3.5", slaStatus === 'overdue' && "animate-pulse")} />
                            <span>SLA: {resolutionTime}</span>
                        </div>

                        {/* First Response Pill */}
                        {firstResponse && (
                            <div className={cn(
                                "px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5",
                                firstResponse.color
                            )}>
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>{firstResponse.text}</span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            {isTerminal ? (
                                <div className={cn(
                                    "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs border",
                                    isResolved
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                                        : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                                )}>
                                    {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                    <span>{isResolved ? 'Resolved' : 'Cancelled'}</span>
                                </div>
                            ) : (
                                <>
                                    {onResolve && (
                                        <button
                                            type="button"
                                            onClick={onResolve}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Resolve
                                        </button>
                                    )}

                                    {onCancel && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCancelConfirm(true)}
                                            disabled={isCancelling}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold transition-colors cursor-pointer"
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            Cancel Ticket
                                        </button>
                                    )}
                                </>
                            )}

                            {/* Toggle Properties Sidebar Button */}
                            {onToggleSidebar && (
                                <button
                                    type="button"
                                    onClick={onToggleSidebar}
                                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                    title={isSidebarOpen ? "Hide Ticket Properties" : "Show Ticket Properties"}
                                >
                                    {isSidebarOpen ? (
                                        <PanelRightClose className="w-4 h-4" />
                                    ) : (
                                        <PanelRightOpen className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Cancel Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={showCancelConfirm}
                title="Cancel Ticket"
                description="Are you sure you want to cancel this ticket? This action cannot be undone."
                confirmText="Cancel Ticket"
                cancelText="Keep Open"
                variant="destructive"
                onConfirm={confirmCancel}
                onCancel={() => setShowCancelConfirm(false)}
                isLoading={isCancelling}
            />
        </>
    );
};
