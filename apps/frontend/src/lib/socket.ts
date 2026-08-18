import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket URL from environment variable with fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;

// Lazy socket instance - only one per app
let socketInstance: Socket | null = null;

const getSocket = (): Socket => {
    if (!socketInstance) {
        // Auth travels in the HttpOnly `access_token` cookie, which the browser
        // attaches to the handshake only when credentials are enabled. The gateway
        // reads it server-side; no token is ever exposed to JavaScript.
        socketInstance = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            withCredentials: true,
        });
    }
    return socketInstance;
};

/**
 * Disconnect and cleanup socket instance.
 * Called on logout. The instance is reused rather than discarded so that
 * long-lived consumers holding a reference keep talking to the live socket.
 */
export const disconnectSocket = (): void => {
    socketInstance?.disconnect();
};

export const socket: Socket = getSocket();

/**
 * Open the shared connection. Safe to call repeatedly — socket.io ignores
 * connect() on an already-open socket.
 */
export const connectSocket = (): void => {
    getSocket().connect();
};

export const useSocket = (): { socket: Socket; isConnected: boolean } => {
    const currentSocket = getSocket();
    const [isConnected, setIsConnected] = useState(currentSocket.connected);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        currentSocket.on('connect', onConnect);
        currentSocket.on('disconnect', onDisconnect);

        // Reconnect after a logout/login cycle closed the shared socket.
        if (!currentSocket.connected) {
            currentSocket.connect();
        }

        // Resync in case connect() resolved before the listener was attached.
        setIsConnected(currentSocket.connected);

        return () => {
            currentSocket.off('connect', onConnect);
            currentSocket.off('disconnect', onDisconnect);
        };
    }, [currentSocket]);

    return { socket: currentSocket, isConnected };
};
