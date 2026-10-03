import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TicketCreateService } from './ticket-create.service';
import { HandlingTeam, TicketPriority, TicketType } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { createTestSlaClock } from './sla-clock.testing';

const ORACLE_DTO = {
    title: 'Oracle report error',
    description: 'Report fails to open',
    priority: TicketPriority.MEDIUM,
    category: 'ORACLE_REQUEST',
    ticketType: TicketType.ORACLE_REQUEST,
};

const buildService = (users: Record<string, unknown>) => {
    const userRepo = {
        findOne: jest.fn(({ where: { id } }) => Promise.resolve(users[id] ?? null)),
    };
    const ticketRepo = {
        create: jest.fn((data) => ({ ...data })),
        manager: {
            transaction: jest.fn().mockResolvedValue({
                id: 't-1', ticketNumber: 'GEN-1', siteId: 'site-smg', createdAt: new Date(),
            }),
        },
    };
    const service = new TicketCreateService(
        ticketRepo as never,
        {} as never,
        userRepo as never,
        {} as never,
        { notifyDashboardStatsUpdate: jest.fn(), notifyNewTicket: jest.fn() } as never,
        {} as never,
        {} as never,
        { emit: jest.fn() } as never,
        { autoAssignTicket: jest.fn().mockRejectedValue(new Error('dev queue')) } as never,
        { logAsync: jest.fn() } as never,
        createTestSlaClock(),
    );
    return { service, ticketRepo };
};

describe('TicketCreateService', () => {
    it('lets a support agent submit a developer request; the dev team handles it', async () => {
        const { service, ticketRepo } = buildService({
            'agent-smg': { id: 'agent-smg', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-smg', isActive: true },
        });

        await service.createTicket('agent-smg', ORACLE_DTO);

        expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            handlingTeam: HandlingTeam.ORACLE_DEV,
            createdById: null,
            siteId: 'site-smg',
        }));
    });

    it('files on behalf of another user: requester owns it, the agent is recorded as creator', async () => {
        const requester = { id: 'user-1', role: UserRole.USER, siteId: 'site-krw', isActive: true };
        const { service, ticketRepo } = buildService({
            'agent-smg': { id: 'agent-smg', role: UserRole.AGENT, siteId: 'site-smg', isActive: true },
            'user-1': requester,
        });

        await service.createTicket('agent-smg', { ...ORACLE_DTO, requesterId: 'user-1' });

        expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            user: requester,
            createdById: 'agent-smg',
            siteId: 'site-krw',
        }));
    });

    it('rejects a USER filing on behalf of someone else', async () => {
        const { service } = buildService({
            'user-1': { id: 'user-1', role: UserRole.USER, siteId: 'site-1', isActive: true },
        });

        await expect(service.createTicket('user-1', { ...ORACLE_DTO, requesterId: 'user-2' }))
            .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an inactive or unknown requester', async () => {
        const { service } = buildService({
            'agent-1': { id: 'agent-1', role: UserRole.AGENT, siteId: 'site-1', isActive: true },
            'gone': { id: 'gone', role: UserRole.USER, siteId: 'site-1', isActive: false },
        });

        await expect(service.createTicket('agent-1', { ...ORACLE_DTO, requesterId: 'gone' }))
            .rejects.toBeInstanceOf(BadRequestException);
        await expect(service.createTicket('agent-1', { ...ORACLE_DTO, requesterId: 'missing' }))
            .rejects.toBeInstanceOf(BadRequestException);
    });
});
