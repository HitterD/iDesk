import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { HardwareRequestItem } from '../../hardware-request/domain/entities/hardware-request-item.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import type { EditItemsDto } from '../dto/edit-items.dto';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestItemsService } from './request-items.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';
const REASON = 'Stok laptop lama habis';

const unit = (id: string, name: string, over: Partial<HardwareRequestItem> = {}): HardwareRequestItem => ({
    id, requestId: 'hr-1', catalogId: 'cat-1', quantity: 1, notes: null, deliveryStatus: 'PENDING', procurementDecision: null,
    categorySnapshot: { code: 'LT1', name, category: 'LAPTOP', specs: {}, customFields: {} }, ...over,
}) as HardwareRequestItem;

function context(items: HardwareRequestItem[], over: { status?: string; signed?: { manager: boolean; gm: boolean }; route?: 'MANAGER' | null } = {}): FlowContext {
    const status = over.status ?? 'UNDER_REVIEW';
    return {
        flow: { id: 'flow-1', ticketId: TID, kind: 'HARDWARE', route: over.route ?? null, managerId: 'mgr-1', gmId: 'gm-1', documentVersion: 2, returnedReason: null } as never,
        ticket: { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1' } as never,
        kind: 'HARDWARE', requesterId: 'req-1', requesterName: 'Leony', number: 'HR-2026-0042',
        hardware: { id: 'hr-1', requestNumber: 'HR-2026-0042', status, items } as never,
        eform: null, signed: over.signed ?? { manager: false, gm: false }, phase: 'review', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext, schedules = 0) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
        delete: jest.fn(async () => undefined),
        count: jest.fn(async () => schedules),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const reader = { load: jest.fn(async () => ctx) };
    const documents = { bump: jest.fn(async () => 3) };
    const stepper = { tell: jest.fn(async () => undefined) };
    const notifier = { tellUser: jest.fn(async () => undefined) };
    const catalog = {
        ensureActive: jest.fn(async (id: string) => ({ id, code: 'LT2', name: 'Laptop B', category: 'LAPTOP', defaultSpecs: { ram: '16' } })),
        assertRequiredFields: jest.fn(),
    };
    const service = new RequestItemsService(dataSource as never, reader as never, stepper as never, documents as never, notifier as never, catalog as never);
    return { service, manager, documents, stepper, notifier, catalog };
}

const edit = (items: EditItemsDto['items']): EditItemsDto => ({ items, reason: REASON });
const savedRows = (manager: { save: jest.Mock }) =>
    manager.save.mock.calls.filter(([entity]) => entity === HardwareRequestItem).flatMap(([, rows]) => rows as HardwareRequestItem[]);

describe('RequestItemsService.edit', () => {
    it('swapping an item records replaces and bumps the document', async () => {
        const { service, manager, documents, stepper } = setup(context([unit('a', 'Laptop A')]));

        const result = await service.edit(IT, TID, edit([{ existingItemIds: ['a'], catalogId: 'cat-2', quantity: 1, replacesName: 'Laptop A' }]));

        const [row] = savedRows(manager);
        expect(row).toMatchObject({ id: 'a', catalogId: 'cat-2', categorySnapshot: { name: 'Laptop B', code: 'LT2', replaces: 'Laptop A' } });
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'GEN', 'Barang diubah oleh IT', 'it-1', manager);
        expect(result).toEqual({ version: 3 });
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            text: expect.stringContaining('RM Bagastyo mengubah barang'), reason: REASON,
        }));
        const text = (stepper.tell.mock.calls[0] as unknown as [unknown, { text: string }])[1].text;
        expect(text).toContain('Sebelum: 1× Laptop A');
        expect(text).toContain('Sesudah: 1× Laptop B');
    });

    it('refuses to remove an arrived unit', async () => {
        const { service } = setup(context([unit('a', 'Laptop A', { deliveryStatus: 'ARRIVED' }), unit('b', 'Mouse')], { status: 'INSTALLATION' }));

        await expect(service.edit(IT, TID, edit([{ existingItemIds: ['b'], manualName: 'Mouse', quantity: 1 }])))
            .rejects.toThrow(new ConflictException('Barang yang sudah tiba tidak bisa diubah'));
    });

    it('refuses to rename an arrived unit but lets its note change', async () => {
        const arrived = unit('a', 'Laptop A', { deliveryStatus: 'ARRIVED' });
        const { service, manager } = setup(context([arrived], { status: 'INSTALLATION' }));

        await expect(service.edit(IT, TID, edit([{ existingItemIds: ['a'], manualName: 'Laptop Z', quantity: 1 }])))
            .rejects.toThrow('Barang yang sudah tiba tidak bisa diubah');

        await service.edit(IT, TID, edit([{ existingItemIds: ['a'], manualName: 'Laptop A', quantity: 1, note: 'Warna hitam' }]));
        expect(savedRows(manager)[0]).toMatchObject({ id: 'a', notes: 'Warna hitam' });
    });

    it('adding a unit creates one row per unit', async () => {
        const { service, manager } = setup(context([unit('a', 'Laptop A')]));

        await service.edit(IT, TID, edit([{ existingItemIds: ['a'], manualName: 'Laptop A', quantity: 3, recipientName: 'Budi' }]));

        const rows = savedRows(manager);
        expect(rows).toHaveLength(3);
        const added = rows.filter((r) => !r.id);
        expect(added).toHaveLength(2);
        expect(added[0]).toMatchObject({
            requestId: 'hr-1', quantity: 1, catalogId: null, deliveryStatus: 'PENDING',
            categorySnapshot: { code: null, name: 'Laptop A', category: 'OTHER', customFields: { recipientName: 'Budi' } },
        });
    });

    it('removes units that are no longer asked for', async () => {
        const { service, manager } = setup(context([unit('a', 'Laptop A'), unit('b', 'Laptop A'), unit('c', 'Mouse')]));

        await service.edit(IT, TID, edit([{ existingItemIds: ['a', 'b'], manualName: 'Laptop A', quantity: 1 }]));

        expect(manager.delete).toHaveBeenCalledWith(HardwareRequestItem, ['b', 'c']);
    });

    it('checks the catalog fields of a catalog item', async () => {
        const { service, catalog } = setup(context([unit('a', 'Laptop A')]));

        await service.edit(IT, TID, edit([{ catalogId: 'cat-2', quantity: 1, fields: { ram: '16' } }, { existingItemIds: ['a'], manualName: 'Laptop A', quantity: 1 }]));

        expect(catalog.assertRequiredFields).toHaveBeenCalledWith(expect.objectContaining({ id: 'cat-2' }), { ram: '16' });
    });

    it('tells the approvers once someone has signed', async () => {
        const { service, notifier } = setup(context([unit('a', 'Laptop A')], { status: 'UNDER_REVIEW', route: 'MANAGER', signed: { manager: true, gm: false } }));

        await service.edit(IT, TID, edit([{ existingItemIds: ['a'], catalogId: 'cat-2', quantity: 1 }]));

        expect(notifier.tellUser).toHaveBeenCalledWith(expect.anything(), 'mgr-1', expect.any(String), expect.stringContaining('221126-QC-0035'));
        expect(notifier.tellUser).not.toHaveBeenCalledWith(expect.anything(), 'gm-1', expect.anything(), expect.anything());
    });

    it('does not bother approvers when nobody has signed', async () => {
        const { service, notifier } = setup(context([unit('a', 'Laptop A')]));
        await service.edit(IT, TID, edit([{ existingItemIds: ['a'], catalogId: 'cat-2', quantity: 1 }]));
        expect(notifier.tellUser).not.toHaveBeenCalled();
    });

    it('refuses once installation is under way, for e-forms, non-IT and an unknown unit', async () => {
        const lines = [{ existingItemIds: ['a'], manualName: 'Laptop A', quantity: 2 }];
        await expect(setup(context([unit('a', 'Laptop A')], { status: 'INSTALLATION' }), 1).service.edit(IT, TID, edit(lines))).rejects.toThrow(ConflictException);
        await expect(setup(context([unit('a', 'Laptop A')], { status: 'AWAITING_USER_CONFIRMATION' })).service.edit(IT, TID, edit(lines))).rejects.toThrow(ConflictException);
        await expect(setup({ ...context([]), hardware: null }).service.edit(IT, TID, edit(lines))).rejects.toThrow(ConflictException);
        await expect(setup(context([unit('a', 'Laptop A')])).service.edit({ ...IT, role: UserRole.USER }, TID, edit(lines))).rejects.toThrow(ForbiddenException);
        await expect(setup(context([unit('a', 'Laptop A')])).service.edit(IT, TID, edit([{ existingItemIds: ['zzz'], manualName: 'X', quantity: 1 }]))).rejects.toThrow(BadRequestException);
    });

    it('refuses extra units once the goods are bought', async () => {
        const { service } = setup(context([unit('a', 'Laptop A', { procurementDecision: 'APPROVED' })], { status: 'AWAITING_DELIVERY' }));
        await expect(service.edit(IT, TID, edit([{ existingItemIds: ['a'], manualName: 'Laptop A', quantity: 2 }])))
            .rejects.toThrow('Barang tidak bisa ditambah setelah pembelian');
    });

    it('a unit named by two lines is refused', async () => {
        const { service } = setup(context([unit('a', 'Laptop A')]));
        await expect(service.edit(IT, TID, edit([
            { existingItemIds: ['a'], manualName: 'Laptop A', quantity: 1 }, { existingItemIds: ['a'], manualName: 'Laptop B', quantity: 1 },
        ]))).rejects.toThrow(BadRequestException);
    });
});
