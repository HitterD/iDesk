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
    /** The server says this TV link was revoked or never existed. */
    isTokenInvalid: boolean;
}

/** Wait before retrying a join the server could not finish (e.g. a slow database). */
export const JOIN_RETRY_DELAY_MS = 5000;
/** Wait before reconnecting after the server dropped the socket (e.g. a backend restart). */
export const SERVER_DISCONNECT_RETRY_MS = 3000;

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
    const [isTokenInvalid, setIsTokenInvalid] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!token) return;

        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let tokenRejected = false;
        const retryLater = (action: () => void, delayMs: number) => {
            clearTimeout(retryTimer);
            retryTimer = setTimeout(action, delayMs);
        };

        const socket = io(`${SOCKET_URL}/tv-board`, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });
        const join = () => socket.emit('tv-board:join', { token });

        socket.on('connect', join);

        // Connected only counts once the server has joined us to the site and sent the board.
        socket.on('tv-board:update', (data: TvBoardData) => {
            setIsConnected(true);
            setBoardData(data);
        });

        socket.on('tv-board:join-error', () => {
            if (socket.connected) retryLater(join, JOIN_RETRY_DELAY_MS);
        });

        socket.on('tv-board:invalid-token', () => {
            tokenRejected = true;
            setIsTokenInvalid(true);
        });

        socket.on('disconnect', (reason) => {
            setIsConnected(false);
            // socket.io never reconnects on its own after a server-side disconnect.
            if (reason === 'io server disconnect' && !tokenRejected) {
                retryLater(() => socket.connect(), SERVER_DISCONNECT_RETRY_MS);
            }
        });

        socket.on('connect_error', (err) => {
            console.error('TV Board socket connect_error:', err);
            setIsConnected(false);
        });

        socketRef.current = socket;

        return () => {
            clearTimeout(retryTimer);
            socket.removeAllListeners();
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token]);

    return { boardData, isConnected, isTokenInvalid };
}
