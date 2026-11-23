import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EFormApproval } from '../../eform-request/entities/eform-approval.entity';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { EFormSignature } from '../../eform-request/entities/eform-signature.entity';
import { TicketMessage } from '../../ticketing/entities/ticket-message.entity';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApproveDto } from '../dto/approve.dto';
import type { ReviewDto } from '../dto/review.dto';
import { RequestFlow } from '../entities/request-flow.entity';
import type { FlowContext } from './request-flow-reader';
import { RequestFlowReviewService, scanFileFilter, staleScanMessage, type FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const MGR: FlowActor = { userId: 'mgr-1', role: UserRole.MANAGER, siteId: 'site-1', fullName: 'Pak Manager' };
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';
const TID = '0b6d3c4e-1111-4222-8333-444455556677';
const TICKET = { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1' };

function context(over: Omit<Partial<FlowContext>, 'flow'> & { flow?: Partial<RequestFlow> } = {}, kind: 'HARDWARE' | 'EFORM' = 'EFORM'): FlowContext {
    const { flow, ...rest } = over;
    return {
        flow: { id: 'flow-1', ticketId: TID, kind, route: null, managerId: null, gmId: null, hardwareSource: null, documentVersion: 1, returnedReason: null, reviewedById: 'it-1', ...flow } as RequestFlow,
        ticket: TICKET as never,
        kind,
        requesterId: 'req-1',
        requesterName: 'Leony',
        number: 'F/ICT/04/0120',
        hardware: kind === 'HARDWARE' ? ({ id: 'hr-1', requestNumber: 'HR-2026-0042', status: 'SUBMITTED' } as never) : null,
        eform: kind === 'EFORM' ? ({ id: 'ef-1', formType: EFormType.VPN, status: EFormStatus.PENDING_REVIEW } as never) : null,
        signed: { manager: false, gm: false },
        phase: 'review',
        step: null,
        approverId: null,
        ...rest,
    };
}

function setup(ctx: FlowContext) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
        update: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        findOne: jest.fn(async () => null),
    };
    const dataSource = {
        transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
        manager: { findOne: jest.fn(async () => null), find: jest.fn(async () => []) },
    };
    const reader = { load: jest.fn(async () => ctx) };
    const hardware = {
        reviewWith: jest.fn(async () => ({})),
        approveAndStartWith: jest.fn(async () => ({})),
        rejectWith: jest.fn(async () => ({})),
        cancelWith: jest.fn(async () => ({ saved: {}, announce: jest.fn() })),
    };
    const documents = { bump: jest.fn(async () => 2), attachScan: jest.fn(async () => undefined) };
    const linked = { record: jest.fn(async () => undefined), recordWithin: jest.fn(async () => async () => undefined) };
    const notifier = { askApprover: jest.fn(async () => undefined), tellRequester: jest.fn(async () => undefined), tellUser: jest.fn(async () => undefined) };
    const emitter = { emit: jest.fn() };
    const userRepo = {
        exists: jest.fn(async () => true),
        findOne: jest.fn(async () => ({ id: 'mgr-1', fullName: 'Pak Manager' })),
    };
    const stepper = new RequestFlowStepper(hardware as never, documents as never, linked as never);
    const service = new RequestFlowReviewService(
        dataSource as never, reader as never, stepper, documents as never, notifier as never, hardware as never, emitter as never, userRepo as never,
    );
    return { service, manager, dataSource, hardware, documents, linked, notifier, emitter, userRepo };
}

const pdfFile = (): Express.Multer.File =>
    ({ originalname: 'scan.pdf', size: 1000, buffer: Buffer.from('%PDF-1.4 test') } as Express.Multer.File);

describe('RequestFlowReviewService.review', () => {
    it('review with route NONE and IT_STOCK sends hardware straight to installation with items arrived', async () => {
        const { service, hardware, notifier } = setup(context({}, 'HARDWARE'));
        const dto: ReviewDto = { route: 'NONE', hardwareSource: 'IT_STOCK' };

        await service.review(IT, TID, dto);

        expect(hardware.reviewWith).toHaveBeenCalledWith(expect.anything(), 'it-1', 'hr-1');
        expect(hardware.approveAndStartWith).toHaveBeenCalledWith(expect.anything(), 'it-1', 'hr-1', { fromStock: true });
        expect(notifier.askApprover).not.toHaveBeenCalled();
    });

    it('review MANAGER_GM on eform sets current approver to manager and requiresGm', async () => {
        const { service, manager, notifier } = setup(context());

        await service.review(IT, TID, { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1' });

        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, {
            status: EFormStatus.PENDING_MANAGER, currentApproverId: 'mgr-1', requiresGm: true, gmApproverId: 'gm-1',
        });
        expect(manager.save).toHaveBeenCalledWith(EFormApproval, expect.objectContaining({ approverId: 'mgr-1', role: 'MANAGER', sequence: 2, action: 'PENDING' }));
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'MANAGER', 'mgr-1');
    });

    it('bumps a GEN revision labelled with the route and source', async () => {
        const { service, documents } = setup(context({}, 'HARDWARE'));
        await service.review(IT, TID, { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'ANNUAL_BUDGET' });
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'GEN', 'Ditinjau IT: Atasan saja · Budget Tahunan', 'it-1', expect.anything());
    });

    it('cannot change MANAGER to NONE after the manager signed', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', returnedReason: 'ubah' }, signed: { manager: true, gm: false } });
        const { service } = setup(ctx);
        await expect(service.review(IT, TID, { route: 'NONE' })).rejects.toThrow(BadRequestException);
    });

    it('refuses staff outside IT', async () => {
        const { service } = setup(context());
        await expect(service.review({ ...IT, role: UserRole.USER }, TID, { route: 'NONE' })).rejects.toThrow(ForbiddenException);
    });

    it('requires a source for hardware and an approver for a route', async () => {
        await expect(setup(context({}, 'HARDWARE')).service.review(IT, TID, { route: 'NONE' })).rejects.toThrow('Pilih sumber barang');
        await expect(setup(context()).service.review(IT, TID, { route: 'MANAGER' })).rejects.toThrow('Pilih atasan penyetuju');
        await expect(setup(context()).service.review(IT, TID, { route: 'MANAGER', managerId: 'req-1' })).rejects.toThrow('Atasan tidak boleh pemohon sendiri');
    });
});

describe('RequestFlowReviewService.review: two different signers', () => {
    it('the manager and the GM cannot be the same person (one person would sign both steps)', async () => {
        await expect(setup(context()).service.review(IT, TID, { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'mgr-1' }))
            .rejects.toThrow('Atasan dan GM harus orang yang berbeda');
    });

    it('the same person is fine on a route with no GM step', async () => {
        await expect(setup(context()).service.review(IT, TID, { route: 'MANAGER', managerId: 'mgr-1', gmId: 'mgr-1' })).resolves.toBeDefined();
    });
});

describe('RequestFlowReviewService.decide', () => {
    const approving = () => context({
        flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1',
    });

    it('only the current approver can decide', async () => {
        const { service } = setup(approving());
        await expect(service.decide({ ...MGR, userId: 'someone-else' }, TID, { decision: 'APPROVE', signatureData: SIGNATURE }))
            .rejects.toThrow(ForbiddenException);
    });

    it('RETURN sends it back to review and keeps the manager signature', async () => {
        const ctx = approving();
        const { service, manager, notifier } = setup(ctx);

        await service.decide(MGR, TID, { decision: 'RETURN', note: 'Ganti barangnya' });

        expect(ctx.flow.returnedReason).toBe('Ganti barangnya');
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, { status: EFormStatus.PENDING_REVIEW, currentApproverId: null });
        expect(manager.delete).not.toHaveBeenCalledWith(EFormSignature, expect.anything());
        expect(manager.delete).toHaveBeenCalledTimes(1);
        expect(notifier.tellUser).toHaveBeenCalledWith(expect.anything(), 'it-1', expect.any(String), expect.stringContaining('Ganti barangnya'));
    });

    it('REJECT requires a note of at least 5 characters', async () => {
        const { service } = setup(approving());
        await expect(service.decide(MGR, TID, { decision: 'REJECT', note: 'no' })).rejects.toThrow(BadRequestException);

        const errors = await validate(plainToInstance(ApproveDto, { decision: 'REJECT', note: 'no' }));
        expect(errors.map((e) => e.property)).toEqual(['note']);
        expect(await validate(plainToInstance(ApproveDto, { decision: 'REJECT', note: 'Tidak sesuai' }))).toHaveLength(0);
    });

    it('APPROVE needs a PNG signature and advances to the GM', async () => {
        expect((await validate(plainToInstance(ApproveDto, { decision: 'APPROVE' }))).map((e) => e.property)).toEqual(['signatureData']);

        const { service, manager, documents, notifier } = setup(approving());
        await service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });

        expect(manager.save).toHaveBeenCalledWith(EFormSignature, expect.objectContaining({ signerRole: 'MANAGER', signerId: 'mgr-1' }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'DIG', expect.stringContaining('TTD Atasan'), 'mgr-1', expect.anything());
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' }));
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'GM', 'gm-1');
    });

    it('the last approval sends an e-form to ICT', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });
        const { service, manager } = setup(ctx);
        await service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_ICT, currentApproverId: null }));
    });

    it('the last approval of hardware from stock starts installation', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'IT_STOCK' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }, 'HARDWARE');
        const { service, hardware } = setup(ctx);
        await service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(hardware.approveAndStartWith).toHaveBeenCalledWith(expect.anything(), 'mgr-1', 'hr-1', { fromStock: true });
    });
});

describe('RequestFlowReviewService.paperSign', () => {
    const waiting = () => context({
        flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1', documentVersion: 3 }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1',
    });

    it('rejects a scan whose QR is not the latest version', async () => {
        const { service, documents } = setup(waiting());
        await expect(service.paperSign(IT, TID, pdfFile(), '221126-QC-0035/v1')).rejects.toThrow(
            new ConflictException('Dokumen versi lama (v1). Unduh versi terbaru (v3) lalu minta tanda tangan ulang.'),
        );
        expect(documents.bump).not.toHaveBeenCalled();
        expect(staleScanMessage('X/v1', 3)).toBe('Dokumen versi lama (v1). Unduh versi terbaru (v3) lalu minta tanda tangan ulang.');
    });

    it('accepts a scan for the latest version and advances to the GM step', async () => {
        const { service, manager, documents } = setup(waiting());
        const file = { ...pdfFile(), filename: '0b6d3c4e-1111-4222-8333-444455556666.pdf' };

        await expect(service.paperSign(IT, TID, file, '221126-QC-0035/v3')).resolves.toEqual({ version: 2 });

        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'IMP', expect.stringContaining('Impor scan TTD basah'), 'it-1', expect.anything());
        expect(documents.attachScan).toHaveBeenCalledWith('flow-1', 2, 'request-scans/0b6d3c4e-1111-4222-8333-444455556666.pdf', expect.anything());
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' }));
        expect(manager.update).toHaveBeenCalledWith(EFormApproval, expect.anything(), expect.objectContaining({ action: 'APPROVED', notes: 'Tanda tangan kertas' }));
    });

    it('rejects a file that is not a real PDF/JPG/PNG', async () => {
        const { service } = setup(waiting());
        const fake = { originalname: 'scan.pdf', size: 10, buffer: Buffer.from('MZ not a pdf') } as Express.Multer.File;
        await expect(service.paperSign(IT, TID, fake, '221126-QC-0035/v3')).rejects.toThrow(BadRequestException);
        await expect(service.paperSign(IT, TID, undefined, 'x')).rejects.toThrow(BadRequestException);
    });
});

describe('RequestFlowReviewService.remind', () => {
    const waiting = () => context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });

    it('remind is limited to once per hour', async () => {
        const { service, manager, notifier } = setup(waiting());

        await service.remind(IT, TID);
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'MANAGER', 'mgr-1', true);
        // The marker is written in the same transaction as the decision to notify.
        expect(manager.save).toHaveBeenCalledWith(TicketMessage, expect.objectContaining({ isSystemMessage: true, content: expect.stringContaining('System: Pengingat') }));

        manager.findOne.mockResolvedValueOnce({ id: 'msg-1' } as never);
        await expect(service.remind(IT, TID)).rejects.toThrow(new ConflictException('Pengingat sudah dikirim kurang dari 1 jam lalu'));
        expect(notifier.askApprover).toHaveBeenCalledTimes(1);
    });
});

describe('re-review after a return', () => {
    it('repeating the same route after the manager signed and the GM returned it goes back to the GM step', async () => {
        const ctx = context({
            flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1', returnedReason: 'Ganti barang' },
            signed: { manager: true, gm: false },
        });
        const { service, manager, notifier } = setup(ctx);

        await service.review(IT, TID, { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1' });

        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' }));
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'GM', 'gm-1');
    });

    it('refuses changing the manager who already signed (or the GM who did)', async () => {
        const signedManager = context({ flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1', returnedReason: 'x' }, signed: { manager: true, gm: false } });
        await expect(setup(signedManager).service.review(IT, TID, { route: 'MANAGER_GM', managerId: 'mgr-2', gmId: 'gm-1' }))
            .rejects.toThrow('Atasan sudah menandatangani');
        const signedGm = context({ flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1', returnedReason: 'x' }, signed: { manager: true, gm: true } });
        await expect(setup(signedGm).service.review(IT, TID, { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-2' }))
            .rejects.toThrow('GM sudah menandatangani');
    });
});

describe('processor roles', () => {
    it('AGENT can review; AGENT_ORACLE cannot', async () => {
        await expect(setup(context()).service.review({ ...IT, role: UserRole.AGENT }, TID, { route: 'NONE' })).resolves.toBeDefined();
        await expect(setup(context()).service.review({ ...IT, role: UserRole.AGENT_ORACLE }, TID, { route: 'NONE' })).rejects.toThrow(ForbiddenException);
    });

    it('rejects an id that is not a UUID with 400', async () => {
        await expect(setup(context()).service.review(IT, 'not-a-uuid', { route: 'NONE' })).rejects.toThrow(BadRequestException);
        await expect(setup(context()).service.paperSign(IT, 'not-a-uuid', pdfFile(), 'x/v1')).rejects.toThrow('ID tiket tidak valid');
    });
});

describe('scan storage', () => {
    const SCAN_NAME = '0b6d3c4e-1111-4222-8333-4444555566ab';
    const scanDir = join(process.cwd(), 'uploads', 'request-scans');
    const stored = async (ext: string) => {
        await fs.mkdir(scanDir, { recursive: true });
        const path = join(scanDir, `${SCAN_NAME}${ext}`);
        await fs.writeFile(path, 'x');
        return path;
    };
    const exists = (path: string) => fs.access(path).then(() => true, () => false);

    it('the multer filter refuses everything but pdf/jpg/jpeg/png, case-insensitively', () => {
        const accepts = (name: string) => { let ok = false; scanFileFilter(null, { originalname: name }, (_e, accept) => { ok = accept; }); return ok; };
        expect(['a.PDF', 'a.jpg', 'a.JPEG', 'a.Png'].map(accepts)).toEqual([true, true, true, true]);
        expect(['x.exe', 'x.pdf.exe', 'x', 'x.svg'].map(accepts)).toEqual([false, false, false, false]);
    });

    it('a refused upload with a disallowed extension leaves no file behind', async () => {
        const path = await stored('.exe');
        const { service } = setup(context());
        const file = { originalname: 'x.exe', size: 5, buffer: Buffer.from('MZ'), filename: `${SCAN_NAME}.exe`, path } as Express.Multer.File;
        await expect(service.paperSign(IT, TID, file, 'x/v1')).rejects.toThrow(BadRequestException);
        expect(await exists(path)).toBe(false);
    });

    it('a valid file with a stale QR is a 409 and leaves no file behind', async () => {
        const path = await stored('.pdf');
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', documentVersion: 3 }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });
        const { service } = setup(ctx);
        const file = { ...pdfFile(), filename: `${SCAN_NAME}.pdf`, path } as Express.Multer.File;
        await expect(service.paperSign(IT, TID, file, `${TICKET.ticketNumber}/v1`)).rejects.toThrow(ConflictException);
        expect(await exists(path)).toBe(false);
    });

    it('an unparsable QR gets its own message', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });
        await expect(setup(ctx).service.paperSign(IT, TID, pdfFile(), 'hello')).rejects.toThrow('QR tidak valid. Pastikan Anda mengunggah dokumen hasil unduhan iDesk.');
    });
});

describe('ticket SLA hold follows the flow phase', () => {
    const lastTarget = (linked: { record: jest.Mock }) => (linked.record.mock.calls.at(-1)![0] as { target?: TicketStatus }).target;

    it('review with an approval route holds the SLA (WAITING_VENDOR)', async () => {
        const { service, linked } = setup(context());
        await service.review(IT, TID, { route: 'MANAGER', managerId: 'mgr-1' });
        expect(lastTarget(linked)).toBe(TicketStatus.WAITING_VENDOR);
    });

    it('review with route NONE keeps holding when hardware goes to procurement, and runs when it is from stock or an e-form', async () => {
        const buy = setup(context({}, 'HARDWARE'));
        await buy.service.review(IT, TID, { route: 'NONE', hardwareSource: 'NON_BUDGET' });
        expect(lastTarget(buy.linked)).toBe(TicketStatus.WAITING_VENDOR);

        const stock = setup(context({}, 'HARDWARE'));
        await stock.service.review(IT, TID, { route: 'NONE', hardwareSource: 'IT_STOCK' });
        expect(lastTarget(stock.linked)).toBe(TicketStatus.IN_PROGRESS);

        const eform = setup(context());
        await eform.service.review(IT, TID, { route: 'NONE' });
        expect(lastTarget(eform.linked)).toBe(TicketStatus.IN_PROGRESS);
    });

    it('the last signature of purchased hardware does not release the SLA (procurement is next), an e-form does', async () => {
        const hw = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'NON_BUDGET' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }, 'HARDWARE');
        const buy = setup(hw);
        await buy.service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(lastTarget(buy.linked)).toBe(TicketStatus.WAITING_VENDOR);

        const ef = setup(context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }));
        await ef.service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(lastTarget(ef.linked)).toBe(TicketStatus.IN_PROGRESS);
    });

    it('the last signature of hardware from IT stock resumes the SLA (straight to installation)', async () => {
        const stock = setup(context({ flow: { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'IT_STOCK' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }, 'HARDWARE'));
        await stock.service.decide(MGR, TID, { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(lastTarget(stock.linked)).toBe(TicketStatus.IN_PROGRESS);
    });

    it('returning to IT resumes the SLA', async () => {
        const { service, linked } = setup(context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }));
        await service.decide(MGR, TID, { decision: 'RETURN', note: 'Ganti barangnya' });
        expect(lastTarget(linked)).toBe(TicketStatus.IN_PROGRESS);
    });
});

describe('RequestFlowReviewService.rejectByIt', () => {
    it('IT refuses a request in review with a reason; hardware is rejected and the final document locks', async () => {
        const { service, hardware, documents, emitter } = setup(context({}, 'HARDWARE'));
        await service.rejectByIt(IT, TID, 'Barang tidak sesuai kebijakan');
        expect(hardware.rejectWith).toHaveBeenCalledWith(expect.anything(), 'it-1', 'hr-1', { reason: 'Barang tidak sesuai kebijakan' });
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', expect.stringContaining('Ditolak'), 'it-1', expect.anything());
        expect(emitter.emit).toHaveBeenCalled();
    });

    it('an e-form in review becomes REJECTED', async () => {
        const { service, manager } = setup(context({}, 'EFORM'));
        await service.rejectByIt(IT, TID, 'Akses tidak diperlukan');
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.REJECTED, rejectionReason: 'Akses tidak diperlukan' }));
    });

    it('needs a reason of 5+ characters, IT, and a request that is still in review', async () => {
        await expect(setup(context({}, 'EFORM')).service.rejectByIt(IT, TID, 'no')).rejects.toBeInstanceOf(BadRequestException);
        await expect(setup(context({}, 'EFORM')).service.rejectByIt({ ...IT, role: UserRole.USER }, TID, 'Alasan jelas')).rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context({ phase: 'approval' }, 'EFORM')).service.rejectByIt(IT, TID, 'Alasan jelas')).rejects.toBeInstanceOf(ConflictException);
    });
});

describe('RequestFlowReviewService.cancel', () => {
    const REQ: FlowActor = { userId: 'req-1', role: UserRole.USER, siteId: 'site-9', fullName: 'Leony' };

    it('the requester withdraws a request that is still in review or waiting for a signature', async () => {
        for (const phase of ['review', 'approval'] as const) {
            const { service, hardware, documents, linked } = setup(context({ phase }, 'HARDWARE'));
            await service.cancel(REQ, TID);
            expect(hardware.cancelWith).toHaveBeenCalledWith(expect.anything(), { id: 'req-1', role: 'USER' }, 'hr-1', { allowed: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW] });
            expect(documents.bump).toHaveBeenCalledWith('flow-1', 'FIN', expect.stringContaining('Dibatalkan'), 'req-1', expect.anything());
            expect(linked.recordWithin).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ target: 'CANCELLED' }));
        }
    });

    it('an e-form is set to CANCELLED', async () => {
        const { service, manager } = setup(context({ phase: 'review' }, 'EFORM'));
        await service.cancel(REQ, TID);
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.CANCELLED }));
    });

    it('the requester cannot withdraw once IT is processing it; IT still can before the install', async () => {
        await expect(setup(context({ phase: 'other' }, 'HARDWARE')).service.cancel(REQ, TID)).rejects.toBeInstanceOf(ConflictException);
        const { service, hardware } = setup(context({ phase: 'other' }, 'HARDWARE'));
        await service.cancel(IT, TID);
        expect(hardware.cancelWith).toHaveBeenCalledWith(expect.anything(), { id: 'it-1', role: 'ICT_STAFF' }, 'hr-1', { allowed: expect.arrayContaining([RequestStatus.PROCUREMENT, RequestStatus.INSTALLATION]) });
    });

    it.each([EFormStatus.CONFIRMED, EFormStatus.REJECTED, EFormStatus.CANCELLED])('an e-form that is already %s cannot be cancelled again (no overwritten status, no second FIN revision)', async (status) => {
        const base = context({ phase: 'other' }, 'EFORM');
        const { service, manager, documents } = setup({ ...base, eform: { ...base.eform!, status } as never });
        await expect(service.cancel(IT, TID)).rejects.toBeInstanceOf(ConflictException);
        expect(manager.update).not.toHaveBeenCalled();
        expect(documents.bump).not.toHaveBeenCalled();
    });

    it('someone who is not the requester or IT is refused', async () => {
        await expect(setup(context({ phase: 'review' }, 'EFORM')).service.cancel({ ...REQ, userId: 'other' }, TID)).rejects.toBeInstanceOf(ForbiddenException);
    });
});
