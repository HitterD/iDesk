import { Test } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MutualSchedulingService } from '../mutual-scheduling.service';
import { HardwareRequest } from '../../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../../domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../../domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from '../../domain/entities/installation-schedule-item.entity';
import { RequestStatus } from '../../domain/enums/request-status.enum';
import { InstallStatus } from '../../domain/enums/install-status.enum';

describe('MutualSchedulingService', () => {
  let service: MutualSchedulingService;
  let mockEmitter: jest.Mocked<EventEmitter2>;
  let mockDataSource: any;

  const futureSlot = (hoursFromNow: number) => {
    const start = new Date(Date.now() + hoursFromNow * 3600_000);
    const end = new Date(start.getTime() + 2 * 3600_000);
    return { start: start.toISOString(), end: end.toISOString() };
  };

  beforeEach(async () => {
    mockEmitter = { emit: jest.fn() } as any;
    const itemRepoMock = { findBy: jest.fn() };
    const reqRepoMock = { findOne: jest.fn(), save: jest.fn((x) => x) };
    const schedRepoMock = { create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'sch-1', ...x })), find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    const linkRepoMock = { create: jest.fn((x) => x), save: jest.fn() };

    mockDataSource = {
      transaction: jest.fn(async (cb) => cb({
        getRepository: (e: any) => {
          if (e === HardwareRequestItem) return itemRepoMock;
          if (e === HardwareRequest) return reqRepoMock;
          if (e === InstallationSchedule) return schedRepoMock;
          if (e === InstallationScheduleItem) return linkRepoMock;
          return {};
        },
      })),
      _itemRepo: itemRepoMock, _reqRepo: reqRepoMock,
      _schedRepo: schedRepoMock, _linkRepo: linkRepoMock,
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MutualSchedulingService,
        { provide: getRepositoryToken(HardwareRequestItem), useValue: {} },
        { provide: getRepositoryToken(HardwareRequest), useValue: {} },
        { provide: getRepositoryToken(InstallationSchedule), useValue: {} },
        { provide: getRepositoryToken(InstallationScheduleItem), useValue: {} },
        { provide: EventEmitter2, useValue: mockEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = moduleRef.get(MutualSchedulingService);
  });

  describe('proposeSchedule', () => {
    it('creates schedule status PROPOSED_AWAITING_USER + links items + emits event', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({
        id: 'r1', requesterId: 'u1', status: RequestStatus.AWAITING_DELIVERY,
      });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'ARRIVED' },
        { id: 'i2', requestId: 'r1', deliveryStatus: 'ARRIVED' },
      ]);

      const slots = [futureSlot(2), futureSlot(24)];
      const result = await service.proposeSchedule('r1', {
        itemIds: ['i1', 'i2'], technicianId: 't1', slots,
      }, { id: 'ict-1' });

      expect(result.status).toBe(InstallStatus.PROPOSED_AWAITING_USER);
      expect(mockDataSource._linkRepo.save).toHaveBeenCalled();
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.proposed', expect.objectContaining({
        requestId: 'r1', ownerId: 'u1', technicianId: 't1',
      }));
    });

    describe('re-proposing for the same request', () => {
      const arrange = (existing: any[], busy: any[] = existing) => {
        mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', requesterId: 'u1', status: RequestStatus.INSTALLATION });
        mockDataSource._itemRepo.findBy.mockResolvedValue([{ id: 'i1', requestId: 'r1', deliveryStatus: 'ARRIVED' }]);
        mockDataSource._schedRepo.find.mockImplementation(async ({ where }: any) =>
          where.technicianId ? busy : existing);
      };

      it('does not count this request\'s own confirmed slot as a conflict', async () => {
        const slot = futureSlot(48);
        const confirmed = {
          id: 'old', requestId: 'r1', status: InstallStatus.CONFIRMED, rescheduleCount: 0,
          scheduledStart: new Date(slot.start), scheduledEnd: new Date(slot.end),
        };
        arrange([confirmed]);

        const result = await service.proposeSchedule('r1', { itemIds: ['i1'], technicianId: 't1', slots: [slot] }, { id: 'ict-1' });

        expect(result.status).toBe(InstallStatus.PROPOSED_AWAITING_USER);
      });

      it('retires the previously confirmed schedule so only the new proposal is active', async () => {
        const confirmed = {
          id: 'old', requestId: 'r1', status: InstallStatus.CONFIRMED, rescheduleCount: 1,
          scheduledStart: new Date(futureSlot(24).start), scheduledEnd: new Date(futureSlot(24).end),
        };
        arrange([confirmed], []);

        const result = await service.proposeSchedule('r1', { itemIds: ['i1'], technicianId: 't1', slots: [futureSlot(72)] }, { id: 'ict-1' });

        expect(mockDataSource._schedRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'old', status: InstallStatus.RESCHEDULED }));
        expect(result.rescheduleCount).toBe(1);
      });

      it('still blocks a slot taken by another request', async () => {
        const slot = futureSlot(48);
        const otherRequest = {
          id: 'other', requestId: 'r2', status: InstallStatus.CONFIRMED,
          scheduledStart: new Date(slot.start), scheduledEnd: new Date(slot.end),
        };
        arrange([], [otherRequest]);

        await expect(service.proposeSchedule('r1', { itemIds: ['i1'], technicianId: 't1', slots: [slot] }, { id: 'ict-1' }))
          .rejects.toThrow(/conflicting slot/i);
      });
    });

    it('rejects if any item not ARRIVED', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.AWAITING_DELIVERY });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'PENDING' },
      ]);

      await expect(service.proposeSchedule('r1', {
        itemIds: ['i1'], technicianId: 't1', slots: [futureSlot(2)],
      }, { id: 'ict-1' })).rejects.toThrow(/item not arrived/i);
    });
  });

  describe('selectSlot', () => {
    it('allows the SKD requester to select an SPJ installation slot, not unrelated site staff', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: [futureSlot(2)], technicianId: 't1',
        request: { id: 'r1', requesterId: 'u1', siteId: 'site-spj', status: RequestStatus.INSTALLATION },
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 0 },
        { id: 'u1', siteId: 'site-skd', userRole: 'USER' as any })).resolves.toBeDefined();
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 0 },
        { id: 'agent-krw', siteId: 'site-krw', userRole: 'AGENT_OPERATIONAL_SUPPORT' as any })).rejects.toThrow();
    });
    it('confirms schedule, sets scheduled_start/end from chosen slot, emits event', async () => {
      const slots = [futureSlot(2), futureSlot(24)];
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: slots, technicianId: 't1',
        request: { id: 'r1', status: RequestStatus.AWAITING_DELIVERY },
      });

      const result = await service.selectSlot('r1', 'sch-1', { slotIndex: 1 }, { id: 'u1' });

      expect(result.status).toBe(InstallStatus.CONFIRMED);
      expect(result.scheduledStart!.toISOString()).toBe(slots[1].start);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.confirmed', expect.any(Object));
    });

    it('throws if slotIndex out of range', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: [futureSlot(2)],
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 2 }, { id: 'u1' }))
        .rejects.toThrow(/slot index out of range/i);
    });

    it('throws if schedule not in PROPOSED_AWAITING_USER', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED,
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 0 }, { id: 'u1' }))
        .rejects.toThrow(/not awaiting user/i);
    });
  });

  describe('requestReschedule', () => {
    it('increments count + sets RESCHEDULE_REQUESTED + emits event', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: InstallStatus.PROPOSED_AWAITING_USER,
        rescheduleCount: 0, technicianId: 't1', requestId: 'r1',
      });

      const result = await service.requestReschedule('r1', 'sch-1', { reason: 'busy' }, { id: 'u1' });

      expect(result.status).toBe(InstallStatus.RESCHEDULE_REQUESTED);
      expect(result.rescheduleCount).toBe(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.reschedule-requested', expect.any(Object));
    });

    it('rejects a 4th reschedule and leaves the schedule as it was', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: InstallStatus.CONFIRMED,
        rescheduleCount: 3, requestId: 'r1',
      });

      await expect(service.requestReschedule('r1', 'sch-1', { reason: 'busy again' }, { id: 'u1' }))
        .rejects.toThrow(/batas jadwal ulang/i);
      expect(mockDataSource._schedRepo.save).not.toHaveBeenCalled();
      expect(mockEmitter.emit).not.toHaveBeenCalled();
    });

    it.each([InstallStatus.DONE, InstallStatus.CANCELLED, InstallStatus.RESCHEDULED, InstallStatus.IN_PROGRESS])(
      'rejects a reschedule of a %s schedule',
      async (status) => {
        mockDataSource._schedRepo.findOne.mockResolvedValue({ id: 'sch-1', status, rescheduleCount: 0, requestId: 'r1' });

        await expect(service.requestReschedule('r1', 'sch-1', { reason: 'x' }, { id: 'u1' }))
          .rejects.toThrow(/cannot reschedule/i);
      },
    );
  });
});
