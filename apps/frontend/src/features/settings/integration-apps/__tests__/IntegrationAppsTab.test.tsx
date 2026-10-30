import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationAppsTab } from '../IntegrationAppsTab';

const ebbk = {
    id: 'a-1', clientId: 'ebbk', name: 'EBBK', description: 'Bukti kas', secretHint: 'H1as', modules: ['web-developer'],
    permissions: ['tickets:create', 'tickets:read'], webhookUrl: null, isActive: true, lastUsedAt: null,
    createdAt: '2026-10-24T00:00:00Z', updatedAt: '2026-10-24T00:00:00Z',
};
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderTab = () => render(<QueryClientProvider client={new QueryClient()}><IntegrationAppsTab /></QueryClientProvider>);

describe('IntegrationAppsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.get.mockImplementation(async (url: string) => ({
            data: url.includes('ticket-modules')
                ? [{ slug: 'it-support', name: 'IT Support Tickets', isActive: true }, { slug: 'web-developer', name: 'Web Developer Request', isActive: true }, { slug: 'hr', name: 'HR', isActive: true }]
                : [ebbk],
        }));
    });

    it('lists each app with what it is allowed to do', async () => {
        renderTab();
        const card = (await screen.findByText('EBBK')).closest('li')!;
        expect(within(card).getByText('Web Developer Request')).toBeInTheDocument();
        expect(within(card).getByText('Buat tiket')).toBeInTheDocument();
        expect(within(card).getByText('Lihat progres')).toBeInTheDocument();
        expect(within(card).getByText('Tidak dipakai')).toBeInTheDocument();
        expect(within(card).getByText(/••••H1as/)).toBeInTheDocument();
    });

    it('creates an app and shows its secret once', async () => {
        api.post.mockResolvedValue({ data: { app: { ...ebbk, id: 'a-2', clientId: 'portal-hr', name: 'Portal HR' }, secret: 'the-secret-value' } });
        renderTab();
        await screen.findByText('EBBK');
        fireEvent.click(screen.getAllByRole('button', { name: /Tambah aplikasi/ })[0]);

        fireEvent.change(screen.getByPlaceholderText('mis. EBBK'), { target: { value: 'Portal HR' } });
        fireEvent.change(screen.getByPlaceholderText('mis. ebbk'), { target: { value: 'portal-hr' } });
        expect(screen.queryByRole('checkbox', { name: /HR$/ })).not.toBeInTheDocument(); // only modules the ticket API supports
        fireEvent.click(screen.getByRole('checkbox', { name: /IT Support Tickets/ }));
        fireEvent.click(screen.getByRole('button', { name: /Tambah & buat secret/ }));

        await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/integration-apps', expect.objectContaining({
            clientId: 'portal-hr', name: 'Portal HR', modules: ['it-support'],
            permissions: ['tickets:create', 'tickets:read', 'messages:read', 'messages:write'], webhookUrl: null,
        })));
        expect(await screen.findByText('the-secret-value')).toBeInTheDocument();
        expect(screen.getByText(/Secret hanya tampil sekali/)).toBeInTheDocument();
    });

    it('rejects a client id that would clash with a built-in source', async () => {
        renderTab();
        await screen.findByText('EBBK');
        fireEvent.click(screen.getAllByRole('button', { name: /Tambah aplikasi/ })[0]);
        fireEvent.change(screen.getByPlaceholderText('mis. ebbk'), { target: { value: 'ipop' } });
        expect(screen.getByText('Nama ini dipakai sistem')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Tambah & buat secret/ })).toBeDisabled();
    });
});
