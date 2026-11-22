import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../users/enums/user-role.enum';
import { RequestDocumentRevision } from '../entities/request-document-revision.entity';
import { RequestFlow } from '../entities/request-flow.entity';
import { signedSlots } from '../domain/hardware-signatures';
import { renderHardwareRequestPdf } from '../pdf/hardware-request-pdf';
import { RequestDocumentService } from './request-document.service';

function setup(latest?: { version: number }) {
    const manager = {
        findOne: jest.fn(async (entity: unknown) => (entity === RequestDocumentRevision ? latest ?? null : { id: 'flow-1' })),
        create: jest.fn((_e: unknown, v: unknown) => v),
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        update: jest.fn(async () => undefined),
    };
    const ctx = {
        flow: { id: 'flow-1', documentVersion: 3, route: 'MANAGER', hardwareSource: 'IT_STOCK', managerId: 'mgr-1', gmId: null },
        ticket: { id: 't-1', ticketNumber: '221126-QC-0035', siteId: 'site-1', userId: 'req-1' },
        requesterId: 'req-1', requesterName: 'Leony',
        hardware: { id: 'hr-1', requestNumber: 'HR-2026-0042', createdAt: new Date('2026-11-22'), division: 'QC', justification: 'Staf baru', items: [
            { categorySnapshot: { name: 'Laptop', customFields: {} }, notes: null, quantity: 1 },
            { categorySnapshot: { name: 'Laptop', customFields: {} }, notes: null, quantity: 1 },
        ] },
        eform: null,
    };
    const reader = { load: jest.fn(async () => ctx) };
    const dataSource = { manager: { find: jest.fn(async () => []) } };
    const eformPdf = { generatePdf: jest.fn(async () => Buffer.from('%PDF')) };
    const service = new RequestDocumentService(dataSource as never, reader as never, eformPdf as never, {} as never);
    return { service, manager, ctx, eformPdf };
}

describe('RequestDocumentService.bump', () => {
    it('adds the next version and keeps the flow in sync', async () => {
        const { service, manager } = setup({ version: 3 });
        await expect(service.bump('flow-1', 'DIG', 'TTD Atasan', 'u-1', manager as never)).resolves.toBe(4);
        expect(manager.save).toHaveBeenCalledWith(RequestDocumentRevision, { flowId: 'flow-1', version: 4, kind: 'DIG', label: 'TTD Atasan', actorId: 'u-1' });
        expect(manager.update).toHaveBeenCalledWith(RequestFlow, { id: 'flow-1' }, { documentVersion: 4 });
    });

    it('starts at version 1 when there is no revision yet', async () => {
        const { service, manager } = setup();
        await expect(service.bump('flow-1', 'GEN', 'x', null, manager as never)).resolves.toBe(1);
    });
});

describe('RequestDocumentService.renderPdf', () => {
    const viewer = { userId: 'req-1', role: UserRole.USER, siteId: 'site-1' };

    it('renders a hardware PDF of the latest version with the ticket-number QR file name', async () => {
        const { service } = setup();
        const { buffer, fileName } = await service.renderPdf(viewer, 't-1');
        expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
        expect(fileName).toBe('221126-QC-0035_v3.pdf');
    });

    it('lets processors and MANAGER open it, but not AGENT_ORACLE or an unrelated USER', async () => {
        const { service } = setup();
        await expect(service.renderPdf({ userId: 'x', role: UserRole.AGENT, siteId: 'site-1' }, 't-1')).resolves.toBeDefined();
        await expect(service.renderPdf({ userId: 'x', role: UserRole.MANAGER, siteId: 'site-2' }, 't-1')).resolves.toBeDefined();
        await expect(service.renderPdf({ userId: 'x', role: UserRole.AGENT_ORACLE, siteId: 'site-1' }, 't-1')).rejects.toThrow(ForbiddenException);
        await expect(service.renderPdf({ userId: 'x', role: UserRole.USER, siteId: 'site-1' }, 't-1')).rejects.toThrow(ForbiddenException);
    });

    it('refuses an unknown version and strangers', async () => {
        const { service } = setup();
        await expect(service.renderPdf(viewer, 't-1', 9)).rejects.toThrow(BadRequestException);
        await expect(service.renderPdf({ ...viewer, userId: 'x' }, 't-1')).rejects.toThrow(ForbiddenException);
    });

    it('passes the QR text and version to the e-form PDF', async () => {
        const { service, ctx, eformPdf } = setup();
        Object.assign(ctx, { hardware: null, eform: { id: 'ef-1' } });
        (service as never as { eformRepo: unknown }).eformRepo = { findOne: jest.fn(async () => ({ id: 'ef-1' })) };
        await service.renderPdf(viewer, 't-1', 2);
        expect(eformPdf.generatePdf).toHaveBeenCalledWith({ id: 'ef-1' }, undefined, { qrText: '221126-QC-0035/v2', version: 2 });
    });
});

describe('hardware document', () => {
    it('renders four signature slots, items and a QR footer', async () => {
        const buffer = await renderHardwareRequestPdf({
            ticketNumber: '221126-QC-0035', requestNumber: 'HR-1', version: 2, createdAt: new Date(), requesterName: 'Leony', division: 'QC',
            justification: 'Staf baru', sourceLabel: 'Stok IT', routeLabel: 'Atasan saja',
            items: [{ name: 'Laptop', quantity: 2, recipient: 'Andi', note: '' }],
            signatures: signedSlots([
                { action: 'CREATED', metadata: { signature: 'data:image/png;base64,iVBORw0KGgo=' } },
                { action: 'UPDATED', metadata: { step: 'MANAGER', signerName: 'Pak M', how: 'paper' } },
            ], 'Leony'),
        });
        expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
        expect(buffer.length).toBeGreaterThan(1500);
    });
});
