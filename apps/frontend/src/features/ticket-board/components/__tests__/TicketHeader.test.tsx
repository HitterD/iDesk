import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TicketHeader } from '../ticket-detail/TicketHeader';

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
