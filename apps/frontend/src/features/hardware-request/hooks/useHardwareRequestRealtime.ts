import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;
function getSocket() {
    if (!socket) {
        socket = io(`${import.meta.env.VITE_WS_URL}/ws/hardware-requests`, {
            withCredentials: true, transports: ['websocket'],
        });
    }
    return socket;
}

export function useHardwareRequestRealtime(requestId?: string) {
    const qc = useQueryClient();

    useEffect(() => {
        if (!requestId) return;
        const s = getSocket();

        const onStatusChanged = (p: any) => {
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', p.requestId] });
            qc.invalidateQueries({ queryKey: ['activity', p.requestId] });
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
        };
        const onComment = (p: any) => qc.invalidateQueries({ queryKey: ['comments', p.requestId] });
        const onSchedule = (p: any) => qc.invalidateQueries({ queryKey: ['hardware-requests', 'detail', p.requestId] });

        s.emit('subscribe_request', { requestId });
        s.on('status_changed', onStatusChanged);
        s.on('new_comment', onComment);
        s.on('schedule_proposed', onSchedule);
        s.on('schedule_confirmed', onSchedule);
        s.on('schedule_rescheduled', onSchedule);
        s.on('procurement_updated', onStatusChanged);

        return () => {
            s.emit('unsubscribe_request', { requestId });
            s.off('status_changed', onStatusChanged);
            s.off('new_comment', onComment);
            s.off('schedule_proposed', onSchedule);
            s.off('schedule_confirmed', onSchedule);
            s.off('schedule_rescheduled', onSchedule);
            s.off('procurement_updated', onStatusChanged);
        };
    }, [requestId, qc]);
}

export function useHardwareGlobalRealtime() {
    const qc = useQueryClient();
    useEffect(() => {
        const s = getSocket();
        let t: any;
        const debounce = (fn: () => void) => { clearTimeout(t); t = setTimeout(fn, 1000); };
        const fn = () => debounce(() => {
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'list'] });
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'open-count'] });
            qc.invalidateQueries({ queryKey: ['hardware-requests', 'dashboard'] });
        });
        
        s.on('request_list_updated', fn);
        return () => { 
            s.off('request_list_updated', fn); 
            clearTimeout(t); 
        };
    }, [qc]);
}
