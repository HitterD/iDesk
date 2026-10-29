import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, LessThan, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { CacheInvalidationService } from '../../../shared/core/cache';
import { TicketClosedReason, TicketUpdatedEvent } from '../events/ticket-updated.event';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { WorkloadService } from '../../workload/workload.service';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationCenterService } from '../../notifications/notification-center.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { SlaClockService } from './sla-clock.service';

/** Actor id recorded for transitions made by the auto-close cron. */
export const SYSTEM_ACTOR_ID = 'system';
const SYSTEM_ACTOR_NAME = 'Sistem';

/** Open statuses from which the requester may close the ticket themselves. */
const SELF_RESOLVABLE_STATUSES: TicketStatus[] = [
    TicketStatus.TODO,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_VENDOR,
];

export const RESOLUTION_MESSAGES = {
    NOT_OWNER: 'Hanya pemohon tiket yang dapat melakukan aksi ini.',
    NOT_AWAITING_CONFIRMATION: 'Tiket tidak sedang menunggu konfirmasi penyelesaian.',
    NOT_SELF_RESOLVABLE: 'Tiket hanya bisa ditandai selesai saat berstatus To Do, In Progress, atau Waiting Vendor.',
} as const;

interface TransitionResult {
    ticket: Ticket;
    oldStatus: TicketStatus;
    changes: string[];
    messages: TicketMessage[];
    /** Set when the transition closed the ticket; partners tell the PIC why. */
    closedReason?: TicketClosedReason;
    /** The requester's comment when they disputed (reopened) the resolution. */
    reason?: string;
}

/**
 * Requester side of the resolution flow. An agent's RESOLVED only opens a confirmation
 * window; the ticket becomes CLOSED (final, locked) when the requester confirms,
 * closes it themselves, or the window expires. A dispute sends it back to the agent.
 */
@Injectable()
export class TicketResolutionService {
    private readonly logger = new Logger(TicketResolutionService.name);

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly eventsGateway: EventsGateway,
        private readonly cacheInvalidationService: CacheInvalidationService,
        private readonly eventEmitter: EventEmitter2,
        private readonly auditService: AuditService,
        private readonly workloadService: WorkloadService,
        private readonly notificationService: NotificationService,
        private readonly notificationCenterService: NotificationCenterService,
        private readonly slaClock: SlaClockService,
    ) { }

    async confirmResolution(ticketId: string, userId: string): Promise<Ticket> {
        const { result, user } = await this.runAsOwner(ticketId, userId, async (manager, ticket, owner) => {
            if (ticket.status !== TicketStatus.RESOLVED) {
                throw new BadRequestException(RESOLUTION_MESSAGES.NOT_AWAITING_CONFIRMATION);
            }
            this.close(ticket);
            const note = await this.saveMessage(manager, ticket.id, `System: Penyelesaian tiket dikonfirmasi oleh ${owner.fullName}`, null);
            return { ticket: await manager.save(Ticket, ticket), oldStatus: TicketStatus.RESOLVED, changes: ['Status changed from RESOLVED to CLOSED (dikonfirmasi pemohon)'], messages: [note], closedReason: 'confirmed' as const };
        });
        return this.publish(result, user);
    }

    async disputeResolution(ticketId: string, userId: string, reason: string): Promise<Ticket> {
        const { result, user } = await this.runAsOwner(ticketId, userId, async (manager, ticket, owner) => {
            if (ticket.status !== TicketStatus.RESOLVED) {
                throw new BadRequestException(RESOLUTION_MESSAGES.NOT_AWAITING_CONFIRMATION);
            }
            ticket.status = TicketStatus.IN_PROGRESS;
            ticket.disputedAt = new Date();
            ticket.resolutionDeadlineAt = null;
            // The ticket is no longer done; the next resolve sets a fresh timestamp.
            ticket.resolvedAt = null;
            // Resume the SLA from what was left at resolve; time spent RESOLVED does not count.
            await this.slaClock.release(ticket);
            const reasonMessage = await this.saveMessage(manager, ticket.id, `Sanggahan penyelesaian: ${reason.trim()}`, owner.id, false);
            // Chat clients render user bubbles from the embedded sender, like a normal reply.
            const reasonWithSender = Object.assign(reasonMessage, { sender: { id: owner.id, fullName: owner.fullName, role: owner.role } });
            const note = await this.saveMessage(manager, ticket.id, `System: ${owner.fullName} menyanggah penyelesaian, tiket dikembalikan ke In Progress`, null);
            return { ticket: await manager.save(Ticket, ticket), oldStatus: TicketStatus.RESOLVED, changes: ['Status changed from RESOLVED to IN_PROGRESS (disanggah pemohon)'], messages: [reasonWithSender, note], reason: reason.trim() };
        });
        const saved = await this.publish(result, user);
        await this.notifyAgentOfDispute(saved, user, reason);
        return saved;
    }

    async selfResolve(ticketId: string, userId: string): Promise<Ticket> {
        const { result, user } = await this.runAsOwner(ticketId, userId, async (manager, ticket, owner) => {
            if (!SELF_RESOLVABLE_STATUSES.includes(ticket.status)) {
                throw new BadRequestException(RESOLUTION_MESSAGES.NOT_SELF_RESOLVABLE);
            }
            const oldStatus = ticket.status;
            if (oldStatus === TicketStatus.WAITING_VENDOR) {
                this.endVendorPause(ticket);
            }
            ticket.resolvedAt = new Date();
            this.close(ticket);
            const note = await this.saveMessage(manager, ticket.id, `System: Tiket ditandai selesai oleh pemohon (${owner.fullName})`, null);
            return { ticket: await manager.save(Ticket, ticket), oldStatus, changes: [`Status changed from ${oldStatus} to CLOSED (ditandai selesai oleh pemohon)`], messages: [note], closedReason: 'manual' as const };
        });
        return this.publish(result, user);
    }

    /** Closes every RESOLVED ticket whose confirmation window has passed. */
    async autoCloseExpired(now: Date = new Date()): Promise<{ closed: number; failed: number }> {
        const rows = await this.ticketRepo.find({
            where: { status: TicketStatus.RESOLVED, resolutionDeadlineAt: LessThan(now) },
            select: ['id'],
        });
        let closed = 0;
        let failed = 0;
        for (const row of rows) {
            try {
                if (await this.autoClose(row.id)) closed += 1;
            } catch (err) {
                failed += 1;
                this.logger.error(`Auto-close failed for ticket ${row.id}: ${(err as Error).message}`);
            }
        }
        return { closed, failed };
    }

    private async autoClose(ticketId: string): Promise<boolean> {
        const result = await this.dataSource.transaction(async (manager) => {
            const ticket = await manager.findOne(Ticket, { where: { id: ticketId }, lock: { mode: 'pessimistic_write' } });
            // The requester may have answered between the scan and this lock.
            if (!ticket || ticket.status !== TicketStatus.RESOLVED) return null;
            this.close(ticket);
            const note = await this.saveMessage(manager, ticket.id, 'System: Tiket otomatis ditutup karena tidak ada konfirmasi hingga batas waktu', null);
            return { ticket: await manager.save(Ticket, ticket), oldStatus: TicketStatus.RESOLVED, changes: ['Status changed from RESOLVED to CLOSED (otomatis, batas konfirmasi terlewati)'], messages: [note], closedReason: 'auto_unconfirmed' as const };
        });
        if (!result) return false;
        await this.publish(result, null);
        return true;
    }

    /** Locks the ticket, verifies the caller is its requester, and runs the mutation atomically. */
    private async runAsOwner(
        ticketId: string,
        userId: string,
        mutate: (manager: EntityManager, ticket: Ticket, owner: User) => Promise<TransitionResult>,
    ): Promise<{ result: TransitionResult; user: User }> {
        return this.dataSource.transaction(async (manager) => {
            // FOR UPDATE cannot be combined with the outer joins that relations add.
            const ticket = await manager.findOne(Ticket, { where: { id: ticketId }, lock: { mode: 'pessimistic_write' } });
            if (!ticket) throw new NotFoundException('Ticket not found');
            if (ticket.userId !== userId) throw new ForbiddenException(RESOLUTION_MESSAGES.NOT_OWNER);
            if (ticket.status === TicketStatus.CLOSED) throw new BadRequestException(TICKET_CLOSED_MESSAGE);
            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) throw new NotFoundException('User not found');
            return { result: await mutate(manager, ticket, user), user };
        });
    }

    private close(ticket: Ticket): void {
        ticket.status = TicketStatus.CLOSED;
        ticket.closedAt = new Date();
        ticket.resolutionDeadlineAt = null;
    }

    /** Same bookkeeping as leaving WAITING_VENDOR through a normal status change. */
    private endVendorPause(ticket: Ticket): void {
        if (ticket.lastPausedAt) {
            const pausedMinutes = Math.floor((Date.now() - new Date(ticket.lastPausedAt).getTime()) / 60000);
            ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + pausedMinutes;
            ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + pausedMinutes;
        }
        ticket.lastPausedAt = null;
        ticket.waitingVendorAt = null;
    }

    private async saveMessage(
        manager: EntityManager, ticketId: string, content: string, senderId: string | null, isSystemMessage = true,
    ): Promise<TicketMessage> {
        const message = manager.create(TicketMessage, { ticketId, content, senderId: senderId as string, isSystemMessage });
        return manager.save(TicketMessage, message);
    }

    /** Post-commit side effects shared by every transition. */
    private async publish(result: TransitionResult, actor: User | null): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: result.ticket.id }, relations: ['user', 'assignedTo'] }) ?? result.ticket;
        const siteId = ticket.siteId ?? null;
        const actorId = actor?.id ?? SYSTEM_ACTOR_ID;

        await this.cacheInvalidationService.onTicketChange(ticket.id);
        await this.recalculateWorkload(ticket);

        for (const message of result.messages) {
            this.eventsGateway.notifyNewMessage(ticket.id, message);
        }
        this.eventsGateway.notifyStatusChange(ticket.id, ticket.status, actor?.fullName ?? SYSTEM_ACTOR_NAME, siteId);
        this.eventsGateway.notifyTicketListUpdate(siteId);
        this.eventsGateway.notifyDashboardStatsUpdate(siteId);
        if (siteId) this.eventEmitter.emit('tv-board.ticket-changed', { siteId });

        this.eventEmitter.emit('ticket.updated', new TicketUpdatedEvent(
            ticket.id, ticket.ticketNumber || ticket.id.split('-')[0], actorId, result.changes, ticket, result.closedReason, result.reason,
        ));
        this.refreshActionItems(ticket);

        this.auditService.logAsync({
            userId: actorId,
            action: AuditAction.UPDATE_TICKET,
            entityType: 'ticket',
            entityId: ticket.id,
            oldValue: { status: result.oldStatus },
            newValue: { status: ticket.status },
            description: `Ticket #${ticket.ticketNumber || ticket.id.slice(0, 8)} updated: ${result.changes.join(', ')}`,
        });
        return ticket;
    }

    private async recalculateWorkload(ticket: Ticket): Promise<void> {
        if (!ticket.assignedToId || !ticket.siteId) return;
        try {
            const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: ticket.siteId };
            await this.workloadService.recalculateAgentWorkload(internalActor, ticket.assignedToId, ticket.siteId);
        } catch (error) {
            this.logger.error(`Failed to recalculate workload for ticket ${ticket.ticketNumber}: ${(error as Error).message}`);
        }
    }

    private refreshActionItems(ticket: Ticket): void {
        if (ticket.userId) this.notificationCenterService.emitActionItemsRefresh(ticket.userId, 'TICKET', ticket.id);
        if (ticket.assignedToId) this.notificationCenterService.emitActionItemsRefresh(ticket.assignedToId, 'TICKET', ticket.id);
    }

    private async notifyAgentOfDispute(ticket: Ticket, requester: User, reason: string): Promise<void> {
        if (!ticket.assignedToId) return;
        try {
            await this.notificationService.create({
                userId: ticket.assignedToId,
                type: NotificationType.TICKET_UPDATED,
                title: 'Penyelesaian Disanggah',
                message: `${requester.fullName} menyanggah penyelesaian tiket #${ticket.ticketNumber}: "${reason.trim()}"`,
                ticketId: ticket.id,
                link: `/tickets/${ticket.id}`,
            });
        } catch (error) {
            this.logger.error(`Failed to notify agent about dispute on ticket ${ticket.id}: ${(error as Error).message}`);
        }
    }
}
