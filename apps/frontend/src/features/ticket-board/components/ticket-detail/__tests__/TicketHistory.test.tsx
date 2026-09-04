import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TicketHistory } from '../TicketHistory';
import { TicketDetail } from '../types';

const mockTicket: TicketDetail = {
    id: 'ticket-1',
    ticketNumber: '190826-GEN-0005',
    title: 'Password terkunci',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    category: 'HARDWARE',
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-19T10:00:00.000Z',
    user: {
        id: 'user-1',
        fullName: 'User SPJ',
    },
    messages: [
        {
            id: 'sys-1',
            content: 'System: Status changed from TODO to IN_PROGRESS, SLA Timer started (business hours). Target: 2026-09-01T17:00:00.000Z by System Administrator',
            isSystemMessage: true,
            createdAt: '2026-08-19T10:00:00.000Z',
        },
        {
            id: 'sys-2',
            content: 'System: Ticket assigned to YUDI ARTA TRIRENSILA (was RM BAGASTYO ANGGORO INDRASTOTO) by System Administrator',
            isSystemMessage: true,
            createdAt: '2026-08-19T09:30:00.000Z',
        },
        {
            id: 'sys-3',
            content: 'System: Priority changed from MEDIUM to HIGH by System Administrator',
            isSystemMessage: true,
            createdAt: '2026-08-19T09:00:00.000Z',
        },
        {
            id: 'chat-1',
            content: 'Mohon dibantu segera',
            isSystemMessage: false,
            createdAt: '2026-08-19T08:30:00.000Z',
        },
    ],
};

describe('TicketHistory', () => {
    it('renders structured timeline cards with parsed status, assignment, and priority transitions', () => {
        render(<TicketHistory ticket={mockTicket} />);

        // Counter badge
        expect(screen.getByText('Activity Logs')).toBeInTheDocument();
        expect(screen.getAllByText('3').length).toBeGreaterThan(0); // 3 system messages

        // Status change card
        expect(screen.getByText('Pengerjaan Tiket Dimulai')).toBeInTheDocument();
        expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
        expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
        expect(screen.getByText('Target Resolusi SLA:')).toBeInTheDocument();
        expect(screen.getByText('Waktu Kerja (Business Hours)')).toBeInTheDocument();

        // Assignment card
        expect(screen.getByText('Pengalihan Teknisi')).toBeInTheDocument();
        expect(screen.getByText('RM BAGASTYO ANGGORO INDRASTOTO')).toBeInTheDocument();
        expect(screen.getByText('YUDI ARTA TRIRENSILA')).toBeInTheDocument();

        // Priority card
        expect(screen.getByText('Perubahan Prioritas Tiket')).toBeInTheDocument();
        expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
        expect(screen.getAllByText('High').length).toBeGreaterThan(0);

        // Actor
        expect(screen.getAllByText('System Administrator').length).toBe(3);
    });

    it('filters activities by category pills', () => {
        render(<TicketHistory ticket={mockTicket} />);

        // Click Penugasan tab
        fireEvent.click(screen.getByRole('button', { name: /Penugasan/i }));

        // Should only show assignment card
        expect(screen.getByText('Pengalihan Teknisi')).toBeInTheDocument();
        expect(screen.queryByText('Pengerjaan Tiket Dimulai')).not.toBeInTheDocument();
        expect(screen.queryByText('Perubahan Prioritas Tiket')).not.toBeInTheDocument();
    });

    it('filters activities by search query', () => {
        render(<TicketHistory ticket={mockTicket} />);

        const searchInput = screen.getByPlaceholderText('Cari log / aksi / user...');
        fireEvent.change(searchInput, { target: { value: 'YUDI ARTA' } });

        expect(screen.getByText('Pengalihan Teknisi')).toBeInTheDocument();
        expect(screen.queryByText('Perubahan Prioritas Tiket')).not.toBeInTheDocument();
    });
});
