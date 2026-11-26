vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));
vi.mock('../ticket-detail/useTicketHold', () => ({ useTicketHold: () => null }));
vi.mock('@/stores/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1', role: 'AGENT_OPERATIONAL_SUPPORT' } }) }));

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketHeader } from '../ticket-detail/TicketHeader';

afterEach(cleanup);

const ticket = {
    id: 't-1', ticketNumber: '221126-QC-0035', title: 'Akses VPN', description: 'x', category: 'GENERAL', status: 'IN_PROGRESS',
    priority: 'MEDIUM', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

const renderHeader = (
    flow?: { kind: 'HARDWARE' | 'EFORM'; phase: string; phaseLabel: string; paused: boolean; phaseSince?: string | null; installScheduledAt?: string | null },
    ticketOverrides: Record<string, unknown> = {},
) => render(
    <MemoryRouter>
        <TicketHeader ticket={{ ...ticket, ...ticketOverrides } as never} flow={flow} onForward={vi.fn()} onResolve={vi.fn()} onCancel={vi.fn()} />
    </MemoryRouter>,
);

describe('TicketHeader for a request ticket', () => {
    it('shows the type tag and neutral stage chip, and no Teruskan / Selesaikan / Responded', () => {
        renderHeader(
            { kind: 'EFORM', phase: 'appr_mgr', phaseLabel: 'Menunggu Atasan', paused: true, phaseSince: new Date().toISOString() },
            { firstResponseAt: new Date().toISOString(), firstResponseTarget: new Date().toISOString() },
        );
        expect(screen.getByText('E-Form Request')).toBeInTheDocument();
        expect(screen.getByText('Menunggu Atasan · Hari ini')).toBeInTheDocument();
        expect(screen.queryByText('SLA dijeda')).toBeNull();
        expect(screen.queryByText('Responded')).toBeNull();
        expect(screen.queryByRole('button', { name: /Teruskan/ })).toBeNull();
        expect(screen.queryByRole('button', { name: /Selesaikan/ })).toBeNull();
    });

    it('shows neutral stage pill with age instead of "SLA dijeda"', () => {
        const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000).toISOString();
        renderHeader({ kind: 'HARDWARE', phase: 'delivery', phaseLabel: 'Menunggu barang tiba', paused: true, phaseSince: eightDaysAgo });
        expect(screen.getByText('Menunggu barang tiba · 8 hari')).toBeInTheDocument();
        expect(screen.queryByText('SLA dijeda')).toBeNull();
    });

    it('keeps everything as it was for an ordinary IT ticket', () => {
        renderHeader();
        expect(screen.queryByText('E-Form Request')).toBeNull();
        expect(screen.getByRole('button', { name: /Selesaikan/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Teruskan/ })).toBeInTheDocument();
    });

    it('the menu holds Batalkan and the PDF download for a request ticket', () => {
        const onDownloadPdf = vi.fn();
        render(
            <MemoryRouter>
                <TicketHeader ticket={ticket as never} flow={{ kind: 'HARDWARE', phase: 'review', phaseLabel: 'Review IT', paused: false }} onCancel={vi.fn()} onDownloadPdf={onDownloadPdf} />
            </MemoryRouter>,
        );
        fireEvent.pointerDown(screen.getByRole('button', { name: 'Aksi lainnya' }), { button: 0, ctrlKey: false });
        fireEvent.click(screen.getByRole('button', { name: 'Aksi lainnya' }));
        expect(screen.getByText('Unduh dokumen PDF')).toBeInTheDocument();
    });
});
