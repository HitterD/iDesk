import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Ticket } from '../types/ticket.types';
import { queryKeys } from '@/lib/queryKeys';

export const useTicketListMutations = (agents: any[]) => {
    const queryClient = useQueryClient();

    // Helper to update a ticket inside an arbitrary cache structure (array or paginated response)
    const updateTicketInCache = (old: any, ticketId: string, updater: (t: Ticket) => Ticket): any => {
        if (!old) return old;
        if (Array.isArray(old)) {
            return old.map((t: any) => (t && t.id === ticketId ? updater(t) : t));
        }
        if (Array.isArray(old.data)) {
            return {
                ...old,
                data: old.data.map((t: any) => (t && t.id === ticketId ? updater(t) : t)),
            };
        }
        if (old.id === ticketId) {
            return updater(old);
        }
        return old;
    };

    const assignTicketMutation = useMutation({
        mutationFn: async ({
            ticketId,
            assigneeId,
            reason,
        }: {
            ticketId: string;
            assigneeId?: string | null;
            reason?: string;
        }) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId: assigneeId || undefined, reason });
        },
        onMutate: async ({ ticketId, assigneeId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.detail(ticketId) });

            const previousPaginated = queryClient.getQueriesData({ queryKey: ['tickets', 'paginated'] });
            const previousTickets = queryClient.getQueriesData({ queryKey: queryKeys.tickets.all });
            const previousDetail = queryClient.getQueryData(queryKeys.tickets.detail(ticketId));

            const assignee = assigneeId ? agents.find((a) => a.id === assigneeId) || null : null;
            const applyAssignee = (t: Ticket): Ticket => ({
                ...t,
                assignedTo: assignee ? { id: assignee.id, fullName: assignee.fullName, avatarUrl: assignee.avatarUrl } : undefined,
            });

            // 1. Optimistic update paginated tables
            queryClient.setQueriesData({ queryKey: ['tickets', 'paginated'] }, (old: any) =>
                updateTicketInCache(old, ticketId, applyAssignee)
            );

            // 2. Optimistic update Kanban and ticket lists
            queryClient.setQueriesData({ queryKey: queryKeys.tickets.all }, (old: any) =>
                updateTicketInCache(old, ticketId, applyAssignee)
            );

            // 3. Optimistic update single ticket detail
            queryClient.setQueryData(queryKeys.tickets.detail(ticketId), (old: any) =>
                old ? applyAssignee(old) : old
            );

            return { previousPaginated, previousTickets, previousDetail, ticketId };
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.dashboardStats() });
        },
        onError: (err, variables, context) => {
            if (context?.previousPaginated) {
                context.previousPaginated.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousTickets) {
                context.previousTickets.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousDetail !== undefined && context?.ticketId) {
                queryClient.setQueryData(queryKeys.tickets.detail(context.ticketId), context.previousDetail);
            }
            toast.error('Failed to assign ticket');
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
            if (variables?.ticketId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(variables.ticketId) });
            }
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({
            ticketId,
            status,
            resolutionNote,
            files,
        }: {
            ticketId: string;
            status: string;
            resolutionNote?: string;
            files?: File[];
        }) => {
            if (status === 'RESOLVED') {
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

                    await api.post(`/tickets/${ticketId}/reply`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                } catch (e) {
                    // Continue with status update even if reply fails
                }
            }

            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onMutate: async ({ ticketId, status }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.detail(ticketId) });

            const previousPaginated = queryClient.getQueriesData({ queryKey: ['tickets', 'paginated'] });
            const previousTickets = queryClient.getQueriesData({ queryKey: queryKeys.tickets.all });
            const previousDetail = queryClient.getQueryData(queryKeys.tickets.detail(ticketId));

            const applyStatus = (t: Ticket): Ticket => ({
                ...t,
                status: status as Ticket['status'],
            });

            // 1. Optimistic update paginated tables
            queryClient.setQueriesData({ queryKey: ['tickets', 'paginated'] }, (old: any) =>
                updateTicketInCache(old, ticketId, applyStatus)
            );

            // 2. Optimistic update Kanban and ticket lists
            queryClient.setQueriesData({ queryKey: queryKeys.tickets.all }, (old: any) =>
                updateTicketInCache(old, ticketId, applyStatus)
            );

            // 3. Optimistic update single ticket detail
            queryClient.setQueryData(queryKeys.tickets.detail(ticketId), (old: any) =>
                old ? applyStatus(old) : old
            );

            return { previousPaginated, previousTickets, previousDetail, ticketId };
        },
        onSuccess: (data, variables) => {
            toast.success('Status updated');
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.dashboardStats() });
            if (variables.status === 'RESOLVED') {
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.actionItems() });
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.legacyActionItems() });
            }
        },
        onError: (err, variables, context) => {
            if (context?.previousPaginated) {
                context.previousPaginated.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousTickets) {
                context.previousTickets.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousDetail !== undefined && context?.ticketId) {
                queryClient.setQueryData(queryKeys.tickets.detail(context.ticketId), context.previousDetail);
            }
            toast.error('Failed to update status');
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
            if (variables?.ticketId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(variables.ticketId) });
            }
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onMutate: async ({ ticketId, priority }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.all });
            await queryClient.cancelQueries({ queryKey: queryKeys.tickets.detail(ticketId) });

            const previousPaginated = queryClient.getQueriesData({ queryKey: ['tickets', 'paginated'] });
            const previousTickets = queryClient.getQueriesData({ queryKey: queryKeys.tickets.all });
            const previousDetail = queryClient.getQueryData(queryKeys.tickets.detail(ticketId));

            const applyPriority = (t: Ticket): Ticket => ({
                ...t,
                priority: priority as Ticket['priority'],
            });

            // 1. Optimistic update paginated tables
            queryClient.setQueriesData({ queryKey: ['tickets', 'paginated'] }, (old: any) =>
                updateTicketInCache(old, ticketId, applyPriority)
            );

            // 2. Optimistic update Kanban and ticket lists
            queryClient.setQueriesData({ queryKey: queryKeys.tickets.all }, (old: any) =>
                updateTicketInCache(old, ticketId, applyPriority)
            );

            // 3. Optimistic update single ticket detail
            queryClient.setQueryData(queryKeys.tickets.detail(ticketId), (old: any) =>
                old ? applyPriority(old) : old
            );

            return { previousPaginated, previousTickets, previousDetail, ticketId };
        },
        onSuccess: () => {
            toast.success('Priority updated');
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.dashboardStats() });
        },
        onError: (err, variables, context) => {
            if (context?.previousPaginated) {
                context.previousPaginated.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousTickets) {
                context.previousTickets.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            if (context?.previousDetail !== undefined && context?.ticketId) {
                queryClient.setQueryData(queryKeys.tickets.detail(context.ticketId), context.previousDetail);
            }
            toast.error('Failed to update priority');
        },
        onSettled: (data, error, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
            if (variables?.ticketId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(variables.ticketId) });
            }
        },
    });

    return {
        assignTicketMutation,
        updateStatusMutation,
        updatePriorityMutation,
    };
};
