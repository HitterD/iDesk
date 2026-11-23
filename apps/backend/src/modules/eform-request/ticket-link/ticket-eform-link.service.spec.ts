import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketLinkedRequestService } from '../../ticketing/services/ticket-linked-request.service';
import { TicketEFormLinkService } from './ticket-eform-link.service';

describe('TicketEFormLinkService on a RESOLVED flow ticket', () => {
    const setup = (status: TicketStatus) => {
        const ticket: any = { id: 't-1', siteId: 'site-1', status, resolutionDeadlineAt: new Date(), assignedToId: 'agent-1' };
        const manager = {
            findOne: jest.fn(async (entity: any) => (entity.name === 'User' ? null : ticket)),
            save: jest.fn(async (_e: unknown, row: any) => ({ id: 'msg-1', ...row })),
            create: jest.fn((_e: unknown, row: any) => row),
            query: jest.fn(async () => [{ running: '0', proposals: '0' }]),
        };
        const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };
        const gateway = { notifyNewMessage: jest.fn(), notifyTicketUpdate: jest.fn(), notifyTicketListUpdate: jest.fn(), notifyDashboardStatsUpdate: jest.fn() };
        const linked = new TicketLinkedRequestService(
            dataSource as any, { hold: jest.fn(), release: jest.fn(), resumeOnOriginalTarget: jest.fn() } as any, { clear: jest.fn() } as any, gateway as any,
            { recalculateAgentWorkload: jest.fn() } as any, { calculateSlaTarget: jest.fn() } as any, { createSurvey: jest.fn() } as any,
        );
        const repo = { findOne: jest.fn(async () => ({ id: '0b6d3c4e-1111-4222-8333-444455556677', formType: 'VPN', status: 'REJECTED', sourceTicketId: 't-1' })) };
        return { ticket, service: new TicketEFormLinkService(repo as any, linked) };
    };

    it('a rejected e-form leaves a RESOLVED ticket alone', async () => {
        const { ticket, service } = setup(TicketStatus.RESOLVED);
        await service.record('ef-1', 'REJECTED', { actorId: 'agent-1' });
        expect(ticket.status).toBe(TicketStatus.RESOLVED);
        expect(ticket.disputedAt).toBeUndefined();
    });

    it('a rejected e-form still hands a waiting ticket back to IT', async () => {
        const { ticket, service } = setup(TicketStatus.WAITING_VENDOR);
        await service.record('ef-1', 'REJECTED', { actorId: 'agent-1' });
        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
    });
});
