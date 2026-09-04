import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketCreateService } from '../services/ticket-create.service';

describe('Ticket Creation Oracle Guard', () => {
    let service: TicketCreateService;
    let userRepo: any;
    let ticketRepo: any;
    let eventEmitter: { emit: jest.Mock };
    let auditService: { logAsync: jest.Mock };

    beforeEach(() => {
        userRepo = {
            findOne: jest.fn(async ({ where: { id } }) => {
                if (id === 'user-1') return { id: 'user-1', role: UserRole.USER, fullName: 'Standard User' };
                if (id === 'user-site-1') {
                    return { id: 'user-site-1', role: UserRole.USER, fullName: 'Site Client', siteId: 'site-1' };
                }
                if (id === 'oracle-1') return { id: 'oracle-1', role: UserRole.AGENT_ORACLE, fullName: 'Oracle Agent' };
                return null;
            }),
        };

        const mockQb = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
        };

        const mockManager = {
            count: jest.fn(async () => 0),
            create: jest.fn((_, dto) => dto),
            save: jest.fn(async (entityClass, t) => {
                const target = t || entityClass;
                return { id: 't-created', category: 'Oracle', ...target };
            }),
            createQueryBuilder: jest.fn(() => mockQb),
        };

        ticketRepo = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (t) => ({ id: 't-created', category: 'Oracle', ...t })),
            manager: {
                transaction: jest.fn(async (cb) => cb(mockManager)),
            },
        };

        eventEmitter = { emit: jest.fn() };
        auditService = { logAsync: jest.fn() };

        service = new TicketCreateService(
            ticketRepo,
            { create: jest.fn(), save: jest.fn() } as any,
            userRepo,
            { findOne: jest.fn() } as any,
            { server: { emit: jest.fn() }, notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyNewTicket: jest.fn() } as any,
            { get: jest.fn(), set: jest.fn() } as any,
            { invalidateTicketCache: jest.fn(), onTicketChange: jest.fn() } as any,
            eventEmitter as any,
            { recalculateAgentWorkload: jest.fn() } as any,
            auditService as any,
        );
    });

    it('allows USER to create an Oracle ticket (Oracle/K2 request submission is unrestricted for requesters)', async () => {
        const ticket = await service.createTicket('user-1', {
            title: 'Oracle Bug',
            description: 'Issue in Oracle',
            category: 'Oracle',
        } as any);

        expect(ticket).toBeDefined();
        expect(ticket.category).toBe('Oracle');
    });

    it('emits a TV Board refresh for an Oracle/K2 ticket created by a client with a site', async () => {
        await service.createTicket('user-site-1', {
            title: 'Oracle access issue',
            description: 'Tidak dapat membuka menu K2',
            category: 'ORACLE_REQUEST',
            ticketType: 'ORACLE_REQUEST',
        } as any);

        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'tv-board.ticket-changed',
            { siteId: 'site-1' },
        );
    });

    it('allows AGENT_ORACLE to create an Oracle ticket', async () => {
        const ticket = await service.createTicket('oracle-1', {
            title: 'Oracle Patch',
            description: 'Apply patch',
            category: 'Oracle',
        } as any);

        expect(ticket).toBeDefined();
        expect(ticket.category).toBe('Oracle');
    });

    it('rejects AGENT_ORACLE creation outside Oracle/K2 category', async () => {
        await expect(
            service.createTicket('oracle-1', {
                title: 'Standard issue',
                description: 'Standard ticket description',
                category: 'GENERAL',
            } as any),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('emits ticket.created and logs audit AFTER the transaction commits, not inside it', async () => {
        const order: string[] = [];
        eventEmitter.emit.mockImplementation((name: string) => { order.push(`emit:${name}`); });
        auditService.logAsync.mockImplementation(() => { order.push('audit'); });
        ticketRepo.manager.transaction.mockImplementation(async (cb: (m: unknown) => Promise<unknown>) =>
            cb({
                createQueryBuilder: () => ({
                    where: jest.fn().mockReturnThis(),
                    orderBy: jest.fn().mockReturnThis(),
                    setLock: jest.fn().mockReturnThis(),
                    getOne: jest.fn().mockResolvedValue(null),
                }),
                create: jest.fn((_, dto) => dto),
                save: jest.fn(async (_e: unknown, t?: unknown) => {
                    const target = (t || _e) as Record<string, unknown>;
                    order.push('tx:save');
                    return { id: 't-created', ...target };
                }),
            }),
        );

        await service.createTicket('user-site-1', {
            title: 'Oracle access issue',
            description: 'Tidak dapat membuka menu K2',
            category: 'ORACLE_REQUEST',
            ticketType: 'ORACLE_REQUEST',
        } as any);

        // Ticket save + message save inside the transaction; emit + audit only AFTER commit
        expect(order).toEqual(['tx:save', 'tx:save', 'emit:ticket.created', 'audit', 'emit:tv-board.ticket-changed']);
        const event = eventEmitter.emit.mock.calls.find(([name]) => name === 'ticket.created')![1];
        expect(event.ticketId).toBe('t-created');
        expect(event.siteId).toBe('site-1');
    });
});
