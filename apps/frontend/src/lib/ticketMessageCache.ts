import type { QueryClient } from '@tanstack/react-query';

type CachedMessage = { id: string; sender?: object | null };
type WithMessages = { messages?: CachedMessage[] };

/** The server's version wins field by field; sender is merged so cached extras (avatar) survive. */
const merge = <T extends CachedMessage>(cached: T, incoming: CachedMessage): T => ({
    ...cached,
    ...incoming,
    sender: incoming.sender && cached.sender ? { ...cached.sender, ...incoming.sender } : (incoming.sender ?? cached.sender),
});

const replaceIn = <T extends CachedMessage>(list: T[], message: CachedMessage): T[] =>
    list.some((m) => m.id === message.id) ? list.map((m) => (m.id === message.id ? merge(m, message) : m)) : list;

/** Swap an edited or deleted message into both ticket caches (detail page and client page). */
export function replaceMessageInCaches(queryClient: QueryClient, ticketId: string, message: { id: string }): void {
    queryClient.setQueryData(['ticket', ticketId], (old: WithMessages | undefined) => {
        if (!old?.messages) return old;
        const messages = replaceIn(old.messages, message);
        return messages === old.messages ? old : { ...old, messages };
    });
    queryClient.setQueryData(['ticket-messages', ticketId], (old: CachedMessage[] | undefined) =>
        old ? replaceIn(old, message) : old);
}
