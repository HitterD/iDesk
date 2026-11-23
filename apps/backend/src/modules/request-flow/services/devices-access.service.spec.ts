import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { TicketPriority } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { DevicesAccessService } from './devices-access.service';
import type { FlowActor } from './request-flow-review.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const NOW = new Date('2026-11-23T05:00:00Z');

/** `answers` maps a marker found in the SQL to the rows that query returns. */
function setup(answers: Array<[string, unknown[]]> = []) {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => answers.find(([marker]) => sql.includes(marker))?.[1] ?? []);
    const dataSource = { query, manager: { query } };
    const tickets = { createTicket: jest.fn(async () => ({ id: 'new-t', ticketNumber: '231126-IT-0001' })) };
    const notifications = { send: jest.fn(async () => ({ id: 'n' })) };
    const audit = { logAsync: jest.fn() };
    const service = new DevicesAccessService(dataSource as never, tickets as never, notifications as never, audit as never);
    service.now = () => NOW;
    return { service, query, tickets, notifications, audit };
}

const accessRow = (over: Record<string, unknown> = {}) => ({
    id: 'ef-1', ticketId: 't-1', formType: 'VPN', requesterId: 'req-1', requesterName: 'Andi', department: 'QC', siteId: 'site-1',
    startDate: '2026-01-01', endDate: '2026-11-27', ...over,
});

describe('DevicesAccessService.access', () => {
    it('groups by end date: soon <= 7 days, expired < 0, permanent has no end, active otherwise', async () => {
        const rows = [
            accessRow({ id: 'a', endDate: '2026-11-27' }), accessRow({ id: 'b', endDate: '2026-11-20' }),
            accessRow({ id: 'c', endDate: null }), accessRow({ id: 'd', endDate: '2027-02-28' }),
        ];
        const { service } = setup([['ACCESS_ROWS', rows]]);
        const ids = async (g: 'soon' | 'expired' | 'active' | 'permanent') => (await service.access(IT, g)).items.map((r) => r.eformId);
        expect(await ids('soon')).toEqual(['a']);
        expect(await ids('expired')).toEqual(['b']);
        expect(await ids('permanent')).toEqual(['c']);
        expect(await ids('active')).toEqual(['d']);
        expect((await service.access(IT, 'soon')).counts).toEqual({ soon: 1, expired: 1, active: 1, permanent: 1 });
    });

    it('is for IT staff only, and stays inside the staff site (fail closed without one)', async () => {
        await expect(setup().service.access({ ...IT, role: UserRole.USER }, 'soon')).rejects.toBeInstanceOf(ForbiddenException);
        const { service, query } = setup([['ACCESS_ROWS', []]]);
        await service.access(IT, 'soon');
        expect(query.mock.calls[0][1]).toContain('site-1');
        const none = setup();
        await expect(none.service.access({ ...IT, siteId: null }, 'soon')).resolves.toMatchObject({ items: [] });
        expect(none.query).not.toHaveBeenCalled();
    });
});

describe('DevicesAccessService.myAccess', () => {
    const MINE: FlowActor = { userId: 'req-1', role: UserRole.USER, siteId: 'site-9', fullName: 'Leony' };

    it('lists the active accesses of the signed-in requester with their end date and group, nearest end first', async () => {
        const rows = [
            { id: 'ef-1', ticketId: 't-1', formType: 'VPN', endDate: '2027-02-01', startDate: '2026-02-01' },
            { id: 'ef-2', ticketId: 't-2', formType: 'EMAIL', endDate: null, startDate: '2026-01-01' },
            { id: 'ef-3', ticketId: 't-3', formType: 'FLASHDISK', endDate: '2026-11-27', startDate: '2026-11-01' },
        ];
        const { service, query } = setup([['MY_ACCESS_ROWS', rows]]);
        const result = await service.myAccess(MINE);
        expect(query.mock.calls[0][1]).toEqual(['req-1']);
        expect(result.map((r) => [r.eformId, r.group, r.daysLeft])).toEqual([['ef-3', 'soon', 4], ['ef-1', 'active', 70], ['ef-2', 'permanent', null]]);
    });

    it('is open to every role: it only returns the accesses of the person asking', async () => {
        const { service, query } = setup([['MY_ACCESS_ROWS', []]]);
        await expect(service.myAccess({ ...MINE, role: UserRole.USER })).resolves.toEqual([]);
        expect(query.mock.calls[0][1]).not.toContain('site-9');
    });
});

describe('DevicesAccessService.remind and revoke', () => {
    it('remind sends the requester an expiry notice and audits it', async () => {
        const { service, notifications, audit } = setup([['ACCESS_ROWS', [accessRow()]]]);
        await service.remind(IT, 'ef-1');
        expect(notifications.send).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'req-1', type: NotificationType.EFORM_EXPIRY_REMINDER, ticketId: 't-1',
        }));
        expect(audit.logAsync).toHaveBeenCalled();
    });

    it('revoke files an IT Support ticket named after the access and the person', async () => {
        const { service, tickets } = setup([['ACCESS_ROWS', [accessRow()]]]);
        await expect(service.revoke(IT, 'ef-1')).resolves.toEqual({ ticketId: 'new-t', ticketNumber: '231126-IT-0001' });
        expect(tickets.createTicket).toHaveBeenCalledWith('it-1', expect.objectContaining({
            title: 'Cabut akses VPN — Andi', priority: TicketPriority.MEDIUM,
        }));
    });

    it('an access of another site or an unknown one is not found', async () => {
        await expect(setup([['ACCESS_ROWS', []]]).service.revoke(IT, 'nope')).rejects.toBeInstanceOf(NotFoundException);
        await expect(setup([['ACCESS_ROWS', []]]).service.remind(IT, 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
});

describe('DevicesAccessService.schedule', () => {
    it('returns the week installations with the technician load', async () => {
        const rows = [
            { scheduleId: 's1', ticketId: 't-1', ticketNumber: 'A', title: 'PC', siteId: 'site-1', technicianId: 'tech-1', technicianName: 'YUDI', status: 'CONFIRMED', start: '2026-11-24T02:00:00Z', end: '2026-11-24T04:00:00Z' },
            { scheduleId: 's2', ticketId: 't-2', ticketNumber: 'B', title: 'Monitor', siteId: 'site-1', technicianId: 'tech-1', technicianName: 'YUDI', status: 'PROPOSED_AWAITING_USER', start: '2026-11-25T02:00:00Z', end: '2026-11-25T04:00:00Z' },
        ];
        const { service } = setup([['SCHEDULE_ROWS', rows]]);
        const week = await service.schedule(IT, '2026-11-23');
        expect(week.events.map((e) => e.scheduleId)).toEqual(['s1', 's2']);
        expect(week.load).toEqual([{ technicianId: 'tech-1', technicianName: 'YUDI', count: 2 }]);
    });

    it('refuses a week start that is not a date', async () => {
        await expect(setup().service.schedule(IT, 'abc')).rejects.toThrow();
    });
});

describe('DevicesAccessService.schedule: the side panel of the mockup', () => {
    it('lists the installing requests nobody scheduled yet, inside the site, with requester and ticket', async () => {
        const queue = [{ ticketId: 't-9', ticketNumber: 'C', title: 'Printer', requesterName: 'Leony' }];
        const { service, query } = setup([['UNSCHEDULED_ROWS', queue], ['RESCHEDULE_ROWS', [{ count: '2' }]]]);
        const week = await service.schedule(IT, '2026-11-23');
        expect(week.unscheduled).toEqual(queue);
        expect(week.rescheduleRequested).toBe(2);
        const sql = query.mock.calls.map((c) => String(c[0])).find((q) => q.includes('UNSCHEDULED_ROWS'))!;
        expect(sql).toContain(`h."status"::text = 'INSTALLATION'`);
        expect(sql).toContain('NOT EXISTS');
    });
});

describe('DevicesAccessService.summary: the cards of the mockup', () => {
    it('adds the most requested items of the last 30 days and the age of the requests still running', async () => {
        const { service } = setup([
            ['SUMMARY_ROWS', [{ status: 'INSTALLATION', count: '1', doneThisMonth: '0' }]],
            ['TOP_ITEM_ROWS', [{ name: 'Laptop', count: '3' }, { name: 'Mouse', count: '1' }]],
            ['AGE_ROWS', [{ bucket: 'fresh', count: '4' }, { bucket: 'week', count: '1' }, { bucket: 'old', count: '2' }]],
        ]);
        const summary = await service.summary(IT);
        expect(summary.topItems).toEqual([{ name: 'Laptop', count: 3 }, { name: 'Mouse', count: 1 }]);
        expect(summary.age).toEqual({ fresh: 4, week: 1, old: 2 });
    });
});

describe('DevicesAccessService.approvals', () => {
    it('lists only tickets waiting for my signature', async () => {
        const waiting = {
            ticketId: 't-1', ticketNumber: 'A', title: 'Akses VPN', requesterName: 'Andi', kind: 'EFORM', status: 'PENDING_MANAGER', route: 'MANAGER',
            returnedReason: null, managerId: 'mgr-1', gmId: null, requesterId: 'r', managerSigned: false, gmSigned: false, hasOpenSchedule: false,
        };
        const other = { ...waiting, ticketId: 't-2', ticketNumber: 'B', status: 'PENDING_GM', gmId: 'gm-9', route: 'MANAGER_GM', managerSigned: true };
        const { service } = setup([['APPROVAL_ROWS', [waiting, other]]]);
        const result = await service.approvals({ userId: 'mgr-1', role: UserRole.MANAGER, siteId: 'site-1', fullName: 'M' });
        expect(result.map((r) => r.ticketId)).toEqual(['t-1']);
        expect(result[0]).toMatchObject({ ticketNumber: 'A', flowPhaseLabel: 'Menunggu Atasan', requestKind: 'EFORM' });
    });
});

describe('DevicesAccessService.approvalHistory', () => {
    const actor = { userId: 'mgr-1', role: UserRole.MANAGER, siteId: 'site-1', fullName: 'M' };

    it('asks only for signatures made by the signed-in person, newest first, with a limit', async () => {
        const { service, query } = setup();
        await service.approvalHistory(actor);
        const [sql, params] = query.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain('APPROVAL_HISTORY');
        expect(sql).toContain("'signerId' = $1");
        expect(sql).toContain('s."signerId"::text = $1');
        expect(sql).toMatch(/ORDER BY "signedAt" DESC LIMIT 200/);
        expect(params).toEqual(['mgr-1']);
    });

    it('returns the ticket, the requester and where the request stands now', async () => {
        const row = { ticketId: 't-1', ticketNumber: 'A', title: 'Akses VPN', requesterName: 'Andi', kind: 'EFORM', status: 'CONFIRMED', route: 'MANAGER', returnedReason: null, managerId: 'mgr-1', gmId: null, requesterId: 'r', managerSigned: true, gmSigned: false, hasOpenSchedule: false, signedAt: '2026-11-20T01:00:00.000Z' };
        const { service } = setup([['APPROVAL_HISTORY', [row]]]);
        const result = await service.approvalHistory(actor);
        expect(result[0]).toMatchObject({ ticketId: 't-1', ticketNumber: 'A', requesterName: 'Andi', requestKind: 'EFORM', signedAt: '2026-11-20T01:00:00.000Z' });
    });
});

describe('DevicesAccessService.approvals: the row limit', () => {
    it('leaves finished requests out in SQL, so old history cannot push a waiting request past the limit', async () => {
        const { service, query } = setup();
        await service.approvals({ userId: 'mgr-1', role: UserRole.MANAGER, siteId: 'site-1', fullName: 'M' });
        const sql = String(query.mock.calls[0][0]);
        expect(sql).toMatch(/NOT IN \([^)]*'CONFIRMED'[^)]*\)/);
        expect(sql).toContain("'COMPLETED'");
        expect(sql).toContain("'REJECTED'");
        expect(sql).toContain("'CANCELLED'");
    });
});

describe('DevicesAccessService.summary', () => {
    it('counts hardware requests by position, inside the site', async () => {
        const rows = [
            { status: 'PROCUREMENT', count: '3', doneThisMonth: '0' }, { status: 'INSTALLATION', count: '4', doneThisMonth: '0' },
            { status: 'COMPLETED', count: '12', doneThisMonth: '12' }, { status: 'SUBMITTED', count: '2', doneThisMonth: '0' },
        ];
        const { service, query } = setup([['SUMMARY_ROWS', rows]]);
        await expect(service.summary(IT)).resolves.toMatchObject({ activeHardware: 9, inProcurement: 3, waitingInstall: 4, doneThisMonth: 12 });
        expect(query.mock.calls[0][1]).toContain('site-1');
        // The month starts at midnight in Jakarta, whatever zone the database session uses.
        expect(String(query.mock.calls[0][0])).toContain("date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'");
    });
});
