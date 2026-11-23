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
    it('shows the type tag next to the number and the phase under the status', () => {
        renderRow({ ...base, requestKind: 'EFORM', flowPhase: 'appr_mgr', flowPhaseLabel: 'Menunggu Atasan', flowPaused: false });
        expect(screen.getAllByText('E-Form').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Menunggu Atasan').length).toBeGreaterThan(0);
    });

    it('a paused phase says the SLA is on hold', () => {
        renderRow({ ...base, requestKind: 'HARDWARE', flowPhase: 'delivery', flowPhaseLabel: 'Menunggu barang tiba', flowPaused: true });
        expect(screen.getAllByText('Dijeda').length).toBeGreaterThan(0);
    });

    it('marks the row when it is my turn', () => {
        renderRow({ ...base, requestKind: 'HARDWARE', flowPhase: 'review', flowPhaseLabel: 'Review IT', flowPaused: false, needsMyAction: true });
        expect(screen.getAllByText('Giliran Anda').length).toBeGreaterThan(0);
    });

    it('an ordinary IT ticket shows no tag, phase or pause', () => {
        renderRow(base);
        expect(screen.queryByText('Hardware')).toBeNull();
        expect(screen.queryByText('E-Form')).toBeNull();
        expect(screen.queryByText('Dijeda')).toBeNull();
    });
});
