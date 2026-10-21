import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BentoDashboardPage } from '../BentoDashboardPage';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const auth = vi.hoisted(() => ({ role: 'ADMIN' }));
vi.mock('@/lib/api', () => ({ default: api }));
vi.mock('@/hooks/useTicketSocket', () => ({ useTicketListSocket: () => ({ isConnected: true }) }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', role: auth.role } }) }));
vi.mock('../../components/MyRatingCard', () => ({ MyRatingCard: () => <div>MyRatingCard</div> }));
vi.mock('recharts', async (orig) => {
    const actual = await orig<typeof import('recharts')>();
    return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});

const now = new Date().toISOString();
const tickets = [
    { id: 't1', ticketNumber: 'A-1', title: 'Printer mati', status: 'TODO', priority: 'CRITICAL', category: 'HARDWARE', isOverdue: true, user: { id: 'u', fullName: 'Nur' }, createdAt: now, updatedAt: now },
    { id: 't2', ticketNumber: 'A-2', title: 'Email', status: 'IN_PROGRESS', priority: 'HIGH', category: 'SOFTWARE', isOverdue: false, user: { id: 'u', fullName: 'Nur' }, assignedTo: { id: 'ag', fullName: 'Beny Saputra' }, createdAt: now, updatedAt: now },
    { id: 't3', ticketNumber: 'A-3', title: 'Wifi', status: 'RESOLVED', priority: 'MEDIUM', isOverdue: false, user: { id: 'u', fullName: 'Nur' }, assignedTo: { id: 'ag', fullName: 'Beny Saputra' }, createdAt: now, updatedAt: now },
];

const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><BentoDashboardPage /></MemoryRouter>
    </QueryClientProvider>,
);

describe('BentoDashboardPage (Dashboard Tim)', () => {
    beforeEach(() => {
        auth.role = 'ADMIN';
        api.get.mockReset();
        api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/tickets' ? tickets : { avgResolutionTime: '4h 20m' } }));
    });

    it('shows the five stat cards with real counts and mockup copy', async () => {
        renderPage();
        const stats = await screen.findByRole('region', { name: 'Ringkasan tiket' });
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard Tim');
        expect(within(stats).getByRole('link', { name: /Total tiket/ })).toHaveTextContent('3');
        expect(within(stats).getByRole('link', { name: /Open & aktif/ })).toHaveAttribute('href', '/tickets/list?status=TODO,IN_PROGRESS');
        expect(within(stats).getByRole('link', { name: /Overdue/ })).toHaveClass('is-attn');
        expect(stats).toHaveTextContent('Rata-rata selesai 4j 20m');
        expect(stats).toHaveTextContent('67%');
    });

    it('keeps status, priority, category, live feed and top agents', async () => {
        renderPage();
        expect(await screen.findByRole('img', { name: /Tiket per status: Open 1, In Progress 1, Waiting 0, Resolved 1/ })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Tiket per prioritas: Blocker \(Critical\) 1/ })).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Aktivitas tim' })).getByText('Printer mati')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'Tiket per kategori' })).getByText('Hardware')).toBeInTheDocument();
        const top = screen.getByRole('region', { name: 'Agent terbaik' });
        expect(within(top).getByRole('link', { name: /Beny Saputra/ })).toHaveAttribute('href', '/dashboard/agent/ag');
        expect(screen.queryByText('MyRatingCard')).not.toBeInTheDocument();
    });

    it('feed panel switches Aktivitas live | Tiket terbaru (8 newest, mockup rows)', async () => {
        const many = Array.from({ length: 10 }, (_, i) => ({
            id: `r${i}`, ticketNumber: `R-${i}`, title: `Tiket ${i}`, status: i % 2 ? 'IN_PROGRESS' : 'TODO', priority: 'MEDIUM',
            isOverdue: false, user: { id: 'u', fullName: 'Nur' }, createdAt: new Date(Date.now() - i * 60_000).toISOString(), updatedAt: now,
        }));
        api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/tickets' ? many : { avgResolutionTime: '1h' } }));
        renderPage();
        const feed = await screen.findByRole('region', { name: 'Aktivitas tim' });
        const seg = within(feed).getByRole('group', { name: 'Tampilan feed' });
        expect(within(seg).getByRole('button', { name: 'Aktivitas live' })).toHaveAttribute('aria-pressed', 'true');
        // Live: 5 event lines with the derived detail.
        expect(within(feed).getAllByRole('link')).toHaveLength(5);
        expect(within(feed).getByText(/#R-0 · Tiket baru dari Nur/)).toBeInTheDocument();

        fireEvent.click(within(seg).getByRole('button', { name: 'Tiket terbaru' }));
        expect(within(seg).getByRole('button', { name: 'Tiket terbaru' })).toHaveAttribute('aria-pressed', 'true');
        const rows = within(feed).getAllByRole('link');
        expect(rows).toHaveLength(8);
        expect(rows[0]).toHaveTextContent('Tiket 0');
        expect(rows[0]).toHaveTextContent('#R-0 · Nur');
        expect(rows[0]).toHaveAttribute('href', '/tickets/r0');
        expect(rows[1].querySelector('.ticket-pill')).toHaveTextContent('In Progress');
        expect(within(feed).queryByText('Tiket 8')).not.toBeInTheDocument();
    });

    it('switches the activity range 7/14/30 and only agents see their rating', async () => {
        auth.role = 'AGENT';
        renderPage();
        const range = await screen.findByRole('group', { name: 'Rentang' });
        expect(screen.getByText('Tiket dibuat vs diselesaikan (7 hari terakhir)')).toBeInTheDocument();
        fireEvent.click(within(range).getByRole('button', { name: '30h' }));
        expect(screen.getByText('Tiket dibuat vs diselesaikan (30 hari terakhir)')).toBeInTheDocument();
        expect(screen.getByText('MyRatingCard')).toBeInTheDocument();
        // Agents cannot open another agent's dashboard (route is ADMIN/MANAGER only).
        expect(within(screen.getByRole('region', { name: 'Agent terbaik' })).queryByRole('link', { name: /Beny/ })).not.toBeInTheDocument();
    });
});
