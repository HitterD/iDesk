import type { InstallationSchedule, InstallStatus } from '../types';

/** Schedules that have been replaced or dropped and no longer drive the UI. */
const INACTIVE: InstallStatus[] = ['RESCHEDULED', 'CANCELLED'];

type WithSchedules = {
    schedules?: InstallationSchedule[] | null;
    installationSchedule?: InstallationSchedule | null;
};

const createdAtOf = (s: InstallationSchedule) => new Date((s as { createdAt?: string }).createdAt ?? 0).getTime();

/**
 * The schedule currently in play: the newest one that is not superseded or cancelled.
 * Sorted by createdAt because the API does not order `schedules`; picking "the last
 * non-cancelled" one used to land on an old RESCHEDULED row.
 */
export function pickActiveSchedule(r: WithSchedules): InstallationSchedule | undefined {
    if (!r.schedules?.length) return r.installationSchedule ?? undefined;
    return [...r.schedules]
        .sort((a, b) => createdAtOf(b) - createdAtOf(a))
        .find((s) => !INACTIVE.includes(s.status));
}

export type InstallSubState =
    | 'needs-proposal'
    | 'awaiting-user'
    | 'reschedule-requested'
    | 'ready-to-complete'
    | 'done';

/** What ICT staff should do next for a request in INSTALLATION, given its active schedule. */
export function installSubState(active: InstallationSchedule | undefined): InstallSubState {
    switch (active?.status) {
        case 'PROPOSED':
        case 'PROPOSED_AWAITING_USER':
            return 'awaiting-user';
        case 'RESCHEDULE_REQUESTED':
            return 'reschedule-requested';
        case 'CONFIRMED':
        case 'IN_PROGRESS':
            return 'ready-to-complete';
        case 'DONE':
            return 'done';
        default:
            return 'needs-proposal';
    }
}
