import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityEvent, type TicketSystemEvent } from '../ActivityEvent';

const event: TicketSystemEvent = {
    v: 1,
    actor: { id: 'u1', name: 'RM BAGASTYO ANGGORO' },
    changes: [
        { field: 'status', from: 'TODO', to: 'IN_PROGRESS' },
        { field: 'assignee', from: 'BENY SAPUTRA', to: 'RM BAGASTYO ANGGORO' },
        { field: 'priority', from: 'MEDIUM', to: 'HIGH' },
        { field: 'vendorVisit', from: null, to: '2026-10-29T02:00:00.000Z' },
    ],
    reason: 'Beban Kerja Penuh / Overload',
};

describe('ActivityEvent', () => {
    it('tells staff who changed what, old to new, and why', () => {
        render(<ActivityEvent event={event} createdAt="2026-10-23T06:20:00Z" audience="staff" />);
        expect(screen.getByRole('group', { name: /Aktivitas oleh/ })).toHaveTextContent(/memperbarui tiket/);
        expect(screen.getByText('Open')).toBeInTheDocument();
        expect(screen.getByText('In Progress')).toBeInTheDocument();
        expect(screen.getByText('Urgent')).toBeInTheDocument();
        expect(screen.getByText(/Kam, 29 Okt.*09[.:]00 WIB/)).toBeInTheDocument();
        expect(screen.getByText('“Beban Kerja Penuh / Overload”')).toBeInTheDocument();
    });

    it('shows requesters the outcome without the actor, priority or internal reason', () => {
        render(<ActivityEvent event={event} createdAt="2026-10-23T06:20:00Z" audience="requester" />);
        expect(screen.getByText('Tim IT')).toBeInTheDocument();
        expect(screen.queryByText('Prioritas')).not.toBeInTheDocument();
        expect(screen.queryByText(/Beban Kerja/)).not.toBeInTheDocument();
        expect(screen.getByText('Janji vendor')).toBeInTheDocument();
    });
});
