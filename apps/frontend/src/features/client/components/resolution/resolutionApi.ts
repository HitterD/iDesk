import type { QueryClient } from '@tanstack/react-query';

/** Max characters for the "Masih bermasalah" (dispute) reason. */
export const DISPUTE_REASON_MAX = 1000;
/** Max characters for a rating comment. */
export const RATING_COMMENT_MAX = 1000;
export const RATING_STARS = [1, 2, 3, 4, 5] as const;

export const agentRatingsQueryKey = (ticketId: string) => ['ticket-agent-ratings', ticketId] as const;

export interface TicketAgentRating {
    agentId: string;
    fullName: string;
    rating: number | null;
    comment: string | null;
}

export interface TicketAgentRatingsResponse {
    canRate: boolean;
    ratingDeadline: string | null;
    agents: TicketAgentRating[];
}

/** Prefer the backend message (validation / closed-ticket errors) over a generic fallback. */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
    const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    return message || fallback;
};

export const invalidateTicketQueries = async (queryClient: QueryClient, ticketId: string): Promise<void> => {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    ]);
};
