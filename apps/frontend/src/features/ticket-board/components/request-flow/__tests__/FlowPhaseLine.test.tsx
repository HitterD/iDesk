import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FlowPhaseLine } from '../FlowPhaseLine';

afterEach(cleanup);

const base = { requestKind: 'HARDWARE' as const, flowPhase: 'delivery', flowPhaseLabel: 'Menunggu barang tiba' };

describe('FlowPhaseLine', () => {
    it('renders nothing for an ordinary ticket', () => {
        const { container } = render(<FlowPhaseLine ticket={{}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows only the phase and "Tanpa SLA"; "my turn" lives in the ticket column', () => {
        render(<FlowPhaseLine ticket={{ ...base, flowPaused: true, needsMyAction: true }} />);
        expect(screen.getByText('Menunggu barang tiba')).toBeInTheDocument();
        expect(screen.getByText('Tanpa SLA')).toBeInTheDocument();
        expect(screen.queryByText('Dijeda')).toBeNull();
        expect(screen.queryByText(/Giliran Anda|Catat pembelian|Perlu/)).toBeNull();
    });

    it('never renders legacy .req-phase__pause indicator for request tickets', () => {
        const { container } = render(<FlowPhaseLine ticket={base} />);
        expect(screen.getByText('Menunggu barang tiba')).toBeInTheDocument();
        expect(screen.getByText('Tanpa SLA')).toBeInTheDocument();
        expect(container.querySelector('.req-phase__pause')).toBeNull();
    });

    it('still shows Tanpa SLA when a non-SLA ticket has no flowPhaseLabel yet', () => {
        render(<FlowPhaseLine ticket={{ ticketType: 'HARDWARE_REQUEST' }} />);
        expect(screen.getByText('Tanpa SLA')).toBeInTheDocument();
    });
});
