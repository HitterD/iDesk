import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketUpdateService } from './ticket-update.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';

describe('TicketUpdateService.bulkSoftDelete', () => {
    let service: any;
    let mockTicketRepo: any;
    let mockUserRepo: any;
    let mockAuditService: any;
    let softRemoved: Ticket[];

    const buildTicket = (id: string, siteId: string | null = 'site-1'): Ticket => ({
        id,
        ticketNumber: `TCK-${id}`,
        title: `Ticket ${id}`,
        status: TicketStatus.TODO,
        priority: TicketPriority.MEDIUM,
        siteId,
    } as Ticket);

    const buildUser = (role: UserRole, siteId: string | null = 'site-1') => ({
        id: 'actor-1',
        fullName: 'Actor',
        email: 'actor@test.com',
        role,
        siteId,
    });

    beforeEach(() => {
        softRemoved = [];
        mockTicketRepo = { find: jest.fn() };
        mockUserRepo = { findOne: jest.fn() };
        mockAuditService = { logAsync: jest.fn() };

        const manager = {
            softRemove: jest.fn(async (entity: Ticket) => {
                softRemoved.push(entity);
                return entity;
            }),
        };
        const mockDataSource = {
            transaction: jest.fn(async (cb: any) => cb(manager)),
        };

        service = new TicketUpdateService(
            mockTicketRepo,
            {} as any,
            mockUserRepo,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            { emit: jest.fn() } as any,
            null as any,
            null as any,
            mockAuditService,
            mockDataSource as any,
            {} as any,
            {
                isUserEligible: jest.fn().mockResolvedValue(true),
                describeModule: jest.fn().mockResolvedValue('modul ini'),
                toAssignable: jest.fn((t: any) => t),
            } as any,
        );
    });

    it('soft-deletes every requested ticket for an ADMIN', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a'), buildTicket('b')]);

        const result = await service.bulkSoftDelete(['a', 'b'], 'actor-1');

        expect(result.deleted).toBe(2);
        expect(result.failed).toEqual([]);
        expect(softRemoved.map((t) => t.id).sort()).toEqual(['a', 'b']);
    });

    it('reports unknown ids as failed without aborting the rest', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a')]);

        const result = await service.bulkSoftDelete(['a', 'ghost'], 'actor-1');

        expect(result.deleted).toBe(1);
        expect(result.failed).toEqual(['ghost']);
        expect(softRemoved.map((t) => t.id)).toEqual(['a']);
    });

    it('records one audit entry per deleted ticket', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a')]);

        await service.bulkSoftDelete(['a'], 'actor-1');

        expect(mockAuditService.logAsync).toHaveBeenCalledTimes(1);
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'actor-1',
                action: AuditAction.DELETE_TICKET,
                entityType: 'ticket',
                entityId: 'a',
                oldValue: expect.objectContaining({ ticketNumber: 'TCK-a' }),
            }),
        );
    });

    it('throws NotFoundException when the actor does not exist', async () => {
        mockUserRepo.findOne.mockResolvedValue(null);

        await expect(service.bulkSoftDelete(['a'], 'ghost-actor'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when no ticket matches', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.ADMIN, null));
        mockTicketRepo.find.mockResolvedValue([]);

        await expect(service.bulkSoftDelete(['ghost'], 'actor-1'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('aborts the whole batch when a site-locked actor targets another site', async () => {
        mockUserRepo.findOne.mockResolvedValue(buildUser(UserRole.AGENT, 'site-1'));
        mockTicketRepo.find.mockResolvedValue([buildTicket('a', 'site-1'), buildTicket('b', 'site-2')]);

        await expect(service.bulkSoftDelete(['a', 'b'], 'actor-1'))
            .rejects.toBeInstanceOf(ForbiddenException);
        expect(softRemoved).toEqual([]);
    });
});
