import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { InstallationSchedule } from '../domain/entities/installation-schedule.entity';
import { InstallationScheduleItem } from '../domain/entities/installation-schedule-item.entity';
import { ScheduleProposeDto } from '../dto/schedule-propose.dto';
import { SelectSlotDto } from '../dto/select-slot.dto';
import { RequestRescheduleDto } from '../dto/request-reschedule.dto';
import { canTransition } from '../domain/state-machine/request-state';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { InstallStatus } from '../domain/enums/install-status.enum';
import {
  HardwareEvents,
  ScheduleConfirmedPayload,
  ScheduleProposedPayload,
  ScheduleRescheduleRequestedPayload,
} from '../domain/events/hardware-request.events';

const MAX_RESCHEDULE = 3;

@Injectable()
export class MutualSchedulingService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    @InjectRepository(HardwareRequest)
    private readonly reqRepo: Repository<HardwareRequest>,
    @InjectRepository(InstallationSchedule)
    private readonly schedRepo: Repository<InstallationSchedule>,
    @InjectRepository(InstallationScheduleItem)
    private readonly linkRepo: Repository<InstallationScheduleItem>,
    private readonly emitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async proposeSchedule(
    requestId: string,
    dto: ScheduleProposeDto,
    actorId: string,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const reqRepo = mgr.getRepository(HardwareRequest);
      const itemRepo = mgr.getRepository(HardwareRequestItem);
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const linkRepo = mgr.getRepository(InstallationScheduleItem);

      const req = await reqRepo.findOne({ where: { id: requestId } });
      if (!req) throw new NotFoundException('request not found');
      if (![RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION].includes(req.status as RequestStatus)) {
        throw new BadRequestException(`cannot schedule from status ${req.status}`);
      }

      const items = await itemRepo.findBy({ id: In(dto.itemIds) });
      if (items.length !== dto.itemIds.length) {
        throw new BadRequestException('some items not found');
      }
      for (const item of items) {
        if (item.requestId !== requestId) {
          throw new BadRequestException('item not in request');
        }
        if (item.deliveryStatus !== 'ARRIVED') {
          throw new BadRequestException(`item not arrived: ${item.id}`);
        }
      }

      const now = new Date();
      for (const slot of dto.slots) {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        if (start <= now) throw new BadRequestException('slot start in past');
        if (end <= start) throw new BadRequestException('slot end must be after start');
      }

      const schedule = schedRepo.create({
        requestId,
        technicianId: dto.technicianId,
        status: InstallStatus.PROPOSED_AWAITING_USER,
        proposedSlots: dto.slots,
        rescheduleCount: 0,
        proposedBy: actorId,
        scheduledStart: new Date(dto.slots[0].start), // dummy
        scheduledEnd: new Date(dto.slots[0].end), // dummy
        // scheduledStart/End will be overwritten when user selects
      } as Partial<InstallationSchedule>);
      const saved = await schedRepo.save(schedule);

      const links = items.map((item) =>
        linkRepo.create({ scheduleId: saved.id, itemId: item.id }),
      );
      await linkRepo.save(links);

      const payload: ScheduleProposedPayload = {
        requestId,
        scheduleId: saved.id,
        ownerId: req.requesterId,
        technicianId: dto.technicianId,
        slots: dto.slots,
      };
      this.emitter.emit(HardwareEvents.ScheduleProposed, payload);

      return saved;
    });
  }

  async selectSlot(
    requestId: string,
    scheduleId: string,
    dto: SelectSlotDto,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const reqRepo = mgr.getRepository(HardwareRequest);

      const sched = await schedRepo.findOne({
        where: { id: scheduleId },
        relations: ['request'],
      });
      if (!sched) throw new NotFoundException('schedule not found');
      if (sched.requestId !== requestId) throw new BadRequestException('schedule not in request');
      if (sched.status !== InstallStatus.PROPOSED_AWAITING_USER) {
        throw new BadRequestException('schedule not awaiting user');
      }
      const slots = sched.proposedSlots ?? [];
      if (dto.slotIndex < 0 || dto.slotIndex >= slots.length) {
        throw new BadRequestException('slot index out of range');
      }

      const chosen = slots[dto.slotIndex];
      const updated = {
        ...sched,
        status: InstallStatus.CONFIRMED,
        scheduledStart: new Date(chosen.start),
        scheduledEnd: new Date(chosen.end),
        selectedSlotAt: new Date(),
      } as InstallationSchedule;
      const savedSched = await schedRepo.save(updated);

      // transition request status
      if (sched.request.status === RequestStatus.AWAITING_DELIVERY && canTransition(RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION)) {
        await reqRepo.save({ ...sched.request, status: RequestStatus.INSTALLATION } as unknown as HardwareRequest);
      }

      const payload: ScheduleConfirmedPayload = {
        requestId,
        scheduleId,
        technicianId: sched.technicianId,
        scheduledStart: savedSched.scheduledStart!,
        scheduledEnd: savedSched.scheduledEnd!,
      };
      this.emitter.emit(HardwareEvents.ScheduleConfirmed, payload);

      return savedSched;
    });
  }

  async requestReschedule(
    requestId: string,
    scheduleId: string,
    dto: RequestRescheduleDto,
  ): Promise<InstallationSchedule> {
    return this.dataSource.transaction(async (mgr) => {
      const schedRepo = mgr.getRepository(InstallationSchedule);
      const sched = await schedRepo.findOne({ where: { id: scheduleId } });
      if (!sched) throw new NotFoundException('schedule not found');
      if (sched.requestId !== requestId) throw new BadRequestException('schedule not in request');

      const newCount = sched.rescheduleCount + 1;
      if (newCount > MAX_RESCHEDULE) {
        const cancelled = {
          ...sched,
          status: InstallStatus.CANCELLED,
          rescheduleReason: dto.reason,
          rescheduleCount: newCount,
        } as InstallationSchedule;
        await schedRepo.save(cancelled);
        this.emitter.emit(HardwareEvents.ScheduleCancelled, {
          requestId, scheduleId, technicianId: sched.technicianId,
        });
        return cancelled;
      }

      const updated = {
        ...sched,
        status: InstallStatus.RESCHEDULE_REQUESTED,
        rescheduleReason: dto.reason,
        rescheduleCount: newCount,
      } as InstallationSchedule;
      const saved = await schedRepo.save(updated);

      const payload: ScheduleRescheduleRequestedPayload = {
        requestId, scheduleId,
        technicianId: sched.technicianId,
        reason: dto.reason,
        rescheduleCount: newCount,
      };
      this.emitter.emit(HardwareEvents.ScheduleRescheduleRequested, payload);

      return saved;
    });
  }
}