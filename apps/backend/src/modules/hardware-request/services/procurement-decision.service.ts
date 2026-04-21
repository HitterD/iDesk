import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { ProcurementDecisionDto } from '../dto/procurement-decision.dto';
import { ProcurementCompleteDto } from '../dto/procurement-complete.dto';
import { canTransition } from '../domain/state-machine/request-state';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareEvents, ProcurementCompletedPayload } from '../domain/events/hardware-request.events';

@Injectable()
export class ProcurementDecisionService {
  constructor(
    @InjectRepository(HardwareRequestItem)
    private readonly itemRepo: Repository<HardwareRequestItem>,
    @InjectRepository(HardwareRequest)
    private readonly reqRepo: Repository<HardwareRequest>,
    private readonly emitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async decideItems(
    requestId: string,
    dto: ProcurementDecisionDto,
    actorId: string,
  ): Promise<HardwareRequestItem[]> {
    const req = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('request not found');
    if (req.status === RequestStatus.APPROVED) {
      if (!canTransition(RequestStatus.APPROVED, RequestStatus.PROCUREMENT)) {
        throw new BadRequestException('cannot start procurement from current status');
      }
      req.status = RequestStatus.PROCUREMENT;
      req.procuredById = actorId;
      await this.reqRepo.save(req);
    } else if (req.status !== RequestStatus.PROCUREMENT) {
      throw new BadRequestException(`cannot decide items in status ${req.status}`);
    }

    const ids = dto.decisions.map((d) => d.itemId);
    const items = await this.itemRepo.findBy({ id: In(ids) });

    if (items.length !== ids.length) {
      throw new BadRequestException('item not in request');
    }

    const invalid = items.find((i) => i.requestId !== requestId);
    if (invalid) {
      throw new BadRequestException('item not in request');
    }

    const now = new Date();
    const updated = items.map((item) => {
      const decisionObj = dto.decisions.find((d) => d.itemId === item.id);
      if (!decisionObj) throw new BadRequestException('item decision missing');
      
      return {
        ...item,
        procurementDecision: decisionObj.decision,
        procurementDecidedAt: now,
        procurementDecidedBy: actorId,
      };
    });
    return this.itemRepo.save(updated as HardwareRequestItem[]);
  }

  async completeProcurement(
    requestId: string,
    dto: ProcurementCompleteDto,
    actorId: string,
  ): Promise<HardwareRequest> {
    return this.dataSource.transaction(async (mgr) => {
      const reqRepoTx = mgr.getRepository(HardwareRequest);
      const itemRepoTx = mgr.getRepository(HardwareRequestItem);

      const req = await reqRepoTx.findOne({
        where: { id: requestId },
        relations: ['items'],
      });
      if (!req) throw new NotFoundException('request not found');
      if (req.status !== RequestStatus.PROCUREMENT) {
        throw new BadRequestException(`cannot complete from status ${req.status}`);
      }

      const undecided = req.items.filter((i) => !i.procurementDecision);
      if (undecided.length > 0) {
        throw new BadRequestException(`undecided items: ${undecided.length}`);
      }

      const approved = req.items.filter((i) => i.procurementDecision === 'APPROVED');
      const rejected = req.items.filter((i) => i.procurementDecision === 'REJECTED');

      if (approved.length === 0 && !dto.rejectReason) {
        throw new BadRequestException('reason required when all items rejected');
      }

      const nextStatus = approved.length > 0 ? RequestStatus.AWAITING_DELIVERY : RequestStatus.REJECTED;
      if (!canTransition(req.status as RequestStatus, nextStatus)) {
        throw new BadRequestException(`cannot transition ${req.status} → ${nextStatus}`);
      }

      // sync per-item delivery_status
      await itemRepoTx.save(req.items.map((i) => ({
        ...i,
        deliveryStatus: i.procurementDecision === 'APPROVED' ? 'PENDING' : 'NOT_PROCURED',
      })) as HardwareRequestItem[]);

      const updatedReq = await reqRepoTx.save({
        ...req,
        status: nextStatus,
        rejectReason: nextStatus === RequestStatus.REJECTED ? dto.rejectReason : req.rejectReason,
      } as unknown as HardwareRequest);

      const payload: ProcurementCompletedPayload = {
        requestId: req.id,
        ownerId: req.requesterId,
        approvedItems: approved.length,
        rejectedItems: rejected.length,
      };
      this.emitter.emit(HardwareEvents.ProcurementCompleted, payload);

      return updatedReq;
    });
  }
}
