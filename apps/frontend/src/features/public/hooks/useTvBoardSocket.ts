import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TvBoardCard {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    requesterName: string;
    requesterDepartment: string | null;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
    isOracleRequest: boolean;
    handlingTeam?: 'OPS_SUPPORT' | 'ORACLE_DEV' | 'WEB_DEV' | 'MOBILE_DEV' | string;
    category?: string | null;
    ticketType?: string | null;
}

export interface TvBoardRingtones {
    newTicket: string | null;
    newTicketSupport?: string | null;
    newTicketOracle?: string | null;
    newTicketWebDev?: string | null;
    newTicketMobileDev?: string | null;
    inProgress: string | null;
    closing: string | null;
    closingTime: string | null;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    waitingVendorCount: number;
    ringtones: TvBoardRingtones;
}

interface UseTvBoardSocketReturn {
    boardData: TvBoardData | null;
    isConnected: boolean;
}

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
const SOCKET_URL = rawSocketUrl
    .replace(/\/v1\/?$/, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/+$/, '');

export function useTvBoardSocket(token: string | undefined): UseTvBoardSocketReturn {
    const [boardData, setBoardData] = useState<TvBoardData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token) return;

        const socket = io(`${SOCKET_URL}/tv-board`, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('tv-board:join', { token });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.error('TV Board socket connect_error:', err);
            setIsConnected(false);
        });

        socket.on('tv-board:update', (data: TvBoardData) => {
            setBoardData(data);
        });

        socketRef.current = socket;

        return () => {
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    return { boardData, isConnected };
}
