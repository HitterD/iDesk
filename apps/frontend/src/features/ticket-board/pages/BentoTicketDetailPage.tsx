import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { usePresence } from '@/hooks/usePresence';
import { TicketDetail, Agent } from '../components/ticket-detail/types';
import { ImageLightbox } from '../components/ticket-detail/ImageLightbox';
import { SlaStatusCard } from '../components/ticket-detail/SlaStatusCard';
import { TicketHeader } from '../components/ticket-detail/TicketHeader';
import { TicketInfoCard } from '../components/ticket-detail/TicketInfoCard';
import { TicketChat } from '../components/ticket-detail/TicketChat';
import { TicketHistory } from '../components/ticket-detail/TicketHistory';
import { TicketSidebar } from '../components/ticket-detail/TicketSidebar';
import { logger } from '@/lib/logger';

export const BentoTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [assigneeId, setAssigneeId] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [priority, setPriority] = useState<string>('');
    const [category, setCategory] = useState<string>('');
    const [device, setDevice] = useState<string>('');
    const [attributes, setAttributes] = useState<any>({ categories: [], priorities: [], devices: [], software: [] });
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Get current user (mock for now, should come from auth context)
    // In a real app, useAuth() hook would provide this
    const currentUser = { id: 'current-user-id', fullName: 'Current User' };

    // Presence hook
    usePresence(currentUser.id);

    // Real-time socket connection for live chat
    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id,
        onNewMessage: () => {
            // Socket hook handles query invalidation
        },
    });

    useEffect(() => {
        const fetchAttributes = async () => {
            try {
                const res = await api.get('/ticket-attributes');
                setAttributes(res.data);
            } catch (error) {
                logger.error('Failed to fetch attributes:', error);
            }
        };
        fetchAttributes();
    }, []);

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

    useEffect(() => {
        if (ticket) {
            if (ticket.assignedTo) setAssigneeId(ticket.assignedTo.id);
            setStatus(ticket.status);
            setPriority(ticket.priority);
            setCategory(ticket.category || 'GENERAL');
            setDevice(ticket.device || '');
        }
    }, [ticket]);

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
        if (window.confirm('Are you sure you want to cancel this ticket? This action cannot be undone.')) {
            cancelMutation.mutate(undefined);
        }
    };

    const handleSendMessage = async (content: string, files?: FileList | null) => {
        try {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('mentionedUserIds', JSON.stringify([]));
            if (files) {
                Array.from(files).forEach((file) => {
                    formData.append('files', file);
                });
            }

            await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            toast.success('Message sent');
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        } catch (error) {
            toast.error('Failed to send message');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }
    if (!ticket) return <div className="p-8 text-center text-red-500">Ticket not found</div>;

    return (
        <div className="space-y-6 min-h-screen">
            {/* Header */}
            <TicketHeader
                ticket={ticket}
                onSave={handleSave}
                isSaving={updateTicketMutation.isPending}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Ticket Info Card */}
                    <TicketInfoCard ticket={ticket} />

                    {/* SLA Card */}
                    <SlaStatusCard ticket={ticket} />

                    {/* Notes Section */}
                    <TicketChat
                        ticket={ticket}
                        isConnected={isConnected}
                        onSendMessage={handleSendMessage}
                        onImageClick={setLightboxImage}
                        typingUsers={typingUsers}
                        onTypingStart={() => sendTypingStart({ fullName: currentUser.fullName })}
                        onTypingStop={sendTypingStop}
                    />

                    {/* History Section */}
                    <TicketHistory ticket={ticket} />
                </div>

                {/* Sidebar */}
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
                    onCancel={handleCancelTicket}
                    isCancelling={cancelMutation.isPending}
                />
            </div>

            {/* Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </div>
    );
};
