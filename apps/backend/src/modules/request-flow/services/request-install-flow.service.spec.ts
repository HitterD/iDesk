import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { HardwareRequestItem } from '../../hardware-request/domain/entities/hardware-request-item.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import type { FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestInstallFlowService } from './request-install-flow.service';

const IT: FlowActor = { userId: 'it-1', role: UserRole.AGENT_OPERATIONAL_SUPPORT, siteId: 'site-1', fullName: 'RM Bagastyo' };
const TID = '0b6d3c4e-1111-4222-8333-444455556677';
const SIGNATURE = 'data:image/png;base64,AAAA';

const unit = (id: string, over: Partial<HardwareRequestItem> = {}): HardwareRequestItem => ({
    id, requestId: 'hr-1', quantity: 1, deliveryStatus: 'ARRIVED', procurementDecision: 'APPROVED', categorySnapshot: { name: 'Laptop A' }, ...over,
}) as HardwareRequestItem;

function context(items: HardwareRequestItem[], status: string = RequestStatus.INSTALLATION): FlowContext {
    return {
        flow: { id: 'flow-1', ticketId: TID, kind: 'HARDWARE', route: 'MANAGER', returnedReason: null, documentVersion: 4 } as never,
        ticket: { id: TID, ticketNumber: '221126-QC-0035', siteId: 'site-1', status: TicketStatus.IN_PROGRESS } as never,
        kind: 'HARDWARE', requesterId: 'req-1', requesterName: 'Leony', number: 'HR-2026-0042',
        hardware: { id: 'hr-1', requestNumber: 'HR-2026-0042', status, items } as never,
        eform: null, signed: { manager: true, gm: false }, phase: 'other', step: null, approverId: null,
    };
}

function setup(ctx: FlowContext, openSchedules = 1) {
    const manager = {
        save: jest.fn(async (_e: unknown, v: unknown) => v),
        create: jest.fn((_e: unknown, v: unknown) => v),
        count: jest.fn(async () => openSchedules),
    };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const reader = { load: jest.fn(async () => ctx) };
    const assets = { createAssetsWith: jest.fn(async (..._args: unknown[]): Promise<void> => undefined) };
    const schedules = { completeWith: jest.fn(async () => undefined) };
    const hardware = { completeInstallationWith: jest.fn(async () => ({ id: 'hr-1', status: RequestStatus.AWAITING_USER_CONFIRMATION })), announceInstallCompleted: jest.fn() };
    const documents = { bump: jest.fn(async () => 5) };
    const stepper = { tell: jest.fn(async () => undefined) };
    const service = new RequestInstallFlowService(dataSource as never, reader as never, assets as never, schedules as never, hardware as never, documents as never, stepper as never);
    return { service, manager, assets, schedules, hardware, documents, stepper };
}

const dto = (assets: { itemId: string; code: string }[], over: object = {}) => ({ assets, signatureData: SIGNATURE, ...over });

describe('RequestInstallFlowService.installDone', () => {
    it('install-done requires one unique asset code per arrived unit', async () => {
        const { service, assets } = setup(context([unit('a'), unit('b'), unit('c', { deliveryStatus: 'PENDING' })]));

        await expect(service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }])))
            .rejects.toThrow(new BadRequestException('Setiap barang yang sudah tiba harus punya satu kode aset'));
        await expect(service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }, { itemId: 'b', code: 'AST-0001' }])))
            .rejects.toThrow(new ConflictException('Kode aset AST-0001 sudah dipakai'));
        await expect(service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }, { itemId: 'b', code: 'AST-0002' }, { itemId: 'c', code: 'AST-0003' }])))
            .rejects.toThrow(new BadRequestException('Barang belum tiba atau bukan bagian permintaan ini'));
        await expect(service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }, { itemId: 'a', code: 'AST-0002' }, { itemId: 'b', code: 'AST-0003' }])))
            .rejects.toThrow(new BadRequestException('Setiap barang yang sudah tiba harus punya satu kode aset'));
        expect(assets.createAssetsWith).not.toHaveBeenCalled();
    });

    it('a code already used elsewhere refuses the whole report', async () => {
        const { service, assets, stepper, hardware } = setup(context([unit('a')]));
        assets.createAssetsWith.mockRejectedValueOnce(new ConflictException('Kode aset AST-0001 sudah dipakai'));

        await expect(service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }]))).rejects.toThrow('Kode aset AST-0001 sudah dipakai');
        expect(hardware.announceInstallCompleted).not.toHaveBeenCalled();
        expect(stepper.tell).not.toHaveBeenCalled();
    });

    it('registers the assets, completes the installation, signs as ICT and hands the ticket to the requester', async () => {
        const { service, manager, assets, schedules, hardware, documents, stepper } = setup(context([unit('a'), unit('b')]));

        const result = await service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }, { itemId: 'b', code: 'AST-0002' }], { photoUrl: '/uploads/x.jpg' }));

        expect(assets.createAssetsWith).toHaveBeenCalledWith(manager, 'hr-1', [{ itemId: 'a', barcode: 'AST-0001' }, { itemId: 'b', barcode: 'AST-0002' }], 'it-1');
        expect(schedules.completeWith).toHaveBeenCalledWith(manager, 'hr-1', 'it-1');
        expect(hardware.completeInstallationWith).toHaveBeenCalledWith(manager, 'hr-1', 'it-1');
        const activities = manager.save.mock.calls.filter(([e]) => e === HardwareRequestActivity).map(([, row]) => row as { metadata: Record<string, unknown>; action: string });
        expect(activities.find((a) => a.metadata.step === 'ICT')).toMatchObject({
            action: 'UPDATED', metadata: { step: 'ICT', signerId: 'it-1', signerName: 'RM Bagastyo', how: 'digital', signature: SIGNATURE },
        });
        expect(activities.find((a) => a.metadata.change === 'ASSETS_REGISTERED')).toMatchObject({ metadata: { count: 2, photoUrl: '/uploads/x.jpg' } });
        expect(documents.bump).toHaveBeenCalledWith('flow-1', 'DIG', 'TTD teknisi — 2 aset tercatat', 'it-1', manager);
        expect(hardware.announceInstallCompleted).toHaveBeenCalledWith(expect.objectContaining({ id: 'hr-1' }), 'it-1');
        expect(stepper.tell).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            actorId: 'it-1', phase: 'INSTALLED', target: TicketStatus.RESOLVED, text: 'Pemasangan selesai — menunggu Leony mengecek',
        }));
        expect(result).toEqual({ status: RequestStatus.AWAITING_USER_CONFIRMATION, assets: 2 });
    });

    it('never puts the signature into the result', async () => {
        const { service } = setup(context([unit('a')]));
        const result = await service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }]));
        expect(JSON.stringify(result)).not.toContain('base64');
    });

    it('only a processor may report, and only while installing with an agreed schedule', async () => {
        await expect(setup(context([unit('a')])).service.installDone({ ...IT, role: UserRole.USER }, TID, dto([{ itemId: 'a', code: 'AST-0001' }])))
            .rejects.toBeInstanceOf(ForbiddenException);
        await expect(setup(context([unit('a')], RequestStatus.AWAITING_DELIVERY)).service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }])))
            .rejects.toThrow('Permintaan ini tidak sedang dalam tahap pemasangan');
        await expect(setup(context([unit('a')]), 0).service.installDone(IT, TID, dto([{ itemId: 'a', code: 'AST-0001' }])))
            .rejects.toThrow('Permintaan ini tidak sedang dalam tahap pemasangan');
    });

    it('refuses another site', async () => {
        const { service } = setup(context([unit('a')]));
        await expect(service.installDone({ ...IT, siteId: 'site-2' }, TID, dto([{ itemId: 'a', code: 'AST-0001' }]))).rejects.toBeInstanceOf(ForbiddenException);
    });
});
