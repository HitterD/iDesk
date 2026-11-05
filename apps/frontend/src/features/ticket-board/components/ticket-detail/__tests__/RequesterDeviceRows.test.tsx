import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { RequesterDeviceRows } from '../RequesterDeviceRows';

vi.mock('@/lib/api', () => ({ default: { get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const mockedGet = vi.mocked(api.get);

const renderRows = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RequesterDeviceRows ticketId="t-1" />
    </QueryClientProvider>,
);

describe('RequesterDeviceRows', () => {
    beforeEach(() => mockedGet.mockReset());

    it('shows the computer and IP the ticket came from, with the source and other devices on hover', async () => {
        mockedGet.mockResolvedValue({ data: {
            requesterIp: '10.10.6.45', requesterHostname: 'SJA-FIN-PC012', requesterHostnameSource: 'AGENT',
            recentDevices: [
                { hostname: 'SJA-FIN-PC012', lanIp: '10.10.6.45', osVersion: 'Windows 11', lastSeenAt: new Date().toISOString() },
                { hostname: 'SJA-FIN-LT03', lanIp: '10.10.7.12', osVersion: null, lastSeenAt: new Date().toISOString() },
            ],
        } });
        renderRows();

        expect(await screen.findByRole('button', { name: 'Salin nama komputer SJA-FIN-PC012' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Salin IP 10.10.6.45' })).toBeInTheDocument();
        const tooltip = screen.getByTitle(/aplikasi desktop/);
        expect(tooltip.getAttribute('title')).toContain('SJA-FIN-LT03 (10.10.7.12)');
        expect(tooltip.getAttribute('title')).not.toContain('• SJA-FIN-PC012');
        expect(mockedGet).toHaveBeenCalledWith('/tickets/t-1/requester-device', { skipToast: true });
    });

    it('shows a dash when only the IP is known', async () => {
        mockedGet.mockResolvedValue({ data: { requesterIp: '10.10.6.45', requesterHostname: null, requesterHostnameSource: null, recentDevices: [] } });
        renderRows();
        expect(await screen.findByRole('button', { name: 'Salin IP 10.10.6.45' })).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders nothing when the server refuses or nothing was recorded', async () => {
        mockedGet.mockRejectedValueOnce({ response: { status: 403 } });
        const { container, unmount } = renderRows();
        await vi.waitFor(() => expect(mockedGet).toHaveBeenCalled());
        expect(container.querySelector('[data-testid="requester-device"]')).toBeNull();
        unmount();

        mockedGet.mockResolvedValue({ data: { requesterIp: null, requesterHostname: null, requesterHostnameSource: null, recentDevices: [] } });
        const second = renderRows();
        await vi.waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
        expect(second.container.querySelector('[data-testid="requester-device"]')).toBeNull();
    });
});
