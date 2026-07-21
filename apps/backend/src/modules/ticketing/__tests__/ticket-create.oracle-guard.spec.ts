import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketCreateService } from '../services/ticket-create.service';

describe('Ticket Creation Oracle Guard', () => {
    let service: TicketCreateService;
    let userRepo: any;
    let ticketRepo: any;

    beforeEach(() => {
        userRepo = {
            findOne: jest.fn(async ({ where: { id } }) => {
                if (id === 'user-1') return { id: 'user-1', role: UserRole.USER, fullName: 'Standard User' };
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

        service = new TicketCreateService(
            ticketRepo,
            { create: jest.fn(), save: jest.fn() } as any,
            userRepo,
            { findOne: jest.fn() } as any,
            { server: { emit: jest.fn() }, notifyDashboardStatsUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyNewTicket: jest.fn() } as any,
            { get: jest.fn(), set: jest.fn() } as any,
            { invalidateTicketCache: jest.fn(), onTicketChange: jest.fn() } as any,
            { emit: jest.fn() } as any,
            { recalculateAgentWorkload: jest.fn() } as any,
            { logAsync: jest.fn() } as any,
        );
    });

    it('blocks USER from creating an Oracle ticket', async () => {
        await expect(
            service.createTicket('user-1', {
                title: 'Oracle Bug',
                description: 'Issue in Oracle',
                category: 'Oracle',
            } as any),
        ).rejects.toThrow(ForbiddenException);
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
});
