import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Ticket } from '../types/ticket.types';

export const useTicketListMutations = (agents: any[]) => {
    const queryClient = useQueryClient();

    const assignTicketMutation = useMutation({
        mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId });
        },
        onMutate: async ({ ticketId, assigneeId }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousData = queryClient.getQueryData(['tickets', 'paginated']);
            const assignee = agents.find(a => a.id === assigneeId) || null;

            queryClient.setQueriesData(
                { queryKey: ['tickets', 'paginated'] },
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((ticket: Ticket) =>
                            ticket.id === ticketId
                                ? {
                                    ...ticket,
                                    assignedTo: assignee ? { id: assignee.id, fullName: assignee.fullName, email: assignee.email } : ticket.assignedTo
                                }
                                : ticket
                        ),
                    };
                }
            );
            return { previousData };
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['tickets', 'paginated'], context.previousData);
            }
            toast.error('Failed to assign ticket');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onMutate: async ({ ticketId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousData = queryClient.getQueryData(['tickets', 'paginated']);

            queryClient.setQueriesData(
                { queryKey: ['tickets', 'paginated'] },
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((ticket: Ticket) =>
                            ticket.id === ticketId
                                ? { ...ticket, status: status as Ticket['status'] }
                                : ticket
                        ),
                    };
                }
            );
            return { previousData };
        },
        onSuccess: () => {
            toast.success('Status updated');
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['tickets', 'paginated'], context.previousData);
            }
            toast.error('Failed to update status');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onMutate: async ({ ticketId, priority }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousData = queryClient.getQueryData(['tickets', 'paginated']);

            queryClient.setQueriesData(
                { queryKey: ['tickets', 'paginated'] },
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.map((ticket: Ticket) =>
                            ticket.id === ticketId
                                ? { ...ticket, priority: priority as Ticket['priority'] }
                                : ticket
                        ),
                    };
                }
            );
            return { previousData };
        },
        onSuccess: () => {
            toast.success('Priority updated');
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['tickets', 'paginated'], context.previousData);
            }
            toast.error('Failed to update priority');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });

    return {
        assignTicketMutation,
        updateStatusMutation,
        updatePriorityMutation,
    };
};
