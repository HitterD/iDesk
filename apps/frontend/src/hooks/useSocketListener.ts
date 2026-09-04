import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../lib/socket';
import { queryKeys } from '../lib/queryKeys';

export const useSocketListener = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        const handleTicketUpdated = (ticket: any) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.tickets.dashboardStats() });
            if (ticket?.id) {
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.detail(ticket.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.messages(ticket.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.tickets.legacyMessages(ticket.id) });
            }
        };

        socket.on('ticketUpdated', handleTicketUpdated);

        return () => {
            socket.off('ticketUpdated', handleTicketUpdated);
        };
    }, [queryClient]);
};
