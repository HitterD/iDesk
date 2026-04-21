import { Test } from '@nestjs/testing';
import { InstallationController } from './installation.controller';
import { InstallationScheduleService } from '../services/installation-schedule.service';
import { HardwareAssetService } from '../services/hardware-asset.service';
import { HardwareRequestCommandService } from '../services/hardware-request-command.service';
import { MutualSchedulingService } from '../services/mutual-scheduling.service';
import { DeliveryTrackingService } from '../services/delivery-tracking.service';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { HardwareRoleGuard } from '../guards/hardware-role.guard';

describe('InstallationController', () => {
    let ctrl: InstallationController;
    let scheduleSvc: jest.Mocked<Partial<InstallationScheduleService>>;
    let assetSvc: jest.Mocked<Partial<HardwareAssetService>>;
    let cmdSvc: jest.Mocked<Partial<HardwareRequestCommandService>>;
    let mutualSchedSvc: jest.Mocked<Partial<MutualSchedulingService>>;
    let deliverySvc: jest.Mocked<Partial<DeliveryTrackingService>>;
    let querySvc: jest.Mocked<Partial<HardwareRequestQueryService>>;

    beforeEach(async () => {
        scheduleSvc = {
            propose: jest.fn(), confirm: jest.fn(), reschedule: jest.fn(),
            startInstallation: jest.fn(), completeInstallation: jest.fn(), calendar: jest.fn(),
            unscheduled: jest.fn(), myToday: jest.fn(),
        };
        assetSvc = { createAsset: jest.fn(), findByBarcode: jest.fn() };
        cmdSvc = { completeInstallation: jest.fn() };
        mutualSchedSvc = { proposeSchedule: jest.fn(), selectSlot: jest.fn(), requestReschedule: jest.fn() };
        deliverySvc = { updateDelivery: jest.fn() };
        querySvc = { getById: jest.fn() };

        const moduleRef = await Test.createTestingModule({
            controllers: [InstallationController],
            providers: [
                { provide: InstallationScheduleService, useValue: scheduleSvc },
                { provide: HardwareAssetService, useValue: assetSvc },
                { provide: HardwareRequestCommandService, useValue: cmdSvc },
                { provide: MutualSchedulingService, useValue: mutualSchedSvc },
                { provide: DeliveryTrackingService, useValue: deliverySvc },
                { provide: HardwareRequestQueryService, useValue: querySvc },
            ],
        })
        .overrideGuard(HardwareRoleGuard).useValue({ canActivate: () => true })
        .compile();

        ctrl = moduleRef.get(InstallationController);
    });

    const mockReq = { user: { userId: 'u1', role: 'USER' } };

    it('propose calls scheduleSvc', async () => {
        const dto = { scheduledStart: '2026-05-01T09:00:00Z', scheduledEnd: '2026-05-01T10:00:00Z', technicianId: 't1' };
        (scheduleSvc.propose as jest.Mock).mockResolvedValue({ id: 's1' } as any);
        const res = await ctrl.propose('r1', dto as any, mockReq);
        expect(scheduleSvc.propose).toHaveBeenCalledWith('r1', dto, { id: 'u1', role: expect.any(String) });
        expect(res.data.id).toBe('s1');
    });

    it('confirm calls scheduleSvc', async () => {
        (scheduleSvc.confirm as jest.Mock).mockResolvedValue({ id: 's1' } as any);
        const res = await ctrl.confirm('r1', mockReq);
        expect(scheduleSvc.confirm).toHaveBeenCalledWith('r1', { id: 'u1', role: expect.any(String) });
        expect(res.data.id).toBe('s1');
    });

    it('calendar calls scheduleSvc', async () => {
        (scheduleSvc.calendar as jest.Mock).mockResolvedValue([]);
        const q = { from: '2026-01-01', to: '2026-12-31' };
        const res = await ctrl.calendar(q as any);
        expect(scheduleSvc.calendar).toHaveBeenCalledWith(q);
        expect(res.data).toEqual([]);
    });

    it('complete calls both services', async () => {
        (cmdSvc.completeInstallation as jest.Mock).mockResolvedValue({ id: 'r1' } as any);
        const res = await ctrl.complete('r1', {}, mockReq);
        expect(scheduleSvc.completeInstallation).toHaveBeenCalledWith('r1', { id: 'u1', role: expect.any(String) });
        expect(cmdSvc.completeInstallation).toHaveBeenCalledWith('r1', { id: 'u1', role: expect.any(String) });
        expect(res.data.id).toBe('r1');
    });

    it('scan barcode calls assetSvc', async () => {
        (assetSvc.createAsset as jest.Mock).mockResolvedValue({ id: 'a1' } as any);
        const res = await ctrl.scan('r1', 'i1', { barcode: 'BC-123' }, mockReq);
        expect(assetSvc.createAsset).toHaveBeenCalledWith('r1', 'i1', 'BC-123', 'u1');
        expect(res.data.id).toBe('a1');
    });
});
