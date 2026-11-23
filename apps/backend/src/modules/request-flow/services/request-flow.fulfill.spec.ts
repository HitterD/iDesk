import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EFormCredential } from '../../eform-request/entities/eform-credential.entity';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { EFormSignature } from '../../eform-request/entities/eform-signature.entity';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import type { FulfillDto } from '../dto/fulfill.dto';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFulfillFlowService } from './request-fulfill-flow.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';
const SIGNATURE = 'data:image/png;base64,AAAA';

function context(over: { status?: EFormStatus; formType?: EFormType; requesterId?: string; hardware?: boolean } = {}): FlowContext {
    const hardware = over.hardware ? ({ id: 'hr-1', requestNumber: 'HR-1', status: 'INSTALLATION' } as never) : null;
    return {
        flow: { id: 'flow-1', ticketId: TID, kind: over.hardware ? 'HARDWARE' : 'EFORM', route: 'MANAGER', returnedReason: null, reviewedById: 'it-9', documentVersion: 3 } as never,
        ticket: { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1', status: TicketStatus.IN_PROGRESS } as never,
        kind: over.hardware ? 'HARDWARE' : 'EFORM', requesterId: over.requesterId ?? 'req-1', requesterName: 'Leony', number: 'F/ICT/04/0120',
        hardware,
        eform: over.hardware ? null : ({ id: 'ef-1', formType: over.formType ?? EFormType.VPN, status: over.status ?? EFormStatus.PENDING_ICT, formData: { alasan: 'WFH' } } as never),
        signed: { manager: true, gm: false }, phase: 'other', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext, credentialRow: Record<string, unknown> | null = null) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
        update: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        findOne: jest.fn(async () => credentialRow),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)), manager };
    const reader = { load: jest.fn(async () => ctx) };
    const credentials = {
        encrypt: jest.fn((v: string) => ({ ciphertext: `enc(${v})`, iv: `iv(${v})`, authTag: `tag(${v})` })),
        decrypt: jest.fn((c: string) => c.replace(/^enc\(|\)$/g, '')),
    };
    const documents = { bump: jest.fn(async () => 4) };
    const stepper = { tell: jest.fn(async () => undefined), tellWithin: jest.fn(async () => async () => undefined) };
    const notifier = { tellRequester: jest.fn(async () => undefined) };
    const audit = { logAsync: jest.fn() };
    const service = new RequestFulfillFlowService(dataSource as never, reader as never, credentials as never, documents as never, stepper as never, notifier as never, audit as never);
    return { service, manager, credentials, documents, stepper, notifier, audit };
}

const dto = (over: Partial<FulfillDto> = {}): FulfillDto => ({ mode: 'CREDENTIALS', username: 'leony.r', password: 'S3cret!x', signatureData: SIGNATURE, ...over }) as FulfillDto;

describe('RequestFulfillFlowService.fulfill', () => {
    it('fulfil with credentials moves to awaiting confirmation and resolves the ticket', async () => {
        const { service, manager, credentials, documents, stepper, notifier } = setup(context());

        const result = await service.fulfill(IT, TID, dto({ server: 'vpn.example.com', note: 'Ganti password saat login pertama' }));

        expect(result).toEqual({ status: EFormStatus.AWAITING_CONFIRMATION, mode: 'CREDENTIALS' });
        expect(credentials.encrypt).toHaveBeenCalledWith('leony.r');
        expect(credentials.encrypt).toHaveBeenCalledWith('S3cret!x');
        expect(manager.save).toHaveBeenCalledWith(EFormCredential, expect.objectContaining({
            eformRequestId: 'ef-1', encryptedUsername: 'enc(leony.r)', encryptedPassword: 'enc(S3cret!x)', vpnServer: 'vpn.example.com',
            notes: 'Ganti password saat login pertama', provisionedById: 'it-1',
        }));
        expect(manager.save).toHaveBeenCalledWith(EFormSignature, expect.objectContaining({
            eformRequestId: 'ef-1', signerId: 'it-1', signerName: 'RM Bagastyo', signatureData: SIGNATURE, signerRole: 'ICT',
        }));
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({
            status: EFormStatus.AWAITING_CONFIRMATION,
            formData: expect.objectContaining({ alasan: 'WFH', fulfilledWithoutCredentials: false }),
        }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'DIG', 'TTD IT — akses diberikan', 'it-1', manager);
        expect(stepper.tellWithin).toHaveBeenCalledWith(manager, expect.anything(), expect.objectContaining({
            actorId: 'it-1', phase: 'FULFILLED', target: TicketStatus.RESOLVED, text: 'Akses diberikan — Leony diminta mencoba',
        }));
        expect(notifier.tellRequester).toHaveBeenCalledTimes(1);
    });

    it('rejects fulfillment and sends no notice when the ticket state cannot be saved', async () => {
        const { service, stepper, notifier } = setup(context());
        stepper.tellWithin.mockRejectedValueOnce(new Error('ticket save failed'));

        await expect(service.fulfill(IT, TID, dto())).rejects.toThrow('ticket save failed');
        expect(notifier.tellRequester).not.toHaveBeenCalled();
    });

    it('replaces the credentials and the IT signature of an earlier attempt', async () => {
        const { service, manager } = setup(context());
        await service.fulfill(IT, TID, dto());
        expect(manager.delete).toHaveBeenCalledWith(EFormCredential, { eformRequestId: 'ef-1' });
        expect(manager.delete).toHaveBeenCalledWith(EFormSignature, { eformRequestId: 'ef-1', signerRole: 'ICT' });
    });

    it('an Email request ignores the server', async () => {
        const { service, manager } = setup(context({ formType: EFormType.EMAIL }));
        await service.fulfill(IT, TID, dto({ server: 'mail.example.com' }));
        expect(manager.save).toHaveBeenCalledWith(EFormCredential, expect.objectContaining({ vpnServer: '' }));
    });

    it('credentials need both a username and a password', async () => {
        const { service, manager, stepper } = setup(context());
        await expect(service.fulfill(IT, TID, dto({ username: '  ' }))).rejects.toThrow(new BadRequestException('Username dan password wajib diisi'));
        await expect(service.fulfill(IT, TID, dto({ password: undefined }))).rejects.toThrow(new BadRequestException('Username dan password wajib diisi'));
        expect(manager.save).not.toHaveBeenCalled();
        expect(stepper.tellWithin).not.toHaveBeenCalled();
    });

    it('fulfil without credentials needs a note', async () => {
        const { service, manager, credentials, stepper } = setup(context({ formType: EFormType.SYNOLOGY_NAS }));
        await expect(service.fulfill(IT, TID, { mode: 'NO_CREDENTIALS', signatureData: SIGNATURE } as FulfillDto))
            .rejects.toThrow(new BadRequestException('Catatan wajib diisi (minimal 3 karakter)'));
        await expect(service.fulfill(IT, TID, { mode: 'NO_CREDENTIALS', note: 'ok', signatureData: SIGNATURE } as FulfillDto))
            .rejects.toBeInstanceOf(BadRequestException);
        expect(stepper.tellWithin).not.toHaveBeenCalled();

        await service.fulfill(IT, TID, { mode: 'NO_CREDENTIALS', note: 'Folder Finance/Shared ditambahkan', accountName: 'leony.r', signatureData: SIGNATURE } as FulfillDto);

        expect(credentials.encrypt).not.toHaveBeenCalled();
        expect(manager.save).not.toHaveBeenCalledWith(EFormCredential, expect.anything());
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({
            status: EFormStatus.AWAITING_CONFIRMATION,
            formData: expect.objectContaining({ fulfillmentNotes: 'Folder Finance/Shared ditambahkan', fulfilledAccountName: 'leony.r', fulfilledWithoutCredentials: true }),
        }));
    });

    it('never puts a secret or the signature into the result', async () => {
        const { service } = setup(context());
        expect(JSON.stringify(await service.fulfill(IT, TID, dto()))).not.toMatch(/S3cret|base64/);
    });

    it('only a processor may fulfil, on their own site, an e-form waiting for IT', async () => {
        await expect(setup(context()).service.fulfill({ ...IT, role: UserRole.USER }, TID, dto())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context()).service.fulfill({ ...IT, role: UserRole.MANAGER }, TID, dto())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context()).service.fulfill({ ...IT, siteId: 'site-2' }, TID, dto())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context({ status: EFormStatus.PENDING_MANAGER })).service.fulfill(IT, TID, dto())).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context({ hardware: true })).service.fulfill(IT, TID, dto())).rejects.toBeInstanceOf(ConflictException);
        await expect(setup(context()).service.fulfill(IT, 'nope', dto())).rejects.toBeInstanceOf(BadRequestException);
    });
});

describe('RequestFulfillFlowService.credentials', () => {
    const ROW = { encryptedUsername: 'enc(leony.r)', iv: 'i', authTag: 't', encryptedPassword: 'enc(S3cret!x)', passwordIv: 'pi', passwordAuthTag: 'pt', vpnServer: 'vpn.example.com', notes: 'Ganti password', provisionedAt: new Date('2026-11-23T03:00:00Z') };
    const REQUESTER: FlowActor = { userId: 'req-1', role: UserRole.USER, siteId: 'site-9', fullName: 'Leony' };

    it('the requester reads them, wherever IT handled the request', async () => {
        const { service } = setup(context(), ROW);
        await expect(service.credentials(REQUESTER, TID)).resolves.toEqual({
            username: 'leony.r', password: 'S3cret!x', server: 'vpn.example.com', note: 'Ganti password', provisionedAt: ROW.provisionedAt,
        });
    });

    it('ICT of the same site reads them (ADMIN, AGENT_ADMIN, AGENT_OPERATIONAL_SUPPORT)', async () => {
        for (const role of [UserRole.ADMIN, UserRole.AGENT_ADMIN, UserRole.AGENT_OPERATIONAL_SUPPORT]) {
            const { service } = setup(context(), ROW);
            await expect(service.credentials({ ...IT, role, siteId: role === UserRole.ADMIN ? null : 'site-1' }, TID)).resolves.toMatchObject({ username: 'leony.r' });
        }
    });

    it('a MANAGER who is not the requester cannot read credentials', async () => {
        const { service, credentials, audit } = setup(context(), ROW);
        await expect(service.credentials({ ...IT, userId: 'mgr-1', role: UserRole.MANAGER }, TID)).rejects.toBeInstanceOf(ForbiddenException);
        expect(credentials.decrypt).not.toHaveBeenCalled();
        expect(audit.logAsync).not.toHaveBeenCalled();
    });

    it('an AGENT, another requester and ICT of another site are refused before any decryption', async () => {
        for (const actor of [
            { ...IT, role: UserRole.AGENT },
            { ...REQUESTER, userId: 'someone-else' },
            { ...IT, siteId: 'site-2' },
        ]) {
            const { service, credentials } = setup(context(), ROW);
            await expect(service.credentials(actor, TID)).rejects.toBeInstanceOf(ForbiddenException);
            expect(credentials.decrypt).not.toHaveBeenCalled();
        }
    });

    it('credential reads are logged, without the secrets', async () => {
        const { service, audit } = setup(context(), ROW);
        await service.credentials(REQUESTER, TID);
        expect(audit.logAsync).toHaveBeenCalledTimes(1);
        const row = audit.logAsync.mock.calls[0][0];
        expect(row).toMatchObject({ userId: 'req-1', action: AuditAction.CREDENTIALS_VIEWED, entityType: 'EFormRequest', entityId: 'ef-1' });
        expect(JSON.stringify(row)).not.toMatch(/S3cret|leony\.r|enc\(/);
    });

    it('says so when no credentials were issued, and refuses a hardware ticket', async () => {
        await expect(setup(context(), null).service.credentials(REQUESTER, TID)).rejects.toBeInstanceOf(NotFoundException);
        await expect(setup(context({ hardware: true }), ROW).service.credentials(REQUESTER, TID)).rejects.toBeInstanceOf(ConflictException);
    });
});
