import { describe, it, expect } from 'vitest';
import { pickActiveSchedule, installSubState } from '../active-schedule.util';
import type { InstallationSchedule } from '../../types';

const sched = (id: string, status: InstallationSchedule['status'], createdAt: string) =>
    ({ id, status, createdAt } as unknown as InstallationSchedule);

describe('pickActiveSchedule', () => {
    it('returns the newest schedule that is still in play, regardless of array order', () => {
        const result = pickActiveSchedule({
            schedules: [
                sched('new', 'PROPOSED_AWAITING_USER', '2026-10-07T03:00:00Z'),
                sched('old', 'RESCHEDULED', '2026-10-06T03:00:00Z'),
            ],
        });
        expect(result?.id).toBe('new');
    });

    it('skips superseded (RESCHEDULED) and CANCELLED schedules', () => {
        const result = pickActiveSchedule({
            schedules: [
                sched('confirmed', 'CONFIRMED', '2026-10-05T03:00:00Z'),
                sched('replaced', 'RESCHEDULED', '2026-10-06T03:00:00Z'),
                sched('cancelled', 'CANCELLED', '2026-10-07T03:00:00Z'),
            ],
        });
        expect(result?.id).toBe('confirmed');
    });

    it('returns undefined when every schedule is finished with', () => {
        expect(pickActiveSchedule({ schedules: [sched('a', 'CANCELLED', '2026-10-05T03:00:00Z')] })).toBeUndefined();
        expect(pickActiveSchedule({ schedules: [] })).toBeUndefined();
    });

    it('falls back to the legacy single installationSchedule', () => {
        const legacy = sched('legacy', 'CONFIRMED', '2026-10-05T03:00:00Z');
        expect(pickActiveSchedule({ installationSchedule: legacy })?.id).toBe('legacy');
    });
});

describe('installSubState', () => {
    it.each([
        [undefined, 'needs-proposal'],
        ['PROPOSED_AWAITING_USER', 'awaiting-user'],
        ['PROPOSED', 'awaiting-user'],
        ['RESCHEDULE_REQUESTED', 'reschedule-requested'],
        ['CONFIRMED', 'ready-to-complete'],
        ['IN_PROGRESS', 'ready-to-complete'],
        ['DONE', 'done'],
    ] as const)('%s → %s', (status, expected) => {
        const s = status ? sched('s', status, '2026-10-05T03:00:00Z') : undefined;
        expect(installSubState(s)).toBe(expected);
    });
});
