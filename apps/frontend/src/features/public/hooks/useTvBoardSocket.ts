import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface TvBoardCard {
    id: string;
    description: string;
    requesterName: string;
    assignedToName: string | null;
    priority: string;
    slaTarget: string | null;
    isOverdue: boolean;
}

export interface TvBoardData {
    siteName: string;
    siteCode: string;
    open: TvBoardCard[];
    inProgress: TvBoardCard[];
    resolved: TvBoardCard[];
    waitingVendorCount: number;
}

interface UseTvBoardSocketReturn {
    boardData: TvBoardData | null;
    isConnected: boolean;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5050';

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
