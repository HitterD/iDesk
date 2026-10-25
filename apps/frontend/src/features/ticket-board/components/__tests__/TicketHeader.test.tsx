vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TicketHeader } from '../ticket-detail/TicketHeader';

// The hold lookup is a query of its own (covered by StatusPill tests); the header tests are about layout and navigation.
vi.mock('../ticket-detail/useTicketHold', () => ({ useTicketHold: () => null }));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock useAuth
vi.mock('@/stores/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', role: 'ADMIN' },
    }),
}));

const createMockTicket = (overrides: Record<string, any> = {}) => ({
    id: '9fd3c82d-002c-4686-8999-a3e8eeb47d28',
    ticketNumber: '080926-GEN-0001',
    title: 'Printer rusak / tidak merespon',
    description: 'Printer tidak merespon saat print.',
    category: 'HARDWARE',
    status: 'OPEN',
    priority: 'HIGH',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
});

describe('TicketHeader Back Navigation', () => {
    it('renders "Kembali ke Daftar Tiket" for HARDWARE category tickets and navigates to /tickets/list', () => {
        mockNavigate.mockClear();
        const ticket = createMockTicket({ category: 'HARDWARE' });

        render(
            <MemoryRouter initialEntries={['/tickets/' + ticket.id]}>
                <TicketHeader ticket={ticket as any} />
            </MemoryRouter>
        );

        const backBtn = screen.getByRole('button', { name: /Kembali ke Daftar Tiket/i });
        expect(backBtn).toBeDefined();
        expect(screen.queryByText(/Kembali ke Hardware/i)).toBeNull();

        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/list');
    });

    it('renders "Kembali ke Kanban" when navigated from /kanban via location.state', () => {
        mockNavigate.mockClear();
        const ticket = createMockTicket({ category: 'HARDWARE' });

        render(
            <MemoryRouter initialEntries={[{ pathname: `/tickets/${ticket.id}`, state: { from: '/kanban' } }]}>
                <TicketHeader ticket={ticket as any} />
            </MemoryRouter>
        );

        const backBtn = screen.getByRole('button', { name: /Kembali ke Kanban/i });
        expect(backBtn).toBeDefined();

        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/kanban');
    });

    it('renders "Kembali ke Oracle K2" when handlingTeam is ORACLE_DEV and navigates to /tickets/oracle-k2', () => {
        mockNavigate.mockClear();
        const ticket = createMockTicket({ handlingTeam: 'ORACLE_DEV' });

        render(
            <MemoryRouter initialEntries={['/tickets/' + ticket.id]}>
                <TicketHeader ticket={ticket as any} />
            </MemoryRouter>
        );

        const backBtn = screen.getByRole('button', { name: /Kembali ke Oracle K2/i });
        expect(backBtn).toBeDefined();

        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/oracle-k2');
    });

    it('renders "Kembali ke Web Developer" and navigates to /tickets/web-developer for WEB_DEV handling team', () => {
        mockNavigate.mockClear();
        const ticket = createMockTicket({ handlingTeam: 'WEB_DEV' });

        render(
            <MemoryRouter initialEntries={['/tickets/' + ticket.id]}>
                <TicketHeader ticket={ticket as any} />
            </MemoryRouter>
        );

        const backBtn = screen.getByRole('button', { name: /Kembali ke Web Developer/i });
        expect(backBtn).toBeDefined();

        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/web-developer');
    });

    it('renders "Kembali ke Mobile Developer" and navigates to /tickets/mobile-developer for MOBILE_DEV handling team', () => {
        mockNavigate.mockClear();
        const ticket = createMockTicket({ handlingTeam: 'MOBILE_DEV' });

        render(
            <MemoryRouter initialEntries={['/tickets/' + ticket.id]}>
                <TicketHeader ticket={ticket as any} />
            </MemoryRouter>
        );

        const backBtn = screen.getByRole('button', { name: /Kembali ke Mobile Developer/i });
        expect(backBtn).toBeDefined();

        fireEvent.click(backBtn);
        expect(mockNavigate).toHaveBeenCalledWith('/tickets/mobile-developer');
    });
});

describe('TicketHeader compact metadata bubbles', () => {
    const renderHeader = (overrides: Record<string, any>) => render(
        <MemoryRouter initialEntries={['/tickets/t-1']}>
            <TicketHeader ticket={createMockTicket(overrides) as any} onResolve={vi.fn()} onCancel={vi.fn()} onForward={vi.fn()} />
        </MemoryRouter>
    );

    it('shows readonly status and priority pills next to the copyable ticket number', () => {
        renderHeader({ status: 'IN_PROGRESS', priority: 'HIGH', slaTarget: new Date(Date.now() + 86_400_000).toISOString() });
        expect(screen.getByRole('button', { name: /Salin nomor tiket/ })).toHaveTextContent('#080926-GEN-0001');
        const pills = Array.from(document.querySelectorAll('header .ticket-pill')).map(el => el.textContent);
        expect(pills).toEqual(expect.arrayContaining(['In Progress', 'Urgent']));
        expect(document.querySelector('header .picker-trigger')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Selesaikan/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Teruskan/ })).toBeInTheDocument();
    });

    it('shows paused SLA with remaining business time and no target date', () => {
        renderHeader({ status: 'WAITING_VENDOR', slaTarget: '2026-10-20T05:00:00Z', slaRemainingMinutes: 320 });
        const sla = screen.getByText('SLA dijeda · sisa 5 jam 20 mnt');
        expect(sla.closest('.ticket-pill')).toHaveClass('ticket-tone-amber');
        expect(document.querySelector('header [title*="Target:"]')).not.toBeInTheDocument();
    });

    it('groups actions per mockup: Batalkan (soft danger) · Teruskan (soft) | Resolve (only primary) · panel toggle', () => {
        render(
            <MemoryRouter initialEntries={['/tickets/t-1']}>
                <TicketHeader ticket={createMockTicket({}) as any} onResolve={vi.fn()} onCancel={vi.fn()} onForward={vi.fn()} onToggleSidebar={vi.fn()} isSidebarOpen />
            </MemoryRouter>
        );
        expect(screen.getByRole('button', { name: 'Batalkan' })).toHaveClass('is-danger');
        expect(screen.getByRole('button', { name: 'Teruskan' })).toHaveClass('is-soft');
        expect(screen.getByRole('button', { name: 'Selesaikan' })).toHaveClass('is-primary');
        expect(document.querySelectorAll('header .is-primary')).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Sembunyikan properti' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Aksi lainnya' })).toBeInTheDocument();
    });

    it('Batalkan opens the existing confirmation before cancelling', () => {
        const onCancel = vi.fn();
        render(
            <MemoryRouter initialEntries={['/tickets/t-1']}>
                <TicketHeader ticket={createMockTicket({}) as any} onCancel={onCancel} />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Batalkan' }));
        expect(onCancel).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Batalkan tiket' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('hides every action on a terminal ticket', () => {
        render(
            <MemoryRouter initialEntries={['/tickets/t-1']}>
                <TicketHeader ticket={createMockTicket({ status: 'RESOLVED' }) as any} onResolve={vi.fn()} onCancel={vi.fn()} onForward={vi.fn()} />
            </MemoryRouter>
        );
        for (const name of ['Batalkan', 'Teruskan', 'Resolve', 'Aksi lainnya']) {
            expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
        }
    });
});
