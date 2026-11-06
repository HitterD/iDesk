import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { EFormRequestService } from './eform-request.service';
import { EFormDocumentService } from './eform-document.service';
import { formatDocumentNumber, nextDocumentNumber } from './eform-document-number';
import { EFormStatus, EFormType } from './entities';
import { UserRole } from '../users/enums/user-role.enum';
import { AuditAction } from '../audit/entities/audit-log.entity';

const ICT = { role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1' };
const ID = '0b6d3c4e-1111-4222-8333-444455556666';
const STORED = '9f1c2d3e-aaaa-4bbb-8ccc-ddddeeeeffff.pdf';
const pdf = (filename = STORED) => ({ filename, originalname: 'form-ttd-gm.pdf', buffer: Buffer.from('%PDF-1.7 signed') }) as Express.Multer.File;

describe('e-form document numbers', () => {
    it('pads the running number after the form code', () => {
        expect(formatDocumentNumber(EFormType.WEBSITE, 7)).toBe('F/ICT/04-W/0007');
        expect(formatDocumentNumber(EFormType.VPN, 12345)).toBe('F/ICT/04/12345');
    });

    it('continues from the highest number of that form, under a lock', async () => {
        const query = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ maxSeq: '50' }]);
        await expect(nextDocumentNumber({ query } as any, EFormType.NETWORK)).resolves.toBe('F/ICT/04-N/0051');
        expect(query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
        // Prefix, where the digits start, prefix length: only `F/ICT/04-N/<digits>` counts.
        expect(query.mock.calls[1][1]).toEqual(['F/ICT/04-N/', 12, 11]);
        // Untyped, `SUBSTRING(x FROM $2)` is the regex form in Postgres and the sequence would restart at 0001.
        expect(query.mock.calls[1][0]).toContain('FROM $2::int');
    });

    it('starts at 0001 for a form that has none yet', async () => {
        const query = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ maxSeq: null }]);
        await expect(nextDocumentNumber({ query } as any, EFormType.EMAIL)).resolves.toBe('F/ICT/04-E/0001');
    });
});

describe('EFormRequestService.approveByManager', () => {
    const approve = async (overrides: Record<string, unknown>) => {
        const request = { id: ID, formType: EFormType.VPN, status: EFormStatus.PENDING_MANAGER, currentApproverId: 'mgr-1', requiresGm: false, gmApproverId: null, ...overrides };
        const repo = { findOne: jest.fn().mockResolvedValue(request), save: jest.fn(async (v: any) => v) };
        const approvals = { update: jest.fn(), save: jest.fn() };
        const emit = jest.fn();
        const service = new EFormRequestService(
            {} as any, repo as any, approvals as any, { save: jest.fn() } as any, {} as any,
            {} as any, {} as any, {} as any, { emit } as any, {} as any,
        );
        const saved = await service.approveByManager(ID, 'mgr-1', 'Manajer', { action: 'APPROVE', signatureData: 'data:image/png;base64,AA' });
        return { saved, emit, approvals };
    };

    it('waits for the paper GM signature when the GM step is on and no GM was picked', async () => {
        const { saved, emit, approvals } = await approve({ requiresGm: true });
        expect(saved).toMatchObject({ status: EFormStatus.PENDING_GM, currentApproverId: null });
        expect(approvals.save).not.toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith('eform.manager-approved', { request: saved });
    });

    it('hands the request to the picked GM to approve in iDesk', async () => {
        const { saved, emit, approvals } = await approve({ requiresGm: true, gmApproverId: 'gm-1' });
        expect(saved).toMatchObject({ status: EFormStatus.PENDING_GM, currentApproverId: 'gm-1' });
        expect(approvals.save).toHaveBeenCalledWith(expect.objectContaining({ approverId: 'gm-1', role: 'GM', action: 'PENDING' }));
        expect(emit).toHaveBeenCalledWith('eform.gm-requested', { request: saved, gmId: 'gm-1' });
    });

    it('sends the request straight to IT when the GM step is off', async () => {
        const { saved } = await approve({ formType: EFormType.WEBSITE, requiresGm: false });
        expect(saved).toMatchObject({ status: EFormStatus.PENDING_ICT, currentApproverId: null });
    });
});

describe('EFormDocumentService', () => {
    let repo: any;
    let audit: { logAsync: jest.Mock };
    let emit: jest.Mock;
    let service: EFormDocumentService;
    let unlink: jest.SpyInstance;

    const load = (overrides: Record<string, unknown> = {}) => {
        const request = { id: ID, siteId: 'site-1', status: EFormStatus.PENDING_GM, documentNumber: 'F/ICT/04/0003', gmApprovalFile: null, ...overrides };
        repo.findOne.mockResolvedValue(request);
        return request;
    };

    beforeEach(() => {
        repo = {
            findOne: jest.fn(),
            exists: jest.fn().mockResolvedValue(false),
            save: jest.fn(async (v: any) => ({ ...v })),
            metadata: { columns: [{ propertyName: 'id' }, { propertyName: 'gmApprovalFile' }] },
        };
        audit = { logAsync: jest.fn() };
        emit = jest.fn();
        service = new EFormDocumentService(repo, { getDetails: jest.fn() } as any, audit as any, { emit } as any);
        unlink = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
    });

    afterEach(() => unlink.mockRestore());

    describe('updateDocumentNumber', () => {
        it('lets IT correct the number and records who did', async () => {
            load({ status: EFormStatus.PENDING_ICT });
            const saved = await service.updateDocumentNumber(ICT, ID, 'agent-1', '  F/ICT/04/0050 ');
            expect(saved.documentNumber).toBe('F/ICT/04/0050');
            expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({
                action: AuditAction.EFORM_DOCUMENT_NUMBER_UPDATE,
                oldValue: { documentNumber: 'F/ICT/04/0003' },
                newValue: { documentNumber: 'F/ICT/04/0050' },
            }));
        });

        it('refuses a number another form already uses', async () => {
            load();
            repo.exists.mockResolvedValue(true);
            await expect(service.updateDocumentNumber(ICT, ID, 'agent-1', 'F/ICT/04/0001')).rejects.toBeInstanceOf(ConflictException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('turns a race on the unique index into the same conflict', async () => {
            load();
            repo.save.mockRejectedValue(Object.assign(new Error('duplicate'), { code: '23505' }));
            await expect(service.updateDocumentNumber(ICT, ID, 'agent-1', 'F/ICT/04/0009')).rejects.toBeInstanceOf(ConflictException);
        });

        it.each(['', '   ', 'F ICT 04', '/F/ICT', 'x'.repeat(51)])('rejects the malformed number %p', async (value) => {
            load();
            await expect(service.updateDocumentNumber(ICT, ID, 'agent-1', value)).rejects.toBeInstanceOf(BadRequestException);
        });

        it('leaves unsigned proposals unnumbered', async () => {
            load({ status: EFormStatus.DRAFT, documentNumber: null });
            await expect(service.updateDocumentNumber(ICT, ID, 'agent-1', 'F/ICT/04/0001')).rejects.toBeInstanceOf(BadRequestException);
        });

        it('is IT only', async () => {
            await expect(service.updateDocumentNumber({ role: UserRole.USER, siteId: 'site-1' }, ID, 'u-1', 'F/ICT/04/0001'))
                .rejects.toBeInstanceOf(ForbiddenException);
            expect(repo.findOne).not.toHaveBeenCalled();
        });
    });

    describe('uploadGmApproval', () => {
        it('records the signed copy and hands the request to IT provisioning', async () => {
            load();
            const saved = await service.uploadGmApproval(ICT, ID, 'agent-1', pdf());
            expect(saved).toMatchObject({ status: EFormStatus.PENDING_ICT, gmApprovalFileName: 'form-ttd-gm.pdf', gmApprovalUploadedById: 'agent-1' });
            expect(saved.gmApprovedAt).toBeInstanceOf(Date);
            expect(saved).not.toHaveProperty('gmApprovalFile');
            expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ gmApprovalFile: STORED }));
            expect(emit).toHaveBeenCalledWith('eform.gm-approved', expect.objectContaining({ userId: 'agent-1' }));
            expect(unlink).not.toHaveBeenCalled();
        });

        it('replaces a wrong scan while IT is still provisioning, without re-announcing the step', async () => {
            const old = '11111111-2222-4333-8444-555566667777.pdf';
            load({ status: EFormStatus.PENDING_ICT, gmApprovalFile: old });
            const saved = await service.uploadGmApproval(ICT, ID, 'agent-1', pdf());
            expect(saved.status).toBe(EFormStatus.PENDING_ICT);
            expect(emit).not.toHaveBeenCalled();
            expect(unlink).toHaveBeenCalledWith(expect.stringContaining(old));
        });

        it.each([EFormStatus.PENDING_MANAGER, EFormStatus.CONFIRMED, EFormStatus.REJECTED])('refuses an upload while %s and drops the file', async (status) => {
            load({ status });
            await expect(service.uploadGmApproval(ICT, ID, 'agent-1', pdf())).rejects.toBeInstanceOf(BadRequestException);
            expect(repo.save).not.toHaveBeenCalled();
            expect(unlink).toHaveBeenCalledWith(expect.stringContaining(STORED));
        });

        it('refuses a file that is not really a PDF', async () => {
            load();
            const fake = { ...pdf(), buffer: Buffer.from('MZ not a pdf') } as Express.Multer.File;
            await expect(service.uploadGmApproval(ICT, ID, 'agent-1', fake)).rejects.toBeInstanceOf(BadRequestException);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('drops the file when the id is not a request id', async () => {
            await expect(service.uploadGmApproval(ICT, 'undefined', 'agent-1', pdf())).rejects.toBeInstanceOf(BadRequestException);
            expect(repo.findOne).not.toHaveBeenCalled();
            expect(unlink).toHaveBeenCalledWith(expect.stringContaining(STORED));
        });

        describe('by the requester', () => {
            const REQUESTER = { role: UserRole.USER, siteId: 'site-1' };

            it('records the signed copy on the paper route and flags it as the requester\'s', async () => {
                load({ requesterId: 'u-1', gmApproverId: null });
                const saved = await service.uploadGmApproval(REQUESTER, ID, 'u-1', pdf());
                expect(saved).toMatchObject({ status: EFormStatus.PENDING_ICT, gmApprovalUploadedById: 'u-1' });
                expect(emit).toHaveBeenCalledWith('eform.gm-approved', expect.objectContaining({ userId: 'u-1' }));
                expect(audit.logAsync).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('by requester') }));
            });

            it('may replace the scan while IT has not started', async () => {
                load({ requesterId: 'u-1', status: EFormStatus.PENDING_ICT, gmApprovalFile: '11111111-2222-4333-8444-555566667777.pdf' });
                const saved = await service.uploadGmApproval(REQUESTER, ID, 'u-1', pdf());
                expect(saved.status).toBe(EFormStatus.PENDING_ICT);
                expect(emit).not.toHaveBeenCalled();
            });

            it('is refused when a GM approves in iDesk, and the file is dropped', async () => {
                load({ requesterId: 'u-1', gmApproverId: 'gm-1' });
                await expect(service.uploadGmApproval(REQUESTER, ID, 'u-1', pdf())).rejects.toBeInstanceOf(ForbiddenException);
                expect(repo.save).not.toHaveBeenCalled();
                expect(unlink).toHaveBeenCalledWith(expect.stringContaining(STORED));
            });

            it('is refused for someone else\'s request', async () => {
                load({ requesterId: 'u-2' });
                await expect(service.uploadGmApproval(REQUESTER, ID, 'u-1', pdf())).rejects.toBeInstanceOf(NotFoundException);
                expect(repo.save).not.toHaveBeenCalled();
            });
        });

        it('asks for a file when none came', async () => {
            await expect(service.uploadGmApproval(ICT, ID, 'agent-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
        });
    });
});
