import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { usePresence } from '@/hooks/usePresence';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useAuth } from '@/stores/useAuth';
import { TicketDetail, Agent } from '../components/ticket-detail/types';
import { ImageLightbox } from '../components/ticket-detail/ImageLightbox';
import { TicketHeader } from '../components/ticket-detail/TicketHeader';
import { TicketInfoCard } from '../components/ticket-detail/TicketInfoCard';
import { TicketChat } from '../components/ticket-detail/TicketChat';
import { TicketHistory } from '../components/ticket-detail/TicketHistory';
import { TicketSidebar } from '../components/ticket-detail/TicketSidebar';
import { UnsavedChangesDialog } from '@/components/ui/UnsavedChangesDialog';
import { TicketDetailSkeleton } from '../components/TicketDetailSkeleton';
import { logger } from '@/lib/logger';
import { useTicketShortcuts, TICKET_SHORTCUTS } from '@/hooks/useTicketShortcuts';
import { Keyboard, X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { validateFiles, FILE_SIZE_LIMITS } from '@/lib/file-validation';
import { TicketAttributes } from '../types';

export const BentoTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [priority, setPriority] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [device, setDevice] = useState<string>('');
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const chatSectionRef = useRef<HTMLDivElement>(null);
    const shortcutsModalRef = useRef<HTMLDivElement>(null);

    // Focus trap for shortcuts modal
    useFocusTrap(shortcutsModalRef, {
        enabled: showShortcutsModal,
        escapeDeactivates: true,
        onEscape: () => setShowShortcutsModal(false),
    });

    // Use authenticated user from auth store
    const currentUser = user ? { id: user.id, fullName: user.fullName } : { id: '', fullName: '' };

    // Presence hook
    usePresence(currentUser.id);

    // Real-time socket connection for live chat
    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id,
        onNewMessage: () => {
            // Socket hook handles query invalidation
        },
    });

    // Fetch ticket attributes using useQuery instead of useEffect
    const { data: attributes = { categories: [], priorities: [], devices: [], software: [] } } = useQuery<TicketAttributes>({
        queryKey: ['ticket-attributes'],
        queryFn: async () => {
            const res = await api.get('/ticket-attributes');
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // cache for 5 minutes
    });

    const { data: ticket, isLoading } = useQuery<TicketDetail>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        staleTime: 5000,
    });

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
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
                setStatus('RESOLVED');
                toast.info('Status set to Resolved. Click Save to apply.');
            }
        },
        onEscape: () => {
            setShowShortcutsModal(false);
        },
        onCopyTicketNumber: () => toast.success('Ticket number copied!'),
    }, { enabled: !!ticket, ticketNumber: ticket?.ticketNumber });

    // Sync shortcuts hint modal with local state
    useEffect(() => {
        setShowShortcutsModal(showShortcutsHint);
    }, [showShortcutsHint]);

    useEffect(() => {
        if (ticket) {
            if (ticket.assignedTo) setAssigneeId(ticket.assignedTo.id);
            setStatus(ticket.status);
            setPriority(ticket.priority);
            setCategory(ticket.category || 'GENERAL');
            setDevice(ticket.device || '');
        }
    }, [ticket]);

    // Track if there are unsaved changes
    const isDirty = useMemo(() => {
        if (!ticket) return false;
        const assigneeChanged = assigneeId !== (ticket.assignedTo?.id || '');
        const statusChanged = status !== ticket.status;
        const priorityChanged = priority !== ticket.priority;
        const categoryChanged = category !== (ticket.category || 'GENERAL');
        const deviceChanged = device !== (ticket.device || '');
        return assigneeChanged || statusChanged || priorityChanged || categoryChanged || deviceChanged;
    }, [ticket, assigneeId, status, priority, category, device]);

    // Unsaved changes warning hook
    const { isBlocked, confirmNavigation, cancelNavigation } = useUnsavedChanges({
        isDirty,
        message: 'You have unsaved changes. Are you sure you want to leave?',
    });

    const updateTicketMutation = useMutation({
        mutationFn: async (data: { assigneeId?: string; status?: string; priority?: string; category?: string; device?: string }) => {
            const promises = [];
            if (data.assigneeId && data.assigneeId !== ticket?.assignedTo?.id) {
                promises.push(api.patch(`/tickets/${id}/assign`, { assigneeId: data.assigneeId }));
            }
            if (data.status && data.status !== ticket?.status) {
                promises.push(api.patch(`/tickets/${id}/status`, { status: data.status }));
            }
            if (data.priority && data.priority !== ticket?.priority) {
                promises.push(api.patch(`/tickets/${id}/priority`, { priority: data.priority }));
            }
            if (data.category && data.category !== ticket?.category) {
                promises.push(api.patch(`/tickets/${id}/category`, { category: data.category }));
            }
            if (data.device && data.device !== ticket?.device) {
                promises.push(api.patch(`/tickets/${id}/device`, { device: data.device }));
            }
            await Promise.all(promises);
        },
        onSuccess: () => {
            toast.success('Ticket updated successfully');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            navigate('/tickets/list');
        },
        onError: () => {
            toast.error('Failed to update ticket');
        },
    });

    const handleSave = () => {
        updateTicketMutation.mutate({ assigneeId, status, priority, category, device });
    };

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
        // Validate files before upload
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

        // Optimistic update - add message immediately
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

        // Optimistically update the cache
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
            // Refetch to get the actual message with real IDs
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (error) {
            // Rollback optimistic update on error
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            toast.error('Failed to send message');
        }
    };

    if (isLoading) {
        return <TicketDetailSkeleton />;
    }
    if (!ticket) return <div className="p-8 text-center text-red-500">Ticket not found</div>;

    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden animate-fade-in-up text-slate-900 dark:text-slate-200">
            {/* Compact Header with SLA + Cancel */}
            <TicketHeader
                ticket={ticket}
                onSave={handleSave}
                onCancel={!isClosed ? handleCancelTicket : undefined}
                isSaving={updateTicketMutation.isPending}
                isCancelling={cancelMutation.isPending}
            />

            {/* 2-Section Layout: Sidebar + Main */}
            <div className="flex flex-1 overflow-hidden">
                <div className="w-64 flex flex-col border-r border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] overflow-y-auto custom-scrollbar">
                    <TicketSidebar
                        ticket={ticket}
                        agents={agents}
                        slaConfigs={slaConfigs}
                        attributes={attributes}
                        assigneeId={assigneeId}
                        setAssigneeId={setAssigneeId}
                        status={status}
                        setStatus={setStatus}
                        priority={priority}
                        setPriority={setPriority}
                        category={category}
                        setCategory={setCategory}
                        device={device}
                        setDevice={setDevice}
                    />
                </div>

                {/* RIGHT: Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="shrink-0 border-b border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))]">
                        <TicketInfoCard ticket={ticket} />
                    </div>

                    {/* Chat + Activity Side by Side */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-transparent" ref={chatSectionRef}>
                            <TicketChat
                                ticket={ticket}
                                isConnected={isConnected}
                                onSendMessage={handleSendMessage}
                                onImageClick={setLightboxImage}
                                typingUsers={typingUsers}
                                onTypingStart={() => sendTypingStart({ fullName: currentUser.fullName })}
                                onTypingStop={sendTypingStop}
                            />
                        </div>

                        <div className="w-56 border-l border-[hsl(var(--border))] bg-slate-50 dark:bg-slate-900/40 overflow-y-auto custom-scrollbar hidden lg:block">
                            <TicketHistory ticket={ticket} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    onClose={() => setLightboxImage(null)}
                />
            )}

            {/* Keyboard Shortcuts Button */}
            <button
                onClick={() => setShowShortcutsModal(true)}
                className="fixed bottom-4 right-4 p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] dark:shadow-none hover:border-primary/50 hover:text-primary transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out z-40 group"
                title="Keyboard shortcuts (Shift+?)"
            >
                <Keyboard className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
            </button>

            {/* Keyboard Shortcuts Modal */}
            {showShortcutsModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcutsModal(false)}>
                    <div
                        ref={shortcutsModalRef}
                        className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-smxl max-w-md w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                <Keyboard className="w-4 h-4 text-primary" />
                                Keyboard Shortcuts
                            </h3>
                            <button
                                onClick={() => setShowShortcutsModal(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
                            {TICKET_SHORTCUTS.map((shortcut, i) => (
                                <div key={i} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{shortcut.description}</span>
                                    <div className="flex items-center gap-1">
                                        {shortcut.keys.map((key, j) => (
                                            <kbd
                                                key={j}
                                                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-600"
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 text-center">
                            Press <kbd className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">Esc</kbd> to close
                        </div>
                    </div>
                </div>
            )}

            {/* Unsaved Changes Warning Dialog */}
            <UnsavedChangesDialog
                isOpen={isBlocked}
                onConfirm={confirmNavigation}
                onCancel={cancelNavigation}
            />
        </div>
    );
};
