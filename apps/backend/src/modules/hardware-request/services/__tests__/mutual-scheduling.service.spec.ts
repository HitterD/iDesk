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
      }, 'ict-1');

      expect(result.status).toBe(InstallStatus.PROPOSED_AWAITING_USER);
      expect(mockDataSource._linkRepo.save).toHaveBeenCalled();
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.proposed', expect.objectContaining({
        requestId: 'r1', ownerId: 'u1', technicianId: 't1',
      }));
    });

    it('rejects if any item not ARRIVED', async () => {
      mockDataSource._reqRepo.findOne.mockResolvedValue({ id: 'r1', status: RequestStatus.AWAITING_DELIVERY });
      mockDataSource._itemRepo.findBy.mockResolvedValue([
        { id: 'i1', requestId: 'r1', deliveryStatus: 'PENDING' },
      ]);

      await expect(service.proposeSchedule('r1', {
        itemIds: ['i1'], technicianId: 't1', slots: [futureSlot(2)],
      }, 'ict-1')).rejects.toThrow(/item not arrived/i);
    });
  });

  describe('selectSlot', () => {
    it('confirms schedule, sets scheduled_start/end from chosen slot, emits event', async () => {
      const slots = [futureSlot(2), futureSlot(24)];
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: slots, technicianId: 't1',
        request: { id: 'r1', status: RequestStatus.AWAITING_DELIVERY },
      });

      const result = await service.selectSlot('r1', 'sch-1', { slotIndex: 1 });

      expect(result.status).toBe(InstallStatus.CONFIRMED);
      expect(result.scheduledStart!.toISOString()).toBe(slots[1].start);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.confirmed', expect.any(Object));
    });

    it('throws if slotIndex out of range', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: [futureSlot(2)],
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 2 }))
        .rejects.toThrow(/slot index out of range/i);
    });

    it('throws if schedule not in PROPOSED_AWAITING_USER', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', requestId: 'r1', status: InstallStatus.CONFIRMED,
      });
      await expect(service.selectSlot('r1', 'sch-1', { slotIndex: 0 }))
        .rejects.toThrow(/not awaiting user/i);
    });
  });

  describe('requestReschedule', () => {
    it('increments count + sets RESCHEDULE_REQUESTED + emits event', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: InstallStatus.PROPOSED_AWAITING_USER,
        rescheduleCount: 0, technicianId: 't1', requestId: 'r1',
      });

      const result = await service.requestReschedule('r1', 'sch-1', { reason: 'busy' });

      expect(result.status).toBe(InstallStatus.RESCHEDULE_REQUESTED);
      expect(result.rescheduleCount).toBe(1);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.reschedule-requested', expect.any(Object));
    });

    it('auto-cancels when count would exceed 3', async () => {
      mockDataSource._schedRepo.findOne.mockResolvedValue({
        id: 'sch-1', status: InstallStatus.PROPOSED_AWAITING_USER,
        rescheduleCount: 3, requestId: 'r1',
      });

      const result = await service.requestReschedule('r1', 'sch-1', { reason: 'busy again' });

      expect(result.status).toBe(InstallStatus.CANCELLED);
      expect(mockEmitter.emit).toHaveBeenCalledWith('schedule.cancelled', expect.any(Object));
    });
  });
});
