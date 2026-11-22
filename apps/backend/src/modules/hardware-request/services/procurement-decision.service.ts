import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HardwareRequest } from '../domain/entities/hardware-request.entity';
import { HardwareRequestItem } from '../domain/entities/hardware-request-item.entity';
import { ProcurementDecisionDto } from '../dto/procurement-decision.dto';
import { ProcurementCompleteDto } from '../dto/procurement-complete.dto';
import { canTransition } from '../domain/state-machine/request-state';
import { RequestStatus } from '../domain/enums/request-status.enum';
import { HardwareRequestActivity } from '../domain/entities/hardware-request-activity.entity';
import { ActivityAction } from '../domain/enums/activity-action.enum';
import { HR_EVT, HardwareEvents, ProcurementCompletedPayload } from '../domain/events/hardware-request.events';

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
    const outcome = await this.dataSource.transaction(async (mgr) => {
      const req = await this.loadForProcurement(mgr, requestId);
      return this.finish(mgr, req, actorId, dto);
    });
    this.announce(outcome, actorId);
    return outcome.request;
  }

  /**
   * One call per procurement of the unified ticket flow, inside the caller's transaction: every unit still undecided
   * gets its decision (and vendor, cost, invoice when bought) and the request moves on. The caller announces the outcome.
   */
  async recordWith(
    mgr: EntityManager,
    requestId: string,
    actorId: string,
    input: { lines: ProcurementLine[]; note?: string },
  ): Promise<ProcurementOutcome> {
    const req = await this.loadForProcurement(mgr, requestId);
    const pending = req.items.filter((i) => !i.procurementDecision);
    const lineOf = this.assignLines(pending, input.lines);
    const now = new Date();
    const note = input.note?.trim() ?? '';
    const decided = req.items.map((item) => {
      const line = lineOf.get(item.id);
      if (!line) return item;
      const bought = line.decision === 'APPROVED';
      return Object.assign(item, {
        procurementDecision: line.decision,
        procurementDecidedAt: now,
        procurementDecidedBy: actorId,
        ...(bought ? {
          vendor: line.vendor!.trim(),
          actualCost: line.unitCost!.toFixed(2),
          invoiceNumber: line.invoiceNumber?.trim() || null,
          invoiceDate: line.invoiceDate ? new Date(line.invoiceDate) : null,
        } : {}),
      });
    });
    if (decided.every((i) => i.procurementDecision === 'REJECTED') && note.length < REJECT_NOTE_MIN) {
      throw new BadRequestException(MESSAGES.rejectReason);
    }
    req.items = decided;
    return this.finish(mgr, req, actorId, { rejectReason: note || undefined, note: note || undefined });
  }

  /** Tells the listeners (ticket card, in-app, e-mail, realtime) once the procurement transaction has committed. */
  announce(outcome: ProcurementOutcome, actorId: string): void {
    const payload: ProcurementCompletedPayload = {
      requestId: outcome.request.id,
      ownerId: outcome.request.requesterId,
      approvedItems: outcome.approvedItems,
      rejectedItems: outcome.rejectedItems,
    };
    this.emitter.emit(HardwareEvents.ProcurementCompleted, payload);
    if (outcome.approvedItems > 0) {
      this.emitter.emit(HR_EVT.PROCUREMENT_DONE, {
        requestId: outcome.request.id, actorId, occurredAt: new Date(), requesterId: outcome.request.requesterId,
      });
    }
  }

  private async loadForProcurement(mgr: EntityManager, requestId: string): Promise<HardwareRequest> {
    const req = await mgr.getRepository(HardwareRequest).findOne({ where: { id: requestId }, relations: ['items'] });
    if (!req) throw new NotFoundException('request not found');
    if (req.status !== RequestStatus.PROCUREMENT) {
      throw new BadRequestException(`cannot complete from status ${req.status}`);
    }
    return req;
  }

  /** Each undecided unit must appear in exactly one line, and a unit that is bought needs vendor and cost. */
  private assignLines(pending: HardwareRequestItem[], lines: ProcurementLine[]): Map<string, ProcurementLine> {
    const lineOf = new Map<string, ProcurementLine>();
    const known = new Set(pending.map((i) => i.id));
    for (const line of lines) {
      if (line.decision === 'APPROVED' && (!line.vendor?.trim() || typeof line.unitCost !== 'number' || !(line.unitCost >= 0))) {
        throw new BadRequestException(MESSAGES.vendorCost);
      }
      for (const id of line.itemIds) {
        if (!known.has(id) || lineOf.has(id)) throw new BadRequestException(MESSAGES.coverage);
        lineOf.set(id, line);
      }
    }
    if (lineOf.size !== known.size) throw new BadRequestException(MESSAGES.coverage);
    return lineOf;
  }

  /** The state machine step shared by both ways in: saves the items, moves the request, logs the activity. */
  private async finish(mgr: EntityManager, req: HardwareRequest, actorId: string, dto: ProcurementCompleteDto): Promise<ProcurementOutcome> {
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

    await mgr.getRepository(HardwareRequestItem).save(req.items.map((i) => ({
      ...i,
      deliveryStatus: i.procurementDecision === 'APPROVED' ? 'PENDING' : 'NOT_PROCURED',
    })) as HardwareRequestItem[]);

    const fromStatus = req.status as RequestStatus;
    const request = await mgr.getRepository(HardwareRequest).save({
      ...req,
      status: nextStatus,
      rejectReason: nextStatus === RequestStatus.REJECTED ? dto.rejectReason : req.rejectReason,
    } as unknown as HardwareRequest);

    const activities = mgr.getRepository(HardwareRequestActivity);
    await activities.save(activities.create({
      requestId: req.id,
      actorId,
      action: ActivityAction.PROCUREMENT_COMPLETED,
      fromStatus,
      toStatus: nextStatus,
      metadata: { approvedItems: approved.length, rejectedItems: rejected.length, ...(dto.note ? { note: dto.note } : {}) },
    }));

    return { request, approvedItems: approved.length, rejectedItems: rejected.length };
  }
}

/** One group of units bought (or not) the same way. */
export interface ProcurementLine {
  itemIds: string[];
  decision: 'APPROVED' | 'REJECTED';
  vendor?: string;
  unitCost?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
}

export interface ProcurementOutcome { request: HardwareRequest; approvedItems: number; rejectedItems: number }

const REJECT_NOTE_MIN = 5;
const MESSAGES = {
  rejectReason: 'Isi alasan penolakan',
  vendorCost: 'Vendor dan harga wajib diisi untuk barang yang dibeli',
  coverage: 'Setiap barang yang belum diputuskan harus ada tepat satu kali',
} as const;
