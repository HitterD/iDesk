import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { applyPinsToCaches, type PinnedMessageSummary } from '@/lib/ticketMessageCache';

/** Pin / release a chat message; the server's pin list replaces the cached one right away. */
export function usePinActions(ticketId: string) {
    const queryClient = useQueryClient();
    const apply = (pins: PinnedMessageSummary[] | undefined) => {
        if (Array.isArray(pins)) applyPinsToCaches(queryClient, ticketId, pins);
    };

    return {
        pin: async (messageId: string) => {
            const { data } = await api.post(`/tickets/${ticketId}/messages/${messageId}/pin`);
            apply(data);
        },
        unpin: async (messageId: string) => {
            const { data } = await api.delete(`/tickets/${ticketId}/messages/${messageId}/pin`);
            apply(data);
        },
    };
}
