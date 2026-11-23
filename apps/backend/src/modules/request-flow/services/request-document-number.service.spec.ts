import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestDocumentNumberService } from './request-document-number.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';

function context(kind: 'EFORM' | 'HARDWARE', status?: string): FlowContext {
    const hardware = kind === 'HARDWARE';
    return {
        flow: { id: 'flow-1', ticketId: TID, kind } as never,
        ticket: { id: TID, siteId: 'site-1', status: TicketStatus.IN_PROGRESS } as never,
        kind, requesterId: 'req-1', requesterName: 'Leony', number: hardware ? 'HR-2026-0042' : 'F/ICT/04/0120',
        hardware: hardware ? ({ id: 'hr-1', requestNumber: 'HR-2026-0042', status: status ?? RequestStatus.PROCUREMENT } as never) : null,
        eform: hardware ? null : ({ id: 'ef-1', formType: EFormType.VPN, status: status ?? EFormStatus.PENDING_ICT, documentNumber: 'F/ICT/04/0120' } as never),
        signed: { manager: false, gm: false }, phase: 'other', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext, taken = false) {
    const manager = {
        exists: jest.fn(async () => taken),
        update: jest.fn(async () => undefined),
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const reader = { load: jest.fn(async () => ctx) };
    const audit = { logAsync: jest.fn() };
    const documents = { bump: jest.fn(async () => 4) };
    const service = new RequestDocumentNumberService(dataSource as never, reader as never, audit as never, documents as never);
    return { service, manager, audit, documents };
}

describe('RequestDocumentNumberService.update', () => {
    it('a new number advances the document version, in the same transaction; the same number does not', async () => {
        const { service, manager, documents } = setup(context('EFORM'));
        await service.update(IT, TID, 'F/ICT/04/0999');
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'DIG', 'Nomor dokumen diubah — F/ICT/04/0999', 'it-1', manager);

        documents.bump.mockClear();
        await service.update(IT, TID, 'F/ICT/04/0120');
        expect(documents.bump).not.toHaveBeenCalled();
    });

    it('changes an e-form number and audits it', async () => {
        const { service, manager, audit } = setup(context('EFORM'));
        await expect(service.update(IT, TID, 'F/ICT/04/0999')).resolves.toEqual({ documentNumber: 'F/ICT/04/0999' });
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, { documentNumber: 'F/ICT/04/0999' });
        expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'it-1', action: AuditAction.EFORM_DOCUMENT_NUMBER_UPDATE, entityId: 'ef-1',
            oldValue: { documentNumber: 'F/ICT/04/0120' }, newValue: { documentNumber: 'F/ICT/04/0999' },
        }));
    });

    it('changes a hardware number (requestNumber) and records an activity row', async () => {
        const { service, manager } = setup(context('HARDWARE'));
        await expect(service.update(IT, TID, ' HR/2026/0042-A ')).resolves.toEqual({ documentNumber: 'HR/2026/0042-A' });
        expect(manager.update).toHaveBeenCalledWith(HardwareRequest, { id: 'hr-1' }, { requestNumber: 'HR/2026/0042-A' });
        expect(manager.save).toHaveBeenCalledWith(HardwareRequestActivity, expect.objectContaining({
            requestId: 'hr-1', actorId: 'it-1', metadata: { change: 'DOCUMENT_NUMBER', from: 'HR-2026-0042', to: 'HR/2026/0042-A' },
        }));
    });

    it('document number must be unique', async () => {
        const e = setup(context('EFORM'), true);
        await expect(e.service.update(IT, TID, 'F/ICT/04/0001')).rejects.toBeInstanceOf(ConflictException);
        expect(e.manager.update).not.toHaveBeenCalled();
        const h = setup(context('HARDWARE'), true);
        await expect(h.service.update(IT, TID, 'HR-2026-0001')).rejects.toBeInstanceOf(ConflictException);
    });

    it('a unique-index race answers like the check', async () => {
        const { service, manager } = setup(context('HARDWARE'));
        manager.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
        await expect(service.update(IT, TID, 'HR-2026-0001')).rejects.toBeInstanceOf(ConflictException);
    });

    it.each(['', '   ', 'a b', 'x'.repeat(51), '../x', '-start'])('refuses the invalid number %p', async (value) => {
        await expect(setup(context('EFORM')).service.update(IT, TID, value)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a hardware number respects the 32 character column', async () => {
        await expect(setup(context('HARDWARE')).service.update(IT, TID, 'H'.repeat(33))).rejects.toBeInstanceOf(BadRequestException);
        await expect(setup(context('HARDWARE')).service.update(IT, TID, 'H'.repeat(32))).resolves.toBeDefined();
    });

    it('is refused for a finished, rejected or cancelled request', async () => {
        await expect(setup(context('EFORM', EFormStatus.CONFIRMED)).service.update(IT, TID, 'F/ICT/04/0999')).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context('EFORM', EFormStatus.REJECTED)).service.update(IT, TID, 'F/ICT/04/0999')).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context('HARDWARE', RequestStatus.COMPLETED)).service.update(IT, TID, 'HR-9')).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context('HARDWARE', RequestStatus.CANCELLED)).service.update(IT, TID, 'HR-9')).rejects.toBeInstanceOf(ConflictException);
    });

    it('only a processor of the ticket site may edit', async () => {
        await expect(setup(context('EFORM')).service.update({ ...IT, role: UserRole.USER }, TID, 'F/1')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context('EFORM')).service.update({ ...IT, siteId: 'site-2' }, TID, 'F/1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('an unchanged number is accepted without a write', async () => {
        const { service, manager } = setup(context('EFORM'));
        await expect(service.update(IT, TID, 'F/ICT/04/0120')).resolves.toEqual({ documentNumber: 'F/ICT/04/0120' });
        expect(manager.update).not.toHaveBeenCalled();
    });
});
