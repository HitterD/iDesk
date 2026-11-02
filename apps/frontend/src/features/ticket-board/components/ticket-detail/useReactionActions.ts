import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { applyReactionsToCaches, type ReactionSummary } from '@/lib/ticketMessageCache';
import type { Reaction } from '@/components/ui/ChatReactions';

/** Server totals as the chips show them: `hasReacted` for the viewer, names for the tooltip. */
export function toReactionChips(summaries: ReactionSummary[] | undefined, viewerId: string | undefined): Reaction[] {
    return (summaries ?? []).map((r) => ({
        emoji: r.emoji,
        count: r.count,
        users: r.userNames,
        hasReacted: Boolean(viewerId && r.userIds.includes(viewerId)),
    }));
}

/** React / take back a reaction; the server's totals replace the cached ones right away. */
export function useReactionActions(ticketId: string) {
    const queryClient = useQueryClient();
    const apply = (messageId: string, reactions: ReactionSummary[] | undefined) => {
        if (Array.isArray(reactions)) applyReactionsToCaches(queryClient, ticketId, messageId, reactions);
    };

    return {
        react: async (messageId: string, emoji: string) => {
            const { data } = await api.put(`/tickets/${ticketId}/messages/${messageId}/reaction`, { emoji });
            apply(messageId, data);
        },
        unreact: async (messageId: string) => {
            const { data } = await api.delete(`/tickets/${ticketId}/messages/${messageId}/reaction`);
            apply(messageId, data);
        },
    };
}
