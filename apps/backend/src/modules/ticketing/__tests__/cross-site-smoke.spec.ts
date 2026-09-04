/**
 * Cross-site smoke test: two site-locked agents must not cross.
 * AGENT_OPERATIONAL_SUPPORT SPJ cannot list/read/mutate SMG tickets, and vice versa.
 * Cross-site roles (ADMIN, MANAGER, AGENT_ORACLE) can.
 *
 * Exercises the real enforcement chain (service → site-access.util) without a DB.
 * Each service is wired with minimal mocks; the policy is real.
 */
import { ForbiddenException } from '@nestjs/common';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { TicketQueryService } from '../services/ticket-query.service';
import { TicketUpdateService } from '../services/ticket-update.service';
import { TicketMergeService } from '../services/ticket-merge.service';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { UserRole } from '../../users/enums/user-role.enum';

const SITE_SPJ = 'site-spj';
const SITE_SMG = 'site-smg';

function ticket(siteId: string | null, overrides: Partial<Ticket> = {}): Ticket {
    return {
        id: 't1',
        ticketNumber: '0001',
        title: 'x',
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        category: 'GENERAL',
        ticketType: 'SERVICE',
        siteId,
        userId: 'user-owner',
        user: { id: 'user-owner' } as any,
        assignedTo: null,
        ...overrides,
    } as any;
}

function qbSpy(): any {
    const terminals: Record<string, unknown> = { getRawOne: {}, getRawMany: [], getManyAndCount: [[], 0], getMany: [], getCount: 0 };
    const spies = new Map<string, jest.Mock>();
    return new Proxy({} as any, {
        get(_t, prop: string) {
            if (prop in terminals) return jest.fn().mockResolvedValue(terminals[prop as string]);
            if (!spies.has(prop)) spies.set(prop, jest.fn(() => qbSpyProxy));
            return spies.get(prop)!;
        },
    });
}
// Need self-reference for chain
let qbSpyProxy: any;
beforeEach(() => { qbSpyProxy = qbSpy(); });

describe('Cross-site smoke: site-locked agents cannot cross sites', () => {
    describe('findOne — HTTP detail view', () => {
        let svc: TicketQueryService;
        let ticketRepo: any;

        beforeEach(() => {
            ticketRepo = {
                findOne: jest.fn(),
                createQueryBuilder: jest.fn().mockReturnValue(qbSpyProxy),
                save: jest.fn(async (x: any) => x),
            } as any;
            const slaConfigRepo = { findOne: jest.fn().mockResolvedValue(null) } as any;
            svc = new TicketQueryService(
                ticketRepo as any,
                slaConfigRepo as any,
                { getOrSet: jest.fn((_: string, fn: any) => fn()) } as any,
            );
        });

        it('AGENT_OPERATIONAL_SUPPORT SPJ cannot read a SMG ticket (403)', async () => {
            ticketRepo.findOne.mockResolvedValue(ticket(SITE_SMG));
            await expect(svc.findOne('t1', { id: 'u1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ })).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('AGENT_OPERATIONAL_SUPPORT SMG cannot read a SPJ ticket (403)', async () => {
            ticketRepo.findOne.mockResolvedValue(ticket(SITE_SPJ));
            await expect(svc.findOne('t1', { id: 'u1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SMG })).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('same-site read succeeds', async () => {
            const t = ticket(SITE_SPJ);
            ticketRepo.findOne.mockResolvedValue({ ...t, user: { id: 'x', department: null }, assignedTo: null, messages: [], siteId: SITE_SPJ });
            try {
                await svc.findOne('t1', { id: 'u1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ });
            } catch (e) {
                expect(e).not.toBeInstanceOf(ForbiddenException);
            }
        });

        it('ADMIN can read cross-site', async () => {
            const t = ticket(SITE_SMG);
            ticketRepo.findOne.mockResolvedValue({ ...t, user: { id: 'x', department: null }, assignedTo: null, messages: [], siteId: SITE_SMG });
            try {
                await svc.findOne('t1', { id: 'u1', role: UserRole.ADMIN, siteId: null });
            } catch (e) {
                expect(e).not.toBeInstanceOf(ForbiddenException);
            }
        });
    });

    describe('mutations — update, assign, cancel', () => {
        let svc: TicketUpdateService;
        let ticketRepo: any;
        let userRepo: any;
        let dataSource: any;
        let eventsGateway: any;

        beforeEach(() => {
            ticketRepo = { findOne: jest.fn(), save: jest.fn(async (x: any) => x), manager: { findOne: jest.fn() } as any };
            userRepo = { findOne: jest.fn() };
            const manager = {
                findOne: jest.fn().mockImplementation(async (entity: any, opts: any) => {
                    if (entity?.name === 'Ticket' || entity === Ticket) {
                        if (opts?.where?.id === 't1') return ticket(SITE_SMG);
                        return null;
                    }
                    if (entity?.name === 'User') {
                        return { id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'A SPJ' } as any;
                    }
                    return null;
                }),
                save: jest.fn(async (_e: any, x: any) => x),
            };
            dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) };
            const siteRoom = { emit: jest.fn() };
            eventsGateway = { server: { emit: jest.fn(), to: jest.fn(() => siteRoom) }, notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyStatusChange: jest.fn() };
            svc = new TicketUpdateService(
                ticketRepo, { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) } as any,
                userRepo, {} as any, eventsGateway, {} as any, {} as any, { onTicketChange: jest.fn(async () => {}) } as any,
                { emit: jest.fn() } as any, null as any, null as any, { logAsync: jest.fn() } as any,
                dataSource as any, { recalculateAgentWorkload: jest.fn() } as any,
                {
                    isUserEligible: jest.fn().mockResolvedValue(true),
                    describeModule: jest.fn().mockResolvedValue('modul ini'),
                    toAssignable: jest.fn((t: any) => t),
                } as any,
            );
        });

        it('updateTicket: SPJ agent cannot mutate SMG ticket', async () => {
            await expect(svc.updateTicket('t1', { priority: 'HIGH' } as any, 'u-spj')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('assignTicket: SPJ assigner cannot assign SMG ticket', async () => {
            ticketRepo.findOne.mockResolvedValue(ticket(SITE_SMG));
            userRepo.findOne.mockImplementation(async (opts: any) => {
                const id = opts?.where?.id;
                if (id === 'assignee-1') return { id: 'assignee-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'Ass SPJ', email: 'a@x' } as any;
                if (id === 'u-spj') return { id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'Assigner SPJ' } as any;
                return null;
            });
            await expect(svc.assignTicket('t1', 'assignee-1', 'u-spj')).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('cancelTicket: SPJ agent cannot cancel SMG ticket', async () => {
            const t = ticket(SITE_SMG);
            ticketRepo.findOne.mockResolvedValue({ ...t, user: { id: 'user-owner' }, assignedTo: null });
            userRepo.findOne.mockResolvedValue({ id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'A SPJ' } as any);
            await expect(svc.cancelTicket('t1', 'u-spj', UserRole.AGENT_OPERATIONAL_SUPPORT)).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('messages — read and reply', () => {
        let svc: TicketMessagingService;
        let ticketRepo: any;

        beforeEach(() => {
            ticketRepo = { findOne: jest.fn() };
            svc = new TicketMessagingService(
                ticketRepo as any,
                { find: jest.fn(async () => []), create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x), count: jest.fn(async () => 0) } as any,
                { findOne: jest.fn() } as any,
                {} as any,
                {} as any,
                { to: jest.fn(() => ({ emit: jest.fn() })), emit: jest.fn() } as any as EventsGateway,
                { emit: jest.fn() } as any,
            );
        });

        it('getMessages: SPJ agent cannot read SMG ticket messages', async () => {
            ticketRepo.findOne.mockResolvedValue(ticket(SITE_SMG));
            await expect(svc.getMessages('t1', UserRole.AGENT_OPERATIONAL_SUPPORT, SITE_SPJ)).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('merge — cross-site blocked', () => {
        let svc: TicketMergeService;
        let ticketRepo: any;
        let userRepo: any;

        beforeEach(() => {
            ticketRepo = { findOne: jest.fn() } as any;
            const messageRepo = {} as any;
            userRepo = { findOne: jest.fn(async () => ({ id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ } as any)) };
            const manager = {
                findOne: jest.fn(async (entity: any, opts: any) => {
                    const entityName = entity?.name ?? '';
                    if (entityName === 'User') {
                        return { id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'A SPJ' } as any;
                    }
                    const id = opts?.where?.id;
                    if (id === 'primary') return ticket(SITE_SPJ, { id: 'primary' });
                    if (id === 'secondary') return ticket(SITE_SMG, { id: 'secondary' });
                    if (id === 'u-spj') return { id: 'u-spj', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: SITE_SPJ, fullName: 'A SPJ' } as any;
                    return null;
                }),
                find: jest.fn(async () => [ticket(SITE_SMG, { id: 'secondary' })]),
                save: jest.fn(async (_e: any, x: any) => x),
                create: jest.fn((_: any, x: any) => x ?? _),
                update: jest.fn(async () => {}),
            } as any;
            const dataSource = { transaction: jest.fn(async (fn: any) => fn(manager)) } as any;
            const siteRoom = { emit: jest.fn() };
            const gw = { server: { emit: jest.fn(), to: jest.fn(() => siteRoom) }, notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() } as any;
            const auditService = { log: jest.fn(async () => {}), logAsync: jest.fn(async () => {}) } as any;
            svc = new TicketMergeService(ticketRepo as any, messageRepo as any, userRepo as any, dataSource as any, gw as any, auditService as any);
        });

        it('SPJ agent cannot merge a SMG secondary into SPJ primary', async () => {
            await expect(svc.mergeTickets('primary', ['secondary'], 'u-spj')).rejects.toBeInstanceOf(ForbiddenException);
        });
    });

    describe('realtime — WS fan-out is site-scoped (no global ticket leak)', () => {
        let gw: EventsGateway;
        let server: any;

        beforeEach(() => {
            const jwt = { verify: jest.fn() } as any;
            const config = { get: jest.fn().mockReturnValue('secret') } as any;
            const tickets = { findById: jest.fn() } as any;
            gw = new EventsGateway(jwt, config, tickets);
            const siteEmit = jest.fn();
            const ticketEmit = jest.fn();
            const toMock = jest.fn((room: string) => ({ emit: room.startsWith('site:') ? siteEmit : ticketEmit }));
            server = { emit: jest.fn(), to: toMock };
            (gw as any).server = server;
            (gw as any)._siteEmit = siteEmit;
            (gw as any)._ticketEmit = ticketEmit;
        });

        it('notifyNewTicket emits only to site:SPJ, not globally', () => {
            gw.notifyNewTicket({ id: 't1', siteId: SITE_SPJ } as any);
            expect(server.emit).not.toHaveBeenCalledWith('ticket:created', expect.anything());
            expect(server.to).toHaveBeenCalledWith(`site:${SITE_SPJ}`);
            expect(server.to).not.toHaveBeenCalledWith(`site:${SITE_SMG}`);
        });

        it('notifyTicketListUpdate emits only to the asking site', () => {
            gw.notifyTicketListUpdate(SITE_SPJ);
            expect(server.emit).not.toHaveBeenCalledWith('tickets:listUpdated', expect.anything());
            expect(server.to).toHaveBeenCalledWith(`site:${SITE_SPJ}`);
            expect(server.to).not.toHaveBeenCalledWith(`site:${SITE_SMG}`);
        });

        it('notifyDashboardStatsUpdate emits only to the asking site', () => {
            gw.notifyDashboardStatsUpdate(SITE_SPJ);
            expect(server.emit).not.toHaveBeenCalledWith('dashboard:stats:update', expect.anything());
            expect(server.to).toHaveBeenCalledWith(`site:${SITE_SPJ}`);
        });

        it('notifyNewTicket with no site emits nowhere', () => {
            const toCalls: string[] = [];
            server.to.mockImplementation((room: string) => { toCalls.push(room); return { emit: jest.fn() }; });
            gw.notifyNewTicket({ id: 't1', siteId: null } as any);
            expect(toCalls.length).toBe(0);
            expect(server.emit).not.toHaveBeenCalledWith('ticket:created', expect.anything());
        });
    });
});
