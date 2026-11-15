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

/** One entry of the pinned bar, as sent in `ticket:pinsChanged` and by the pin endpoints. */
export interface PinnedMessageSummary {
    id: string;
    senderName: string;
    snippet: string;
    pinnedAt: string;
    isInternal: boolean;
    canUnpin?: boolean;
}

type PinState = { id: string; isPinned?: boolean; pinnedAt?: string | null; canUnpin?: boolean };

const withPins = <T extends PinState>(list: T[], pins: PinnedMessageSummary[]): T[] => {
    const pinById = new Map(pins.map((p) => [p.id, p]));
    return list.map((m) => {
        const entry = pinById.get(m.id);
        const at = entry?.pinnedAt ?? null;
        const nextCanUnpin = entry ? (typeof entry.canUnpin === 'boolean' ? entry.canUnpin : m.canUnpin) : undefined;
        return Boolean(m.isPinned) === Boolean(at) && (m.pinnedAt ?? null) === at && m.canUnpin === nextCanUnpin
            ? m
            : { ...m, isPinned: Boolean(at), pinnedAt: at, canUnpin: nextCanUnpin };
    });
};

/** The server's pin list is the whole truth: listed messages are pinned, every other one is not. */
export function applyPinsToCaches(queryClient: QueryClient, ticketId: string, pins: PinnedMessageSummary[]): void {
    queryClient.setQueryData(['ticket', ticketId], (old: { messages?: PinState[] } | undefined) =>
        old?.messages ? { ...old, messages: withPins(old.messages, pins) } : old);
    queryClient.setQueryData(['ticket-messages', ticketId], (old: PinState[] | undefined) =>
        old ? withPins(old, pins) : old);
}

/** Everyone who reacted with one emoji on one message (as the server sends it). */
export interface ReactionSummary {
    emoji: string;
    count: number;
    userIds: string[];
    userNames: string[];
}

/** New reaction totals of one message, in both ticket caches. */
export function applyReactionsToCaches(queryClient: QueryClient, ticketId: string, messageId: string, reactions: ReactionSummary[]): void {
    const patch = <T extends { id: string }>(list: T[]) =>
        list.some((m) => m.id === messageId) ? list.map((m) => (m.id === messageId ? { ...m, reactions } : m)) : list;
    queryClient.setQueryData(['ticket', ticketId], (old: { messages?: { id: string }[] } | undefined) =>
        old?.messages ? { ...old, messages: patch(old.messages) } : old);
    queryClient.setQueryData(['ticket-messages', ticketId], (old: { id: string }[] | undefined) => (old ? patch(old) : old));
}

/** Append an optimistic reply into the ticket detail cache before the HTTP request settles. */
export function appendOptimisticMessage<T extends CachedMessage>(queryClient: QueryClient, ticketId: string, message: T): void {
    queryClient.setQueryData(['ticket', ticketId], (old: WithMessages | undefined) =>
        old ? { ...old, messages: [...(old.messages ?? []), message] } : old);
}

/** Swap an optimistic message with the server's saved copy, or drop it if WS delivered it first. */
export function reconcileOptimisticMessage(
    queryClient: QueryClient,
    ticketId: string,
    tempId: string,
    saved?: CachedMessage | null,
): void {
    if (!saved?.id) return;
    queryClient.setQueryData(['ticket', ticketId], (old: WithMessages | undefined) => {
        if (!old?.messages) return old;
        const alreadyHasReal = old.messages.some((m) => m.id === saved.id);
        return {
            ...old,
            messages: alreadyHasReal
                ? old.messages.filter((m) => m.id !== tempId)
                : old.messages.map((m) => (m.id === tempId ? merge(m, saved) : m)),
        };
    });
}

/** Remove an optimistic message after a failed send so it does not stay stuck in the stream. */
export function removeOptimisticMessage(queryClient: QueryClient, ticketId: string, tempId: string): void {
    queryClient.setQueryData(['ticket', ticketId], (old: WithMessages | undefined) => {
        if (!old?.messages) return old;
        const filtered = old.messages.filter((m) => m.id !== tempId);
        return filtered.length === old.messages.length ? old : { ...old, messages: filtered };
    });
}
