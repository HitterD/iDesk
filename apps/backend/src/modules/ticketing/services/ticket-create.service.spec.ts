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

/** Sukodono's ICT requests are handled by Sepanjang; every other site handles its own. */
const SITE_SKD = 'site-skd';
const SITE_SPJ = 'site-spj';
const handlingSite = {
    handlingSiteId: jest.fn(async (siteId: string | null) => (siteId === SITE_SKD ? SITE_SPJ : siteId)),
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
    const messageRepo = { create: jest.fn((data) => ({ ...data })) };
    const workloadService = { autoAssignTicket: jest.fn().mockRejectedValue(new Error('dev queue')) };
    const service = new TicketCreateService(
        ticketRepo as never,
        messageRepo as never,
        userRepo as never,
        {} as never,
        { notifyDashboardStatsUpdate: jest.fn(), notifyNewTicket: jest.fn() } as never,
        {} as never,
        {} as never,
        { emit: jest.fn() } as never,
        workloadService as never,
        { logAsync: jest.fn() } as never,
        createTestSlaClock(),
        handlingSite as never,
    );
    return { service, ticketRepo, messageRepo, workloadService };
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

    it('saves the opening report as the requester\'s message, not the filing agent\'s', async () => {
        const requester = { id: 'user-1', role: UserRole.USER, siteId: 'site-krw', isActive: true };
        const { service, ticketRepo, messageRepo } = buildService({
            'agent-smg': { id: 'agent-smg', role: UserRole.AGENT, siteId: 'site-smg', isActive: true },
            'user-1': requester,
        });
        // Run the transaction body so the initial message is actually built.
        const manager = {
            save: jest.fn(async (entity: any) => ({ id: 't-1', ...entity })),
            query: jest.fn().mockResolvedValue([{ next: 1 }]),
            createQueryBuilder: jest.fn(() => ({ select: () => ({ where: () => ({ getRawOne: async () => ({ max: null }) }) }) })),
        };
        ticketRepo.manager.transaction = jest.fn((cb: any) => cb(manager));

        await service.createTicket('agent-smg', { ...ORACLE_DTO, requesterId: 'user-1' }).catch(() => undefined);

        expect(messageRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            content: ORACLE_DTO.description,
            senderId: 'user-1',
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

    describe('site handling (Sukodono handled by Sepanjang)', () => {
        const SUPPORT_DTO = { title: 'Printer error', description: 'Tidak bisa print', priority: TicketPriority.MEDIUM, category: 'HARDWARE' };
        const skdUser = { id: 'u-skd', role: UserRole.USER, siteId: SITE_SKD, isActive: true };

        it("files a Sukodono requester's ticket under Sepanjang and auto-assigns it there", async () => {
            const { service, ticketRepo, workloadService } = buildService({ 'u-skd': skdUser });
            ticketRepo.manager.transaction.mockResolvedValue({ id: 't-1', ticketNumber: 'GEN-1', siteId: SITE_SPJ, createdAt: new Date() });

            await service.createTicket('u-skd', SUPPORT_DTO);

            expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ user: skdUser, siteId: SITE_SPJ }));
            expect(workloadService.autoAssignTicket).toHaveBeenCalledWith('t-1');
        });

        it("uses the requester's handling site when an agent files on behalf of a Sukodono user", async () => {
            const { service, ticketRepo } = buildService({
                'agent-spj': { id: 'agent-spj', role: UserRole.AGENT, siteId: SITE_SPJ, isActive: true },
                'u-skd': skdUser,
            });

            await service.createTicket('agent-spj', { ...SUPPORT_DTO, requesterId: 'u-skd' });

            expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ user: skdUser, createdById: 'agent-spj', siteId: SITE_SPJ }));
        });

        it('routes an external (iPop) ticket for a Sukodono requester to Sepanjang', async () => {
            const { service, ticketRepo } = buildService({ 'u-skd': skdUser });

            await service.createTicket('u-skd', SUPPORT_DTO, [], [], { source: 'IPOP', ref: 'ext-1' });

            expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ siteId: SITE_SPJ, externalSource: 'IPOP' }));
        });

        it('keeps a site without a handling site on its own site', async () => {
            const { service, ticketRepo } = buildService({
                'u-krw': { id: 'u-krw', role: UserRole.USER, siteId: 'site-krw', isActive: true },
            });

            await service.createTicket('u-krw', SUPPORT_DTO);

            expect(ticketRepo.create).toHaveBeenCalledWith(expect.objectContaining({ siteId: 'site-krw' }));
        });
    });
});
