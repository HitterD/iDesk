import { create } from 'zustand';
import { useEffect } from 'react';
import { useSocket } from '@/lib/socket';

interface PresenceState {
    onlineUserIds: string[];
    setOnlineUserIds: (ids: string[]) => void;
    addOnlineUser: (id: string) => void;
    removeOnlineUser: (id: string) => void;
    reset: () => void;
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
    reset: () => set({ onlineUserIds: [] }),
}));

/**
 * Subscribe to server presence. Mount once high in the tree (see PresenceProvider).
 * Returns nothing on purpose: reading the roster here would re-render the whole
 * subtree on every delta. Components read it with `useIsUserOnline` instead.
 */
export const usePresence = (userId?: string): void => {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!userId) return;

        // Actions are read via getState() so the effect does not re-subscribe
        // (and re-emit identify) on every presence delta.
        const { setOnlineUserIds, addOnlineUser, removeOnlineUser, reset } = usePresenceStore.getState();

        // Server room state is rebuilt on every (re)connect, so re-identify each time
        // to pull a fresh roster instead of drifting on stale deltas.
        const identify = () => socket.emit('identify', userId);

        const handleUsersOnline = (ids: string[]) => {
            setOnlineUserIds(Array.isArray(ids) ? ids : []);
        };

        const handleUserOnline = (data: { userId: string }) => {
            if (data?.userId) addOnlineUser(data.userId);
        };

        const handleUserOffline = (data: { userId: string }) => {
            if (data?.userId) removeOnlineUser(data.userId);
        };

        // The roster is only trustworthy while connected.
        const handleDisconnect = () => reset();

        socket.on('connect', identify);
        socket.on('disconnect', handleDisconnect);
        socket.on('users:online', handleUsersOnline);
        socket.on('user:online', handleUserOnline);
        socket.on('user:offline', handleUserOffline);

        if (isConnected) identify();

        return () => {
            socket.off('connect', identify);
            socket.off('disconnect', handleDisconnect);
            socket.off('users:online', handleUsersOnline);
            socket.off('user:online', handleUserOnline);
            socket.off('user:offline', handleUserOffline);
        };
    }, [isConnected, userId, socket]);
};

/**
 * Read a single user's presence without re-rendering on unrelated roster changes.
 */
export const useIsUserOnline = (userId?: string): boolean =>
    usePresenceStore((state) => (userId ? state.onlineUserIds.includes(userId) : false));
