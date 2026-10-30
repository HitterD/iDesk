import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));
vi.mock('../../../../lib/api', () => ({ default: { get: (...a: unknown[]) => get(...a) } }));

const logs = [
    { id: 'l1', userId: 'u1', user: { fullName: 'RM Bagastyo Anggoro', email: 'bagas@x.id' }, action: 'STATUS_CHANGE', entityType: 'ticket', entityId: 'abcdef1234567', oldValue: { status: 'IN_PROGRESS' }, newValue: { status: 'WAITING_VENDOR' }, ipAddress: '10.10.4.21', description: 'Status IN_PROGRESS → WAITING_VENDOR', createdAt: '2026-10-21T05:38:00Z' },
    { id: 'l2', userId: 'u2', action: 'USER_LOGIN', entityType: 'user', entityId: null, oldValue: null, newValue: null, ipAddress: null, description: 'Login berhasil', createdAt: '2026-10-21T01:01:00Z' },
];

const { AuditLogPage } = await import('../AuditLogPage');
const renderPage = () => render(
    <MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuditLogPage /></QueryClientProvider></MemoryRouter>,
);

describe('AuditLogPage (round-2 table)', () => {
    beforeEach(() => {
        get.mockReset();
        get.mockImplementation((url: string) => {
            if (url.startsWith('/audit/stats')) return Promise.resolve({ data: { totalLogs: 120, loginsToday: 8, changesLast24h: 30, failedAuthAttempts: 0 } });
            if (url.startsWith('/audit')) return Promise.resolve({ data: { data: logs, meta: { total: 2, page: 1, limit: 25, totalPages: 1 } } });
            return Promise.resolve({ data: [] });
        });
    });

    it('renders mockup columns, action bubbles, entity link and System rows', async () => {
        renderPage();
        expect(await screen.findByText('Status Changed')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Audit Logs' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '#abcdef12' })).toHaveAttribute('href', '/tickets/abcdef1234567');
        expect(screen.getByText('System')).toBeInTheDocument();
        expect(screen.getByText('Menampilkan 1–2 dari 2 log')).toBeInTheDocument();
    });

    it('links users and articles to registered application routes', async () => {
        get.mockImplementation((url: string) => {
            if (url.startsWith('/audit/stats')) return Promise.resolve({ data: {} });
            return Promise.resolve({ data: { data: [
                { ...logs[0], id: 'user-log', entityType: 'user', entityId: 'user-123456' },
                { ...logs[0], id: 'article-log', entityType: 'article', entityId: 'article-123456' },
            ], meta: { total: 2, page: 1, limit: 25, totalPages: 1 } } });
        });
        renderPage();
        expect(await screen.findByRole('link', { name: '#user-123' })).toHaveAttribute('href', '/agents');
        expect(screen.getByRole('link', { name: '#article-' })).toHaveAttribute('href', '/kb/articles/article-123456');
    });

    it('expands a row through its disclosure button to show before/after values', async () => {
        renderPage();
        const toggle = await screen.findByRole('button', { name: 'Buka detail log Status Changed' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const region = screen.getByRole('region', { name: 'Detail Status Changed' });
        expect(within(region).getByText('Sebelum')).toBeInTheDocument();
        expect(region).toHaveTextContent('"WAITING_VENDOR"');
    });
});
