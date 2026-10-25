vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TargetDateCell } from '../TargetDateCell';

describe('TargetDateCell', () => {
    it.each(['TODO', 'RESOLVED', 'CLOSED', 'CANCELLED', 'WAITING_VENDOR'])('renders %s SLA as readonly, without a caret', (status) => {
        const { container } = render(<TargetDateCell status={status} slaTarget="2099-08-30T10:00:00Z" />);
        expect(container.querySelector('.ticket-pill, .sla-cell')).not.toBeNull();
        expect(container.querySelector('button, .lucide-chevron-down')).toBeNull();
    });
    it('renders DONE correctly when status is RESOLVED', () => {
        render(
            <TargetDateCell
                status="RESOLVED"
                slaTarget="2026-08-30T10:00:00Z"
            />
        );

        expect(screen.getByText('Selesai')).toBeInTheDocument();
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

        expect(screen.getByText('Selesai')).toBeInTheDocument();
    });

    it('handles status transition from RESOLVED to TODO without hook count errors', () => {
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
        const { rerender } = render(
            <TargetDateCell
                status="RESOLVED"
                slaTarget={futureDate}
            />
        );

        expect(screen.getByText('Selesai')).toBeInTheDocument();

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

        expect(screen.getByText('Tanpa SLA')).toBeInTheDocument();
    });

    it('renders Paused when status is WAITING_VENDOR', () => {
        render(
            <TargetDateCell
                status="WAITING_VENDOR"
                slaTarget="2026-08-30T10:00:00Z"
            />
        );

        expect(screen.getByText('Dijeda')).toBeInTheDocument();
    });

    it.each([[120, '2 jam'], [0, '0 mnt']])('shows paused remaining minutes from the list payload: %s', (remaining, text) => {
        render(<TargetDateCell ticket={{ status: 'WAITING_VENDOR', slaRemainingMinutes: remaining }} />);
        expect(screen.getByText(`Dijeda · sisa ${text}`)).toBeInTheDocument();
        expect(screen.queryByTitle(/SLA Target:/)).not.toBeInTheDocument();
    });

    it('supports paused remaining minutes as a direct prop', () => {
        render(<TargetDateCell status="WAITING_VENDOR" slaRemainingMinutes={120} />);
        expect(screen.getByText('Dijeda · sisa 2 jam')).toBeInTheDocument();
    });

    it('shows the vendor appointment under a paused SLA and the note in the tooltip', () => {
        render(<TargetDateCell ticket={{ status: 'WAITING_VENDOR', slaRemainingMinutes: 60, vendorVisitAt: '2099-10-29T02:00:00Z', vendorNote: 'Menunggu spare part' }} />);
        expect(screen.getByText(/^vendor .*09\.00$/)).toBeInTheDocument();
        expect(screen.getByLabelText('SLA Timer Paused')).toHaveAttribute('title', expect.stringContaining('Menunggu spare part'));
    });

    it('shows the target date and the time left without hovering', () => {
        const target = new Date(Date.now() + 3 * 60 * 60 * 1000);
        render(<TargetDateCell status="IN_PROGRESS" slaTarget={target.toISOString()} />);
        const cell = screen.getByTitle(/SLA Target:/);
        expect(cell).toHaveTextContent(/·/);
        expect(cell).toHaveTextContent(/sisa (2 jam 5\d mnt|3 jam)/);
    });

    it('says how long a target has been overdue', () => {
        render(<TargetDateCell status="IN_PROGRESS" slaTarget={new Date(Date.now() - 90 * 60 * 1000).toISOString()} />);
        expect(screen.getByTitle(/SLA Target:/)).toHaveTextContent(/lewat 1 jam 30 mnt/);
    });

    it('accepts ticket object correctly and renders DONE when ticket.status is RESOLVED', () => {
        const mockTicket = {
            id: 't-1',
            status: 'RESOLVED',
            slaTarget: '2026-08-30T10:00:00Z',
        };

        render(<TargetDateCell ticket={mockTicket as any} />);

        expect(screen.getByText('Selesai')).toBeInTheDocument();
    });
});
