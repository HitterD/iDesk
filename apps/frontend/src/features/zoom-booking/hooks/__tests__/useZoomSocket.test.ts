import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useZoomSocket } from '../useZoomSocket';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('socket.io-client', () => ({
    io: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('useZoomSocket', () => {
    let mockSocket: any;
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient();

        mockSocket = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
            disconnect: vi.fn(),
            connected: true,
        };

        (io as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSocket);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
    );

    it('subscribes to sync:completed and displays toast with id zoom-calendar-sync and Indonesian message', () => {
        renderHook(() => useZoomSocket('acc-1'), { wrapper });

        // Find the 'sync:completed' handler registered via socket.on
        const syncCompletedCall = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'sync:completed'
        );
        expect(syncCompletedCall).toBeDefined();

        const handler = syncCompletedCall[1];
        handler({ updatedCount: 5 });

        expect(toast.info).toHaveBeenCalledWith(
            'Jadwal Zoom diperbarui (5 perubahan)',
            expect.objectContaining({
                id: 'zoom-calendar-sync',
            })
        );
    });

    it('does not display toast when updatedCount is 0', () => {
        renderHook(() => useZoomSocket('acc-1'), { wrapper });

        const syncCompletedCall = mockSocket.on.mock.calls.find(
            (call: any[]) => call[0] === 'sync:completed'
        );
        expect(syncCompletedCall).toBeDefined();

        const handler = syncCompletedCall[1];
        handler({ updatedCount: 0 });

        expect(toast.info).not.toHaveBeenCalled();
    });

    it('cleans up all socket listeners with socket.off upon unmount', () => {
        const { unmount } = renderHook(() => useZoomSocket('acc-1'), { wrapper });

        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('calendar:updated', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('settings:updated', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('booking:created', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('booking:cancelled', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('sync:completed', expect.any(Function));

        unmount();

        expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('calendar:updated', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('settings:updated', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('booking:created', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('booking:cancelled', expect.any(Function));
        expect(mockSocket.off).toHaveBeenCalledWith('sync:completed', expect.any(Function));
        expect(mockSocket.disconnect).toHaveBeenCalled();
    });
});
