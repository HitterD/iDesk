import React, { useState, useEffect } from 'react';
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
            case 'overdue': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'paused': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        }
    };

    return (
        <>
            <div className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/10 shadow-sm dark:shadow-none ${isTerminal ? 'opacity-90' : ''}`}>
                {/* Left Section: Back + Ticket Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                        onClick={() => navigate('/tickets/list')}
                        className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition-all shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    {/* Ticket Number + Status + Priority - Inline */}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-gray-600 dark:text-slate-400 text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded shrink-0">
                            #{ticket.ticketNumber || ticket.id.split('-')[0]}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shrink-0 ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-bold shrink-0 ${priorityConfig.color}`}>
                            <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`}></span>
                            {priorityConfig.label}
                        </span>
                    </div>

                    {/* Ticket Title - Truncated */}
                    <h1 className={`text-sm font-semibold truncate ${isTerminal ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {ticket.title}
                    </h1>
                </div>

                {/* Center Section: SLA Pills */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Resolution SLA */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getSlaColors()}`}>
                        {slaStatus === 'overdue' && <AlertTriangle className="w-3 h-3 animate-pulse" />}
                        {slaStatus === 'paused' && <Pause className="w-3 h-3" />}
                        {slaStatus === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
                        {(slaStatus === 'ok' || slaStatus === 'warning') && <Clock className="w-3 h-3" />}
                        <span>SLA: {resolutionTime}</span>
                    </div>

                    {/* First Response */}
                    {firstResponse && (
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700`}>
                            <MessageSquare className="w-3 h-3 text-slate-400" />
                            <span className={firstResponse.color}>{firstResponse.text}</span>
                        </div>
                    )}
                </div>

                {/* Right Section: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {isTerminal ? (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs ${isResolved ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
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
                                    className="p-2 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 hover:bg-red-900/50 hover:text-red-300 transition-all"
                                    title="Cancel Ticket"
                                >
                                    <XCircle className="w-4 h-4" />
                                </button>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={onSave}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-slate-900 font-bold text-xs rounded-lg hover:from-primary/90 hover:to-primary/70 transition-all shadow-lg shadow-primary/30"
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
