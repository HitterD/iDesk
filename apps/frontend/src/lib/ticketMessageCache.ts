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
}

type PinState = { id: string; isPinned?: boolean; pinnedAt?: string | null };

const withPins = <T extends PinState>(list: T[], pins: PinnedMessageSummary[]): T[] => {
    const pinnedAt = new Map(pins.map((p) => [p.id, p.pinnedAt]));
    return list.map((m) => {
        const at = pinnedAt.get(m.id) ?? null;
        return Boolean(m.isPinned) === Boolean(at) && (m.pinnedAt ?? null) === at ? m : { ...m, isPinned: Boolean(at), pinnedAt: at };
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
