import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import api from '@/lib/api';
import { buildReplyForm } from '@/lib/ticketReplyForm';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { TICKET_OFFLINE_POLL_MS, useTicketSocket } from '@/hooks/useTicketSocket';
import { TicketChat } from '../../ticket-board/components/ticket-detail/TicketChat';
import { TicketHistory } from '../../ticket-board/components/ticket-detail/TicketHistory';
import { ImageLightbox } from '../../ticket-board/components/ticket-detail/ImageLightbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { KbSuggestionDialog } from '../../ticket-board/components/KbSuggestionDialog';
import { SELF_RESOLVABLE_STATUSES, isTerminalStatus } from '../../ticket-board/components/ticket-detail/constants';
import { ResolutionConfirmationBanner } from '../components/resolution/ResolutionConfirmationBanner';
import { AgentRatingForm } from '../components/resolution/AgentRatingForm';
import { getApiErrorMessage } from '../components/resolution/resolutionApi';
import { ClientTicketHeader } from '../components/ClientTicketHeader';
import { ClientTicketInspector } from '../components/ClientTicketInspector';
import { DetailTabs, countChatMessages, type DetailTab } from '../../ticket-board/components/ticket-detail/DetailTabs';
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
    const [mainTab, setMainTab] = useState<DetailTab>('chat');
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
            toast.success('Tiket berhasil dibatalkan');
            setIsCancelDialogOpen(false);
            setCancelReason('');
        },
        onError: () => {
            toast.error('Gagal membatalkan tiket');
        },
    });

    const handleSendMessage = async (
        content: string,
        files?: FileList | null,
        isInternal?: boolean,
        onUploadProgress?: (percent: number) => void,
        replyToId?: string,
    ) => {
        if (files && files.length > 0) {
            const validation = validateFiles(Array.from(files));
            if (!validation.valid) {
                toast.error(validation.error);
                // Reject so TicketChat keeps the draft for the user to fix.
                throw new Error(validation.error);
            }
        }
        const formData = buildReplyForm({ content, files, isInternal, replyToId });

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
                canCancel={isRequester}
                tabs={<DetailTabs value={mainTab} onChange={setMainTab} messageCount={countChatMessages(ticket.messages)} />}
            />

                {/* Conversation / Activity / Mobile Details */}
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">

                    {/* Requester confirmation of an agent-resolved ticket */}
                    {isRequester && ticket.status === 'RESOLVED' && (
                        <ResolutionConfirmationBanner ticketId={ticket.id} deadlineAt={ticket.resolutionDeadlineAt} />
                    )}

                    {/* Optional per-agent rating once the ticket is closed */}
                    {isRequester && ticket.status === 'CLOSED' && <AgentRatingForm ticketId={ticket.id} />}

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
                        ) : mainTab === 'details' ? (
                            <div className="chat-stream flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3 pb-20">
                                <ClientTicketInspector ticket={ticket} />
                                {!isClosed && (
                                    <div className="ticket-panel">
                                        <Button variant="danger" className="w-full" onClick={() => setIsCancelDialogOpen(true)}>
                                            <XCircle aria-hidden="true" /><span>Batalkan tiket</span>
                                        </Button>
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
                appearance="ticket"
                isOpen={isCancelDialogOpen}
                onCancel={() => { setIsCancelDialogOpen(false); setCancelReason(''); }}
                onConfirm={() => cancelMutation.mutate(cancelReason.trim() || undefined)}
                isLoading={cancelMutation.isPending}
                title="Batalkan tiket ini?"
                description={`Tiket #${ticket.ticketNumber || ticket.id.split('-')[0]} yang dibatalkan tidak dapat diproses kembali.`}
                confirmText="Batalkan tiket"
                cancelText="Kembali"
                variant="destructive"
            >
                <label htmlFor="cancel-reason" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Alasan pembatalan <span className="text-slate-400">(opsional)</span>
                </label>
                <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={CANCEL_REASON_MAX}
                    rows={2}
                    disabled={cancelMutation.isPending}
                    placeholder="Contoh: kendala sudah teratasi sendiri"
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
