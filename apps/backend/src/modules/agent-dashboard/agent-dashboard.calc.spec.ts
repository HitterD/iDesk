import { TicketPriority, TicketStatus } from '../ticketing/entities/ticket.entity';
import { DashboardTicket, computeAgentTicketStats, dashboardWindows, normalizePeriod } from './agent-dashboard.calc';

/** WIB wall-clock time -> Date (WIB is UTC+7, no DST). */
const wib = (iso: string) => new Date(`${iso}+07:00`);

let seq = 0;
const ticket = (extra: Partial<DashboardTicket>): DashboardTicket => ({
    id: `t-${++seq}`,
    ticketNumber: null,
    title: 'T',
    status: TicketStatus.TODO,
    priority: TicketPriority.MEDIUM,
    category: 'GENERAL',
    createdAt: wib('2026-10-01T09:00:00'),
    updatedAt: wib('2026-10-01T09:00:00'),
    resolvedAt: null,
    slaTarget: null,
    ...extra,
});

// 2026-10-07 is a Wednesday.
describe('agent dashboard calc', () => {
    it('only accepts 7/30/90 day periods, defaulting to 30', () => {
        expect(normalizePeriod('7')).toBe(7);
        expect(normalizePeriod(90)).toBe(90);
        expect(normalizePeriod('15')).toBe(30);
        expect(normalizePeriod(undefined)).toBe(30);
    });

    it('measures "today" in WIB, even when UTC is still the previous day', () => {
        // 06:00 WIB on Oct 7 = 23:00 UTC on Oct 6.
        const w = dashboardWindows(wib('2026-10-07T06:00:00'), 7);
        expect(w.today.toISOString()).toBe('2026-10-06T17:00:00.000Z');
        expect(w.weekStart.toISOString()).toBe('2026-10-04T17:00:00.000Z'); // Monday Oct 5 WIB
        expect(w.monthStart.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });

    it('counts a ticket resolved at 06:00 WIB as resolved today', () => {
        const now = wib('2026-10-07T10:00:00');
        const stats = computeAgentTicketStats(
            [ticket({ status: TicketStatus.RESOLVED, resolvedAt: wib('2026-10-07T06:00:00') })],
            dashboardWindows(now, 30),
            30,
        );
        expect(stats.resolvedToday).toBe(1);
        expect(stats.resolvedThisWeek).toBe(1);
        expect(stats.resolvedThisMonth).toBe(1);
    });

    it('splits active work, overdue and sorts the list by nearest SLA', () => {
        const now = wib('2026-10-07T10:00:00');
        const late = ticket({ status: TicketStatus.IN_PROGRESS, slaTarget: wib('2026-10-07T09:00:00') });
        const soon = ticket({ slaTarget: wib('2026-10-07T15:00:00') });
        const noSla = ticket({ status: TicketStatus.WAITING_VENDOR });
        const stats = computeAgentTicketStats([noSla, soon, late, ticket({ status: TicketStatus.CANCELLED })], dashboardWindows(now, 30), 30);

        expect(stats.active).toBe(3);
        expect(stats.todo).toBe(1);
        expect(stats.inProgress).toBe(1);
        expect(stats.waitingVendor).toBe(1);
        expect(stats.overdue).toBe(1);
        expect(stats.activeTickets.map((t) => t.id)).toEqual([late.id, soon.id, noSla.id]);
        expect(stats.activeTickets[0].isOverdue).toBe(true);
    });

    it('computes SLA compliance and average resolve time from tickets resolved in the period', () => {
        const now = wib('2026-10-07T10:00:00');
        const created = wib('2026-10-06T08:00:00');
        const stats = computeAgentTicketStats([
            ticket({ status: TicketStatus.RESOLVED, createdAt: created, resolvedAt: wib('2026-10-06T10:00:00'), slaTarget: wib('2026-10-06T12:00:00') }),
            ticket({ status: TicketStatus.CLOSED, createdAt: created, resolvedAt: wib('2026-10-06T12:00:00'), slaTarget: wib('2026-10-06T11:00:00') }),
            // Outside a 7-day period: ignored.
            ticket({ status: TicketStatus.RESOLVED, createdAt: wib('2026-09-01T08:00:00'), resolvedAt: wib('2026-09-02T08:00:00'), slaTarget: wib('2026-09-03T08:00:00') }),
        ], dashboardWindows(now, 7), 7);

        expect(stats.resolvedInPeriod).toBe(2);
        expect(stats.slaCompliance).toBe(50);
        expect(stats.avgResolveMinutes).toBe(180);
    });

    it('returns null SLA/avg when nothing was resolved', () => {
        const stats = computeAgentTicketStats([], dashboardWindows(wib('2026-10-07T10:00:00'), 7), 7);
        expect(stats.slaCompliance).toBeNull();
        expect(stats.avgResolveMinutes).toBeNull();
        expect(stats.trend).toHaveLength(7);
    });

    it('builds a WIB-dated assigned vs resolved trend', () => {
        const now = wib('2026-10-07T10:00:00');
        const stats = computeAgentTicketStats([
            ticket({ createdAt: wib('2026-10-07T06:00:00') }),
            ticket({ status: TicketStatus.RESOLVED, createdAt: wib('2026-10-06T08:00:00'), resolvedAt: wib('2026-10-07T01:00:00') }),
        ], dashboardWindows(now, 7), 7);

        expect(stats.trend[0].date).toBe('2026-10-01');
        expect(stats.trend[6]).toEqual({ date: '2026-10-07', assigned: 1, resolved: 1 });
        expect(stats.trend[5]).toEqual({ date: '2026-10-06', assigned: 1, resolved: 0 });
    });

    it('buckets active tickets by age', () => {
        const now = wib('2026-10-20T10:00:00');
        const ageDays = (d: number) => ticket({ createdAt: new Date(now.getTime() - d * 86_400_000) });
        const stats = computeAgentTicketStats([ageDays(1), ageDays(4), ageDays(10), ageDays(20), ageDays(30)], dashboardWindows(now, 30), 30);
        expect(stats.aging).toEqual({ lt3: 1, d3to7: 1, d7to14: 1, gt14: 2 });
    });
});
