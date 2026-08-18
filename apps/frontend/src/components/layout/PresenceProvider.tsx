import React from 'react';
import { usePresence } from '@/hooks/usePresence';
import { useAuth } from '@/stores/useAuth';

/**
 * Isolated so the subscription — and the socket connect it triggers — only ever
 * mounts for a signed-in user. Public routes must not open a handshake that the
 * gateway is guaranteed to reject.
 */
const PresenceSubscriber: React.FC<{ userId: string }> = ({ userId }) => {
    usePresence(userId);
    return null;
};

/**
 * Keeps the presence roster subscribed for the whole authenticated app.
 *
 * Mounted once at the router root so every portal (admin, manager, client)
 * shares one `identify` round-trip. It renders no wrapper of its own, so a
 * roster change never re-renders the route tree — components opt in with
 * `useIsUserOnline`.
 */
export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const userId = useAuth((state) => (state.isAuthenticated ? state.user?.id : undefined));

    return (
        <>
            {userId && <PresenceSubscriber userId={userId} />}
            {children}
        </>
    );
};
