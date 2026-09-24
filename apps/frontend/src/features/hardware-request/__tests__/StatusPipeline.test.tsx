import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPipeline, STANDARD_PIPELINE, INSTALLATION_ONLY_PIPELINE } from '../components/common/StatusPipeline';

describe('StatusPipeline', () => {
    it('marks completed steps up to current', () => {
        render(<StatusPipeline current="APPROVED" />);
        expect(screen.getAllByText('Disetujui').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Diajukan')).toBeInTheDocument();
        expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('marks all steps as completed when status is COMPLETED', () => {
        const { container } = render(<StatusPipeline current="COMPLETED" />);
        
        STANDARD_PIPELINE.forEach((step) => {
            expect(screen.getAllByText(new RegExp(step.label, 'i')).length).toBeGreaterThanOrEqual(1);
        });

        // There should be 8 checkmark icons (lucide-check)
        const checkIcons = container.querySelectorAll('.lucide-check');
        expect(checkIcons.length).toBe(8);
    });

    it('renders terminal message when status is REJECTED', () => {
        render(<StatusPipeline current="REJECTED" />);
        expect(screen.getByText(/Permintaan ini telah ditolak/i)).toBeInTheDocument();
    });

    it('renders contextual 4-step pipeline when isInstallationOnly is true', () => {
        render(<StatusPipeline current="INSTALLATION" isInstallationOnly={true} />);
        expect(screen.getByText('Penjadwalan & Pemasangan')).toBeInTheDocument();
        expect(screen.queryByText('Review')).not.toBeInTheDocument();
        expect(screen.queryByText('SPP')).not.toBeInTheDocument();
    });
});

