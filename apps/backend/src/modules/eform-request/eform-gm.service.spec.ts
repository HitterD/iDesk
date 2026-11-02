import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EFormGmService } from './eform-gm.service';
import { EFormStatus, EFormType } from './entities';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditAction } from '../audit/entities/audit-log.entity';

const ID = '0b6d3c4e-1111-4222-8333-444455556666';
const ICT = { role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
const SIGNATURE = 'data:image/png;base64,AA';

describe('EFormGmService', () => {
    let repo: any;
    let approvals: any;
    let signatures: any;
    let requests: any;
    let audit: any;
    let emit: jest.Mock;
    let service: EFormGmService;

    const load = (overrides: Record<string, unknown> = {}) => {
        const request = {
            id: ID, formType: EFormType.VPN, siteId: 'site-1', requesterId: 'u-req', status: EFormStatus.PENDING_GM,
            currentApproverId: 'gm-1', requiresGm: true, gmApproverId: 'gm-1', gmApprovedAt: null, ...overrides,
        };
        repo.findOne.mockResolvedValue(request);
        return request;
    };

    beforeEach(() => {
        repo = { findOne: jest.fn(), save: jest.fn(async (v: any) => v) };
        approvals = { update: jest.fn(), save: jest.fn(), findOne: jest.fn().mockResolvedValue(null), delete: jest.fn() };
        signatures = { save: jest.fn() };
        requests = { assertActiveUser: jest.fn() };
        audit = { logAsync: jest.fn() };
        emit = jest.fn();
        service = new EFormGmService(repo, approvals, signatures, requests, audit, { emit } as any);
    });

    describe('approveByGm', () => {
        it('records the GM signature and hands the request to IT', async () => {
            load();
            const saved = await service.approveByGm(ID, 'gm-1', 'Pak GM', { action: 'APPROVE', signatureData: SIGNATURE });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_ICT, currentApproverId: null });
            expect(saved.gmApprovedAt).toBeInstanceOf(Date);
            expect(signatures.save).toHaveBeenCalledWith(expect.objectContaining({ signerId: 'gm-1', signerRole: 'GM' }));
            expect(approvals.update).toHaveBeenCalledWith(expect.objectContaining({ approverId: 'gm-1', role: 'GM' }), expect.objectContaining({ action: 'APPROVED' }));
            expect(emit).toHaveBeenCalledWith('eform.gm-approved', { request: saved, userId: 'gm-1', inApp: true });
        });

        it('lets the GM reject with a reason', async () => {
            load();
            const saved = await service.approveByGm(ID, 'gm-1', 'Pak GM', { action: 'REJECT', rejectionReason: 'Tidak perlu' } as any);

            expect(saved).toMatchObject({ status: EFormStatus.REJECTED, rejectionReason: 'Tidak perlu' });
            expect(emit).toHaveBeenCalledWith('eform.rejected', { request: saved, userId: 'gm-1' });
        });

        it('refuses anyone but the chosen GM', async () => {
            load();
            await expect(service.approveByGm(ID, 'someone', 'X', { action: 'APPROVE', signatureData: SIGNATURE })).rejects.toBeInstanceOf(ForbiddenException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('refuses outside the GM step', async () => {
            load({ status: EFormStatus.PENDING_ICT });
            await expect(service.approveByGm(ID, 'gm-1', 'Pak GM', { action: 'APPROVE', signatureData: SIGNATURE })).rejects.toBeInstanceOf(BadRequestException);
        });

        it('asks for a signature', async () => {
            load();
            await expect(service.approveByGm(ID, 'gm-1', 'Pak GM', { action: 'APPROVE' } as any)).rejects.toBeInstanceOf(BadRequestException);
            expect(repo.save).not.toHaveBeenCalled();
        });
    });

    describe('setGmStep', () => {
        it('is ICT only', async () => {
            load();
            await expect(service.setGmStep({ role: UserRole.USER, siteId: 'site-1' }, ID, 'u', { requiresGm: false })).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('keeps ICT on its own site', async () => {
            load({ siteId: 'site-2' });
            await expect(service.setGmStep(ICT, ID, 'u-ict', { requiresGm: false })).rejects.toBeInstanceOf(ForbiddenException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('sets the step before the manager without moving the request', async () => {
            load({ status: EFormStatus.PENDING_MANAGER, currentApproverId: 'mgr-1', requiresGm: false, gmApproverId: null });
            const saved = await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: 'gm-2' });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_MANAGER, currentApproverId: 'mgr-1', requiresGm: true, gmApproverId: 'gm-2' });
            expect(requests.assertActiveUser).toHaveBeenCalledWith('gm-2', 'u-req');
            expect(approvals.save).not.toHaveBeenCalled();
            expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.EFORM_GM_STEP_UPDATE }));
        });

        it('skips the GM while waiting on them, sending the request to IT', async () => {
            load();
            approvals.findOne.mockResolvedValue({ id: 'ap-1', approverId: 'gm-1' });
            const saved = await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: false, gmApproverId: 'gm-1' });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_ICT, currentApproverId: null, requiresGm: false, gmApproverId: null });
            expect(approvals.delete).toHaveBeenCalledWith('ap-1');
        });

        it('adds the GM to a request already with IT and asks them', async () => {
            load({ formType: EFormType.WEBSITE, status: EFormStatus.PENDING_ICT, currentApproverId: null, requiresGm: false, gmApproverId: null });
            const saved = await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: 'gm-2' });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-2' });
            expect(approvals.save).toHaveBeenCalledWith(expect.objectContaining({ approverId: 'gm-2', role: 'GM', action: 'PENDING' }));
            expect(emit).toHaveBeenCalledWith('eform.gm-requested', { request: saved, gmId: 'gm-2' });
        });

        it('swaps the GM: the old pending approval goes, the new GM is asked', async () => {
            load();
            approvals.findOne.mockResolvedValue({ id: 'ap-1', approverId: 'gm-1' });
            const saved = await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: 'gm-2' });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-2' });
            expect(approvals.delete).toHaveBeenCalledWith('ap-1');
            expect(approvals.save).toHaveBeenCalledWith(expect.objectContaining({ approverId: 'gm-2' }));
        });

        it('switches to the paper route by clearing the GM', async () => {
            load();
            approvals.findOne.mockResolvedValue({ id: 'ap-1', approverId: 'gm-1' });
            const saved = await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: null });

            expect(saved).toMatchObject({ status: EFormStatus.PENDING_GM, currentApproverId: null, gmApproverId: null });
            expect(approvals.delete).toHaveBeenCalledWith('ap-1');
            expect(emit).not.toHaveBeenCalledWith('eform.gm-requested', expect.anything());
        });

        it('does not re-ask the same GM', async () => {
            load();
            approvals.findOne.mockResolvedValue({ id: 'ap-1', approverId: 'gm-1' });
            await service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: 'gm-1' });

            expect(approvals.delete).not.toHaveBeenCalled();
            expect(approvals.save).not.toHaveBeenCalled();
            expect(emit).not.toHaveBeenCalled();
        });

        it('cannot ask the GM again once they approved', async () => {
            load({ status: EFormStatus.PENDING_ICT, currentApproverId: null, gmApprovedAt: new Date() });
            await expect(service.setGmStep(ICT, ID, 'u-ict', { requiresGm: true, gmApproverId: 'gm-2' })).rejects.toBeInstanceOf(BadRequestException);
        });

        it.each([EFormStatus.CONFIRMED, EFormStatus.REJECTED, EFormStatus.DRAFT])('is closed once %s', async (status) => {
            load({ status });
            await expect(service.setGmStep(ICT, ID, 'u-ict', { requiresGm: false })).rejects.toBeInstanceOf(BadRequestException);
        });
    });
});
