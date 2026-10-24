import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EFormRequestService } from '../eform-request.service';
import { EFormStatus, EFormType } from '../entities/eform-request.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { TicketEFormService } from './ticket-eform.service';
import { TicketEFormLinkService } from './ticket-eform-link.service';
import { TicketEFormSyncListener } from './ticket-eform-sync.listener';

const TICKET = { id: 'ticket-1', ticketNumber: '241026-GEN-0001', userId: 'u-req', siteId: 'site-1', status: TicketStatus.IN_PROGRESS, handlingTeam: null, participants: [] };
const AGENT = { id: 'u-agent', fullName: 'Agen IT', role: UserRole.AGENT, siteId: 'site-1' };
const REQUESTER = { id: 'u-req', fullName: 'Budi', email: 'budi@x.id', role: UserRole.USER, siteId: 'site-1', department: { name: 'Finance' } };
const EFORM_ID = '3f2a9c1b-0000-4000-8000-000000000001';

describe('TicketEFormService', () => {
    let service: TicketEFormService;
    let repo: any;
    let link: { record: jest.Mock };
    let notifications: { create: jest.Mock };
    let rows: Record<string, any>;

    beforeEach(() => {
        rows = {};
        const users: Record<string, any> = { [AGENT.id]: AGENT, [REQUESTER.id]: REQUESTER };
        repo = {
            findOne: jest.fn(async ({ where }: any) => (where.id ? rows[where.id] ?? null : Object.values(rows).find((r: any) => r.sourceTicketId === where.sourceTicketId && r.status === where.status) ?? null)),
            find: jest.fn(async () => Object.values(rows)),
            create: jest.fn((v: any) => v),
            save: jest.fn(async (v: any) => { const row = { id: v.id ?? EFORM_ID, createdAt: new Date(), ...v }; rows[row.id] = row; return row; }),
        };
        link = { record: jest.fn() };
        notifications = { create: jest.fn() };
        service = new TicketEFormService(
            { findOne: jest.fn(async () => ({ ...TICKET })) } as any,
            { findOne: jest.fn(async ({ where }: any) => users[where.id] ?? null), find: jest.fn(async () => [AGENT]) } as any,
            repo,
            link as any,
            notifications as any,
        );
    });

    const propose = (extra: Record<string, unknown> = {}) => service.propose(AGENT.id, TICKET.id, {
        formType: EFormType.VPN, note: 'Perlu VPN untuk WFH', details: { kebutuhanAkses: 'SAP', password: 'x' }, ...extra,
    } as any);

    it('drafts the access for the ticket requester, prefilled, and asks them to sign it', async () => {
        const summary = await propose();

        const saved = repo.save.mock.calls[0][0];
        expect(saved).toEqual(expect.objectContaining({
            status: EFormStatus.DRAFT, requesterId: 'u-req', requesterName: 'Budi', requesterDepartment: 'Finance',
            sourceTicketId: 'ticket-1', proposedById: 'u-agent', termsAccepted: false, siteId: 'site-1',
        }));
        // Only known detail keys are kept.
        expect(saved.formData).toEqual({ alasan: 'Perlu VPN untuk WFH', kebutuhanAkses: 'SAP' });
        expect(link.record).toHaveBeenCalledWith(EFORM_ID, 'PROPOSED', { actorId: 'u-agent' });
        expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-req', ticketId: 'ticket-1' }));
        expect(summary).toEqual(expect.objectContaining({ code: '#3F2A9C1B', status: EFormStatus.DRAFT, note: 'Perlu VPN untuk WFH' }));
    });

    it('keeps one unanswered proposal per ticket', async () => {
        await propose();
        await expect(propose()).rejects.toThrow(ConflictException);
    });

    it('lets only IT propose', async () => {
        await expect(service.propose(REQUESTER.id, TICKET.id, { formType: EFormType.VPN, note: 'x' } as any)).rejects.toThrow(ForbiddenException);
    });

    it('tells a declined proposal from a withdrawn one', async () => {
        await propose();
        await service.cancelProposal('u-req', EFORM_ID);
        expect(rows[EFORM_ID].status).toBe(EFormStatus.CANCELLED);
        expect(link.record).toHaveBeenLastCalledWith(EFORM_ID, 'DECLINED', { actorId: 'u-req' });

        rows[EFORM_ID].status = EFormStatus.DRAFT;
        await service.cancelProposal('u-agent', EFORM_ID);
        expect(link.record).toHaveBeenLastCalledWith(EFORM_ID, 'WITHDRAWN', { actorId: 'u-agent' });
    });

    it('does not cancel a proposal that was already signed', async () => {
        await propose();
        rows[EFORM_ID].status = EFormStatus.PENDING_MANAGER;
        await expect(service.cancelProposal('u-req', EFORM_ID)).rejects.toThrow(BadRequestException);
    });
});

describe('TicketEFormLinkService', () => {
    const linked = { record: jest.fn() };
    const request = { id: EFORM_ID, formType: EFormType.VPN, sourceTicketId: 'ticket-1' };
    const service = new TicketEFormLinkService({ findOne: jest.fn(async () => request) } as any, linked as any);

    beforeEach(() => linked.record.mockClear());

    it.each([
        ['SUBMITTED', TicketStatus.WAITING_VENDOR],
        ['MANAGER_APPROVED', undefined],
        ['GRANTED', TicketStatus.CLOSED],
        ['REJECTED', TicketStatus.IN_PROGRESS],
        ['PROPOSED', undefined],
    ] as const)('moves the ticket for %s', async (phase, target) => {
        await service.record(EFORM_ID, phase, { actorId: 'u-1' });
        expect(linked.record).toHaveBeenCalledWith(expect.objectContaining({
            ticketId: 'ticket-1', actorId: 'u-1', target,
            event: { eformRequest: { id: EFORM_ID, code: '#3F2A9C1B', formType: 'VPN', phase } },
        }));
    });

    it('says it in words for email and search', async () => {
        await service.record(EFORM_ID, 'GRANTED');
        expect(linked.record.mock.calls[0][0].text).toBe('Akses VPN #3F2A9C1B sudah diberikan. Tiket ditutup otomatis.');
    });
});

describe('TicketEFormSyncListener', () => {
    const link = { record: jest.fn() };
    const listener = new TicketEFormSyncListener(link as any);
    const request = { id: EFORM_ID, requesterId: 'u-req', rejectionReason: 'Tidak perlu' } as any;

    beforeEach(() => link.record.mockClear());

    it('maps e-form events to ticket steps', async () => {
        await listener.onSubmitted({ request });
        await listener.onDirectToIct({ request });
        await listener.onManagerApproved({ request });
        await listener.onCredentialsIssued({ request });
        await listener.onFulfilled({ request });
        await listener.onRejected({ request, userId: 'u-mgr' });
        expect(link.record.mock.calls.map((c) => c[1])).toEqual(['SUBMITTED', 'SUBMITTED', 'MANAGER_APPROVED', 'GRANTED', 'GRANTED', 'REJECTED']);
        expect(link.record).toHaveBeenLastCalledWith(EFORM_ID, 'REJECTED', { actorId: 'u-mgr', reason: 'Tidak perlu' });
    });
});

describe('EFormRequestService.createRequest completing a proposal', () => {
    let service: EFormRequestService;
    let repo: any;
    const draft = { id: EFORM_ID, status: EFormStatus.DRAFT, requesterId: 'u-req', sourceTicketId: 'ticket-1', formData: { alasan: 'x' } };

    beforeEach(() => {
        repo = {
            findOne: jest.fn(async () => ({ ...draft })),
            create: jest.fn((v: any) => v),
            merge: jest.fn((target: any, v: any) => Object.assign(target, v)),
            save: jest.fn(async (v: any) => ({ id: 'new-id', ...v })),
        };
        service = new EFormRequestService(
            { logAsync: jest.fn() } as any, repo, { save: jest.fn() } as any, { save: jest.fn() } as any, {} as any,
            {} as any, {} as any, {} as any, { emit: jest.fn() } as any, { findOne: jest.fn(async () => ({ siteId: 'site-1' })) } as any,
        );
    });

    const dto = {
        formType: EFormType.VPN, formData: { alasan: 'WFH' }, termsAccepted: true, signatureData: 'sig', managerId: '00000000-0000-4000-8000-000000000009', draftId: EFORM_ID,
    };

    it('fills the draft (keeping its id and ticket link) instead of creating a new request', async () => {
        const saved = await service.createRequest('u-req', 'Budi', dto as any);
        expect(repo.create).not.toHaveBeenCalled();
        expect(saved).toEqual(expect.objectContaining({ id: EFORM_ID, sourceTicketId: 'ticket-1', status: EFormStatus.PENDING_MANAGER, termsAccepted: true }));
    });

    it('refuses someone else\'s proposal, or one already answered', async () => {
        await expect(service.createRequest('u-other', 'X', dto as any)).rejects.toThrow(NotFoundException);
        repo.findOne.mockResolvedValueOnce({ ...draft, status: EFormStatus.CANCELLED });
        await expect(service.createRequest('u-req', 'Budi', dto as any)).rejects.toThrow(BadRequestException);
    });
});
