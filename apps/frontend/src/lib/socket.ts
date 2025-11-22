import { io } from 'socket.io-client';

// In a real app, this URL would come from env vars
const SOCKET_URL = 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
    autoConnect: true,
});

import { useEffect, useState } from 'react';

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(socket.connected);

    useEffect(() => {
        function onConnect() {
            setIsConnected(true);
        }

        function onDisconnect() {
            setIsConnected(false);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    return { socket, isConnected };
};
