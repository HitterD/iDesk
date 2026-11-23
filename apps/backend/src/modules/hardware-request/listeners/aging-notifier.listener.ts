import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { UserRole } from '../../users/enums/user-role.enum';
import { HR_EVT, HrAgingFlagged } from '../domain/events/hardware-request.events';
import { HardwareRequestQueryService } from '../services/hardware-request-query.service';
import { RequestFlowMembership } from '../services/request-flow-membership.service';

/** Legacy requests (no ticket) have no PIC: the site's operational-support agents carry them. */
const LEGACY_RECIPIENTS = [UserRole.AGENT_OPERATIONAL_SUPPORT];

/** Tells whoever carries a request that it has not moved for days; one notice per request per day. */
@Injectable()
export class AgingNotifierListener {
    private readonly logger = new Logger(AgingNotifierListener.name);

    constructor(
        private readonly notif: NotificationService,
        private readonly center: NotificationCenterService,
        private readonly query: HardwareRequestQueryService,
        private readonly flows: RequestFlowMembership,
        private readonly dataSource: DataSource,
    ) {}

    @OnEvent(HR_EVT.AGING_FLAGGED)
    async onAgingFlagged(e: HrAgingFlagged): Promise<void> {
        try {
            const request = await this.query.findById(e.requestId);
            if (!request) return;
            const message = `Request ${request.requestNumber} belum bergerak ${e.daysInStatus} hari`;
            // The day is part of the reference: the notification service skips a repeat within 24 hours.
            const referenceId = `${request.id}_aging_${new Date().toISOString().slice(0, 10)}`;

            if (await this.flows.has(request.id)) {
                const [row]: { ticketId: string; assignedToId: string | null }[] = await this.dataSource.query(
                    `SELECT f."ticketId" AS "ticketId", t."assignedToId" AS "assignedToId"
                       FROM request_flows f JOIN tickets t ON t.id = f."ticketId" AND t."deletedAt" IS NULL WHERE f."hardwareRequestId" = $1 LIMIT 1`,
                    [request.id],
                );
                if (row?.assignedToId) {
                    await this.send(row.assignedToId, message, referenceId, `/tickets/${row.ticketId}`, row.ticketId);
                    return;
                }
                // No PIC yet: the site's agents see it, on the ticket.
                await this.sendToStaff(request.siteId, message, referenceId, row ? `/tickets/${row.ticketId}` : `/hardware-requests/${request.id}`, row?.ticketId);
                return;
            }
            await this.sendToStaff(request.siteId, message, referenceId, `/hardware-requests/${request.id}`);
        } catch (err) {
            this.logger.error(`Aging notice for request ${e.requestId} failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    private async sendToStaff(siteId: string | null | undefined, message: string, referenceId: string, link: string, ticketId?: string): Promise<void> {
        const staff = await this.center.findStaffAtSite(LEGACY_RECIPIENTS, siteId);
        for (const user of staff) await this.send(user.id, message, referenceId, link, ticketId);
    }

    private async send(userId: string, message: string, referenceId: string, link: string, ticketId?: string): Promise<void> {
        await this.notif.create({
            userId, title: 'Request hardware tertahan', message, type: NotificationType.HARDWARE_REQUEST_AGING, link, referenceId,
            ...(ticketId ? { ticketId } : {}),
        });
    }
}
