import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { useAuth } from '@/stores/useAuth';
import { TicketDetail, Agent } from '../components/ticket-detail/types';
import { ImageLightbox } from '../components/ticket-detail/ImageLightbox';
import { TicketHeader } from '../components/ticket-detail/TicketHeader';
import { TicketChat } from '../components/ticket-detail/TicketChat';
import { TicketHistory } from '../components/ticket-detail/TicketHistory';
import { TicketSidebar } from '../components/ticket-detail/TicketSidebar';
import { TicketForwardDialog, type ForwardTargetTeam } from '../components/TicketForwardDialog';
import { ExtendSlaModal } from '../components/ticket-detail/ExtendSlaModal';
import { SetTicketReminderModal } from '../components/ticket-detail/SetTicketReminderModal';
import { TicketDetailSkeleton } from '../components/TicketDetailSkeleton';
import { KbSuggestionDialog } from '../components/KbSuggestionDialog';
import { useTicketShortcuts } from '@/hooks/useTicketShortcuts';
import { MessageSquare, History, SlidersHorizontal, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketAttributes } from '../types';
import { validateFiles, FILE_SIZE_LIMITS } from '@/lib/file-validation';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

export const BentoTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [extendSlaOpen, setExtendSlaOpen] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);
    const [mainTab, setMainTab] = useState<'chat' | 'details' | 'activity'>('chat');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const chatSectionRef = useRef<HTMLDivElement>(null);
    const pdfPreview = usePDFPreview();

    // Suggest KB articles once per ticket visit (per browser session).
    useEffect(() => {
        if (!id) return;
        const key = `idesk_kb_suggested_${id}`;
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            setSuggestionsOpen(true);
        }
    }, [id]);

    // Use authenticated user from auth store
    const currentUser = user ? { id: user.id, fullName: user.fullName } : { id: '', fullName: '' };

    // Presence is subscribed app-wide by PresenceProvider; this page only reads it.

    // Real-time socket connection for live chat
    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id,
        onNewMessage: () => {
            // Socket hook handles query invalidation
        },
    });

    // Fetch ticket attributes
    const { data: attributes = { categories: [], priorities: [], devices: [], software: [] } } = useQuery<TicketAttributes>({
        queryKey: ['ticket-attributes'],
        queryFn: async () => {
            const res = await api.get('/ticket-attributes');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: ticket, isLoading } = useQuery<TicketDetail>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        staleTime: 5000,
    });

    const isAdmin = user?.role === 'ADMIN';
    const resolvedTicketType = useMemo(() => {
        if (!ticket) return null;
        if (ticket.handlingTeam === 'MOBILE_DEV' || ticket.ticketType === 'MOBILE_DEV_REQUEST' || ticket.category === 'MOBILE_DEV_REQUEST' || ticket.category?.toLowerCase().includes('mobile')) {
            return 'MOBILE_DEV_REQUEST';
        }
        if (ticket.handlingTeam === 'WEB_DEV' || ticket.ticketType === 'WEB_DEV_REQUEST' || ticket.category === 'WEB_DEV_REQUEST' || ticket.category?.toLowerCase().includes('web')) {
            return 'WEB_DEV_REQUEST';
        }
        if (ticket.handlingTeam === 'ORACLE_DEV' || ticket.ticketType === 'ORACLE_REQUEST' || ticket.category === 'ORACLE_REQUEST' || ticket.category?.toLowerCase().includes('oracle') || ticket.category?.toLowerCase().includes('k2')) {
            return 'ORACLE_REQUEST';
        }
        return null;
    }, [ticket]);

    const isDeveloperTicket = Boolean(resolvedTicketType);

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', resolvedTicketType || 'general', (isAdmin || isDeveloperTicket) ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && !isDeveloperTicket && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            if (resolvedTicketType) {
                params.set('ticketType', resolvedTicketType);
            }
            if (ticket?.category) {
                params.set('category', ticket.category);
            }
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
        enabled: Boolean(ticket),
    });

    // Fetch SLA configs for priorities
    const { data: slaConfigs = [] } = useQuery<{ id: string; priority: string; resolutionTimeMinutes: number }[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
    });

    // Keyboard shortcuts for ticket actions
    useTicketShortcuts({
        onAssign: () => toast.info('Assign shortcut pressed'),
        onStatus: () => toast.info('Status shortcut pressed'),
        onPriority: () => toast.info('Priority shortcut pressed'),
        onReply: () => chatInputRef.current?.focus(),
        onResolve: () => {
            if (ticket && ticket.status !== 'RESOLVED') {
                handleFieldChange('status', 'RESOLVED');
            }
        },
        onCopyTicketNumber: () => toast.success('Ticket number copied!'),
    }, { enabled: !!ticket, ticketNumber: ticket?.ticketNumber });

    const [isResolving, setIsResolving] = useState(false);

    const handleResolveTicket = useCallback(async (resolutionNote?: string, files?: File[]) => {
        if (!ticket || ticket.status === 'RESOLVED') return;

        setIsResolving(true);
        try {
            const noteText = resolutionNote?.trim() || 'Masalah pada tiket ini telah berhasil diselesaikan.';
            const statementContent = `✅ Tiket Dinyatakan Selesai (Resolved)\n\n📌 Tindakan & Solusi:\n${noteText}`;

            const formData = new FormData();
            formData.append('content', statementContent);
            formData.append('mentionedUserIds', JSON.stringify([]));
            formData.append('isInternal', 'false');
            if (files && files.length > 0) {
                Array.from(files).forEach((file) => {
                    formData.append('files', file);
                });
            }

            await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            await api.patch(`/tickets/${id}/status`, { status: 'RESOLVED' });
            toast.success('Tiket berhasil diselesaikan');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Gagal menyelesaikan tiket');
            throw err;
        } finally {
            setIsResolving(false);
        }
    }, [ticket, id, queryClient]);

    // Auto-save per-field handler
    const handleFieldChange = useCallback(async (
        field: 'assignee' | 'status' | 'priority' | 'category' | 'device',
        value: string,
        reasonOrNote?: string,
        files?: File[]
    ) => {
        if (field === 'status' && value === 'RESOLVED') {
            await handleResolveTicket(reasonOrNote, files);
            return;
        }

        const endpointMap = {
            assignee: `/tickets/${id}/assign`,
            status: `/tickets/${id}/status`,
            priority: `/tickets/${id}/priority`,
            category: `/tickets/${id}/category`,
            device: `/tickets/${id}/device`,
        };
        const bodyMap = {
            assignee: { assigneeId: value || undefined, reason: reasonOrNote },
            status: { status: value },
            priority: { priority: value },
            category: { category: value },
            device: { device: value },
        };
        try {
            await api.patch(endpointMap[field], bodyMap[field]);
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            if (field === 'status' || field === 'assignee') {
                queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            }
        } catch {
            toast.error(`Failed to update ${field}`);
            throw new Error(`Failed to update ${field}`);
        }
    }, [id, queryClient, handleResolveTicket]);

    const handleForwardTicket = useCallback(async (targetTeam: ForwardTargetTeam, reason: string) => {
        try {
            await api.post(`/tickets/${id}/forward`, { targetTeam, reason });
            toast.success('Ticket berhasil diteruskan ke tim lain');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Gagal meneruskan tiket');
            throw err;
        }
    }, [id, queryClient]);

    const cancelMutation = useMutation({
        mutationFn: async (reason?: string) => {
            const res = await api.patch(`/tickets/${id}/cancel`, { reason });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Ticket cancelled successfully');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to cancel ticket');
        },
    });

    const handleCancelTicket = () => {
        cancelMutation.mutate(undefined);
    };

    const handleSendMessage = async (content: string, files?: FileList | null, isInternal: boolean = false) => {
        if (files && files.length > 0) {
            const validation = validateFiles(Array.from(files), {
                maxSize: FILE_SIZE_LIMITS.ATTACHMENT,
                maxFiles: 5,
            });
            if (!validation.valid) {
                toast.error(validation.error);
                return;
            }
        }

        // Optimistic update
        const optimisticMessage = {
            id: `temp-${Date.now()}`,
            content,
            isInternal,
            isSystemMessage: false,
            createdAt: new Date().toISOString(),
            sender: {
                id: currentUser.id,
                fullName: currentUser.fullName,
            },
            attachments: files ? Array.from(files).map((f) => URL.createObjectURL(f)) : [],
        };

        queryClient.setQueryData(['ticket', id], (oldData: TicketDetail | undefined) => {
            if (!oldData) return oldData;
            return {
                ...oldData,
                messages: [...(oldData.messages || []), optimisticMessage],
            };
        });

        try {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('mentionedUserIds', JSON.stringify([]));
            formData.append('isInternal', String(isInternal));
            if (files) {
                Array.from(files).forEach((file) => {
                    formData.append('files', file);
                });
            }

            await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (!isInternal) {
                toast.success('Message sent');
            }
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (error) {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            toast.error('Failed to send message');
            throw error;
        }
    };

    const extendSlaMutation = useMutation({
        mutationFn: async (data: {
            reasonCategory: string;
            reasonText: string;
            newTargetDate?: string;
            minutes?: number;
        }) => {
            return api.post(`/tickets/${id}/sla/extend`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('Target SLA berhasil diperpanjang');
            setExtendSlaOpen(false);
        },
        onError: (err: any) => {
            const msg = err.response?.data?.message || 'Gagal memperpanjang target SLA';
            toast.error(msg);
        },
    });

    const handleExtendSla = async (data: {
        reasonCategory: any;
        reasonText: string;
        newTargetDate?: string;
        minutes?: number;
    }) => {
        await extendSlaMutation.mutateAsync(data);
    };

    if (isLoading) {
        return <TicketDetailSkeleton />;
    }
    if (!ticket) return <div className="p-8 text-center text-rose-500 font-medium">Ticket not found</div>;

    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';
    const canExtendSla = !isClosed && (isAdmin || Boolean(user?.role?.startsWith('AGENT')));
    const messageCount = ticket.messages?.filter(m => !m.isSystemMessage).length || 0;

    const handleToggleSidebar = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setMainTab(prev => (prev === 'details' ? 'chat' : 'details'));
        } else {
            setIsSidebarOpen(prev => !prev);
        }
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100/50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
            {/* ── Top Header with SLA + Quick Actions ── */}
            <TicketHeader
                ticket={ticket}
                onCancel={!isClosed ? handleCancelTicket : undefined}
                isCancelling={cancelMutation.isPending}
                onResolve={!isClosed ? handleResolveTicket : undefined}
                isResolving={isResolving}
                onForward={!isClosed ? () => setForwardOpen(true) : undefined}
                onExtendSla={canExtendSla ? () => setExtendSlaOpen(true) : undefined}
                onSetReminder={!isClosed ? () => setReminderOpen(true) : undefined}
                isSidebarOpen={isSidebarOpen || mainTab === 'details'}
                onToggleSidebar={handleToggleSidebar}
            />

            {/* Critical Priority Banner Alert for Agents */}
            {ticket.priority === 'CRITICAL' && (
                <div className="shrink-0 bg-red-500/10 dark:bg-red-950/40 border-b border-red-500/30 px-5 py-3 flex items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 shrink-0 ring-1 ring-red-500/30 animate-pulse">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm">
                                    CRITICAL PRIORITY TICKET
                                </span>
                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    Penanganan Darurat Diperlukan
                                </span>
                            </div>
                            <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-medium leading-relaxed truncate md:whitespace-normal">
                                <span className="font-bold text-red-700 dark:text-red-400 mr-1.5">Alasan/Justifikasi Requester:</span>
                                {ticket.criticalReason || 'Tidak ada catatan justifikasi tambahan yang disertakan.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Work Area ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* LEFT & CENTER: Conversation Timeline / Activity / Mobile Details */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-slate-100/60 dark:bg-[#090d16]">

                    {/* Navigation Tabs Header */}
                    <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 shrink-0 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md">
                        {/* Desktop Tabs (>= lg) */}
                        <div className="hidden lg:flex gap-6">
                            <button
                                type="button"
                                onClick={() => setMainTab('chat')}
                                className={cn(
                                    "py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                                    mainTab === 'chat'
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Conversation</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat</span>
                                <span className={cn(
                                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    {messageCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('details')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'details'
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Logs</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100/60 dark:bg-[#090d16]" ref={chatSectionRef}>
                        {mainTab === 'chat' ? (
                            <TicketChat
                                ticket={ticket}
                                isConnected={isConnected}
                                onSendMessage={handleSendMessage}
                                onImageClick={setLightboxImage}
                                typingUsers={typingUsers}
                                onTypingStart={() => sendTypingStart({ fullName: currentUser.fullName })}
                                onTypingStop={sendTypingStop}
                            />
                        ) : mainTab === 'details' ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-slate-100/70 dark:bg-slate-900/70">
                                <TicketSidebar
                                    ticket={ticket}
                                    agents={agents}
                                    slaConfigs={slaConfigs}
                                    attributes={attributes}
                                    onAssigneeChange={(v, reason) => handleFieldChange('assignee', v, reason)}
                                    onStatusChange={(v, note, files) => handleFieldChange('status', v, note, files)}
                                    onPriorityChange={(v) => handleFieldChange('priority', v)}
                                    onCategoryChange={(v) => handleFieldChange('category', v)}
                                    onDeviceChange={(v) => handleFieldChange('device', v)}
                                    onForward={handleForwardTicket}
                                    onExtendSla={canExtendSla ? () => setExtendSlaOpen(true) : undefined}
                                    onSetReminder={!isClosed ? () => setReminderOpen(true) : undefined}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-100/50 dark:bg-slate-900/50">
                                <TicketHistory ticket={ticket} />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Desktop Ticket Inspector & Properties Sidebar (>= lg only) */}
                {isSidebarOpen && (
                    <aside className="hidden lg:flex w-80 lg:w-88 shrink-0 flex-col bg-slate-100/70 dark:bg-slate-900/70 border-l border-slate-200/90 dark:border-slate-800 overflow-y-auto custom-scrollbar">
                        <TicketSidebar
                            ticket={ticket}
                            agents={agents}
                            slaConfigs={slaConfigs}
                            attributes={attributes}
                            onAssigneeChange={(v, reason) => handleFieldChange('assignee', v, reason)}
                            onStatusChange={(v, note, files) => handleFieldChange('status', v, note, files)}
                            onPriorityChange={(v) => handleFieldChange('priority', v)}
                            onCategoryChange={(v) => handleFieldChange('category', v)}
                            onDeviceChange={(v) => handleFieldChange('device', v)}
                            onForward={handleForwardTicket}
                            onExtendSla={canExtendSla ? () => setExtendSlaOpen(true) : undefined}
                            onSetReminder={!isClosed ? () => setReminderOpen(true) : undefined}
                        />
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

            {/* PDF Preview Modal */}
            <PDFPreviewModal
                isOpen={pdfPreview.isOpen}
                onClose={pdfPreview.closePreview}
                pdfUrl={pdfPreview.previewConfig?.url || ''}
                filename={pdfPreview.previewConfig?.filename || ''}
                title={pdfPreview.previewConfig?.title || ''}
            />

            {/* Set Reminder Dialog */}
            <SetTicketReminderModal
                isOpen={reminderOpen}
                onClose={() => setReminderOpen(false)}
                ticketId={ticket.id}
                ticketNumber={ticket.ticketNumber}
                ticketTitle={ticket.title}
                assignedAgent={ticket.assignedTo ? {
                    id: ticket.assignedTo.id,
                    fullName: ticket.assignedTo.fullName,
                    email: ticket.assignedTo.email,
                } : null}
                onReminderCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ['ticket', id] });
                }}
            />

            {/* Forward Dialog */}
            <TicketForwardDialog
                isOpen={forwardOpen}
                onClose={() => setForwardOpen(false)}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    handlingTeam: ticket.handlingTeam,
                }}
                onConfirm={async (targetTeam, reason) => {
                    await handleForwardTicket(targetTeam, reason);
                    setForwardOpen(false);
                }}
            />

            {/* Extend SLA Modal */}
            {canExtendSla && (
                <ExtendSlaModal
                    isOpen={extendSlaOpen}
                    onClose={() => setExtendSlaOpen(false)}
                    ticket={{
                        id: ticket.id,
                        ticketNumber: ticket.ticketNumber,
                        title: ticket.title,
                        slaTarget: ticket.slaTarget,
                        priority: ticket.priority,
                    }}
                    onConfirm={handleExtendSla}
                    isLoading={extendSlaMutation.isPending}
                />
            )}

            {/* KB suggestion popup after visiting a fresh ticket */}
            <KbSuggestionDialog
                isOpen={suggestionsOpen}
                onClose={() => setSuggestionsOpen(false)}
                ticketId={id || ''}
                basePath="/kb"
            />
        </div>
    );
};
