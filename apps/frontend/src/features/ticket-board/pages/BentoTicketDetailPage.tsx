import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import type { ForwardTargetTeam } from '../components/TicketForwardDialog';
import { TicketDetailSkeleton } from '../components/TicketDetailSkeleton';
import { KbSuggestionDialog } from '../components/KbSuggestionDialog';
import { useTicketShortcuts, TICKET_SHORTCUTS } from '@/hooks/useTicketShortcuts';
import { Keyboard, X, MessageSquare, History, SlidersHorizontal, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TicketAttributes } from '../types';
import { validateFiles, FILE_SIZE_LIMITS } from '@/lib/file-validation';
import { PDFPreviewModal, usePDFPreview } from '@/features/reports/components/PDFPreviewModal';

export const BentoTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const [mainTab, setMainTab] = useState<'chat' | 'details' | 'activity'>('chat');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const chatSectionRef = useRef<HTMLDivElement>(null);
    const shortcutsModalRef = useRef<HTMLDivElement>(null);
    const pdfPreview = usePDFPreview();

    // Focus trap for shortcuts modal
    useFocusTrap(shortcutsModalRef, {
        enabled: showShortcutsModal,
        escapeDeactivates: true,
        onEscape: () => setShowShortcutsModal(false),
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
    const isOracleTicket = ticket
        ? (ticket.handlingTeam === 'ORACLE_DEV' ||
            (ticket.handlingTeam == null && ticket.category === 'ORACLE_REQUEST'))
        : false;
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', isOracleTicket ? 'oracle' : 'general', isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            if (isOracleTicket) {
                params.set('ticketType', 'ORACLE_REQUEST');
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
    const { showShortcutsHint } = useTicketShortcuts({
        onAssign: () => toast.info('Assign shortcut pressed'),
        onStatus: () => toast.info('Status shortcut pressed'),
        onPriority: () => toast.info('Priority shortcut pressed'),
        onReply: () => chatInputRef.current?.focus(),
        onResolve: () => {
            if (ticket && ticket.status !== 'RESOLVED') {
                handleFieldChange('status', 'RESOLVED');
            }
        },
        onEscape: () => setShowShortcutsModal(false),
        onCopyTicketNumber: () => toast.success('Ticket number copied!'),
    }, { enabled: !!ticket, ticketNumber: ticket?.ticketNumber });

    useEffect(() => {
        setShowShortcutsModal(showShortcutsHint);
    }, [showShortcutsHint]);

    // Auto-save per-field handler
    const handleFieldChange = useCallback(async (
        field: 'assignee' | 'status' | 'priority' | 'category' | 'device',
        value: string,
        reason?: string
    ) => {
        const endpointMap = {
            assignee: `/tickets/${id}/assign`,
            status: `/tickets/${id}/status`,
            priority: `/tickets/${id}/priority`,
            category: `/tickets/${id}/category`,
            device: `/tickets/${id}/device`,
        };
        const bodyMap = {
            assignee: { assigneeId: value || undefined, reason },
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
    }, [id, queryClient]);

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

    const handleResolveTicket = () => {
        if (ticket && ticket.status !== 'RESOLVED') {
            handleFieldChange('status', 'RESOLVED');
            toast.success('Ticket marked as resolved');
        }
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
        }
    };

    if (isLoading) {
        return <TicketDetailSkeleton />;
    }
    if (!ticket) return <div className="p-8 text-center text-rose-500 font-medium">Ticket not found</div>;

    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';
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
                isSidebarOpen={isSidebarOpen || mainTab === 'details'}
                onToggleSidebar={handleToggleSidebar}
            />

            {/* ── Main Work Area ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* LEFT & CENTER: Conversation Timeline / Activity / Mobile Details */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80">

                    {/* Navigation Tabs Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/80">
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
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900" ref={chatSectionRef}>
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-900/50">
                                <TicketSidebar
                                    ticket={ticket}
                                    agents={agents}
                                    slaConfigs={slaConfigs}
                                    attributes={attributes}
                                    onAssigneeChange={(v, reason) => handleFieldChange('assignee', v, reason)}
                                    onStatusChange={(v) => handleFieldChange('status', v)}
                                    onPriorityChange={(v) => handleFieldChange('priority', v)}
                                    onCategoryChange={(v) => handleFieldChange('category', v)}
                                    onDeviceChange={(v) => handleFieldChange('device', v)}
                                    onForward={handleForwardTicket}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/40">
                                <TicketHistory ticket={ticket} />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Desktop Ticket Inspector & Properties Sidebar (>= lg only) */}
                {isSidebarOpen && (
                    <aside className="hidden lg:flex w-80 lg:w-88 shrink-0 flex-col bg-slate-50/70 dark:bg-slate-900/50 overflow-y-auto custom-scrollbar">
                        <TicketSidebar
                            ticket={ticket}
                            agents={agents}
                            slaConfigs={slaConfigs}
                            attributes={attributes}
                            onAssigneeChange={(v, reason) => handleFieldChange('assignee', v, reason)}
                            onStatusChange={(v) => handleFieldChange('status', v)}
                            onPriorityChange={(v) => handleFieldChange('priority', v)}
                            onCategoryChange={(v) => handleFieldChange('category', v)}
                            onDeviceChange={(v) => handleFieldChange('device', v)}
                            onForward={handleForwardTicket}
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

            {/* Keyboard Shortcuts Trigger */}
            <button
                type="button"
                onClick={() => setShowShortcutsModal(true)}
                className="fixed bottom-4 right-4 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg hover:border-blue-500/50 hover:text-blue-600 transition-all z-40 cursor-pointer group"
                title="Keyboard shortcuts (Shift+?)"
            >
                <Keyboard className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Keyboard Shortcuts Modal */}
            {showShortcutsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowShortcutsModal(false)}>
                    <div
                        ref={shortcutsModalRef}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                                <Keyboard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                Keyboard Shortcuts
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowShortcutsModal(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
                            {TICKET_SHORTCUTS.map((shortcut, i) => (
                                <div key={i} className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{shortcut.description}</span>
                                    <div className="flex items-center gap-1">
                                        {shortcut.keys.map((key, j) => (
                                            <kbd
                                                key={j}
                                                className="px-2 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 shadow-2xs"
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                            Press <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded font-mono">Esc</kbd> to close
                        </div>
                    </div>
                </div>
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
