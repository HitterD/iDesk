vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));
vi.mock('@/components/ui/TicketQuickPreview', () => ({
    TicketQuickPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketListRow, type TicketRowData } from '../TicketListRow';

afterEach(cleanup);

const base: TicketRowData = {
    id: 't-1', ticketNumber: '221126-QC-0035', title: 'Akses VPN', description: 'x', category: 'GENERAL', status: 'IN_PROGRESS',
    priority: 'MEDIUM', source: 'WEB', isOverdue: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    user: { id: 'u-1', fullName: 'Andi', department: { name: 'QC' } },
};

const renderRow = (ticket: TicketRowData) => render(
    <MemoryRouter>
        <TicketListRow ticket={ticket} index={0} showSiteColumn={false} canEdit={false} isSelected={false} agents={[]}
            onSelect={vi.fn()} onUpdatePriority={vi.fn()} onUpdateStatus={vi.fn()} onAssign={vi.fn()} />
    </MemoryRouter>,
);

describe('TicketListRow request tickets', () => {
    it('shows the type tag next to the number, stage in the SLA column, and "Tanpa SLA" under the status', () => {
        const { container } = renderRow({
            ...base,
            requestKind: 'EFORM',
            flowPhase: 'appr_mgr',
            flowPhaseLabel: 'Menunggu Atasan',
            flowPhaseSince: new Date().toISOString(),
            flowPaused: false,
        });
        expect(screen.getAllByText('E-Form').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu Atasan').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Tanpa SLA').length).toBeGreaterThan(0);
        expect(container.querySelector('.queue-status-cell .queue-nosla')).toHaveTextContent('Tanpa SLA');
        expect(container.querySelector('.sla-cell.is-stage')).not.toBeNull();
    });

    it('shows neutral stage and age pill instead of Dijeda or overdue even if legacy SLA flags remain', () => {
        const { container } = renderRow({
            ...base,
            requestKind: 'HARDWARE',
            flowPhase: 'delivery',
            flowPhaseLabel: 'Menunggu barang tiba',
            flowPhaseSince: new Date(Date.now() - 8 * 86_400_000).toISOString(),
            flowPaused: true,
            isOverdue: true,
        });
        expect(screen.queryByText('Dijeda')).toBeNull();
        expect(screen.getAllByText('Menunggu barang tiba').length).toBeGreaterThan(0);
        expect(screen.getAllByText('8 hari · lama').length).toBeGreaterThan(0);
        expect(container.querySelector('.sla-cell.is-stage.is-long')).not.toBeNull();
        expect(container.querySelector('.sla-cell.is-late')).toBeNull();
    });

    it('marks the row with the action I must take, named after the step, in the ticket cell', () => {
        const { container } = renderRow({ ...base, requestKind: 'HARDWARE', flowPhase: 'review', flowPhaseLabel: 'Review IT', flowPaused: false, needsMyAction: true });
        expect(screen.queryByText('Giliran Anda')).toBeNull();
        const marks = screen.getAllByText('Tinjau permintaan');
        expect(marks.length).toBeGreaterThan(0);
        expect(marks.every((m) => m.closest('.queue-status-cell') === null)).toBe(true);
        expect(container.querySelector('.queue-title-cell .queue-act-needed')).not.toBeNull();
    });

    it('no action marker when it is not my turn', () => {
        renderRow({ ...base, requestKind: 'HARDWARE', flowPhase: 'review', flowPhaseLabel: 'Review IT', flowPaused: false, needsMyAction: false });
        expect(screen.queryByText('Tinjau permintaan')).toBeNull();
    });

    it('an ordinary IT ticket shows no tag, phase or Tanpa SLA', () => {
        renderRow(base);
        expect(screen.queryByText('Hardware')).toBeNull();
        expect(screen.queryByText('E-Form')).toBeNull();
        expect(screen.queryByText('Dijeda')).toBeNull();
        expect(screen.queryByText('Tanpa SLA')).toBeNull();
    });
});
