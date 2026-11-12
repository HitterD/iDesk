import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TICKET_INACTIVE_STATUSES } from './entities/ticket.entity';
import { MailDispatchService } from '../../shared/mail/mail-dispatch.service';
import { buildAppUrl } from '../../shared/mail/app-url.util';
import { NotificationService } from '../notifications/notification.service';
import { NotificationCenterService } from '../notifications/notification-center.service';
import { UserRole } from '../users/enums/user-role.enum';
import { User } from '../users/entities/user.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

type BreachKind = 'resolution' | 'first_response';

/** Managers of the ticket's site hear about a breach, so someone can step in. */
const SLA_ESCALATION_ROLES = [UserRole.MANAGER];

/**
 * Marks tickets whose SLA ran out and tells the people who can act: the PIC (in-app + email) and the site's
 * managers. Unassigned tickets go to the managers only. Each breach is claimed atomically
 * (UPDATE ... RETURNING), so several instances never notify the same breach twice.
 */
@Injectable()
export class SlaCheckerService {
    private readonly logger = new Logger(SlaCheckerService.name);

    constructor(
        @InjectRepository(Ticket)
        private ticketRepo: Repository<Ticket>,
        private readonly mailDispatch: MailDispatchService,
        private readonly notificationService: NotificationService,
        private readonly notificationCenter: NotificationCenterService,
    ) { }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async checkSla() {
        this.logger.log('Running SLA Checker (Resolution + First Response)...');
        await this.checkResolutionSla();
        await this.checkFirstResponseSla();
        this.logger.log('SLA Checker completed.');
    }

    /** Resolution SLA: only tickets whose SLA clock started; a vendor wait pauses it. */
    private async checkResolutionSla(): Promise<void> {
        const ids = await this.claim(
            `UPDATE "tickets" SET "isOverdue" = true
             WHERE "status" IN ($1, $2) AND "isOverdue" = false
               AND "slaTarget" IS NOT NULL AND "slaStartedAt" IS NOT NULL AND "slaTarget" < $3
             RETURNING "id"`,
            [TicketStatus.IN_PROGRESS, TicketStatus.TODO, new Date()],
        );
        await this.notifyAll(ids, 'resolution');
    }

    /** First response SLA: tickets nobody has answered yet. */
    private async checkFirstResponseSla(): Promise<void> {
        const excluded = [...TICKET_INACTIVE_STATUSES, TicketStatus.WAITING_VENDOR];
        const ids = await this.claim(
            `UPDATE "tickets" SET "isFirstResponseBreached" = true
             WHERE "firstResponseAt" IS NULL AND "firstResponseTarget" IS NOT NULL
               AND "isFirstResponseBreached" = false AND "firstResponseTarget" < $1
               AND "status" <> ALL($2::text[])
             RETURNING "id"`,
            [new Date(), excluded],
        );
        await this.notifyAll(ids, 'first_response');
    }

    /** Runs the marking UPDATE and returns the ids this instance claimed. */
    private async claim(sql: string, params: unknown[]): Promise<string[]> {
        const result = await this.ticketRepo.query(sql, params);
        // pg returns [rows, count] for UPDATE ... RETURNING through TypeORM; tolerate a plain row list too.
        const rows: Array<{ id: string }> = Array.isArray(result?.[0]) ? result[0] : result ?? [];
        return rows.map(r => r.id);
    }

    private async notifyAll(ids: string[], kind: BreachKind): Promise<void> {
        if (ids.length === 0) return;
        this.logger.warn(`${ids.length} ticket(s) breached ${kind} SLA`);
        const tickets = await this.ticketRepo.find({ where: ids.map(id => ({ id })), relations: ['assignedTo'] });
        for (const ticket of tickets) {
            await this.sendOverdueNotifications(ticket, kind).catch(err =>
                this.logger.error(`Failed to send SLA notification for ticket ${ticket.id}: ${err.message}`));
        }
    }

    private async sendOverdueNotifications(ticket: Ticket, kind: BreachKind): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
        const managers = await this.notificationCenter.findStaffAtSite(SLA_ESCALATION_ROLES, ticket.siteId, ticket.assignedToId ? [ticket.assignedToId] : []);
        const recipients: User[] = [...(ticket.assignedTo ? [ticket.assignedTo] : []), ...managers];
        const what = kind === 'resolution' ? 'melewati target waktu penyelesaian (SLA)' : 'belum mendapat respons pertama dalam target SLA';
        const message = `Tiket #${ticketNumber} (${ticket.title}) ${what}. PIC: ${ticket.assignedTo?.fullName ?? 'belum ada'}.`;

        for (const user of recipients) {
            await this.notificationService.create({
                userId: user.id,
                type: NotificationType.SLA_BREACHED,
                title: kind === 'resolution' ? 'SLA terlewati' : 'Respons pertama terlambat',
                message,
                ticketId: ticket.id,
                // One per ticket and breach kind, even if the check runs again.
                referenceId: `${ticket.id}_sla_${kind}`,
                link: `/tickets/${ticket.id}`,
                ticketNumber,
            });
            if (!user.email) continue;
            // Template email: every value is HTML-escaped by Handlebars, never pasted into raw HTML.
            await this.mailDispatch.send({
                to: user.email,
                subject: `SLA: Tiket #${ticketNumber} ${kind === 'resolution' ? 'melewati target' : 'belum direspons'}`,
                template: 'notification',
                context: {
                    title: kind === 'resolution' ? 'SLA Terlewati' : 'Respons Pertama Terlambat',
                    message,
                    ticketId: ticketNumber,
                    link: buildAppUrl(`/tickets/${ticket.id}`),
                    year: new Date().getFullYear(),
                },
            }).catch(err => this.logger.error(`SLA email to ${user.email} failed: ${err.message}`));
        }
        this.logger.log(`[SLA BREACH] ${kind}, ticket #${ticketNumber}, ${recipients.length} recipient(s)`);
    }
}
