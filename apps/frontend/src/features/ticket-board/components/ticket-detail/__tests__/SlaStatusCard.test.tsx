import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SlaStatusCard } from '../SlaStatusCard';
import type { TicketDetail } from '../types';
import { formatDateTimeID } from '@/lib/utils/dateFormat';

const ticket: TicketDetail = {
    id: 'paused-ticket', title: 'Vendor', description: '', category: 'OTHER',
    status: 'WAITING_VENDOR', priority: 'HIGH',
    createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T03:00:00Z',
    slaStartedAt: '2026-10-20T01:00:00Z', slaTarget: '2026-10-20T05:00:00Z',
    firstResponseTarget: '2026-10-20T02:00:00Z',
    lastPausedAt: '2026-10-20T03:00:00Z', slaRemainingMinutes: 120,
    user: { fullName: 'Requester', email: 'requester@example.com' },
};

describe('SlaStatusCard', () => {
    it('hides both SLA targets while waiting vendor and shows pause timestamp', () => {
        render(<SlaStatusCard ticket={ticket} />);
        expect(screen.queryByText(/^Target:/)).not.toBeInTheDocument();
        expect(screen.getByText(`Dijeda sejak ${formatDateTimeID(ticket.lastPausedAt!)}`, { exact: false })).toBeInTheDocument();
        expect(screen.getByText(/sisa 2h 0m jam kerja/)).toBeInTheDocument();
    });

    it('keeps SLA target visible when active', () => {
        render(<SlaStatusCard ticket={{ ...ticket, status: 'IN_PROGRESS' }} />);
        expect(screen.getAllByText(/^Target:/)).toHaveLength(2);
    });
});
