import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TargetDateCell } from '../TargetDateCell';

describe('TargetDateCell', () => {
    it('renders DONE correctly when status is RESOLVED', () => {
        render(
            <TargetDateCell
                status="RESOLVED"
                slaTarget="2026-08-30T10:00:00Z"
            />
        );

        expect(screen.getByText('DONE')).toBeInTheDocument();
    });

    it('renders countdown correctly when status is TODO', () => {
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        render(
            <TargetDateCell
                status="TODO"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByTitle(/SLA Target:/)).toBeInTheDocument();
    });

    it('handles status transition from TODO to RESOLVED without hook count errors', () => {
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const { rerender } = render(
            <TargetDateCell
                status="TODO"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByTitle(/SLA Target:/)).toBeInTheDocument();

        // Rerender as RESOLVED — should NOT trigger "Rendered fewer hooks than expected"
        rerender(
            <TargetDateCell
                status="RESOLVED"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByText('DONE')).toBeInTheDocument();
    });

    it('handles status transition from RESOLVED to TODO without hook count errors', () => {
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const { rerender } = render(
            <TargetDateCell
                status="RESOLVED"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByText('DONE')).toBeInTheDocument();

        // Rerender as TODO — should NOT trigger hook mismatch
        rerender(
            <TargetDateCell
                status="TODO"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByTitle(/SLA Target:/)).toBeInTheDocument();
    });

    it('renders Hardware Installation scheduled date correctly', () => {
        render(
            <TargetDateCell
                status="TODO"
                isHardwareInstallation={true}
                scheduledDate="2026-09-01T09:00:00Z"
            />
        );

        expect(screen.getByText('01 Sep 2026')).toBeInTheDocument();
    });

    it('renders No SLA when slaTarget is not provided and no priority/createdAt', () => {
        render(
            <TargetDateCell
                status="TODO"
            />
        );

        expect(screen.getByText('No SLA')).toBeInTheDocument();
    });

    it('renders Paused when status is WAITING_VENDOR', () => {
        render(
            <TargetDateCell
                status="WAITING_VENDOR"
                slaTarget="2026-08-30T10:00:00Z"
            />
        );

        expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('accepts ticket object correctly and renders DONE when ticket.status is RESOLVED', () => {
        const mockTicket = {
            id: 't-1',
            status: 'RESOLVED',
            slaTarget: '2026-08-30T10:00:00Z',
        };

        render(<TargetDateCell ticket={mockTicket as any} />);

        expect(screen.getByText('DONE')).toBeInTheDocument();
    });
});
