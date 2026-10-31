import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSocket } from '@/lib/socket';
import api from '@/lib/api';
import { notePath, type NoteUser, type TicketNote } from './types';

export function useTicketNotes(ticketId: string, userId: string, enabled = true) {
    const client = useQueryClient();
    const { socket } = useSocket();
    useEffect(() => {
        const changed = () => {
            void client.invalidateQueries({ queryKey: ['private-ticket-notes', userId, ticketId] });
            void client.invalidateQueries({ queryKey: ['private-ticket-note', userId, ticketId] });
            void client.invalidateQueries({ queryKey: ['private-note-discussion', userId] });
        };
        socket?.on('ticket-note:changed', changed);
        return () => { socket?.off('ticket-note:changed', changed); };
    }, [socket, client, userId, ticketId]);
    const key = ['private-ticket-notes', userId, ticketId];
    const query = useQuery({ queryKey: key, enabled,
        queryFn: async () => (await api.get<TicketNote[]>(notePath(ticketId))).data,
        refetchInterval: enabled ? 10_000 : false, retry: false, gcTime: 0 });
    const candidates = useQuery({ queryKey: [...key, 'candidates'], enabled,
        queryFn: async () => (await api.get<NoteUser[]>(`${notePath(ticketId)}/candidates`)).data, gcTime: 0 });
    const refresh = () => client.invalidateQueries({ queryKey: key });
    const create = async (title: string, memberIds: string[]) => {
        const result = await api.post<TicketNote>(notePath(ticketId), { title, memberIds });
        await refresh();
        return result.data;
    };
    return { notes: query.error ? [] : query.data ?? [], candidates: candidates.error ? [] : candidates.data ?? [], loading: query.isLoading,
        error: query.error, create, refresh };
}
