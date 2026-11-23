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
    const trail: string[] = [];
    const dataSource = { transaction: jest.fn(async (cb: (m: unknown) => unknown) => { const out = await cb(manager); trail.push('commit'); return out; }) };
    const emitter = { emit: jest.fn(() => { trail.push('emit'); }) };
    const service = new MutualSchedulingService(null as never, null as never, null as never, null as never, emitter as never, dataSource as never);
    return { service, schedRepo, manager, emitter, trail, request, repos };
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
        expect(manager.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE request_flows'), expect.anything());
    });

describe('MutualSchedulingService: events and locking', () => {
    const propose = (service: MutualSchedulingService) => service.proposeSchedule('hr-1', {
        itemIds: ['i-1'], technicianId: 'tech-1', slots: [{ start: FUTURE(24), end: FUTURE(26) }],
    }, { id: 'it-1' });

    it.each([
        ['proposing', (service: MutualSchedulingService) => propose(service), {}],
        ['picking a slot', (service: MutualSchedulingService) => service.selectSlot('hr-1', 's-1', { slotIndex: 0 } as never, { id: 'req-1' }),
            { status: InstallStatus.PROPOSED_AWAITING_USER, proposedSlots: [{ start: FUTURE(24), end: FUTURE(26) }] }],
        ['asking for another time', (service: MutualSchedulingService) => service.requestReschedule('hr-1', 's-1', { reason: 'cuti' } as never, { id: 'req-1' }), {}],
    ])('%s announces only after the transaction committed', async (_name, act, schedule) => {
        const { service, trail } = setup(schedule as never);
        await act(service as never);
        expect(trail).toEqual(['commit', 'emit']);
    });

    it('a transaction that fails announces nothing', async () => {
        const { service, emitter, repos } = setup({ rescheduleCount: 0 });
        (repos.get(InstallationSchedule) as { save: jest.Mock }).save.mockRejectedValueOnce(new Error('boom'));
        await expect(service.requestReschedule('hr-1', 's-1', { reason: 'cuti' } as never, { id: 'req-1' })).rejects.toThrow('boom');
        expect(emitter.emit).not.toHaveBeenCalled();
    });

    it('takes the request flow row lock first, so two simultaneous picks or proposals cannot both pass', async () => {
        const { service, manager } = setup({ status: InstallStatus.PROPOSED_AWAITING_USER, proposedSlots: [{ start: FUTURE(24), end: FUTURE(26) }] });
        await service.selectSlot('hr-1', 's-1', { slotIndex: 0 } as never, { id: 'req-1' });
        const first = String((manager.query.mock.calls[0] as unknown as [string])[0]);
        expect(first).toContain('request_flows');
        expect(first).toContain('FOR UPDATE');
    });
});
});
