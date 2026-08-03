import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, CheckCircle, Ban, XCircle, HardDrive, Wrench, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { TicketChat } from '../../ticket-board/components/ticket-detail/TicketChat';
import { ImageLightbox } from '../../ticket-board/components/ticket-detail/ImageLightbox';
import { TicketInfoCard } from '../../ticket-board/components/ticket-detail/TicketInfoCard';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../ticket-board/components/ticket-detail/constants';
import { cn } from '@/lib/utils';

/** SLA countdown only renders down to the minute, so recomputing faster is wasted work. */
const SLA_TICK_MS = 60_000;
/** Mirrors `CancelTicketDto.reason` (`@MaxLength(500)`); a longer body is rejected server-side. */
const CANCEL_REASON_MAX = 500;

const UserTicketHeader = ({ ticket, onCancel }: { ticket: TicketDetail, onCancel: () => void }) => {
    const navigate = useNavigate();
    const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED';
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;

    const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, isOverdue: boolean } | null>(null);

    useEffect(() => {
        if (!ticket.slaTarget || isClosed) {
            setTimeLeft(null);
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(ticket.slaTarget!).getTime();
            const diff = target - now;
            
            if (diff <= 0) {
                setTimeLeft({ d: 0, h: 0, m: 0, isOverdue: true });
                return;
            }
            
            setTimeLeft({
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                isOverdue: false
            });
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, SLA_TICK_MS);
        return () => clearInterval(timer);
    }, [ticket.slaTarget, isClosed]);

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => navigate('/client/my-tickets')}
                    aria-label="Back to my tickets"
                    className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            #{ticket.ticketNumber || ticket.id.split('-')[0]}
                        </span>
                        <div className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-slate-100 dark:bg-slate-800", statusConfig.color)}>
                            {statusConfig.icon && React.createElement(statusConfig.icon as any, { className: "w-3 h-3" })}
                            {statusConfig.label}
                        </div>
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight break-words">
                        {ticket.title}
                    </h1>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                {ticket.slaTarget && !isClosed && timeLeft && (
                    <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border",
                        timeLeft.isOverdue 
                            ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                            : timeLeft.d === 0 && timeLeft.h < 4
                                ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 animate-pulse"
                                : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    )}>
                        {timeLeft.isOverdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {timeLeft.isOverdue 
                            ? 'SLA Overdue' 
                            : `${timeLeft.d}d ${timeLeft.h}h ${timeLeft.m}m remaining`}
                    </div>
                )}
                {isClosed && (
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                        ticket.status === 'RESOLVED' 
                            ? "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:border-green-800" 
                            : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    )}>
                        {ticket.status === 'RESOLVED' ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        {ticket.status === 'RESOLVED' ? 'Resolved' : 'Cancelled'}
                    </div>
                )}
                {!isClosed && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 min-h-[44px] rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800 transition-colors flex items-center gap-1.5"
                    >
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        Cancel ticket
                    </button>
                )}
            </div>
        </div>
    );
};

const UserStatusPipeline = ({ status }: { status: string }) => {
    if (status === 'CANCELLED') {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/50 p-4">
                <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-medium text-sm">
                    <Ban className="w-4 h-4" />
                    This ticket has been cancelled and is now closed.
                </div>
            </div>
        );
    }

    const steps = [
        { id: 'TODO', label: 'Open' },
        { id: 'IN_PROGRESS', label: 'In Progress' },
        { id: 'WAITING_VENDOR', label: 'Waiting' },
        { id: 'RESOLVED', label: 'Resolved' }
    ];

    // An unknown status yields -1, which would mark every step "upcoming" — treat it
    // as freshly opened instead so the pipeline never renders as blank.
    const foundIndex = steps.findIndex(s => s.id === status);
    const currentIndex = foundIndex === -1 ? 0 : foundIndex;
    const progress = currentIndex / (steps.length - 1);

    return (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6">
            <ol
                className="flex items-start justify-between max-w-3xl mx-auto relative"
                aria-label="Ticket progress"
            >
                <div className="absolute left-0 top-4 -translate-y-1/2 w-full h-0.5 bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
                {/* scaleX rather than an animated width: width animation relayouts the row
                    on every frame, which janks the whole header on low-end devices. */}
                <div
                    className="absolute left-0 top-4 -translate-y-1/2 w-full h-0.5 bg-primary origin-left transition-transform duration-500 motion-reduce:transition-none"
                    style={{ transform: `scaleX(${progress})` }}
                    aria-hidden="true"
                />

                {steps.map((step, idx) => {
                    const isCompleted = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    const config = STATUS_CONFIG[step.id];

                    return (
                        <li
                            key={step.id}
                            aria-current={isCurrent ? 'step' : undefined}
                            className="flex flex-col items-center gap-2 relative flex-1 min-w-0 bg-white dark:bg-slate-900 px-1"
                        >
                            <div className={cn(
                                "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors ring-4 ring-white dark:ring-slate-900",
                                isCompleted ? "bg-primary text-primary-foreground" :
                                isCurrent ? "bg-white border-2 border-primary text-primary" :
                                "bg-slate-100 dark:bg-slate-800 text-slate-400"
                            )}>
                                {isCompleted ? <CheckCircle className="w-4 h-4" aria-hidden="true" /> : (idx + 1)}
                            </div>
                            <span className={cn(
                                "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center leading-tight",
                                isCurrent ? config?.color || "text-slate-900 dark:text-white" :
                                isCompleted ? "text-slate-600 dark:text-slate-300" :
                                "text-slate-400"
                            )}>
                                {step.label}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

/** Rendered in the desktop sidebar and again in the mobile strip — same markup, one source. */
const InstallationSchedule = ({ ticket, className }: { ticket: TicketDetail; className?: string }) => (
    <div className={cn("p-5 border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 shrink-0", className)}>
        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <HardDrive className="w-3 h-3" aria-hidden="true" />
            Installation Schedule
        </p>
        <div className="space-y-3">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm border border-amber-100 dark:border-amber-800/50">
                <p className="text-xs text-amber-600 dark:text-amber-500 mb-0.5 flex items-center gap-1.5">
                    <Wrench className="w-3 h-3" aria-hidden="true" /> Hardware Type
                </p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{ticket.hardwareType || 'Not specified'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 uppercase">Date</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm text-center border border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-slate-500 uppercase">Time</p>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {ticket.scheduledTime ? `${ticket.scheduledTime}` : '-'}
                    </p>
                </div>
            </div>
        </div>
    </div>
);

/**
 * The sidebar is desktop-only, so on a phone the assignee, priority and — for hardware
 * tickets — the whole installation schedule were unreachable. This carries the same
 * facts in a compact strip.
 */
const MobileTicketMeta = ({ ticket }: { ticket: TicketDetail }) => {
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.LOW;

    return (
        <div className="lg:hidden border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                        {ticket.assignedTo?.fullName?.charAt(0) || '?'}
                    </span>
                    {ticket.assignedTo?.fullName || 'Unassigned'}
                </span>
                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800", priorityConfig.color)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" aria-hidden="true" />
                    {priorityConfig.label}
                </span>
                {ticket.category && (
                    <span className="px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {ticket.category}
                    </span>
                )}
                {ticket.device && (
                    <span className="px-2 py-0.5 rounded-md font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {ticket.device}
                    </span>
                )}
            </div>
            {ticket.isHardwareInstallation && (
                <InstallationSchedule ticket={ticket} className="border-t pt-4" />
            )}
        </div>
    );
};

const UserInfoPanel = ({ ticket }: { ticket: TicketDetail }) => {
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.LOW;

    return (
        <div className="w-64 border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-col overflow-y-auto custom-scrollbar shrink-0 hidden lg:flex">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assigned Agent</p>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {ticket.assignedTo?.fullName?.charAt(0) || '?'}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {ticket.assignedTo?.fullName || 'Unassigned'}
                        </p>
                        <p className="text-xs text-slate-500">IT Support</p>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Priority</p>
                    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700", priorityConfig.color)}>
                        <div className="w-2 h-2 rounded-full bg-current opacity-50" />
                        {priorityConfig.label}
                    </div>
                </div>

                {ticket.category && (
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Category</p>
                        <div className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ticket.category}
                        </div>
                    </div>
                )}
                
                {ticket.device && (
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Device / Asset</p>
                        <div className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {ticket.device}
                        </div>
                    </div>
                )}
            </div>

            {ticket.isHardwareInstallation && (
                <InstallationSchedule ticket={ticket} className="mt-auto border-t" />
            )}
        </div>
    );
};

export const ClientTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id
    });

    const { data: ticket, isLoading } = useQuery<TicketDetail>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        enabled: !!id,
        staleTime: 5000,
    });

    const replyMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        },
        onError: () => toast.error('Failed to send reply'),
    });

    const cancelMutation = useMutation({
        mutationFn: async (reason?: string) => {
            const res = await api.patch(`/tickets/${id}/cancel`, { reason });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('Ticket cancelled successfully');
            setIsCancelDialogOpen(false);
            setCancelReason('');
        },
        onError: () => {
            toast.error('Failed to cancel ticket');
        },
    });

    const handleSendMessage = async (content: string, files?: FileList | null, isInternal?: boolean) => {
        const formData = new FormData();
        formData.append('content', content);
        if (isInternal) {
            formData.append('isInternal', 'true');
        }
        if (files) {
            Array.from(files).forEach(file => {
                formData.append('files', file);
            });
        }
        
        await replyMutation.mutateAsync(formData);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Ticket not found</h2>
                <button onClick={() => navigate('/client/my-tickets')} className="text-primary hover:underline">Back to My Tickets</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="shrink-0">
                <UserTicketHeader ticket={ticket} onCancel={() => setIsCancelDialogOpen(true)} />
            </div>
            <div className="shrink-0">
                <UserStatusPipeline status={ticket.status} />
            </div>
            <div className="shrink-0">
                <MobileTicketMeta ticket={ticket} />
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col min-w-0 min-h-0 border-r border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="shrink-0 border-b border-slate-100 dark:border-slate-800">
                        <TicketInfoCard ticket={ticket} />
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/30">
                        <TicketChat
                            ticket={ticket}
                            isConnected={isConnected}
                            onSendMessage={handleSendMessage}
                            onImageClick={setLightboxImage}
                            typingUsers={typingUsers}
                            onTypingStart={() => sendTypingStart({ fullName: user?.fullName || 'User' })}
                            onTypingStop={sendTypingStop}
                            showCannedResponses={false}
                        />
                    </div>
                </div>
                <UserInfoPanel ticket={ticket} />
            </div>

            {lightboxImage && (
                <ImageLightbox 
                    src={lightboxImage} 
                    onClose={() => setLightboxImage(null)} 
                />
            )}

            <ConfirmationDialog
                isOpen={isCancelDialogOpen}
                onCancel={() => { setIsCancelDialogOpen(false); setCancelReason(''); }}
                onConfirm={() => cancelMutation.mutate(cancelReason.trim() || undefined)}
                isLoading={cancelMutation.isPending}
                title="Cancel Ticket"
                description="Are you sure you want to cancel this ticket? This action cannot be undone."
                confirmText="Yes, Cancel Ticket"
                cancelText="No, Keep It"
                variant="destructive"
            >
                <label htmlFor="cancel-reason" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Reason <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={CANCEL_REASON_MAX}
                    rows={2}
                    disabled={cancelMutation.isPending}
                    placeholder="Tell the agent why you no longer need this ticket"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                />
            </ConfirmationDialog>
        </div>
    );
};

export default ClientTicketDetailPage;
