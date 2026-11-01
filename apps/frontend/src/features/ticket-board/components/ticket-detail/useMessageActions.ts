import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { replaceMessageInCaches } from '@/lib/ticketMessageCache';

/** Edit / delete a ticket chat message; the server's answer replaces it in the caches right away. */
export function useMessageActions(ticketId: string) {
    const queryClient = useQueryClient();
    const apply = (message: { id: string }) => replaceMessageInCaches(queryClient, ticketId, message);

    return {
        editMessage: async (messageId: string, content: string) => {
            const { data } = await api.patch(`/tickets/${ticketId}/messages/${messageId}`, { content });
            apply(data);
        },
        deleteMessage: async (messageId: string) => {
            const { data } = await api.delete(`/tickets/${ticketId}/messages/${messageId}`);
            apply(data);
        },
    };
}
