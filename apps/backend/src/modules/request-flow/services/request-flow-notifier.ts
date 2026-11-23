import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildAppUrl } from '../../../shared/mail/app-url.util';
import { MailDispatchService } from '../../../shared/mail/mail-dispatch.service';
import { Notification, NotificationType } from '../../notifications/entities/notification.entity';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { User } from '../../users/entities/user.entity';
import { STEP_LABEL, type ApprovalStep } from '../domain/approval-phase';
import type { RequestKind } from '../domain/request-kind';
import type { FlowContext } from './request-flow-reader';

const MAIL_TEMPLATE = 'hardware-request-status';
const KIND_LABEL: Record<RequestKind, string> = { HARDWARE: 'permintaan hardware', EFORM: 'pengajuan akses' };
/** The same types the old pages used for "someone must approve" (no new enum values are added). */
const ASK_TYPE: Record<RequestKind, NotificationType> = {
    HARDWARE: NotificationType.HARDWARE_REQUEST_SUBMITTED,
    EFORM: NotificationType.EFORM_SUBMITTED,
};

const REMINDER_WINDOW_MS = 60 * 60 * 1000;

/** The same notice (recipient, kind, text, document version) always maps to the same id, so a retry cannot store or mail it twice. */
export function noticeId(ctx: FlowContext, userId: string, type: NotificationType, title: string, window = ''): string {
    const h = createHash('sha256').update([ctx.flow.id, ctx.flow.documentVersion, userId, type, title, window].join('|')).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** In-app and email notices of the request flow. Failures are logged and never fail the step that caused them. */
@Injectable()
export class RequestFlowNotifier {
    private readonly logger = new Logger(RequestFlowNotifier.name);
    /** Clock for reminders; a test replaces it. */
    now: () => number = () => Date.now();

    constructor(
        private readonly notifications: NotificationCenterService,
        private readonly mail: MailDispatchService,
        @InjectRepository(User) private readonly users: Repository<User>,
    ) {}

    /** It is `userId`'s turn to sign `step` (or IT reminds them to). */
    async askApprover(ctx: FlowContext, step: ApprovalStep, userId: string, reminder = false): Promise<void> {
        const title = `${reminder ? 'Pengingat: ' : ''}Persetujuan ${step === 'GM' ? 'GM ' : ''}Diperlukan`;
        const message = `${ctx.requesterName} mengajukan ${KIND_LABEL[ctx.kind]} (${ctx.ticket.ticketNumber}) yang menunggu tanda tangan ${STEP_LABEL[step]}.`;
        // A reminder is meant to be repeated: it counts as a new notice once per hour, while a retry inside the hour is still one.
        const window = reminder ? String(Math.floor(this.now() / REMINDER_WINDOW_MS)) : '';
        await this.send(userId, ASK_TYPE[ctx.kind], title, message, ctx, window);
    }

    /** The requester hears of a step that concerns them (returned to IT, approved). */
    async tellRequester(ctx: FlowContext, title: string, message: string): Promise<void> {
        await this.send(ctx.requesterId, NotificationType.TICKET_UPDATED, title, message, ctx);
    }

    /** Any other person in the flow (IT, when a request comes back). */
    async tellUser(ctx: FlowContext, userId: string, title: string, message: string): Promise<void> {
        await this.send(userId, NotificationType.TICKET_UPDATED, title, message, ctx);
    }

    private async send(userId: string, type: NotificationType, title: string, message: string, ctx: FlowContext, window = ''): Promise<void> {
        const link = `/tickets/${ctx.ticket.id}`;
        const id = noticeId(ctx, userId, type, title, window);
        let repeat = false;
        try {
            repeat = await this.users.manager.exists(Notification, { where: { id } });
            if (!repeat) await this.notifications.send({
                id, userId, type, title, message, ticketId: ctx.ticket.id, referenceId: `${ctx.flow.id}_${ctx.flow.documentVersion}_${type}${window ? `_${window}` : ''}`, link,
            });
        } catch (err: any) {
            this.logger.error(`In-app notice for ticket ${ctx.ticket.id} failed: ${err?.message ?? err}`);
        }
        if (repeat) return;
        try {
            const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'email'] });
            if (!user?.email) return;
            await this.mail.send({
                to: user.email,
                subject: `${title} - ${ctx.ticket.ticketNumber}`,
                template: MAIL_TEMPLATE,
                context: { requestNumber: ctx.number || ctx.ticket.ticketNumber, title, status: ctx.ticket.ticketNumber, message, link: buildAppUrl(link) },
            });
        } catch (err: any) {
            this.logger.warn(`Email for ticket ${ctx.ticket.id} failed: ${err?.message ?? err}`);
        }
    }
}
