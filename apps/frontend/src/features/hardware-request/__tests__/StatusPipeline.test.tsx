import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPipeline } from '../components/common/StatusPipeline';
import { REQUEST_PIPELINE } from '../types';
import { STATUS_META } from '../utils/status.util';

describe('StatusPipeline', () => {
    it('marks completed steps up to current', () => {
        render(<StatusPipeline current="APPROVED" />);
        expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Submitted')).toBeInTheDocument();
        expect(screen.getByText('Under Review')).toBeInTheDocument();
    });

    it('marks all steps as completed when status is COMPLETED', () => {
        const { container } = render(<StatusPipeline current="COMPLETED" />);
        
        // All 8 steps should be in document
        REQUEST_PIPELINE.forEach((status) => {
            const label = STATUS_META[status].label;
            expect(screen.getAllByText(new RegExp(label, 'i')).length).toBeGreaterThanOrEqual(1);
        });

        // There should be 8 checkmark icons (lucide-check)
        const checkIcons = container.querySelectorAll('.lucide-check');
        expect(checkIcons.length).toBe(8);
    });

    it('renders terminal message when status is REJECTED', () => {
        render(<StatusPipeline current="REJECTED" />);
        expect(screen.getByText(/Request ini telah rejected/i)).toBeInTheDocument();
    });
});

