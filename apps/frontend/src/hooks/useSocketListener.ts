import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socket } from '../lib/socket';

export const useSocketListener = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        socket.on('ticketUpdated', (ticket: any) => {
            console.log('Ticket updated:', ticket);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            if (ticket.id) {
                queryClient.invalidateQueries({ queryKey: ['messages', ticket.id] });
            }
        });

        return () => {
            socket.off('ticketUpdated');
        };
    }, [queryClient]);
};
