import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { EFormRequest, EFormStatus } from '../../eform-request/entities/eform-request.entity';
import { RequestStatus } from '../../hardware-request/domain/enums/request-status.enum';
import { HardwareRequestCommandService } from '../../hardware-request/services/hardware-request-command.service';
import { TicketUpdatedEvent } from '../../ticketing/events/ticket-updated.event';
import { RequestDocumentRevision } from '../entities/request-document-revision.entity';
import { finalRevisionLabel } from './request-confirm-flow.service';
import { RequestDocumentService } from './request-document.service';
import { RequestFlowReader, type FlowContext } from './request-flow-reader';

const SYSTEM_USER = 'system';
const FINAL_KIND = 'FIN';
const HARDWARE_DONE: readonly string[] = [RequestStatus.COMPLETED, RequestStatus.CLOSED];

/**
 * A request ticket can be closed, or disputed, from the ticket itself (the requester's button on the ticket, or the
 * auto-close after the confirmation window). The request behind it follows: finalised with its FIN revision, or sent back
 * to IT. Runs after the ticket's own commit and never throws back into it; a retry is safe (the FIN revision is added once).
 */
@Injectable()
export class RequestFlowFinalizer {
    private readonly logger = new Logger(RequestFlowFinalizer.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly reader: RequestFlowReader,
        private readonly hardware: HardwareRequestCommandService,
        private readonly documents: RequestDocumentService,
    ) {}

    @OnEvent('ticket.updated', { async: true })
    async onTicketUpdated(event: TicketUpdatedEvent): Promise<void> {
        const closed = event.closedReason === 'confirmed' || event.closedReason === 'auto_unconfirmed';
        const disputed = !closed && Boolean(event.reason);
        if (!closed && !disputed) return;
        try {
            const ctx = await this.reader.load(event.ticketId).catch(() => null);
            if (!ctx) return;
            if (closed) await this.finalise(ctx, event);
            else await this.sendBack(ctx, event);
        } catch (err: any) {
            this.logger.error(`Could not follow ticket ${event.ticketId} in its request: ${err?.message ?? err}`);
        }
    }

    private async finalise(ctx: FlowContext, event: TicketUpdatedEvent): Promise<void> {
        const auto = event.closedReason === 'auto_unconfirmed';
        const actorId = auto ? null : event.userId;
        let announce: () => void = () => undefined;
        if (ctx.hardware?.status === RequestStatus.AWAITING_USER_CONFIRMATION) {
            if (auto) await this.hardware.autoConfirmInstallation(ctx.hardware.id);
            else announce = (await this.dataSource.transaction((manager) => this.hardware.confirmInstallationWith(manager, ctx.hardware!.id, event.userId, { kind: 'ACCEPT_AS_IS' }, false))).announce;
        }
        await this.dataSource.transaction(async (manager) => {
            const locked = await this.reader.load(ctx.ticket.id, manager, true);
            if (locked.eform?.status === EFormStatus.AWAITING_CONFIRMATION) {
                await manager.update(EFormRequest, { id: locked.eform.id }, { status: EFormStatus.CONFIRMED, resolvedAt: new Date() });
            } else if (!this.isFinished(locked)) {
                return;
            }
            const latest = await manager.findOne(RequestDocumentRevision, { where: { flowId: locked.flow.id }, order: { version: 'DESC' } });
            if (latest?.kind !== FINAL_KIND) await this.documents.bump(locked.flow.id, FINAL_KIND, finalRevisionLabel(locked.number), actorId, manager);
        });
        announce();
    }

    private isFinished(ctx: FlowContext): boolean {
        if (ctx.hardware) return HARDWARE_DONE.includes(ctx.hardware.status);
        return ctx.eform?.status === EFormStatus.CONFIRMED;
    }

    /** The requester disputed the resolution on the ticket: the request goes back to the work, like the card's "issue". */
    private async sendBack(ctx: FlowContext, event: TicketUpdatedEvent): Promise<void> {
        if (event.userId === SYSTEM_USER) return;
        if (ctx.hardware?.status === RequestStatus.AWAITING_USER_CONFIRMATION) {
            const done = await this.dataSource.transaction((manager) => this.hardware.confirmInstallationWith(manager, ctx.hardware!.id, event.userId, { kind: 'REPORT_ISSUE', comments: event.reason }, false));
            done.announce();
        } else if (ctx.eform?.status === EFormStatus.AWAITING_CONFIRMATION) {
            await this.dataSource.transaction((manager) => manager.update(EFormRequest, { id: ctx.eform!.id }, { status: EFormStatus.PENDING_ICT }));
        }
    }
}
