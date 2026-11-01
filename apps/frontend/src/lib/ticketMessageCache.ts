import type { QueryClient } from '@tanstack/react-query';

type WithMessages = { messages?: { id: string }[] };

const replaceIn = <T extends { id: string }>(list: T[], message: { id: string }): T[] =>
    list.some((m) => m.id === message.id) ? list.map((m) => (m.id === message.id ? { ...m, ...message } : m)) : list;

/** Swap an edited or deleted message into both ticket caches (detail page and client page). */
export function replaceMessageInCaches(queryClient: QueryClient, ticketId: string, message: { id: string }): void {
    queryClient.setQueryData(['ticket', ticketId], (old: WithMessages | undefined) => {
        if (!old?.messages) return old;
        const messages = replaceIn(old.messages, message);
        return messages === old.messages ? old : { ...old, messages };
    });
    queryClient.setQueryData(['ticket-messages', ticketId], (old: { id: string }[] | undefined) =>
        old ? replaceIn(old, message) : old);
}
