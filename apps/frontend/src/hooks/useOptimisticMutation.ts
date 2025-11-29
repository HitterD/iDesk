import { useMutation, useQueryClient, QueryKey, MutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Custom hook for optimistic updates with automatic rollback on error
 * Provides a better UX by immediately reflecting changes while syncing with server
 */

interface OptimisticMutationOptions<TData, TError, TVariables, TContext> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    queryKey: QueryKey;
    // Function to update cache optimistically
    optimisticUpdate: (oldData: TData | undefined, variables: TVariables) => TData;
    // Optional: Custom success message
    successMessage?: string | ((data: TData, variables: TVariables) => string);
    // Optional: Custom error message
    errorMessage?: string | ((error: TError) => string);
    // Optional: Callback on success
    onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
    // Optional: Callback on error
    onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
    // Optional: Don't show toast messages
    silent?: boolean;
}

export function useOptimisticMutation<TData, TError = Error, TVariables = void, TContext = { previousData: TData | undefined }>({
    mutationFn,
    queryKey,
    optimisticUpdate,
    successMessage,
    errorMessage = 'Operation failed. Changes have been reverted.',
    onSuccess,
    onError,
    silent = false,
}: OptimisticMutationOptions<TData, TError, TVariables, TContext>) {
    const queryClient = useQueryClient();

    return useMutation<TData, TError, TVariables, TContext>({
        mutationFn,
        onMutate: async (variables) => {
            // Cancel any outgoing refetches to prevent overwriting optimistic update
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousData = queryClient.getQueryData<TData>(queryKey);

            // Optimistically update to the new value
            if (previousData !== undefined) {
                queryClient.setQueryData<TData>(queryKey, (old) => optimisticUpdate(old, variables));
            }

            // Return context with snapshotted value
            return { previousData } as TContext;
        },
        onError: (error, variables, context) => {
            // Rollback to previous value on error
            if (context && (context as { previousData?: TData }).previousData !== undefined) {
                queryClient.setQueryData(queryKey, (context as { previousData: TData }).previousData);
            }

            if (!silent) {
                const message = typeof errorMessage === 'function' 
                    ? errorMessage(error) 
                    : errorMessage;
                toast.error(message);
            }

            onError?.(error, variables, context);
        },
        onSuccess: (data, variables, context) => {
            if (!silent && successMessage) {
                const message = typeof successMessage === 'function' 
                    ? successMessage(data, variables) 
                    : successMessage;
                toast.success(message);
            }

            onSuccess?.(data, variables, context);
        },
        onSettled: () => {
            // Always refetch after error or success to ensure sync with server
            queryClient.invalidateQueries({ queryKey });
        },
    });
}

/**
 * Hook for optimistic status update on tickets
 */
export function useOptimisticTicketStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
            const { default: api } = await import('@/lib/api');
            return api.patch(`/tickets/${ticketId}/status`, { status }).then(res => res.data);
        },
        onMutate: async ({ ticketId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            
            const previousTickets = queryClient.getQueryData(['tickets']);
            
            // Update in list view
            queryClient.setQueryData(['tickets'], (old: any) => {
                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map((t: any) => t.id === ticketId ? { ...t, status } : t);
                }
                if (old.data && Array.isArray(old.data)) {
                    return { ...old, data: old.data.map((t: any) => t.id === ticketId ? { ...t, status } : t) };
                }
                return old;
            });
            
            return { previousTickets };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(['tickets'], context.previousTickets);
            }
            toast.error('Failed to update status');
        },
        onSuccess: () => {
            toast.success('Status updated');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
        },
    });
}

/**
 * Hook for optimistic priority update on tickets
 */
export function useOptimisticTicketPriority() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            const { default: api } = await import('@/lib/api');
            return api.patch(`/tickets/${ticketId}/priority`, { priority }).then(res => res.data);
        },
        onMutate: async ({ ticketId, priority }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            
            const previousTickets = queryClient.getQueryData(['tickets']);
            
            queryClient.setQueryData(['tickets'], (old: any) => {
                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map((t: any) => t.id === ticketId ? { ...t, priority } : t);
                }
                if (old.data && Array.isArray(old.data)) {
                    return { ...old, data: old.data.map((t: any) => t.id === ticketId ? { ...t, priority } : t) };
                }
                return old;
            });
            
            return { previousTickets };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(['tickets'], context.previousTickets);
            }
            toast.error('Failed to update priority');
        },
        onSuccess: () => {
            toast.success('Priority updated');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });
}

/**
 * Hook for optimistic ticket assignment
 */
export function useOptimisticTicketAssign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
            const { default: api } = await import('@/lib/api');
            return api.patch(`/tickets/${ticketId}/assign`, { assigneeId }).then(res => res.data);
        },
        onMutate: async ({ ticketId, assigneeId }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            
            const previousTickets = queryClient.getQueryData(['tickets']);
            
            // Note: We don't have agent info here, so we just mark as assigned
            // The full data will come from server refresh
            queryClient.setQueryData(['tickets'], (old: any) => {
                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map((t: any) => t.id === ticketId ? { ...t, assignedTo: { id: assigneeId } } : t);
                }
                if (old.data && Array.isArray(old.data)) {
                    return { ...old, data: old.data.map((t: any) => t.id === ticketId ? { ...t, assignedTo: { id: assigneeId } } : t) };
                }
                return old;
            });
            
            return { previousTickets };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousTickets) {
                queryClient.setQueryData(['tickets'], context.previousTickets);
            }
            toast.error('Failed to assign ticket');
        },
        onSuccess: () => {
            toast.success('Ticket assigned');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
    });
}

/**
 * Hook for optimistic notification mark as read
 */
export function useOptimisticMarkNotificationRead() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (notificationId: string) => {
            const { default: api } = await import('@/lib/api');
            return api.patch(`/notifications/${notificationId}/read`).then(res => res.data);
        },
        onMutate: async (notificationId) => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            
            const previousNotifications = queryClient.getQueryData(['notifications']);
            
            queryClient.setQueryData(['notifications'], (old: any) => {
                if (!old) return old;
                if (Array.isArray(old)) {
                    return old.map((n: any) => n.id === notificationId ? { ...n, read: true } : n);
                }
                return old;
            });
            
            // Update unread count
            queryClient.setQueryData(['notifications-unread-count'], (old: number | undefined) => {
                return old ? Math.max(0, old - 1) : 0;
            });
            
            return { previousNotifications };
        },
        onError: (err, variables, context: any) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(['notifications'], context.previousNotifications);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        },
    });
}
