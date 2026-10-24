import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TicketHardwareRequestService, requestTypeOf } from './ticket-hardware-request.service';
import { HardwareRequestType } from '../dto/propose-from-ticket.dto';
import { HandlingTeam, TicketStatus } from '../../ticketing/entities/ticket.entity';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { UserRole } from '../../users/enums/user-role.enum';

describe('TicketHardwareRequestService', () => {
    const agent = { id: 'agent-1', fullName: 'Agen IT', role: UserRole.AGENT, siteId: 'site-1' };
    const requester = { id: 'user-1', fullName: 'Sari', role: UserRole.USER, siteId: 'site-1', department: { name: 'Finance' } };
    let ticket: any;
    let users: any;
    let reqRepo: any;
    let commands: any;
    let link: any;
    let notifications: any;
    let service: TicketHardwareRequestService;
    const dto = {
        requestType: HardwareRequestType.NON_BUDGET, justification: 'Mouse rusak, perlu ganti',
        items: [{ catalogId: '11111111-1111-1111-1111-111111111111', quantity: 2 }],
    };

    beforeEach(() => {
        ticket = {
            id: 'ticket-1', ticketNumber: '241026-FIN-0003', userId: 'user-1', siteId: 'site-1',
            status: TicketStatus.IN_PROGRESS, handlingTeam: HandlingTeam.OPS_SUPPORT, participants: [],
        };
        users = {
            findOne: jest.fn(async ({ where }: any) => (where.id === 'agent-1' ? agent : where.id === 'user-1' ? requester : null)),
            find: jest.fn(async () => [agent]),
        };
        reqRepo = {
            findOne: jest.fn(async () => null),
            find: jest.fn(async () => [{
                id: 'req-1', requestNumber: 'HR-2026-0012', status: RequestStatus.DRAFT, justification: '[NON-BUDGET] Mouse rusak, perlu ganti',
                proposedById: 'agent-1', createdAt: new Date(),
                items: [
                    { id: 'i1', catalogId: 'cat-1', quantity: 1, categorySnapshot: { name: 'Mouse', category: 'PERIPHERAL' } },
                    { id: 'i2', catalogId: 'cat-1', quantity: 1, categorySnapshot: { name: 'Mouse', category: 'PERIPHERAL' } },
                ],
            }]),
        };
        commands = { createDraft: jest.fn(async () => ({ id: 'req-1', requestNumber: 'HR-2026-0012' })) };
        link = { record: jest.fn() };
        notifications = { create: jest.fn() };
        service = new TicketHardwareRequestService(
            { findOne: jest.fn(async () => ticket) } as any, users, reqRepo, { find: jest.fn(async () => []) } as any,
            commands, link, notifications,
        );
    });

    it('drafts the request for the ticket requester, posts the card and notifies them', async () => {
        const summary = await service.propose('agent-1', 'ticket-1', dto);

        expect(commands.createDraft).toHaveBeenCalledWith('user-1', 'site-1', UserRole.USER, expect.objectContaining({
            recipientId: 'user-1', division: 'Finance', justification: '[NON-BUDGET] Mouse rusak, perlu ganti',
        }), { sourceTicketId: 'ticket-1', proposedById: 'agent-1' });
        expect(link.record).toHaveBeenCalledWith('req-1', 'PROPOSED', { actorId: 'agent-1' });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', link: '/tickets/ticket-1' }));
        expect(summary).toEqual(expect.objectContaining({
            requestType: HardwareRequestType.NON_BUDGET, justification: 'Mouse rusak, perlu ganti',
            proposedBy: { id: 'agent-1', name: 'Agen IT' }, items: [{ name: 'Mouse', category: 'PERIPHERAL', quantity: 2 }],
        }));
    });

    it('refuses tickets of the development teams', async () => {
        ticket.handlingTeam = HandlingTeam.ORACLE_DEV;
        // An admin can open any ticket, so the team rule (not access) is what stops it.
        users.findOne.mockResolvedValueOnce({ ...agent, role: UserRole.ADMIN });
        await expect(service.propose('agent-1', 'ticket-1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses finished tickets', async () => {
        ticket.status = TicketStatus.RESOLVED;
        await expect(service.propose('agent-1', 'ticket-1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows one open proposal at a time', async () => {
        reqRepo.findOne.mockResolvedValue({ requestNumber: 'HR-2026-0011' });
        await expect(service.propose('agent-1', 'ticket-1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('only lets ICT staff propose', async () => {
        await expect(service.propose('user-1', 'ticket-1', dto)).rejects.toBeInstanceOf(ForbiddenException);
        expect(commands.createDraft).not.toHaveBeenCalled();
    });

    it('lets the requester see the requests of their own ticket', async () => {
        await expect(service.listForTicket('user-1', 'ticket-1')).resolves.toHaveLength(1);
    });

    it('reads the flow back from the justification prefix', () => {
        expect(requestTypeOf('[PENJADWALAN PEMASANGAN] pasang')).toBe(HardwareRequestType.HARDWARE_INSTALLATION);
        expect(requestTypeOf('tanpa prefix')).toBe(HardwareRequestType.BUDGET_ANNUAL);
    });
});
