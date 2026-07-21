import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketMessagingService } from '../services/ticket-messaging.service';
import { TicketQueryService } from '../services/ticket-query.service';
import { TicketUpdateService } from '../services/ticket-update.service';

describe('Ticket Authorization Object Checks', () => {
    let messagingService: TicketMessagingService;
    let queryService: TicketQueryService;
    let updateService: TicketUpdateService;

    let ticketRepo: any;
    let messageRepo: any;
    let userRepo: any;
    let dataSource: any;

    const oracleTicket = { id: 't-1', category: 'Oracle', ticketType: 'ORACLE_REQUEST' };
    const normalTicket = { id: 't-2', category: 'Hardware' };

    beforeEach(() => {
        ticketRepo = {
            findOne: jest.fn(async ({ where: { id } }) => (id === 't-1' ? oracleTicket : normalTicket)),
            save: jest.fn(async (t) => t),
        };
        messageRepo = {
            find: jest.fn(async () => []),
            create: jest.fn((m) => m),
            save: jest.fn(async (m) => m),
        };
        userRepo = {
            findOne: jest.fn(async ({ where: { id } }) => {
                if (id === 'agent-1') return { id: 'agent-1', role: UserRole.AGENT, fullName: 'Standard Agent' };
                if (id === 'oracle-1') return { id: 'oracle-1', role: UserRole.AGENT_ORACLE, fullName: 'Oracle Agent' };
                if (id === 'admin-1') return { id: 'admin-1', role: UserRole.ADMIN, fullName: 'Admin' };
                return null;
            }),
        };
        dataSource = {
            transaction: jest.fn(async (cb) => cb({
                findOne: jest.fn(async (entity, opts) => {
                    if (entity.name === 'Ticket' || opts?.where?.id?.startsWith('t-')) {
                        return opts?.where?.id === 't-1' ? oracleTicket : normalTicket;
                    }
                    return userRepo.findOne(opts);
                }),
                create: jest.fn((e, d) => d),
                save: jest.fn(async (e, d) => d),
            })),
        };

        messagingService = new TicketMessagingService(
            ticketRepo,
            messageRepo,
            userRepo,
            {} as any,
            dataSource,
            { server: { emit: jest.fn() } } as any,
            { emit: jest.fn() } as any,
        );

        queryService = new TicketQueryService(
            ticketRepo,
            { findOne: jest.fn() } as any,
            { get: jest.fn(), set: jest.fn() } as any,
        );

        updateService = new TicketUpdateService(
            ticketRepo,
            messageRepo,
            userRepo,
            {} as any,
            { server: { emit: jest.fn(), notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn() } } as any,
            {} as any,
            { get: jest.fn(), set: jest.fn() } as any,
            { invalidateTicketCache: jest.fn() } as any,
            { emit: jest.fn() } as any,
            null as any,
            null as any,
            { logAsync: jest.fn() } as any,
            dataSource,
            { recalculateAgentWorkload: jest.fn() } as any,
        );
    });

    it('prevents non-Oracle agent from fetching messages of Oracle ticket', async () => {
        await expect(messagingService.getMessages('t-1', UserRole.AGENT)).rejects.toThrow(ForbiddenException);
    });

    it('prevents non-Oracle agent from viewing Oracle ticket details via findOne', async () => {
        await expect(queryService.findOne('t-1', { id: 'agent-1', role: UserRole.AGENT })).rejects.toThrow(ForbiddenException);
    });

    it('prevents non-Oracle agent from updating Oracle ticket via updateTicket', async () => {
        await expect(updateService.updateTicket('t-1', { status: 'IN_PROGRESS' } as any, 'agent-1')).rejects.toThrow(ForbiddenException);
    });
});
