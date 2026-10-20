import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, MessageSquare, History, SlidersHorizontal } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { TICKET_OFFLINE_POLL_MS, useTicketSocket } from '@/hooks/useTicketSocket';
import { TicketChat } from '../../ticket-board/components/ticket-detail/TicketChat';
import { TicketHistory } from '../../ticket-board/components/ticket-detail/TicketHistory';
import { ImageLightbox } from '../../ticket-board/components/ticket-detail/ImageLightbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { KbSuggestionDialog } from '../../ticket-board/components/KbSuggestionDialog';
import { SELF_RESOLVABLE_STATUSES, isTerminalStatus } from '../../ticket-board/components/ticket-detail/constants';
import { ResolutionConfirmationBanner } from '../components/resolution/ResolutionConfirmationBanner';
import { AgentRatingForm } from '../components/resolution/AgentRatingForm';
import { getApiErrorMessage } from '../components/resolution/resolutionApi';
import { ClientTicketHeader } from '../components/ClientTicketHeader';
import { ClientTicketInspector } from '../components/ClientTicketInspector';
import { cn } from '@/lib/utils';
import { toUploadPercent, validateFiles } from '@/lib/file-validation';
import { useMarkNotificationsRead } from '@/features/notifications/hooks/useMarkNotificationsRead';

/** Max characters for ticket cancellation reason */
const CANCEL_REASON_MAX = 500;

export const ClientTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    useMarkNotificationsRead(id ? { ticketId: id } : null);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [mainTab, setMainTab] = useState<'chat' | 'activity' | 'properties'>('chat');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);

    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id,
    });

    // Suggest KB articles once per ticket visit (per browser session).
    useEffect(() => {
        if (!id) return;
        const key = `idesk_kb_suggested_${id}`;
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            setSuggestionsOpen(true);
        }
    }, [id]);

    const { data: ticket, isLoading } = useQuery<TicketDetail>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        enabled: !!id,
        staleTime: 5000,
        // Socket is the primary channel; poll only while it's down so replies still arrive.
        refetchInterval: isConnected ? false : TICKET_OFFLINE_POLL_MS,
    });

    const replyMutation = useMutation({
        mutationFn: async ({ formData, onUploadProgress }: { formData: FormData; onUploadProgress?: (percent: number) => void }) => {
            const res = await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                skipToast: true,
                onUploadProgress: (e) => onUploadProgress?.(toUploadPercent(e.loaded, e.total)),
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
        // e.g. 400 'Tiket sudah ditutup...' when the ticket was closed meanwhile.
        onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to send reply')),
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

    const handleSendMessage = async (
        content: string,
        files?: FileList | null,
        isInternal?: boolean,
        onUploadProgress?: (percent: number) => void,
    ) => {
        if (files && files.length > 0) {
            const validation = validateFiles(Array.from(files));
            if (!validation.valid) {
                toast.error(validation.error);
                // Reject so TicketChat keeps the draft for the user to fix.
                throw new Error(validation.error);
            }
        }
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

        await replyMutation.mutateAsync({ formData, onUploadProgress });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
                <p className="text-xs text-muted-foreground font-medium">Memuat detail tiket...</p>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <XCircle className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ticket not found</h2>
                    <p className="text-xs text-slate-500 mt-1">Tiket yang Anda cari tidak ditemukan atau telah dihapus.</p>
                </div>
                <button
                    onClick={() => navigate('/client/my-tickets')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
                >
                    Kembali ke My Tickets
                </button>
            </div>
        );
    }

    const isClosed = isTerminalStatus(ticket.status);
    const isRequester = Boolean(user?.id) && ticket.user?.id === user?.id;
    const canSelfResolve = isRequester && SELF_RESOLVABLE_STATUSES.includes(ticket.status);
    const messageCount = ticket.messages?.filter(m => !m.isSystemMessage).length || 0;

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <div className="flex h-full w-full flex-col overflow-hidden text-slate-900 dark:text-slate-200">
          <div className="ticket-detail">
            <section className="ticket-detail-surface flex-1" aria-label="Percakapan">
            {/* ── Compact header: number, readonly bubbles, title, requester actions ── */}
            <ClientTicketHeader
                ticket={ticket}
                onCancel={() => setIsCancelDialogOpen(true)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
                canSelfResolve={canSelfResolve}
            />

                {/* Conversation / Activity / Mobile Details */}
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">

                    {/* Requester confirmation of an agent-resolved ticket */}
                    {isRequester && ticket.status === 'RESOLVED' && (
                        <ResolutionConfirmationBanner ticketId={ticket.id} deadlineAt={ticket.resolutionDeadlineAt} />
                    )}

                    {/* Optional per-agent rating once the ticket is closed */}
                    {isRequester && ticket.status === 'CLOSED' && <AgentRatingForm ticketId={ticket.id} />}

                    {/* Navigation Tabs Header */}
                    <div className="flex items-center justify-between border-b border-[hsl(var(--idesk-border)/0.7)] px-3 sm:px-[18px] shrink-0">
                        {/* Desktop Tabs (>= lg) */}
                        <div className="hidden lg:flex gap-6">
                            <button
                                type="button"
                                onClick={() => setMainTab('chat')}
                                className={cn(
                                    "py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                                    mainTab === 'chat'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Conversation</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-primary/10 dark:bg-primary/20 text-primary"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    {messageCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('activity')}
                                className={cn(
                                    "py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                                    mainTab === 'activity'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Activity Logs</span>
                            </button>
                        </div>

                        {/* Mobile Tabs (< lg) */}
                        <div className="flex lg:hidden items-center justify-around w-full gap-1">
                            <button
                                type="button"
                                onClick={() => setMainTab('chat')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'chat'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat</span>
                                <span className={cn(
                                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-primary/10 dark:bg-primary/20 text-primary"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    {messageCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('properties')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'properties'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Properties</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('activity')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'activity'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Logs</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        {mainTab === 'chat' ? (
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
                        ) : mainTab === 'properties' ? (
                            <div className="chat-stream flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3 pb-20">
                                <ClientTicketInspector ticket={ticket} />
                                {!isClosed && (
                                    <div className="ticket-panel flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setIsCancelDialogOpen(true)}
                                            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Cancel Ticket
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="chat-stream flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
                                <TicketHistory ticket={ticket} />
                            </div>
                        )}
                    </div>
                </div>
            </section>

                {/* Desktop inspector panels (>= lg only) */}
                {isSidebarOpen && (
                    <aside className="ticket-detail-inspector hidden lg:flex custom-scrollbar" aria-label="Info tiket">
                        <ClientTicketInspector ticket={ticket} />
                    </aside>
                )}
          </div>

            {/* Lightbox for Images */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    onClose={() => setLightboxImage(null)}
                />
            )}

            {/* Cancel Confirmation Dialog */}
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
                    placeholder="Tell the IT team why you no longer need this ticket..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                />
            </ConfirmationDialog>

            {/* KB suggestion popup after visiting a fresh ticket */}
            <KbSuggestionDialog
                isOpen={suggestionsOpen}
                onClose={() => setSuggestionsOpen(false)}
                ticketId={id || ''}
                basePath="/client/kb"
            />
        </div>
    );
};

export default ClientTicketDetailPage;
