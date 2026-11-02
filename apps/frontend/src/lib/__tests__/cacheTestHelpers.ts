import type { QueryClient } from '@tanstack/react-query';

export interface CachedMessageRow { id: string; [field: string]: unknown }
export interface CachedTicket { id: string; messages: CachedMessageRow[] }

/** The ['ticket', id] cache as a typed value (these tests only look at its messages). */
export const cachedTicket = (client: QueryClient, ticketId: string): CachedTicket =>
    client.getQueryData(['ticket', ticketId]) as CachedTicket;

/** The ['ticket-messages', id] cache as a typed list. */
export const cachedMessages = (client: QueryClient, ticketId: string): CachedMessageRow[] =>
    client.getQueryData(['ticket-messages', ticketId]) as CachedMessageRow[];
