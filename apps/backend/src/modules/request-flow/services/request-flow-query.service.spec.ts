import { ForbiddenException } from '@nestjs/common';
import { EFormCredential } from '../../eform-request/entities/eform-credential.entity';
import { EFormStatus, EFormType } from '../../eform-request/entities/eform-request.entity';
import { HardwareAsset } from '../../hardware-request/domain/entities/hardware-asset.entity';
import { InstallationSchedule } from '../../hardware-request/domain/entities/installation-schedule.entity';
import { InstallStatus } from '../../hardware-request/domain/enums/install-status.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { RequestDocumentRevision } from '../entities/request-document-revision.entity';
import type { FlowContext } from './request-flow-reader';
import { RequestFlowQueryService } from './request-flow-query.service';

const TID = '0b6d3c4e-1111-4222-8333-444455556677';
const viewer = (userId: string, role = UserRole.USER, siteId: string | null = 'site-1') => ({ userId, role, siteId });
const SIGNATURE = 'data:image/png;base64,SECRET';

function context(kind: 'HARDWARE' | 'EFORM', over: Partial<FlowContext> = {}, flow: object = {}): FlowContext {
    return {
        flow: { id: 'flow-1', ticketId: TID, kind, route: 'MANAGER', managerId: 'mgr-1', gmId: null, hardwareSource: 'NON_BUDGET',
            returnedReason: null, rescheduleCount: 1, documentVersion: 2, ...flow } as never,
        ticket: { id: TID, siteId: 'site-1' } as never,
        kind, requesterId: 'req-1', requesterName: 'Leony', number: 'HR-2026-0042',
        hardware: kind === 'HARDWARE' ? ({
            id: 'hr-1', requestNumber: 'HR-2026-0042', division: 'QC', recipientName: 'Leony, Budi', status: RequestStatus.UNDER_REVIEW,
            items: [{
                id: 'it-1', categorySnapshot: { name: 'Laptop', customFields: { recipientName: 'Budi' } }, quantity: 1, notes: 'i5',
                deliveryStatus: 'ARRIVED', procurementDecision: 'APPROVED', vendor: 'PT X', actualCost: '1000.00', invoiceNumber: 'INV1', invoiceDate: null,
            }],
        } as never) : null,
        eform: kind === 'EFORM' ? ({
            id: 'ef-1', formType: EFormType.VPN, status: EFormStatus.PENDING_MANAGER, documentNumber: 'F/ICT/04/0120', requiresGm: true,
            formData: { alasan: 'WFH', dariTanggal: '2026-11-23', sampaiTanggal: '2027-01-01' }, requestedWebsites: 'a.com', networkPurpose: null,
        } as never) : null,
        signed: { manager: false, gm: false }, phase: 'approval', step: 'MANAGER', approverId: 'mgr-1',
        ...over,
    };
}

function setup(ctx: FlowContext, rows: { schedules?: unknown[]; credentials?: number } = {}) {
    const find = jest.fn(async (entity: unknown) => {
        if (entity === RequestDocumentRevision) return [{ version: 1, kind: 'GEN', label: 'Dibuat', actorId: 'req-1', createdAt: new Date('2026-11-22T01:00:00Z') }];
        if (entity === User) return [{ id: 'req-1', fullName: 'Leony' }, { id: 'tech-1', fullName: 'Teknisi A' }];
        if (entity === InstallationSchedule) return rows.schedules ?? [];
        if (entity === HardwareAsset) return [{ barcode: 'AST-1', itemId: 'it-1', signature: SIGNATURE }];
        return [];
    });
    const count = jest.fn(async (entity: unknown) => (entity === EFormCredential ? rows.credentials ?? 0 : 0));
    const dataSource = { manager: { find, count } };
    const reader = { load: jest.fn(async () => ctx) };
    return { service: new RequestFlowQueryService(dataSource as never, reader as never), reader };
}

describe('RequestFlowQueryService.view', () => {
    it('view marks the current approver', async () => {
        const { service } = setup(context('HARDWARE'));
        await expect(service.view(viewer('mgr-1'), TID)).resolves.toMatchObject({ viewerRoleInFlow: 'APPROVER_CURRENT', phase: 'appr_mgr', phaseLabel: 'Menunggu Atasan' });
    });

    it('marks a signed-off approver, the requester, IT and others', async () => {
        const ctx = context('HARDWARE', { signed: { manager: true, gm: false }, step: 'GM', approverId: 'gm-1' }, { route: 'MANAGER_GM', gmId: 'gm-1' });
        const { service } = setup(ctx);
        expect((await service.view(viewer('mgr-1'), TID)).viewerRoleInFlow).toBe('APPROVER');
        expect((await service.view(viewer('gm-1'), TID)).viewerRoleInFlow).toBe('APPROVER_CURRENT');
        expect((await service.view(viewer('req-1'), TID)).viewerRoleInFlow).toBe('REQUESTER');
        expect((await service.view(viewer('it-1', UserRole.AGENT), TID)).viewerRoleInFlow).toBe('ICT');
        expect((await service.view(viewer('boss', UserRole.MANAGER), TID)).viewerRoleInFlow).toBe('OBSERVER');
    });

    it('ICT outranks everything else', async () => {
        const { service } = setup(context('HARDWARE'));
        expect((await service.view(viewer('mgr-1', UserRole.ADMIN), TID)).viewerRoleInFlow).toBe('ICT');
    });

    it('refuses strangers and other-site IT', async () => {
        const { service } = setup(context('HARDWARE'));
        await expect(service.view(viewer('x'), TID)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.view(viewer('it-9', UserRole.AGENT, 'site-2'), TID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an approver from another site read', async () => {
        const { service } = setup(context('HARDWARE'));
        await expect(service.view(viewer('mgr-1', UserRole.USER, 'site-9'), TID)).resolves.toMatchObject({ kind: 'HARDWARE' });
    });

    it('projects hardware items, recipients, schedule slots and assets without any signature', async () => {
        const slots = [{ start: '2026-11-25T02:00:00.000Z', end: '2026-11-25T03:00:00.000Z' }, { start: '2026-11-26T02:00:00.000Z', end: '2026-11-26T03:00:00.000Z' }];
        const ctx = context('HARDWARE', { hardware: { ...context('HARDWARE').hardware!, status: RequestStatus.INSTALLATION } as never, phase: 'other', step: null, approverId: null });
        const { service } = setup(ctx, { schedules: [{
            id: 's-1', status: InstallStatus.CONFIRMED, proposedSlots: slots, scheduledStart: new Date(slots[1].start), scheduledEnd: new Date(slots[1].end),
            technicianId: 'tech-1', rescheduleCount: 2, createdAt: new Date(),
        }] });

        const view = await service.view(viewer('req-1'), TID);

        expect(view.phase).toBe('install');
        expect(view.rescheduleCount).toBe(1);
        expect(view.documentVersion).toBe(2);
        expect(view.revisions).toEqual([{ version: 1, kind: 'GEN', label: 'Dibuat', actorName: 'Leony', createdAt: '2026-11-22T01:00:00.000Z' }]);
        expect(view.hardware).toMatchObject({
            requestNumber: 'HR-2026-0042', division: 'QC', recipients: ['Leony', 'Budi'],
            assets: [{ code: 'AST-1', itemId: 'it-1' }],
            schedule: { slots, chosen: 1, technicianName: 'Teknisi A', status: 'CONFIRMED', resched: 2 },
        });
        expect(view.hardware!.items[0]).toMatchObject({ id: 'it-1', name: 'Laptop', quantity: 1, deliveryStatus: 'ARRIVED', vendor: 'PT X' });
        expect(JSON.stringify(view)).not.toContain('SECRET');
    });

    it('labels scheduling that waits for the requester', async () => {
        const ctx = context('HARDWARE', { hardware: { ...context('HARDWARE').hardware!, status: RequestStatus.INSTALLATION } as never });
        const { service } = setup(ctx, { schedules: [{
            id: 's-1', status: InstallStatus.PROPOSED, proposedSlots: [{ start: '2026-11-25T02:00:00.000Z', end: '2026-11-25T03:00:00.000Z' }],
            scheduledStart: null, scheduledEnd: null, technicianId: 'tech-1', rescheduleCount: 0, createdAt: new Date(),
        }] });
        await expect(service.view(viewer('req-1'), TID)).resolves.toMatchObject({ phase: 'schedule', phaseLabel: 'Menunggu pemohon pilih jadwal' });
    });

    it('projects the e-form summary and whether credentials exist, never the credentials', async () => {
        const { service } = setup(context('EFORM', {}, { route: 'MANAGER_GM', gmId: 'gm-1' }), { credentials: 1 });
        const view = await service.view(viewer('req-1'), TID);
        expect(view.hardware).toBeUndefined();
        expect(view.eform).toEqual({
            formType: 'VPN', documentNumber: 'F/ICT/04/0120', startDate: '2026-11-23', endDate: '2027-01-01',
            fields: { alasan: 'WFH', requestedWebsites: 'a.com' }, hasCredentials: true, requiresGm: true,
        });
        expect(view.phase).toBe('appr_mgr');
    });

    it('reports a permanent e-form access as endDate null', async () => {
        const base = context('EFORM');
        const ctx = context('EFORM', { eform: { ...base.eform!, formData: { dariTanggal: '2026-11-23', sampaiTanggal: '' } } as never });
        const { service } = setup(ctx);
        expect((await service.view(viewer('req-1'), TID)).eform).toMatchObject({ endDate: null, hasCredentials: false });
    });
});
