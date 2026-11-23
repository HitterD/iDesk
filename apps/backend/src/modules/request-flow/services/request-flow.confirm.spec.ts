import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { TicketUpdatedEvent } from '../../ticketing/events/ticket-updated.event';
import { UserRole } from '../../users/enums/user-role.enum';
import type { ConfirmDto } from '../dto/confirm.dto';
import { RequestConfirmFlowService } from './request-confirm-flow.service';
import { RequestFlowFinalizer } from './request-flow-finalizer';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';

const REQUESTER: FlowActor = { userId: 'req-1', role: UserRole.USER, siteId: 'site-1', fullName: 'Leony' };
const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';

function context(kind: 'EFORM' | 'HARDWARE', status?: string): FlowContext {
    const hardware = kind === 'HARDWARE';
    return {
        flow: { id: 'flow-1', ticketId: TID, kind, route: 'MANAGER', returnedReason: null, documentVersion: 5 } as never,
        ticket: { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1', status: TicketStatus.RESOLVED } as never,
        kind, requesterId: 'req-1', requesterName: 'Leony', number: hardware ? 'HR-2026-0042' : 'F/ICT/04/0120',
        hardware: hardware ? ({ id: 'hr-1', requestNumber: 'HR-2026-0042', status: status ?? RequestStatus.AWAITING_USER_CONFIRMATION } as never) : null,
        eform: hardware ? null : ({ id: 'ef-1', formType: EFormType.VPN, status: status ?? 'AWAITING_CONFIRMATION' } as never),
        signed: { manager: true, gm: false }, phase: 'other', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        update: jest.fn(async () => undefined),
        findOne: jest.fn(async () => null),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)), manager };
    const reader = { load: jest.fn(async () => ctx) };
    const announce = jest.fn();
    const hardware = { confirmInstallationWith: jest.fn(async () => ({ saved: { id: 'hr-1' }, announce })), autoConfirmInstallation: jest.fn(async () => ({})) };
    const documents = { bump: jest.fn(async () => 6) };
    const stepper = { tell: jest.fn(async () => undefined) };
    const audit = { logAsync: jest.fn() };
    const service = new RequestConfirmFlowService(dataSource as never, reader as never, hardware as never, documents as never, stepper as never, audit as never);
    return { service, manager, dataSource, reader, hardware, documents, stepper, audit, announce };
}

const ok = (): ConfirmDto => ({ result: 'OK' });
const issue = (note = 'VPN tidak bisa connect'): ConfirmDto => ({ result: 'ISSUE', note });

describe('RequestConfirmFlowService.confirm (e-form)', () => {
    it('requester confirmation closes the ticket and finalises the document', async () => {
        const { service, manager, documents, stepper } = setup(context('EFORM'));

        await expect(service.confirm(REQUESTER, TID, ok())).resolves.toEqual({ status: EFormStatus.CONFIRMED, result: 'OK' });

        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.CONFIRMED, resolvedAt: expect.any(Date) }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', 'Final · terkunci · F/ICT/04/0120', 'req-1', manager);
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            actorId: 'req-1', phase: 'CONFIRMED', target: TicketStatus.CLOSED, text: 'Leony mengonfirmasi — tiket ditutup',
        }));
    });

    it('IT confirming for the requester is told apart in the message and audited', async () => {
        const { service, stepper, audit } = setup(context('EFORM'));

        await service.confirm(IT, TID, ok());

        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            actorId: 'it-1', target: TicketStatus.CLOSED, text: 'RM Bagastyo (atas nama pemohon) mengonfirmasi — tiket ditutup',
        }));
        expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'it-1', action: AuditAction.REQUEST_CONFIRMED_ON_BEHALF, entityId: 'ef-1' }));
    });

    it('issue sends eform back to PENDING_ICT and the ticket to IN_PROGRESS', async () => {
        const { service, manager, documents, stepper } = setup(context('EFORM'));

        await expect(service.confirm(REQUESTER, TID, issue())).resolves.toEqual({ status: EFormStatus.PENDING_ICT, result: 'ISSUE' });

        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_ICT }));
        expect(documents.bump).not.toHaveBeenCalled();
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            phase: 'ISSUE_REPORTED', target: TicketStatus.IN_PROGRESS, reopenResolved: true,
            text: 'Pemohon melaporkan kendala — kembali ke IT', reason: 'VPN tidak bisa connect',
        }));
    });

    it('only the requester or a processor may answer, and only while waiting for the requester', async () => {
        await expect(setup(context('EFORM')).service.confirm({ ...REQUESTER, userId: 'other' }, TID, ok())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context('EFORM')).service.confirm({ ...IT, role: UserRole.MANAGER }, TID, ok())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context('EFORM')).service.confirm({ ...IT, siteId: 'site-2' }, TID, ok())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context('EFORM', EFormStatus.PENDING_ICT)).service.confirm(REQUESTER, TID, ok())).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context('EFORM')).service.confirm(REQUESTER, 'nope', ok())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('an issue needs a note of at least 5 characters', async () => {
        const { service, stepper } = setup(context('EFORM'));
        await expect(service.confirm(REQUESTER, TID, { result: 'ISSUE', note: 'ab' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.confirm(REQUESTER, TID, { result: 'ISSUE' })).rejects.toBeInstanceOf(BadRequestException);
        expect(stepper.tell).not.toHaveBeenCalled();
    });
});

describe('RequestConfirmFlowService.confirm (hardware)', () => {
    it('OK accepts the installation, finalises the document and closes the ticket', async () => {
        const { service, manager, hardware, documents, stepper, announce } = setup(context('HARDWARE'));

        await expect(service.confirm(REQUESTER, TID, ok())).resolves.toEqual({ status: RequestStatus.COMPLETED, result: 'OK' });

        expect(hardware.confirmInstallationWith).toHaveBeenCalledWith(manager, 'hr-1', 'req-1', { kind: 'ACCEPT_AS_IS', comments: undefined }, false);
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', 'Final · terkunci · HR-2026-0042', 'req-1', manager);
        expect(announce).toHaveBeenCalledTimes(1);
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            phase: 'COMPLETED', target: TicketStatus.CLOSED, text: 'Leony mengonfirmasi — tiket ditutup',
        }));
    });

    it('an issue goes back to the installation and reopens the ticket', async () => {
        const { service, manager, hardware, documents, stepper } = setup(context('HARDWARE'));

        await expect(service.confirm(REQUESTER, TID, issue('Monitor tidak menyala'))).resolves.toEqual({ status: RequestStatus.INSTALLATION, result: 'ISSUE' });

        expect(hardware.confirmInstallationWith).toHaveBeenCalledWith(manager, 'hr-1', 'req-1', { kind: 'REPORT_ISSUE', comments: 'Monitor tidak menyala' }, false);
        expect(documents.bump).not.toHaveBeenCalled();
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            phase: 'ISSUE_REPORTED', target: TicketStatus.IN_PROGRESS, reopenResolved: true, reason: 'Monitor tidak menyala',
        }));
    });

    it('IT confirming on behalf passes the flag on', async () => {
        const { service, hardware } = setup(context('HARDWARE'));
        await service.confirm(IT, TID, ok());
        expect(hardware.confirmInstallationWith).toHaveBeenCalledWith(expect.anything(), 'hr-1', 'it-1', expect.anything(), true);
    });

    it('does not announce or tell when the hardware step refuses', async () => {
        const { service, hardware, stepper, announce } = setup(context('HARDWARE'));
        hardware.confirmInstallationWith.mockRejectedValueOnce(new ConflictException('x'));
        await expect(service.confirm(REQUESTER, TID, ok())).rejects.toBeInstanceOf(ConflictException);
        expect(announce).not.toHaveBeenCalled();
        expect(stepper.tell).not.toHaveBeenCalled();
    });
});

describe('RequestFlowFinalizer (ticket closed or disputed outside the request card)', () => {
    function finalizerSetup(ctx: FlowContext, latestKind: string | null = 'DIG') {
        const manager = {
            findOne: jest.fn(async (entity: { name?: string }) => (entity?.name === 'RequestFlow' ? { id: 'flow-1' } : latestKind ? { kind: latestKind } : null)),
            update: jest.fn(async () => undefined),
        };
        const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)), manager };
        let loads = 0;
        const reader = {
            load: jest.fn(async () => {
                loads += 1;
                const done = loads > 1 && ctx.hardware && ctx.hardware.status === RequestStatus.AWAITING_USER_CONFIRMATION;
                return done ? { ...ctx, hardware: { ...ctx.hardware, status: RequestStatus.COMPLETED } as never } : ctx;
            }),
        };
        const hardware = { autoConfirmInstallation: jest.fn(async () => ({})), confirmInstallationWith: jest.fn(async () => ({ saved: {}, announce: jest.fn() })) };
        const documents = { bump: jest.fn(async () => 7) };
        const finalizer = new RequestFlowFinalizer(dataSource as never, reader as never, hardware as never, documents as never);
        return { finalizer, manager, hardware, documents };
    }

    const event = (over: Partial<TicketUpdatedEvent> = {}) => ({ ticketId: TID, ticketNumber: 'T', userId: 'system', changes: [], ticket: {}, ...over }) as TicketUpdatedEvent;

    it('auto-close of a request ticket completes the hardware request and adds the FIN revision', async () => {
        const { finalizer, hardware, documents, manager } = finalizerSetup(context('HARDWARE'));
        await finalizer.onTicketUpdated(event({ closedReason: 'auto_unconfirmed' }));
        expect(hardware.autoConfirmInstallation).toHaveBeenCalledWith('hr-1');
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', 'Final · terkunci · HR-2026-0042', null, manager);
    });

    it('auto-close of an e-form ticket confirms it', async () => {
        const { finalizer, manager, documents } = finalizerSetup(context('EFORM'));
        await finalizer.onTicketUpdated(event({ closedReason: 'auto_unconfirmed' }));
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.CONFIRMED }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', 'Final · terkunci · F/ICT/04/0120', null, manager);
    });

    it('the requester confirming on the ticket itself finalises the request too', async () => {
        const { finalizer, documents } = finalizerSetup(context('EFORM'));
        await finalizer.onTicketUpdated(event({ closedReason: 'confirmed', userId: 'req-1' }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', expect.any(String), 'req-1', expect.anything());
    });

    it('is a no-op for other closes, tickets without a request, and a request that is already final', async () => {
        const a = finalizerSetup(context('EFORM'));
        await a.finalizer.onTicketUpdated(event({ closedReason: 'manual' }));
        await a.finalizer.onTicketUpdated(event());
        expect(a.documents.bump).not.toHaveBeenCalled();

        const done = finalizerSetup(context('EFORM', EFormStatus.CONFIRMED), 'FIN');
        await done.finalizer.onTicketUpdated(event({ closedReason: 'auto_unconfirmed' }));
        expect(done.documents.bump).not.toHaveBeenCalled();
    });

    it('a retry after the request completed but the revision failed still adds the FIN revision once', async () => {
        const { finalizer, documents } = finalizerSetup(context('EFORM', EFormStatus.CONFIRMED), 'DIG');
        await finalizer.onTicketUpdated(event({ closedReason: 'auto_unconfirmed' }));
        expect(documents.bump).toHaveBeenCalledTimes(1);
    });

    it('a dispute on the ticket sends an e-form back to IT', async () => {
        const { finalizer, manager, documents } = finalizerSetup(context('EFORM'));
        await finalizer.onTicketUpdated(event({ userId: 'req-1', reason: 'Masih tidak bisa' }));
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_ICT }));
        expect(documents.bump).not.toHaveBeenCalled();
    });

    it('a dispute on the ticket sends hardware back to the installation', async () => {
        const { finalizer, hardware } = finalizerSetup(context('HARDWARE'));
        await finalizer.onTicketUpdated(event({ userId: 'req-1', reason: 'Masih rusak' }));
        expect(hardware.confirmInstallationWith).toHaveBeenCalledWith(expect.anything(), 'hr-1', 'req-1', { kind: 'REPORT_ISSUE', comments: 'Masih rusak' }, false);
    });

    it('never throws into the emitter', async () => {
        const { finalizer, hardware } = finalizerSetup(context('HARDWARE'));
        hardware.autoConfirmInstallation.mockRejectedValueOnce(new Error('db down'));
        await expect(finalizer.onTicketUpdated(event({ closedReason: 'auto_unconfirmed' }))).resolves.toBeUndefined();
    });
});
