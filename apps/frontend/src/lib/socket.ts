import { io, Socket } from 'socket.io-client';
import { useEffect, useState, useRef } from 'react';

// In a real app, this URL would come from env vars
const SOCKET_URL = 'http://localhost:5050';

// Lazy socket instance - only one per app
let socketInstance: Socket | null = null;

const getSocket = (): Socket => {
    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
        });
    }
    return socketInstance;
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
