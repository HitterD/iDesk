import { io, Socket } from 'socket.io-client';
import { useEffect, useState, useRef } from 'react';

// Socket URL from environment variable with fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 
                   import.meta.env.VITE_API_URL || 
                   'http://localhost:5050';

// Lazy socket instance - only one per app
let socketInstance: Socket | null = null;

const getSocket = (): Socket => {
    if (!socketInstance) {
        // Get auth token from localStorage for WebSocket authentication
        const getAuthToken = (): string | null => {
            try {
                const authStorage = localStorage.getItem('auth-storage');
                if (authStorage) {
                    const parsed = JSON.parse(authStorage);
                    return parsed?.state?.token || null;
                }
            } catch {
                return null;
            }
            return null;
        };

        socketInstance = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            auth: {
                token: getAuthToken(),
            },
        });

        // Update auth token on reconnect
        socketInstance.on('reconnect_attempt', () => {
            const token = getAuthToken();
            if (token && socketInstance) {
                socketInstance.auth = { token };
            }
        });
    }
    return socketInstance;
};

/**
 * Disconnect and cleanup socket instance
 * Should be called on user logout to prevent memory leaks
 */
export const disconnectSocket = (): void => {
    if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
        socketInstance = null;
    }
};

export const socket = getSocket();

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const connectionRef = useRef(false);

    useEffect(() => {
        const currentSocket = getSocket();

        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        currentSocket.on('connect', onConnect);
        currentSocket.on('disconnect', onDisconnect);

        // Only connect if not already connected
        if (!currentSocket.connected && !connectionRef.current) {
            connectionRef.current = true;
            currentSocket.connect();
        }

        // Set initial state
        setIsConnected(currentSocket.connected);

        return () => {
            currentSocket.off('connect', onConnect);
            currentSocket.off('disconnect', onDisconnect);
        };
    }, []);

    return { socket: getSocket(), isConnected };
};
