import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EFormApproval } from '../../eform-request/entities/eform-approval.entity';
import { EFormRequest, EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { EFormSignature } from '../../eform-request/entities/eform-signature.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { ApproveDto } from '../dto/approve.dto';
import type { ReviewDto } from '../dto/review.dto';
import { RequestFlow } from '../entities/request-flow.entity';
import type { FlowContext } from './request-flow-reader';
import { RequestFlowReviewService, staleScanMessage, type FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const MGR: FlowActor = { userId: 'mgr-1', role: UserRole.MANAGER, siteId: 'site-1', fullName: 'Pak Manager' };
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';
const TICKET = { id: 't-1', ticketNumber: '221126-QC-0035', siteId: 'site-1' };

function context(over: Omit<Partial<FlowContext>, 'flow'> & { flow?: Partial<RequestFlow> } = {}, kind: 'HARDWARE' | 'EFORM' = 'EFORM'): FlowContext {
    const { flow, ...rest } = over;
    return {
        flow: { id: 'flow-1', ticketId: 't-1', kind, route: null, managerId: null, gmId: null, hardwareSource: null, documentVersion: 1, returnedReason: null, reviewedById: 'it-1', ...flow } as RequestFlow,
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
    };
    const documents = { bump: jest.fn(async () => 2), attachScan: jest.fn(async () => undefined) };
    const linked = { record: jest.fn(async () => undefined) };
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

        await service.review(IT, 't-1', dto);

        expect(hardware.reviewWith).toHaveBeenCalledWith(expect.anything(), 'it-1', 'hr-1');
        expect(hardware.approveAndStartWith).toHaveBeenCalledWith(expect.anything(), 'it-1', 'hr-1', { fromStock: true });
        expect(notifier.askApprover).not.toHaveBeenCalled();
    });

    it('review MANAGER_GM on eform sets current approver to manager and requiresGm', async () => {
        const { service, manager, notifier } = setup(context());

        await service.review(IT, 't-1', { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1' });

        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, {
            status: EFormStatus.PENDING_MANAGER, currentApproverId: 'mgr-1', requiresGm: true, gmApproverId: 'gm-1',
        });
        expect(manager.save).toHaveBeenCalledWith(EFormApproval, expect.objectContaining({ approverId: 'mgr-1', role: 'MANAGER', sequence: 2, action: 'PENDING' }));
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'MANAGER', 'mgr-1');
    });

    it('bumps a GEN revision labelled with the route and source', async () => {
        const { service, documents } = setup(context({}, 'HARDWARE'));
        await service.review(IT, 't-1', { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'ANNUAL_BUDGET' });
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'GEN', 'Ditinjau IT: Atasan saja · Budget Tahunan', 'it-1', expect.anything());
    });

    it('cannot change MANAGER to NONE after the manager signed', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', returnedReason: 'ubah' }, signed: { manager: true, gm: false } });
        const { service } = setup(ctx);
        await expect(service.review(IT, 't-1', { route: 'NONE' })).rejects.toThrow(BadRequestException);
    });

    it('refuses staff outside IT', async () => {
        const { service } = setup(context());
        await expect(service.review({ ...IT, role: UserRole.USER }, 't-1', { route: 'NONE' })).rejects.toThrow(ForbiddenException);
    });

    it('requires a source for hardware and an approver for a route', async () => {
        await expect(setup(context({}, 'HARDWARE')).service.review(IT, 't-1', { route: 'NONE' })).rejects.toThrow('Pilih sumber barang');
        await expect(setup(context()).service.review(IT, 't-1', { route: 'MANAGER' })).rejects.toThrow('Pilih atasan penyetuju');
        await expect(setup(context()).service.review(IT, 't-1', { route: 'MANAGER', managerId: 'req-1' })).rejects.toThrow('Atasan tidak boleh pemohon sendiri');
    });
});

describe('RequestFlowReviewService.decide', () => {
    const approving = () => context({
        flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1',
    });

    it('only the current approver can decide', async () => {
        const { service } = setup(approving());
        await expect(service.decide({ ...MGR, userId: 'someone-else' }, 't-1', { decision: 'APPROVE', signatureData: SIGNATURE }))
            .rejects.toThrow(ForbiddenException);
    });

    it('RETURN sends it back to review and keeps the manager signature', async () => {
        const ctx = approving();
        const { service, manager, notifier } = setup(ctx);

        await service.decide(MGR, 't-1', { decision: 'RETURN', note: 'Ganti barangnya' });

        expect(ctx.flow.returnedReason).toBe('Ganti barangnya');
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, { status: EFormStatus.PENDING_REVIEW, currentApproverId: null });
        expect(manager.delete).not.toHaveBeenCalledWith(EFormSignature, expect.anything());
        expect(manager.delete).toHaveBeenCalledTimes(1);
        expect(notifier.tellUser).toHaveBeenCalledWith(expect.anything(), 'it-1', expect.any(String), expect.stringContaining('Ganti barangnya'));
    });

    it('REJECT requires a note of at least 5 characters', async () => {
        const { service } = setup(approving());
        await expect(service.decide(MGR, 't-1', { decision: 'REJECT', note: 'no' })).rejects.toThrow(BadRequestException);

        const errors = await validate(plainToInstance(ApproveDto, { decision: 'REJECT', note: 'no' }));
        expect(errors.map((e) => e.property)).toEqual(['note']);
        expect(await validate(plainToInstance(ApproveDto, { decision: 'REJECT', note: 'Tidak sesuai' }))).toHaveLength(0);
    });

    it('APPROVE needs a PNG signature and advances to the GM', async () => {
        expect((await validate(plainToInstance(ApproveDto, { decision: 'APPROVE' }))).map((e) => e.property)).toEqual(['signatureData']);

        const { service, manager, documents, notifier } = setup(approving());
        await service.decide(MGR, 't-1', { decision: 'APPROVE', signatureData: SIGNATURE });

        expect(manager.save).toHaveBeenCalledWith(EFormSignature, expect.objectContaining({ signerRole: 'MANAGER', signerId: 'mgr-1' }));
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'DIG', expect.stringContaining('TTD Atasan'), 'mgr-1', expect.anything());
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' }));
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'GM', 'gm-1');
    });

    it('the last approval sends an e-form to ICT', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });
        const { service, manager } = setup(ctx);
        await service.decide(MGR, 't-1', { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_ICT, currentApproverId: null }));
    });

    it('the last approval of hardware from stock starts installation', async () => {
        const ctx = context({ flow: { route: 'MANAGER', managerId: 'mgr-1', hardwareSource: 'IT_STOCK' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' }, 'HARDWARE');
        const { service, hardware } = setup(ctx);
        await service.decide(MGR, 't-1', { decision: 'APPROVE', signatureData: SIGNATURE });
        expect(hardware.approveAndStartWith).toHaveBeenCalledWith(expect.anything(), 'mgr-1', 'hr-1', { fromStock: true });
    });
});

describe('RequestFlowReviewService.paperSign', () => {
    const waiting = () => context({
        flow: { route: 'MANAGER_GM', managerId: 'mgr-1', gmId: 'gm-1', documentVersion: 3 }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1',
    });

    it('rejects a scan whose QR is not the latest version', async () => {
        const { service, documents } = setup(waiting());
        await expect(service.paperSign(IT, 't-1', pdfFile(), '221126-QC-0035/v1')).rejects.toThrow(
            new ConflictException('Dokumen versi lama (v1). Unduh versi terbaru (v3) lalu minta tanda tangan ulang.'),
        );
        expect(documents.bump).not.toHaveBeenCalled();
        expect(staleScanMessage('X/v1', 3)).toBe('Dokumen versi lama (v1). Unduh versi terbaru (v3) lalu minta tanda tangan ulang.');
    });

    it('accepts a scan for the latest version and advances to the GM step', async () => {
        const { service, manager, documents } = setup(waiting());
        const file = { ...pdfFile(), filename: '0b6d3c4e-1111-4222-8333-444455556666.pdf' };

        await expect(service.paperSign(IT, 't-1', file, '221126-QC-0035/v3')).resolves.toEqual({ version: 2 });

        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'IMP', expect.stringContaining('Impor scan TTD basah'), 'it-1', expect.anything());
        expect(documents.attachScan).toHaveBeenCalledWith('flow-1', 2, 'request-scans/0b6d3c4e-1111-4222-8333-444455556666.pdf', expect.anything());
        expect(manager.update).toHaveBeenCalledWith(EFormRequest, { id: 'ef-1' }, expect.objectContaining({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' }));
        expect(manager.update).toHaveBeenCalledWith(EFormApproval, expect.anything(), expect.objectContaining({ action: 'APPROVED', notes: 'Tanda tangan kertas' }));
    });

    it('rejects a file that is not a real PDF/JPG/PNG', async () => {
        const { service } = setup(waiting());
        const fake = { originalname: 'scan.pdf', size: 10, buffer: Buffer.from('MZ not a pdf') } as Express.Multer.File;
        await expect(service.paperSign(IT, 't-1', fake, '221126-QC-0035/v3')).rejects.toThrow(BadRequestException);
        await expect(service.paperSign(IT, 't-1', undefined, 'x')).rejects.toThrow(BadRequestException);
    });
});

describe('RequestFlowReviewService.remind', () => {
    const waiting = () => context({ flow: { route: 'MANAGER', managerId: 'mgr-1' }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1' });

    it('remind is limited to once per hour', async () => {
        const { service, dataSource, notifier } = setup(waiting());

        await service.remind(IT, 't-1');
        expect(notifier.askApprover).toHaveBeenCalledWith(expect.anything(), 'MANAGER', 'mgr-1', true);

        dataSource.manager.findOne.mockResolvedValueOnce({ id: 'msg-1' } as never);
        await expect(service.remind(IT, 't-1')).rejects.toThrow(new ConflictException('Pengingat sudah dikirim kurang dari 1 jam lalu'));
        expect(notifier.askApprover).toHaveBeenCalledTimes(1);
    });
});
