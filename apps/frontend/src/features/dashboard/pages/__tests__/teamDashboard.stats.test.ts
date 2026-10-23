import { describe, it, expect } from 'vitest';
import type { Ticket } from '@/types/ticket.types';
import { computeTeamStats, percentChange, toIndonesianDuration } from '../teamDashboard.stats';
import { feedAge, feedItem } from '../TeamDashboardLists';

// Wednesday 21 Oct 2026, 12:00 local; the week starts Sunday 18 Oct.
const NOW = new Date(2026, 9, 21, 12, 0);
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour).toISOString();
const agentA = { id: 'a', fullName: 'Alphin Santoso H.' };
const agentB = { id: 'b', fullName: 'Beny Saputra' };

const ticket = (over: Partial<Ticket>): Ticket => ({
    id: Math.random().toString(36).slice(2), ticketNumber: 'N', title: 'T', description: '', status: 'TODO', priority: 'MEDIUM',
    source: 'WEB', isOverdue: false, user: { id: 'u', fullName: 'Nur Ayni' }, createdAt: at(21), updatedAt: at(21), ...over,
} as Ticket);

const tickets: Ticket[] = [
    ticket({ status: 'TODO', priority: 'CRITICAL', category: 'HARDWARE', createdAt: at(21), isOverdue: true }),
    ticket({ status: 'IN_PROGRESS', priority: 'HIGH', category: 'HARDWARE', assignedTo: agentA as never, createdAt: at(19) }),
    ticket({ status: 'WAITING_VENDOR', category: 'SOFTWARE', createdAt: at(12), updatedAt: at(12) }),
    ticket({ status: 'RESOLVED', assignedTo: agentB as never, createdAt: at(12), updatedAt: at(20) }),
    ticket({ status: 'CLOSED', priority: 'LOW', assignedTo: agentB as never, createdAt: at(11), updatedAt: at(14) }),
];

describe('computeTeamStats', () => {
    const s = computeTeamStats(tickets, 7, NOW);

    it('counts status, priority and category with CLOSED as resolved', () => {
        expect(s).toMatchObject({ total: 5, open: 1, inProgress: 1, waitingVendor: 1, resolved: 2, overdue: 1 });
        expect(s.byPriority).toEqual({ CRITICAL: 1, HIGH: 1, MEDIUM: 2, LOW: 1 });
        expect(s.byCategory).toEqual([{ category: 'HARDWARE', count: 2 }, { category: 'GENERAL', count: 2 }, { category: 'SOFTWARE', count: 1 }]);
        expect(s.slaCompliance).toBe(80);
    });

    it('builds one bucket per day of the range, newest last', () => {
        expect(s.days).toHaveLength(7);
        expect(s.days[6]).toEqual({ date: '2026-10-21', created: 1, resolved: 0 });
        expect(s.days[5]).toEqual({ date: '2026-10-20', created: 0, resolved: 1 });
        expect(computeTeamStats(tickets, 30, NOW).days).toHaveLength(30);
    });

    it('compares this week with last week and ranks agents by resolved', () => {
        expect(s.thisWeekTickets).toBe(2);
        expect(s.resolvedThisWeek).toBe(1);
        expect(s.weekChange).toEqual({ created: -33, resolved: 0 });
        expect(s.topAgents[0]).toEqual({ id: 'b', name: 'Beny Saputra', resolved: 2, inProgress: 0 });
        expect(s.topAgents[1]).toEqual({ id: 'a', name: 'Alphin Santoso H.', resolved: 0, inProgress: 1 });
    });
});

describe('computeTeamStats weekly trend', () => {
    // Monday 19 Oct 2026, 08:00: the week (from Sunday 18 Oct) is barely a day old.
    const MONDAY_MORNING = new Date(2026, 9, 19, 8, 0);
    const lastWeekFull = [11, 12, 13, 14, 15, 16, 17].flatMap((day) => [
        ticket({ createdAt: at(day, 7) }),
        ticket({ status: 'RESOLVED', createdAt: at(day, 7), updatedAt: at(day, 7) }),
    ]);
    const thisWeek = [
        ticket({ createdAt: at(18, 7) }),
        ticket({ status: 'RESOLVED', createdAt: at(18, 7), updatedAt: at(18, 7) }),
        ticket({ createdAt: at(19, 7) }),
        ticket({ status: 'RESOLVED', createdAt: at(19, 7), updatedAt: at(19, 7) }),
    ];

    it('compares the week so far with the same elapsed span of last week, not the full week', () => {
        const s = computeTeamStats([...lastWeekFull, ...thisWeek], 7, MONDAY_MORNING);
        // This week: Sun + Mon 07:00 = 4 created, 2 resolved. Last week Sun 00:00 → Mon 08:00: same 4 / 2.
        expect(s.thisWeekTickets).toBe(4);
        expect(s.resolvedThisWeek).toBe(2);
        expect(s.weekChange).toEqual({ created: 0, resolved: 0 });
    });

    it('excludes last-week activity after the matching moment', () => {
        const lateLastMonday = ticket({ createdAt: at(12, 9) });
        const s = computeTeamStats([...lastWeekFull, ...thisWeek, lateLastMonday], 7, MONDAY_MORNING);
        expect(s.weekChange.created).toBe(0);
    });
});

describe('team dashboard copy helpers', () => {
    it('has no trend without a baseline', () => {
        expect(percentChange(5, 0)).toBeNull();
        expect(percentChange(54, 50)).toBe(8);
    });

    it('speaks Indonesian duration units', () => {
        expect(toIndonesianDuration('4h 20m')).toBe('4j 20m');
        expect(toIndonesianDuration('35m')).toBe('35m');
        expect(toIndonesianDuration(undefined)).toBe('-');
    });

    it('describes feed lines from the ticket state', () => {
        expect(feedItem(tickets[3]).detail).toBe('Diselesaikan oleh Beny Saputra');
        expect(feedItem(tickets[0]).detail).toMatch(/^SLA terlewati · Blocker/);
        expect(feedItem(tickets[1]).detail).toMatch(/^Ditugaskan ke Alphin Santoso H\./);
        expect(feedItem(ticket({})).detail).toMatch(/^Tiket baru dari Nur Ayni/);
        const now = NOW.getTime();
        expect(feedAge(new Date(now - 2 * 60_000).toISOString(), now)).toBe('2 mnt');
        expect(feedAge(new Date(now - 60 * 60_000).toISOString(), now)).toBe('1 jam');
    });
});
