import { InstallStatus } from '../domain/enums/install-status.enum';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from '../domain/entities/installation-schedule-item.entity';
import { MutualSchedulingService } from './mutual-scheduling.service';

const FUTURE = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

function setup(schedule: Partial<InstallationSchedule> = {}) {
    const request = { id: 'hr-1', requesterId: 'req-1', siteId: 'site-1', status: RequestStatus.INSTALLATION };
    const schedRepo = {
        find: jest.fn(async () => []),
        findOne: jest.fn(async () => ({ id: 's-1', requestId: 'hr-1', technicianId: 'tech-1', status: InstallStatus.CONFIRMED, rescheduleCount: 0, request, ...schedule })),
        create: jest.fn((v: object) => v),
        save: jest.fn(async (v: object) => ({ id: 's-new', ...v })),
    };
    const repos = new Map<unknown, unknown>([
        [HardwareRequest, { findOne: jest.fn(async () => request) }],
        [HardwareRequestItem, { findBy: jest.fn(async () => [{ id: 'i-1', requestId: 'hr-1', deliveryStatus: 'ARRIVED' }]) }],
        [InstallationSchedule, schedRepo],
        [InstallationScheduleItem, { create: jest.fn((v: object) => v), save: jest.fn(async (v: unknown) => v) }],
    ]);
    const manager = { getRepository: (e: unknown) => repos.get(e), query: jest.fn(async () => []) };
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)) };
    const emitter = { emit: jest.fn() };
    const service = new MutualSchedulingService(null as never, null as never, null as never, null as never, emitter as never, dataSource as never);
    return { service, schedRepo, manager };
}

describe('MutualSchedulingService', () => {
    it('stores the note of a proposal on the schedule', async () => {
        const { service, schedRepo } = setup();
        await service.proposeSchedule('hr-1', {
            itemIds: ['i-1'], technicianId: 'tech-1', slots: [{ start: FUTURE(24), end: FUTURE(26) }], note: 'Bawa kabel LAN',
        }, { id: 'it-1' });
        expect(schedRepo.create).toHaveBeenCalledWith(expect.objectContaining({ note: 'Bawa kabel LAN' }));
    });

    it('mirrors the reschedule count to the request flow in the same transaction', async () => {
        const { service, manager } = setup({ rescheduleCount: 1 });
        await service.requestReschedule('hr-1', 's-1', { reason: 'Sedang cuti' } as never, { id: 'req-1' });
        expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE request_flows SET "rescheduleCount" = "rescheduleCount" + 1'), ['hr-1']);
    });

    it('keeps the limit of three reschedule requests and does not count a refused one', async () => {
        const { service, manager } = setup({ rescheduleCount: 3 });
        await expect(service.requestReschedule('hr-1', 's-1', { reason: 'lagi' } as never, { id: 'req-1' })).rejects.toThrow('Batas jadwal ulang (3x) tercapai');
        expect(manager.query).not.toHaveBeenCalled();
    });
});
