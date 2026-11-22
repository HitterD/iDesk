import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../hardware-request/domain/entities/hardware-request-item.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { UserRole } from '../../users/enums/user-role.enum';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestProcurementFlowService } from './request-procurement-flow.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';

const unit = (id: string, over: Partial<HardwareRequestItem> = {}): HardwareRequestItem => ({
    id, requestId: 'hr-1', quantity: 1, deliveryStatus: 'PENDING', procurementDecision: 'APPROVED', arrivedAt: null,
    categorySnapshot: { name: 'Laptop A' }, ...over,
}) as HardwareRequestItem;

function context(status: string, items: HardwareRequestItem[]): FlowContext {
    return {
        flow: { id: 'flow-1', ticketId: TID, kind: 'HARDWARE', route: null, returnedReason: null, documentVersion: 1 } as never,
        ticket: { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1' } as never,
        kind: 'HARDWARE', requesterId: 'req-1', requesterName: 'Leony', number: 'HR-2026-0042',
        hardware: { id: 'hr-1', requestNumber: 'HR-2026-0042', status, items } as never,
        eform: null, signed: { manager: false, gm: false }, phase: 'other', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
        update: jest.fn(async () => undefined),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const reader = { load: jest.fn(async () => ctx) };
    const outcome = { request: { id: 'hr-1', status: RequestStatus.AWAITING_DELIVERY, requesterId: 'req-1' }, approvedItems: 2, rejectedItems: 0 };
    const procurement = { recordWith: jest.fn(async () => outcome), announce: jest.fn() };
    const stepper = { tell: jest.fn(async () => undefined) };
    const hardwareLink = { resumeForInstallation: jest.fn(async () => undefined) };
    const service = new RequestProcurementFlowService(dataSource as never, reader as never, procurement as never, stepper as never, hardwareLink as never);
    return { service, manager, procurement, stepper, hardwareLink, outcome };
}

const LINES = [{ itemIds: ['a', 'b'], decision: 'APPROVED' as const, vendor: 'CV Sinar', unitCost: 12400000 }];

describe('RequestProcurementFlowService.procure', () => {
    it('records the lines in the transaction, announces once and tells the ticket', async () => {
        const { service, procurement, stepper } = setup(context(RequestStatus.PROCUREMENT, [unit('a'), unit('b')]));

        await service.procure(IT, TID, { lines: LINES, note: 'tunai' });

        expect(procurement.recordWith).toHaveBeenCalledWith(expect.anything(), 'hr-1', 'it-1', { lines: LINES, note: 'tunai' });
        expect(procurement.announce).toHaveBeenCalledTimes(1);
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            actorId: 'it-1', text: expect.stringContaining('Pembelian dicatat: 2 dari 2 barang'),
        }));
    });

    it('does not tell the ticket twice when everything was rejected (the rejection listener does)', async () => {
        const { service, procurement, stepper, outcome } = setup(context(RequestStatus.PROCUREMENT, [unit('a')]));
        procurement.recordWith.mockResolvedValue({ ...outcome, request: { ...outcome.request, status: RequestStatus.REJECTED }, approvedItems: 0, rejectedItems: 1 });

        await service.procure(IT, TID, { lines: [{ itemIds: ['a'], decision: 'REJECTED' }], note: 'Stok vendor habis' });

        expect(stepper.tell).not.toHaveBeenCalled();
        expect(procurement.announce).toHaveBeenCalledTimes(1);
    });

    it('refuses outside the procurement phase, non-IT staff and bad ids', async () => {
        await expect(setup(context(RequestStatus.AWAITING_DELIVERY, [unit('a')])).service.procure(IT, TID, { lines: LINES })).rejects.toThrow(ConflictException);
        await expect(setup(context(RequestStatus.PROCUREMENT, [unit('a')])).service.procure({ ...IT, role: UserRole.USER }, TID, { lines: LINES })).rejects.toThrow(ForbiddenException);
        await expect(setup(context(RequestStatus.PROCUREMENT, [unit('a')])).service.procure(IT, 'nope', { lines: LINES })).rejects.toThrow(BadRequestException);
    });
});

describe('RequestProcurementFlowService.arrive', () => {
    it('first arrival marks the units, moves the request to installation and resumes the ticket', async () => {
        const { service, manager, stepper, hardwareLink } = setup(context(RequestStatus.AWAITING_DELIVERY, [unit('a'), unit('b')]));

        await service.arrive(IT, TID, { itemIds: ['a'] });

        const saved = manager.save.mock.calls.find(([entity]) => entity === HardwareRequestItem)![1] as HardwareRequestItem[];
        expect(saved).toHaveLength(1);
        expect(saved[0]).toMatchObject({ id: 'a', deliveryStatus: 'ARRIVED' });
        expect(saved[0].arrivedAt).toBeInstanceOf(Date);
        expect(manager.update).toHaveBeenCalledWith(HardwareRequest, { id: 'hr-1' }, { status: RequestStatus.INSTALLATION });
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ text: '1 barang tiba di gudang IT' }));
        expect(hardwareLink.resumeForInstallation).toHaveBeenCalledWith('hr-1', 'it-1');
    });

    it('a later arrival during installation changes no status and does not resume again', async () => {
        const { service, manager, hardwareLink, stepper } = setup(context(RequestStatus.INSTALLATION, [unit('a', { deliveryStatus: 'ARRIVED' }), unit('b')]));

        await service.arrive(IT, TID, { itemIds: ['b'] });

        expect(manager.update).not.toHaveBeenCalled();
        expect(hardwareLink.resumeForInstallation).not.toHaveBeenCalled();
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ text: '1 barang tiba di gudang IT' }));
    });

    it('is idempotent for units that already arrived', async () => {
        const { service, manager, stepper, hardwareLink } = setup(context(RequestStatus.INSTALLATION, [unit('a', { deliveryStatus: 'ARRIVED' })]));

        await expect(service.arrive(IT, TID, { itemIds: ['a'] })).resolves.toEqual({ arrived: 0 });

        expect(manager.save).not.toHaveBeenCalled();
        expect(stepper.tell).not.toHaveBeenCalled();
        expect(hardwareLink.resumeForInstallation).not.toHaveBeenCalled();
    });

    it('refuses units that were not bought or are not on the request', async () => {
        const items = [unit('a'), unit('r', { procurementDecision: 'REJECTED', deliveryStatus: 'NOT_PROCURED' })];
        await expect(setup(context(RequestStatus.AWAITING_DELIVERY, items)).service.arrive(IT, TID, { itemIds: ['r'] })).rejects.toThrow(ConflictException);
        await expect(setup(context(RequestStatus.AWAITING_DELIVERY, items)).service.arrive(IT, TID, { itemIds: ['zzz'] })).rejects.toThrow(ConflictException);
    });

    it('refuses before purchase is recorded and for non-IT staff', async () => {
        await expect(setup(context(RequestStatus.PROCUREMENT, [unit('a')])).service.arrive(IT, TID, { itemIds: ['a'] })).rejects.toThrow(ConflictException);
        await expect(setup(context(RequestStatus.AWAITING_DELIVERY, [unit('a')])).service.arrive({ ...IT, role: UserRole.USER }, TID, { itemIds: ['a'] })).rejects.toThrow(ForbiddenException);
    });
});
