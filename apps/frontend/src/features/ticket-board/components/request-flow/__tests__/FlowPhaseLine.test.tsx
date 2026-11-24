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

    it('shows only the phase and the SLA pause; "my turn" lives in the ticket column', () => {
        render(<FlowPhaseLine ticket={{ ...base, flowPaused: true, needsMyAction: true }} />);
        expect(screen.getByText('Menunggu barang tiba')).toBeInTheDocument();
        expect(screen.getByTitle('SLA dijeda')).toHaveTextContent('Dijeda');
        expect(screen.queryByText(/Giliran Anda|Catat pembelian|Perlu/)).toBeNull();
    });

    it('has no marker when there is nothing to flag', () => {
        const { container } = render(<FlowPhaseLine ticket={base} />);
        expect(screen.getByText('Menunggu barang tiba')).toBeInTheDocument();
        expect(container.querySelector('.req-phase__pause')).toBeNull();
    });
});
