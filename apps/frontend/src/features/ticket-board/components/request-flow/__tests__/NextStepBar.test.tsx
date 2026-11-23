import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FlowPhase, RequestFlowView, ViewerRoleInFlow } from '../flowTypes';
import { NextStepBar } from '../NextStepBar';
import { ProgressCard } from '../ProgressCard';

afterEach(cleanup);

function view(phase: FlowPhase, role: ViewerRoleInFlow): RequestFlowView {
    return {
        kind: 'HARDWARE', phase, phaseLabel: '', route: 'MANAGER', managerId: 'm', gmId: null, hardwareSource: 'NON_BUDGET', returnedReason: null,
        rescheduleCount: 0, documentVersion: 1, revisions: [], viewerRoleInFlow: role,
        hardware: { requestId: 'hr-1', requestNumber: 'HR-1', division: 'QC', recipients: [], items: [], schedule: null, assets: [] },
    };
}

describe('NextStepBar', () => {
    it('IT review: says it is the viewer\'s turn and offers exactly one primary button', () => {
        const onAct = vi.fn();
        render(<NextStepBar view={view('review', 'ICT')} onAct={onAct} />);
        expect(screen.getByText('Giliran Anda')).toBeInTheDocument();
        const primary = screen.getByRole('button', { name: 'Tinjau sekarang' });
        fireEvent.click(primary);
        expect(onAct).toHaveBeenCalledWith('review');
        expect(document.querySelectorAll('[data-primary="true"]')).toHaveLength(1);
    });

    it('the menu holds the rare actions and runs them', () => {
        const onAct = vi.fn();
        render(<NextStepBar view={view('review', 'ICT')} onAct={onAct} />);
        expect(screen.queryByRole('menuitem', { name: /Tolak permintaan/ })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Lainnya/ }));
        fireEvent.click(screen.getByRole('menuitem', { name: /Tolak permintaan/ }));
        expect(onAct).toHaveBeenCalledWith('rejectIT');
    });

    it('someone whose turn it is not sees "Bukan giliran Anda" and no primary button', () => {
        render(<NextStepBar view={view('procure', 'REQUESTER')} onAct={vi.fn()} />);
        expect(screen.getByText('Bukan giliran Anda')).toBeInTheDocument();
        expect(document.querySelectorAll('[data-primary="true"]')).toHaveLength(0);
    });

    it('shows which stage of the request this is', () => {
        render(<NextStepBar view={view('procure', 'ICT')} onAct={vi.fn()} />);
        expect(screen.getByText(/Tahap 3\/5 · Pengadaan barang/)).toBeInTheDocument();
    });
});

describe('ProgressCard', () => {
    it('lists the stages, opens the current one and marks it "Sekarang"', () => {
        render(<ProgressCard view={view('procure', 'ICT')} />);
        expect(screen.getByText('Tahap 3 dari 5')).toBeInTheDocument();
        expect(screen.getByText('Sekarang')).toBeInTheDocument();
        expect(screen.getByText('Keputusan pengadaan')).toBeInTheDocument();
        // A future stage shows only its summary line, not its sub-steps.
        expect(screen.queryByText('Jadwal disepakati')).toBeNull();
    });

    it('says "Selesai" once the request is done', () => {
        render(<ProgressCard view={view('done', 'ICT')} />);
        expect(screen.getByText('Selesai', { selector: '.r' })).toBeInTheDocument();
    });
});
