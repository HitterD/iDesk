import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useEffect } from 'react';
import { useSocket } from '@/lib/socket';

interface PresenceState {
    onlineUserIds: string[];
    setOnlineUserIds: (ids: string[]) => void;
    addOnlineUser: (id: string) => void;
    removeOnlineUser: (id: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
    onlineUserIds: [],
    setOnlineUserIds: (ids) => set({ onlineUserIds: ids }),
    addOnlineUser: (id) => set((state) => ({
        onlineUserIds: state.onlineUserIds.includes(id) ? state.onlineUserIds : [...state.onlineUserIds, id]
    })),
    removeOnlineUser: (id) => set((state) => ({
        onlineUserIds: state.onlineUserIds.filter((uid) => uid !== id)
    })),
}));

export const usePresence = (userId?: string) => {
    const { socket, isConnected } = useSocket();
    const { onlineUserIds, setOnlineUserIds, addOnlineUser, removeOnlineUser } = usePresenceStore();

    useEffect(() => {
        if (!isConnected || !userId) return;

        // Identify self to server
        socket.emit('identify', userId);

        const handleUsersOnline = (ids: string[]) => {
            setOnlineUserIds(ids);
        };

        const handleUserOnline = (data: { userId: string }) => {
            addOnlineUser(data.userId);
        };

        const handleUserOffline = (data: { userId: string }) => {
            removeOnlineUser(data.userId);
        };

        socket.on('users:online', handleUsersOnline);
        socket.on('user:online', handleUserOnline);
        socket.on('user:offline', handleUserOffline);

        return () => {
            socket.off('users:online', handleUsersOnline);
            socket.off('user:online', handleUserOnline);
            socket.off('user:offline', handleUserOffline);
        };
    }, [isConnected, userId, socket, setOnlineUserIds, addOnlineUser, removeOnlineUser]);

    return { onlineUserIds };
};
