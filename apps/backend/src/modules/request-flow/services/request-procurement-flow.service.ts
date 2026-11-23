import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { HardwareRequest } from '../../hardware-request/domain/entities/hardware-request.entity';
import { HardwareRequestActivity } from '../../hardware-request/domain/entities/hardware-request-activity.entity';
import { HardwareRequestItem } from '../../hardware-request/domain/entities/hardware-request-item.entity';
import { ActivityAction } from '../../hardware-request/domain/enums/activity-action.enum';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { ProcurementDecisionService } from '../../hardware-request/services/procurement-decision.service';
import { TicketHardwareLinkService } from '../../hardware-request/services/ticket-hardware-link.service';
import { TicketStatus } from '../../ticketing/entities/ticket.entity';
import { assertSiteAccess } from '../../../shared/core/utils/site-scope.util';
import { REQUEST_PROCESSOR_ROLES } from '../domain/request-roles';
import type { ArrivalsDto } from '../dto/arrivals.dto';
import type { ProcureDto } from '../dto/procure.dto';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';
import type { FlowActor } from './request-flow-review.service';
import { RequestFlowStepper } from './request-flow-stepper';

const MESSAGES = {
    notIct: 'Hanya tim IT yang dapat melakukan ini',
    badTicketId: 'ID tiket tidak valid',
    notHardware: 'Permintaan ini bukan permintaan hardware',
    notProcurement: 'Permintaan ini tidak sedang dalam tahap pengadaan',
    notDelivery: 'Permintaan ini tidak sedang menunggu barang tiba',
    notBought: 'Hanya barang yang sudah dibeli yang bisa ditandai tiba',
} as const;

/** Statuses in which goods can arrive: waiting for delivery, or installing what came first. */
const ARRIVAL_STATUSES: readonly string[] = [RequestStatus.AWAITING_DELIVERY, RequestStatus.INSTALLATION];

/** IT's purchase record and the arrival of the goods, for a hardware request that lives on a ticket. */
@Injectable()
export class RequestProcurementFlowService {
    private readonly logger = new Logger(RequestProcurementFlowService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly procurement: ProcurementDecisionService,
        private readonly stepper: RequestFlowStepper,
        private readonly hardwareLink: TicketHardwareLinkService,
        private readonly documents: RequestDocumentService,
    ) {}

    async procure(actor: FlowActor, ticketId: string, dto: ProcureDto): Promise<{ status: string }> {
        this.assertIct(actor, ticketId);
        const { ctx, outcome } = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.loadHardware(ticketId, manager, actor);
            if (ctx.hardware!.status !== RequestStatus.PROCUREMENT) throw new ConflictException(MESSAGES.notProcurement);
            const outcome = await this.procurement.recordWith(manager, ctx.hardware!.id, actor.userId, { lines: dto.lines, note: dto.note });
            // Nothing bought: the request is over, so its document is final and locked like any refused request.
            if (outcome.approvedItems === 0) {
                await this.documents.bump(ctx.flow.id, 'FIN', `Pembelian dibatalkan oleh ${actor.fullName} · terkunci`, actor.userId, manager);
            }
            return { ctx, outcome };
        });

        // The listeners tell the ticket and the people concerned; all rejected is told by the rejection card instead.
        this.procurement.announce(outcome, actor.userId);
        if (outcome.approvedItems > 0) {
            const total = outcome.approvedItems + outcome.rejectedItems;
            await this.stepper.tell(ctx, {
                actorId: actor.userId, phase: 'REVIEWED', text: `Pembelian dicatat: ${outcome.approvedItems} dari ${total} barang`,
            });
        }
        return { status: outcome.request.status };
    }

    async arrive(actor: FlowActor, ticketId: string, dto: ArrivalsDto): Promise<{ arrived: number }> {
        this.assertIct(actor, ticketId);
        const result = await this.dataSource.transaction(async (manager) => {
            const ctx = await this.loadHardware(ticketId, manager, actor);
            const hardware = ctx.hardware!;
            if (!ARRIVAL_STATUSES.includes(hardware.status)) throw new ConflictException(MESSAGES.notDelivery);
            const wanted = new Set(dto.itemIds);
            const units = (hardware.items ?? []).filter((unit) => wanted.has(unit.id));
            if (units.length !== wanted.size) throw new ConflictException(MESSAGES.notBought);
            const coming = units.filter((unit) => unit.deliveryStatus !== 'ARRIVED');
            if (coming.some((unit) => unit.procurementDecision !== 'APPROVED')) throw new ConflictException(MESSAGES.notBought);
            if (coming.length === 0) return { ctx, arrived: 0, entered: false };

            const now = new Date();
            await manager.save(HardwareRequestItem, coming.map((unit) => Object.assign(unit, { deliveryStatus: 'ARRIVED' as const, arrivedAt: now })));
            const entered = hardware.status === RequestStatus.AWAITING_DELIVERY;
            if (entered) await manager.update(HardwareRequest, { id: hardware.id }, { status: RequestStatus.INSTALLATION });
            await manager.save(HardwareRequestActivity, manager.create(HardwareRequestActivity, {
                requestId: hardware.id, actorId: actor.userId, action: ActivityAction.UPDATED,
                fromStatus: hardware.status as RequestStatus, toStatus: entered ? RequestStatus.INSTALLATION : (hardware.status as RequestStatus),
                metadata: { change: 'ITEMS_ARRIVED', itemIds: coming.map((unit) => unit.id) },
            }));
            return { ctx, arrived: coming.length, entered };
        });

        if (result.arrived > 0) {
            await this.stepper.tell(result.ctx, { actorId: actor.userId, phase: 'REVIEWED', text: `${result.arrived} barang tiba di gudang IT` });
        }
        // The first arrival ends the delivery wait: scheduling is IT's turn and the ticket's SLA runs again. Should that
        // step have failed, any later call retries it while the ticket is still waiting (the request is already in
        // INSTALLATION by then); a failure never fails the arrival itself.
        if (result.entered) await this.resume(result.ctx.hardware!.id, actor.userId);
        else if (this.stillWaiting(result.ctx)) await this.resume(result.ctx.hardware!.id, actor.userId, true);
        return { arrived: result.arrived };
    }

    /** The request is installing but its ticket never left the vendor wait: the resume did not happen (yet). */
    private stillWaiting(ctx: FlowContext): boolean {
        return ctx.hardware?.status === RequestStatus.INSTALLATION && ctx.ticket.status === TicketStatus.WAITING_VENDOR;
    }

    /** A retry is silent: it posts nothing unless the ticket really leaves the vendor wait. */
    private async resume(requestId: string, actorId: string, retry = false): Promise<void> {
        try {
            await this.hardwareLink.resumeForInstallation(requestId, actorId, retry ? { silentUnlessMoved: true } : undefined);
        } catch (err) {
            this.logger.error(`Resuming the ticket of request ${requestId} after arrival failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    private assertIct(actor: FlowActor, ticketId: string): void {
        if (!REQUEST_PROCESSOR_ROLES.includes(actor.role)) throw new ForbiddenException(MESSAGES.notIct);
        if (!isUUID(ticketId)) throw new BadRequestException(MESSAGES.badTicketId);
    }

    private async loadHardware(ticketId: string, manager: Parameters<RequestFlowReader['load']>[1], actor: FlowActor): Promise<FlowContext> {
        const ctx = await this.reader.load(ticketId, manager, true);
        assertSiteAccess(actor, ctx.ticket.siteId);
        if (!ctx.hardware) throw new ConflictException(MESSAGES.notHardware);
        return ctx;
    }
}
