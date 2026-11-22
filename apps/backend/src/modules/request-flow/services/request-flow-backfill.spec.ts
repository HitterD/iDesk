import { EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HandlingTeam, TicketStatus, TicketType } from '../../ticketing/entities/ticket.entity';
import { BACKFILL_SQL, backfillRequestFlows } from './request-flow-backfill';

/** In-memory stand-in for the tables the backfill reads and writes, answering its raw SQL by identity. */
function fakeDb() {
    const db = {
        hardware: [] as any[],
        eform: [] as any[],
        tickets: [] as any[],
        flows: [] as any[],
        revisions: [] as any[],
    };
    let seq = 0;
    const query = jest.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('pg_advisory_xact_lock')) return [];
        if (sql.includes('MAX(CAST')) {
            const prefix = String(params[0]).replace('%', '');
            const nums = db.tickets.filter((t) => t.ticketNumber.startsWith(prefix))
                .map((t) => Number(t.ticketNumber.split('-').pop()));
            return [{ maxSeq: nums.length ? String(Math.max(...nums)) : null }];
        }
        switch (sql) {
            case BACKFILL_SQL.selectHardware: return db.hardware;
            case BACKFILL_SQL.selectEform: return db.eform;
            case BACKFILL_SQL.selectFlows: return db.flows;
            case BACKFILL_SQL.insertTicket: {
                const [ticketNumber, title, description, status, ticketType, handlingTeam, userId, siteId, createdAt, doneAt] = params;
                const row = { id: `ticket-${++seq}`, ticketNumber, title, description, status, ticketType, handlingTeam, userId, siteId, createdAt, doneAt };
                db.tickets.push(row);
                return [{ id: row.id }];
            }
            case BACKFILL_SQL.linkHardware:
                db.hardware.find((r) => r.id === params[1]).sourceTicketId = params[0];
                return [];
            case BACKFILL_SQL.linkEform:
                db.eform.find((r) => r.id === params[1]).sourceTicketId = params[0];
                return [];
            case BACKFILL_SQL.insertFlow: {
                const [ticketId, kind, hardwareRequestId, eformRequestId, route, hardwareSource] = params;
                const row = { id: `flow-${++seq}`, ticketId, kind, hardwareRequestId, eformRequestId, route, hardwareSource };
                db.flows.push(row);
                return [{ id: row.id }];
            }
            case BACKFILL_SQL.insertRevision: {
                const [flowId, version, kind, label] = params;
                db.revisions.push({ flowId, version, kind, label });
                return [];
            }
            default: throw new Error(`Unexpected SQL: ${sql}`);
        }
    });
    return { db, manager: { query } as any };
}

const hardware = (over: Partial<any> = {}) => ({
    id: 'hr-1', requestNumber: 'HR-2026-0001', requesterId: 'user-1', siteId: 'site-1',
    justification: '[NON-BUDGET] Mouse rusak', status: RequestStatus.SUBMITTED, sourceTicketId: null,
    createdAt: new Date(2026, 9, 5, 9), doneAt: new Date(2026, 9, 6, 9), sourceTicketExists: true,
    deptCode: 'QC', deptName: 'Quality Control', userSiteId: 'site-1', ...over,
});

const eform = (over: Partial<any> = {}) => ({
    id: 'ef-1', formType: EFormType.VPN, documentNumber: 'F/ICT/04/0007', requesterId: 'user-2', siteId: 'site-2',
    reason: 'Kerja dari rumah', requiresGm: false, status: EFormStatus.PENDING_MANAGER, sourceTicketId: null,
    createdAt: new Date(2026, 9, 7, 9), doneAt: new Date(2026, 9, 8, 9), sourceTicketExists: true,
    deptCode: 'ACC', deptName: 'Accounting', userSiteId: 'site-2', ...over,
});

describe('backfillRequestFlows', () => {
    it('creates a parent ticket for a standalone submitted hardware request', async () => {
        const { db, manager } = fakeDb();
        db.hardware.push(hardware());

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 1, linked: 0, skipped: 0 });
        expect(db.tickets[0]).toEqual(expect.objectContaining({
            ticketNumber: '051026-QC-0001', title: 'Hardware Request HR-2026-0001', description: '[NON-BUDGET] Mouse rusak',
            status: TicketStatus.IN_PROGRESS, ticketType: TicketType.HARDWARE_REQUEST, handlingTeam: HandlingTeam.OPS_SUPPORT,
            userId: 'user-1', siteId: 'site-1', createdAt: db.hardware[0].createdAt, doneAt: null,
        }));
        expect(db.hardware[0].sourceTicketId).toBe(db.tickets[0].id);
        expect(db.flows[0]).toEqual(expect.objectContaining({
            ticketId: db.tickets[0].id, kind: 'HARDWARE', hardwareRequestId: 'hr-1', eformRequestId: null,
            route: 'MANAGER', hardwareSource: 'NON_BUDGET',
        }));
        expect(db.revisions).toEqual([{ flowId: db.flows[0].id, version: 1, kind: 'GEN', label: 'Dibuat dari data lama' }]);
    });

    it('maps a confirmed eform to a CLOSED EFORM_REQUEST ticket with route MANAGER_GM when requiresGm', async () => {
        const { db, manager } = fakeDb();
        db.eform.push(eform({ status: EFormStatus.CONFIRMED, requiresGm: true }));

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 1, linked: 0, skipped: 0 });
        expect(db.tickets[0]).toEqual(expect.objectContaining({
            ticketNumber: '071026-ACC-0001', title: 'Akses VPN — F/ICT/04/0007', description: 'Kerja dari rumah',
            status: TicketStatus.CLOSED, ticketType: TicketType.EFORM_REQUEST, userId: 'user-2', siteId: 'site-2',
            doneAt: db.eform[0].doneAt,
        }));
        expect(db.flows[0]).toEqual(expect.objectContaining({ kind: 'EFORM', eformRequestId: 'ef-1', route: 'MANAGER_GM', hardwareSource: null }));
    });

    it('routes NAS without approval and other forms to the manager', async () => {
        const { db, manager } = fakeDb();
        db.eform.push(
            eform({ id: 'ef-nas', formType: EFormType.SYNOLOGY_NAS, documentNumber: 'F/ICT/04-NAS/0001' }),
            eform({ id: 'ef-web', formType: EFormType.WEBSITE, documentNumber: 'F/ICT/04-W/0001', status: EFormStatus.REJECTED }),
        );

        await backfillRequestFlows(manager);

        expect(db.flows.map((f) => [f.eformRequestId, f.route])).toEqual([['ef-nas', 'NONE'], ['ef-web', 'MANAGER']]);
        expect(db.tickets.map((t) => t.status)).toEqual([TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED]);
    });

    it('maps hardware sources and terminal statuses', async () => {
        const { db, manager } = fakeDb();
        db.hardware.push(
            hardware({ id: 'a', requestNumber: 'HR-A', justification: '[BUDGET TAHUNAN] x', status: RequestStatus.COMPLETED }),
            hardware({ id: 'b', requestNumber: 'HR-B', justification: '[PENJADWALAN PEMASANGAN] y', status: RequestStatus.REJECTED }),
            hardware({ id: 'c', requestNumber: 'HR-C', justification: 'tanpa prefix', status: RequestStatus.CLOSED }),
        );

        await backfillRequestFlows(manager);

        expect(db.flows.map((f) => f.hardwareSource)).toEqual(['ANNUAL_BUDGET', 'IT_STOCK', null]);
        expect(db.tickets.map((t) => t.status)).toEqual([TicketStatus.CLOSED, TicketStatus.CANCELLED, TicketStatus.CLOSED]);
        expect(db.tickets.map((t) => t.ticketNumber)).toEqual(['051026-QC-0001', '051026-QC-0002', '051026-QC-0003']);
    });

    it('keeps legacy linked tickets as SERVICE', async () => {
        const { db, manager } = fakeDb();
        db.tickets.push({ id: 'legacy', ticketNumber: '011026-QC-0001', ticketType: TicketType.SERVICE });
        db.hardware.push(hardware({ sourceTicketId: 'legacy' }));
        db.eform.push(eform({ sourceTicketId: 'legacy' }));

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 0, linked: 0, skipped: 1 });
        expect(db.tickets).toHaveLength(1);
        expect(db.tickets[0].ticketType).toBe(TicketType.SERVICE);
        expect(db.flows).toEqual([]);
    });

    it('skips a legacy request whose source ticket no longer exists', async () => {
        const { db, manager } = fakeDb();
        db.hardware.push(hardware({ sourceTicketId: 'gone', sourceTicketExists: false }));

        expect(await backfillRequestFlows(manager)).toEqual({ created: 0, linked: 0, skipped: 1 });
        expect(db.flows).toEqual([]);
    });

    it('adds a flow to a legacy ticket raised for exactly one request without changing its type', async () => {
        const { db, manager } = fakeDb();
        db.tickets.push({ id: 'legacy', ticketNumber: '011026-QC-0001', ticketType: TicketType.SERVICE });
        db.hardware.push(hardware({ sourceTicketId: 'legacy' }));

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 0, linked: 1, skipped: 0 });
        expect(db.tickets[0].ticketType).toBe(TicketType.SERVICE);
        expect(db.flows[0]).toEqual(expect.objectContaining({ ticketId: 'legacy', hardwareRequestId: 'hr-1' }));
        expect(db.revisions).toHaveLength(1);
    });

    it('is idempotent', async () => {
        const { db, manager } = fakeDb();
        db.hardware.push(hardware());
        db.eform.push(eform());

        const first = await backfillRequestFlows(manager);
        const second = await backfillRequestFlows(manager);

        expect(first.created).toBe(2);
        expect(second).toEqual({ created: 0, linked: 0, skipped: 0 });
        expect(db.tickets).toHaveLength(2);
        expect(db.flows).toHaveLength(2);
        expect(db.revisions).toHaveLength(2);
    });

    it('skips DRAFT and CANCELLED', async () => {
        const { db, manager } = fakeDb();
        db.hardware.push(hardware({ id: 'd', status: RequestStatus.DRAFT }), hardware({ id: 'c', status: RequestStatus.CANCELLED }));
        db.eform.push(eform({ id: 'd', status: EFormStatus.DRAFT }), eform({ id: 'c', status: EFormStatus.CANCELLED }));

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 0, linked: 0, skipped: 0 });
        expect(db.tickets).toEqual([]);
        expect(db.flows).toEqual([]);
    });

    it("falls back to the requester's site for an eform without one, and skips it when neither has a site", async () => {
        const { db, manager } = fakeDb();
        db.eform.push(
            eform({ id: 'ef-a', siteId: null, userSiteId: 'site-9' }),
            eform({ id: 'ef-b', documentNumber: null, siteId: null, userSiteId: null }),
        );

        const result = await backfillRequestFlows(manager);

        expect(result).toEqual({ created: 1, linked: 0, skipped: 1 });
        expect(db.tickets[0].siteId).toBe('site-9');
        expect(db.eform[1].sourceTicketId).toBeNull();
    });

    it('uses the short e-form code in the title when no document number was assigned', async () => {
        const { db, manager } = fakeDb();
        db.eform.push(eform({ id: '3f2a9c1b-0000', documentNumber: null, reason: null }));

        await backfillRequestFlows(manager);

        expect(db.tickets[0].title).toBe('Akses VPN — #3F2A9C1B');
        expect(db.tickets[0].description).toBe('Akses VPN — #3F2A9C1B');
    });
});
