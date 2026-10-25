vi.mock('@/lib/slaCountdown', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/slaCountdown')>(),
    useSlaClock: () => null,
}));

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatSlaTargetFull } from '@/lib/utils/slaDuration';
import { SlaProgress } from '../SlaProgress';

const props = {
    status: 'WAITING_VENDOR',
    createdAt: '2026-10-20T01:00:00Z',
    slaStartedAt: '2026-10-20T01:00:00Z',
    slaTarget: '2026-10-20T05:00:00Z',
    pausedAt: '2026-10-20T03:00:00Z',
    slaRemainingMinutes: 120,
};

afterEach(() => vi.useRealTimers());

describe('SlaProgress paused', () => {
    it('shows remaining time and pause date without a target title', () => {
        render(<SlaProgress {...props} />);
        expect(screen.getByText('Dijeda · sisa 2 jam')).toBeInTheDocument();
        expect(screen.getByTitle(`Dijeda sejak ${formatDateTimeID(props.pausedAt)}`)).toBeInTheDocument();
        expect(screen.queryByTitle(/Target:/)).not.toBeInTheDocument();
    });

    it('freezes percent at pause time even after the stale target passes', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-20T06:00:00Z'));
        const { rerender } = render(<SlaProgress {...props} />);
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
        vi.setSystemTime(new Date('2026-10-21T06:00:00Z'));
        rerender(<SlaProgress {...props} slaRemainingMinutes={180} />);
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
        expect(screen.getByText('Dijeda · sisa 3 jam')).toBeInTheDocument();
    });

    it.each([
        ['2026-10-19T00:00:00Z', '0'],
        ['2026-10-21T00:00:00Z', '100'],
    ])('clamps paused percent for %s', (pausedAt, expected) => {
        render(<SlaProgress {...props} pausedAt={pausedAt} />);
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', expected);
    });

    it('shows indeterminate paused progress without a pause timestamp', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-20T02:00:00Z'));
        render(<SlaProgress {...props} pausedAt={null} slaRemainingMinutes={null} />);
        expect(screen.getByText('Dijeda')).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
        expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
        expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
        expect(screen.queryByTitle(/Target:/)).not.toBeInTheDocument();
    });

    it('shows zero remaining rather than hiding it', () => {
        render(<SlaProgress {...props} slaRemainingMinutes={0} />);
        expect(screen.getByText('Dijeda · sisa 0 mnt')).toBeInTheDocument();
    });

    it('keeps target title for an active ticket', () => {
        render(<SlaProgress {...props} status="IN_PROGRESS" />);
        expect(screen.getByTitle(`Target: ${formatSlaTargetFull(new Date(props.slaTarget))}`)).toBeInTheDocument();
    });
});
