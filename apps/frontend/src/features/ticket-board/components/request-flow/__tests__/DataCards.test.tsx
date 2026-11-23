import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FlowItem, FlowRevision, RequestFlowView } from '../flowTypes';
import { AccessCard } from '../AccessCard';
import { DocumentPane } from '../DocumentPane';
import { RequestItemsCard } from '../RequestItemsCard';

afterEach(cleanup);

const item = (over: Partial<FlowItem> = {}): FlowItem => ({
    id: 'i-1', name: 'Laptop Standar', quantity: 1, note: null, recipient: 'Leony', deliveryStatus: 'PENDING', procurementDecision: null,
    vendor: null, actualCost: null, invoiceNumber: null, invoiceDate: null, ...over,
});

describe('RequestItemsCard', () => {
    it('lists each item with its recipient and what happened to it', () => {
        render(<RequestItemsCard items={[
            item(), item({ id: 'i-2', name: 'Monitor', recipient: 'Budi', procurementDecision: 'REJECTED' }),
            item({ id: 'i-3', name: 'Mouse', recipient: '', deliveryStatus: 'ARRIVED', procurementDecision: 'APPROVED' }),
        ]} assets={[]} />);
        expect(screen.getByText('Laptop Standar')).toBeInTheDocument();
        expect(screen.getByText('untuk Leony')).toBeInTheDocument();
        expect(screen.getByText('Dibatalkan')).toBeInTheDocument();
        expect(screen.getByText('Sudah tiba')).toBeInTheDocument();
    });

    it('shows vendor and cost only when the API sent them (IT), and the asset codes once installed', () => {
        const { rerender } = render(<RequestItemsCard items={[item()]} assets={[]} />);
        expect(screen.queryByText(/Dell/)).toBeNull();
        rerender(<RequestItemsCard items={[item({ vendor: 'Dell', actualCost: '15000000' })]} assets={[{ code: 'AST-001', itemId: 'i-1' }]} />);
        expect(screen.getByText(/Dell/)).toBeInTheDocument();
        expect(screen.getByText('AST-001')).toBeInTheDocument();
    });
});

describe('AccessCard', () => {
    const eform: NonNullable<RequestFlowView['eform']> = {
        formType: 'VPN', documentNumber: 'F/ICT/04/0120', startDate: '2026-11-01', endDate: '2026-12-31', fields: { alasan: 'WFH' }, hasCredentials: true, requiresGm: false,
    };

    it('shows the kind, the number and the period; a permanent access says so', () => {
        const { rerender } = render(<AccessCard eform={eform} />);
        expect(screen.getByText('VPN')).toBeInTheDocument();
        expect(screen.getByText('F/ICT/04/0120')).toBeInTheDocument();
        expect(screen.getByText(/31 Desember 2026/)).toBeInTheDocument();
        rerender(<AccessCard eform={{ ...eform, endDate: null }} />);
        expect(screen.getByText('Permanen')).toBeInTheDocument();
    });

    it('offers to change the number only to IT', () => {
        const onEditNumber = vi.fn();
        const { rerender } = render(<AccessCard eform={eform} />);
        expect(screen.queryByRole('button', { name: /Ubah nomor/ })).toBeNull();
        rerender(<AccessCard eform={eform} onEditNumber={onEditNumber} />);
        fireEvent.click(screen.getByRole('button', { name: /Ubah nomor/ }));
        expect(onEditNumber).toHaveBeenCalled();
    });
});

describe('DocumentPane', () => {
    const revisions: FlowRevision[] = [
        { version: 1, kind: 'GEN', label: 'Dibuat', actorName: 'Leony', createdAt: '2026-11-22T01:00:00.000Z' },
        { version: 2, kind: 'DIG', label: 'TTD Atasan', actorName: 'Hendra', createdAt: '2026-11-22T03:00:00.000Z' },
        { version: 3, kind: 'FIN', label: 'Final', actorName: 'Leony', createdAt: '2026-11-23T03:00:00.000Z' },
    ];

    it('lists every version newest first with who did it, and marks the latest', () => {
        render(<DocumentPane revisions={revisions} onDownload={vi.fn()} />);
        const labels = screen.getAllByTestId('revision-label').map((node) => node.textContent);
        expect(labels).toEqual(['Final', 'TTD Atasan', 'Dibuat']);
        expect(screen.getByText('Terbaru')).toBeInTheDocument();
    });

    it('downloads the latest version only: older ones cannot be rendered any more', () => {
        const onDownload = vi.fn();
        render(<DocumentPane revisions={revisions} onDownload={onDownload} />);
        fireEvent.click(screen.getByRole('button', { name: /Unduh dokumen v3/ }));
        expect(onDownload).toHaveBeenCalledWith(3);
        expect(screen.queryByRole('button', { name: /Unduh dokumen v2/ })).toBeNull();
    });
});
