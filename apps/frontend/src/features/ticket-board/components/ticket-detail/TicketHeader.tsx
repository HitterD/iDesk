import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, Save, CheckCircle2, XCircle, Clock, AlertTriangle, Pause, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    onSave: () => void;
    onCancel?: () => void;
    isSaving: boolean;
    isCancelling?: boolean;
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
    onSave,
    onCancel,
    isSaving,
    isCancelling = false
}) => {
    const navigate = useNavigate();
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [resolutionTime, setResolutionTime] = useState<string>('');
    const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'overdue' | 'resolved' | 'paused'>('ok');

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
        if (ticket.firstResponseAt) return { text: '✓', color: 'text-green-500' };
        if (ticket.isFirstResponseBreached) return { text: '!', color: 'text-red-500' };
        return null;
    };
    const firstResponse = getFirstResponseStatus();

    const handleCancelClick = () => {
        setShowCancelConfirm(true);
    };

    const confirmCancel = () => {
        if (onCancel) onCancel();
        setShowCancelConfirm(false);
    };

    const getSlaColors = () => {
        switch (slaStatus) {
            case 'overdue': return { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' };
            case 'warning': return { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400' };
            case 'paused': return { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' };
            case 'resolved': return { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-400' };
            default: return { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' };
        }
    };

    const slaColors = getSlaColors();

    return (
        <>
            <div className={cn("flex items-start justify-between gap-4 p-4 lg:p-6 bg-white dark:bg-[hsl(var(--card))] border-b border-slate-200 dark:border-slate-800/60", isTerminal && 'opacity-90')}>
                {/* Left Section: Back + Ticket Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                        onClick={() => navigate('/tickets/list')}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    {/* Ticket Number + Status + Priority - Inline */}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            #{ticket.ticketNumber || ticket.id.split('-')[0]}
                        </span>
                        <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wider", statusConfig.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                        </span>
                        <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wider", priorityConfig.color)}>
                            <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`}></span>
                            {priorityConfig.label}
                        </span>
                    </div>

                    {/* Ticket Title - Truncated */}
                    <h1 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {ticket.title}
                    </h1>
                </div>

                {/* Center Section: SLA Pills */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Resolution SLA */}
                    <div className={cn("text-xs font-bold leading-none p-1.5 px-3 rounded-lg inline-flex items-center gap-1.5", slaColors.bg, slaColors.text)}>
                        {slaStatus === 'overdue' && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                        {slaStatus === 'paused' && <Pause className="w-3 h-3" />}
                        {slaStatus === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
                        {(slaStatus === 'ok' || slaStatus === 'warning') && <Clock className="w-3 h-3" />}
                        <span>SLA: {resolutionTime}</span>
                    </div>

                    {/* First Response */}
                    {firstResponse && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span className={firstResponse.color}>{firstResponse.text}</span>
                        </div>
                    )}
                </div>

                {/* Right Section: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {isTerminal ? (
                        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs", isResolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                            {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {isResolved ? 'Resolved' : 'Cancelled'}
                        </div>
                    ) : (
                        <>
                            {/* Cancel Button */}
                            {onCancel && (
                                <button
                                    onClick={handleCancelClick}
                                    disabled={isCancelling}
                                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Cancel Ticket"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={onSave}
                                disabled={isSaving}
                                className="px-5 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold rounded-xl hover:bg-[hsl(var(--primary))]/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm hover:shadow flex items-center gap-2 text-sm disabled:opacity-70"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </>
                    )}
                </div>
            </div>

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
