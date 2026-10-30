import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus, HandlingTeam, TICKET_INACTIVE_STATUSES } from '../entities/ticket.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { SurveysService } from '../surveys.service';
import { CacheService, CacheInvalidationService } from '../../../shared/core/cache';
import { TicketUpdatedEvent } from '../events/ticket-updated.event';
import { TicketAssignedEvent } from '../events/ticket-assigned.event';
import { TicketCancelledEvent } from '../events/ticket-cancelled.event';
import { BusinessHoursService } from '../../sla-config/business-hours.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { WorkloadService } from '../../workload/workload.service';
import { SiteActor } from '../../../shared/core/utils/site-scope.util';
import { validateTicketAccess } from '../utils/oracle-ticket-access.util';
import { assertTicketRoleAccess, isOracleTicket } from './ticket-oracle-access';
import { validateTicketSiteAccess } from '../utils/site-access.util';
import { ModuleAssignmentPolicyService } from './module-assignment-policy.service';
import { computeResolutionDeadline, TICKET_CLOSED_MESSAGE } from '../utils/resolution-deadline.util';
import { SlaClockService } from './sla-clock.service';
import { TicketVendorVisitService, formatVendorVisit, normalizeVendorNote } from './ticket-vendor-visit.service';
import { TicketSystemEvent, diffActivity, snapshotTicket, systemEvent } from '../utils/ticket-activity.util';
import {
    AppliedTakeover, ModuleEligibility, TakeoverEffectDeps, TakeoverOptions, applyTakeoverDecision, decideBulkTakeovers,
    describeReassignment, ineligibleAssigneeMessage, recordStatusTakeover, resolveStatusTakeover,
} from './status-takeover';

const AGENT_CLOSE_FORBIDDEN_MESSAGE = 'Status CLOSED hanya bisa diberikan oleh pemohon (konfirmasi) atau otomatis setelah batas waktu konfirmasi.';

@Injectable()
export class TicketUpdateService {
    private readonly logger = new Logger(TicketUpdateService.name);

    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly eventsGateway: EventsGateway,
        private readonly surveysService: SurveysService,
        private readonly cacheService: CacheService,
        private readonly cacheInvalidationService: CacheInvalidationService,
        private readonly eventEmitter: EventEmitter2,
        @Optional()
        private readonly businessHoursService: BusinessHoursService,
        private readonly auditService: AuditService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly workloadService: WorkloadService,
        private readonly assignmentPolicy: ModuleAssignmentPolicyService,
        private readonly slaClock: SlaClockService,
        private readonly vendorVisit: TicketVendorVisitService,
    ) { }

    async updateTicket(
        ticketId: string, ticketUpdate: Partial<Ticket> & { vendorVisitRequest?: string; vendorNoteRequest?: string }, userId: string,
        takeoverOpts: TakeoverOptions = {},
    ): Promise<Ticket> {
        // Not columns: the requested vendor appointment and note only matter to the WAITING_VENDOR transition.
        const { vendorVisitRequest, vendorNoteRequest, ...updateData } = ticketUpdate;
        // P1 fix: status transition, priority change, slaTarget recompute, and
        // ticket save were separate awaits. A crash mid-sequence left the
        // ticket in a half-mutated state. Now atomic via dataSource.transaction.
        // postUpdateActions (events, audit) stays outside so listeners fire on
        // commit, not before.
        const { savedTicket, user, changes, oldStatus, takeover, before } = await this.dataSource.transaction(async (manager) => {
            const ticket = await manager.findOne(Ticket, {
                where: { id: ticketId },
                relations: ['user', 'participants', 'assignedTo'],
            });
            if (!ticket) {
                throw new NotFoundException('Ticket not found');
            }

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new NotFoundException('User not found');
            }
            validateTicketAccess(user, ticket);
            if (ticket.status === TicketStatus.CLOSED) {
                throw new BadRequestException(TICKET_CLOSED_MESSAGE);
            }
            if (updateData.status === TicketStatus.CLOSED) {
                throw new BadRequestException(AGENT_CLOSE_FORBIDDEN_MESSAGE);
            }
            const isOwner = ticket.userId === userId;
            const isParticipant = ticket.participants?.some(p => p.userId === userId);
            if (!isOwner && !isParticipant) {
                validateTicketSiteAccess(user.role as UserRole, (user as any).siteId ?? null, (ticket as any).siteId ?? null);
            }

            const changes: string[] = [];
            const oldStatus = ticket.status;
            const before = snapshotTicket(ticket);
            // Throws 409 before anything is written when a non-PIC starts the ticket unconfirmed.
            const decision = updateData.status
                ? await resolveStatusTakeover(ticket, updateData.status, oldStatus, user, takeoverOpts, this.moduleEligibilityOf(user))
                : null;

            if (updateData.status && updateData.status !== ticket.status) {
                await this.applyStatusTransition(ticket, oldStatus, updateData.status, changes, user, manager, { visitAt: vendorVisitRequest, note: vendorNoteRequest });
            }
            const takeover = decision ? applyTakeoverDecision(ticket, user, decision, changes) : null;

            if (updateData.priority && updateData.priority !== ticket.priority) {
                await this.applyPriorityChange(ticket, updateData.priority, changes, manager);
            }

            // Apply updates
            Object.assign(ticket, updateData);
            const savedTicket = await manager.save(Ticket, ticket);
            return { savedTicket, user, changes, oldStatus, takeover, before };
        });

        const activity = systemEvent(user, diffActivity(before, snapshotTicket(savedTicket)), takeover?.reason ?? null);
        await this.postUpdateActions(savedTicket, user, changes, oldStatus, ticketId, userId, activity);
        if (takeover) {
            await recordStatusTakeover(this.takeoverDeps, savedTicket, user, takeover.previous, takeover.reason);
        }
        return savedTicket;
    }

    private get takeoverDeps(): TakeoverEffectDeps {
        return { auditService: this.auditService, workloadService: this.workloadService, eventEmitter: this.eventEmitter, logger: this.logger };
    }

    /** Module curated-list check for `user` becoming PIC, shared with assignTicket's rule and message. */
    private moduleEligibilityOf(user: User): ModuleEligibility {
        return {
            isEligible: (ticket) => this.assignmentPolicy.isUserEligible(this.assignmentPolicy.toAssignable(ticket), user.id),
            denialMessage: async (ticket) => ineligibleAssigneeMessage(
                user.fullName, await this.assignmentPolicy.describeModule(this.assignmentPolicy.toAssignable(ticket)),
            ),
        };
    }

    private async applyStatusTransition(
        ticket: Ticket, oldStatus: TicketStatus, newStatus: TicketStatus, changes: string[], user: User, manager: EntityManager,
        vendorRequest: { visitAt?: string; note?: string } = {},
    ): Promise<void> {
        changes.push(`Status changed from ${oldStatus} to ${newStatus}`);

        if (newStatus === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO) {
            await this.startSlaClock(ticket, changes);
        }

        if (newStatus === TicketStatus.WAITING_VENDOR) {
            await this.pauseForVendor(ticket);
            const visitAt = this.vendorVisit.resolveVisit(vendorRequest.visitAt);
            await this.vendorVisit.schedule(manager, ticket, visitAt, user.id);
            ticket.vendorNote = normalizeVendorNote(vendorRequest.note);
            if (ticket.vendorNote) changes.push(`Keterangan vendor: ${ticket.vendorNote}`);
            changes.push(`Janji vendor: ${formatVendorVisit(visitAt)}`);
        } else if (oldStatus === TicketStatus.WAITING_VENDOR) {
            this.endVendorPause(ticket);
            await this.vendorVisit.clear(manager, ticket);
            ticket.vendorNote = null;
        }

        if (newStatus === TicketStatus.RESOLVED) {
            await this.openConfirmationWindow(ticket, changes);
        } else if (oldStatus === TicketStatus.RESOLVED) {
            // Agent took the ticket back before the requester answered.
            ticket.resolutionDeadlineAt = null;
        }

        if (newStatus !== TicketStatus.WAITING_VENDOR && newStatus !== TicketStatus.RESOLVED
            && await this.slaClock.release(ticket)) {
            changes.push(`SLA dilanjutkan. Target: ${ticket.slaTarget?.toISOString() ?? '-'}`);
        }
    }

    /** RESOLVED now waits for the requester: confirm, dispute, or auto-close at the deadline. */
    private async openConfirmationWindow(ticket: Ticket, changes?: string[]): Promise<void> {
        const now = new Date();
        ticket.resolvedAt = now;
        ticket.disputedAt = null;
        ticket.resolutionDeadlineAt = await computeResolutionDeadline(this.businessHoursService, now);
        // Time spent awaiting confirmation does not count; a dispute resumes from here.
        await this.slaClock.hold(ticket, now);
        changes?.push(`Menunggu konfirmasi pemohon hingga ${ticket.resolutionDeadlineAt.toISOString()}`);
    }

    private async startSlaClock(ticket: Ticket, changes: string[]): Promise<void> {
        const config = await this.slaClock.startResolution(ticket);
        if (config) changes.push(`SLA Timer started. Target: ${ticket.slaTarget!.toISOString()}`);
    }

    private async pauseForVendor(ticket: Ticket): Promise<void> {
        const now = new Date();
        ticket.lastPausedAt = now;
        ticket.waitingVendorAt = now;
        await this.slaClock.hold(ticket, now);
    }

    /** Vendor wait statistics; the SLA clock itself resumes via SlaClockService.release. */
    private endVendorPause(ticket: Ticket): void {
        if (!ticket.lastPausedAt) return;
        const diffMinutes = Math.floor((Date.now() - new Date(ticket.lastPausedAt).getTime()) / 60000);
        ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + diffMinutes;
        ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + diffMinutes;
        ticket.lastPausedAt = null;
        ticket.waitingVendorAt = null;
    }

    private async applyPriorityChange(ticket: Ticket, newPriority: string | any, changes: string[], _manager?: any): Promise<void> {
        if (newPriority === 'HARDWARE_INSTALLATION') {
            throw new BadRequestException('Cannot manually set priority to HARDWARE_INSTALLATION. This priority is system-assigned for hardware installation tickets.');
        }
        if (ticket.priority === 'HARDWARE_INSTALLATION') {
            throw new BadRequestException('Cannot change priority of hardware installation tickets. Priority HARDWARE_INSTALLATION is locked by the system.');
        }

        changes.push(`Priority changed from ${ticket.priority} to ${newPriority}`);

        const config = await this.slaClock.changePriority(ticket, newPriority as string);
        if (config) {
            const target = ticket.slaRemainingMinutes != null
                ? `${ticket.slaRemainingMinutes} menit tersisa (dijeda)`
                : ticket.slaTarget?.toISOString();
            changes.push(`SLA Target updated to ${target} (${config.resolutionTimeMinutes} minutes for ${newPriority})`);
        }
    }

    /** SLA side of a bulk status change: same clock rules as a single update. */
    private async applyBulkStatusSla(
        ticket: Ticket, oldStatus: TicketStatus, newStatus: TicketStatus, manager: EntityManager, actorId: string,
    ): Promise<void> {
        if (newStatus === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO && !ticket.slaStartedAt) {
            await this.slaClock.startResolution(ticket);
        }
        if (newStatus === TicketStatus.WAITING_VENDOR) {
            await this.pauseForVendor(ticket);
            await this.vendorVisit.schedule(manager, ticket, this.vendorVisit.resolveVisit(), actorId);
        } else if (oldStatus === TicketStatus.WAITING_VENDOR) {
            this.endVendorPause(ticket);
            await this.vendorVisit.clear(manager, ticket);
            ticket.vendorNote = null;
        }
        if (newStatus === TicketStatus.RESOLVED) {
            await this.openConfirmationWindow(ticket);
        } else if (newStatus !== TicketStatus.WAITING_VENDOR) {
            await this.slaClock.release(ticket);
        }
    }

    private async postUpdateActions(
        savedTicket: Ticket, user: User, changes: string[], oldStatus: TicketStatus, ticketId: string, userId: string,
        activity?: TicketSystemEvent,
    ): Promise<void> {
        await this.cacheInvalidationService.onTicketChange(savedTicket.id);

        // Ensure workload is recalculated if ticket is assigned (internal trusted path)
        if (savedTicket.assignedToId && savedTicket.siteId) {
            try {
                const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: savedTicket.siteId };
                await this.workloadService.recalculateAgentWorkload(internalActor, savedTicket.assignedToId, savedTicket.siteId);
            } catch (error) {
                this.logger.error(`Failed to recalculate workload for ticket ${savedTicket.ticketNumber}: ${error.message}`);
            }
        }

        this.eventsGateway.notifyDashboardStatsUpdate((savedTicket as any).siteId ?? null);
        this.eventsGateway.notifyTicketListUpdate((savedTicket as any).siteId ?? null);

        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }

        if (changes.length > 0) {
            const systemMessageContent = `System: ${changes.join(', ')} by ${user.fullName}`;
            const systemMessage = this.messageRepo.create({
                content: systemMessageContent,
                ticket: savedTicket,
                senderId: user.id,
                isSystemMessage: true,
                systemEvent: activity && activity.changes.length > 0 ? activity : null,
            });
            await this.messageRepo.save(systemMessage);

            if ((savedTicket as any).siteId) {
                this.eventsGateway.server.to(`site:${(savedTicket as any).siteId}`).emit('ticket:updated', { ticketId });
            }

            this.eventEmitter.emit(
                'ticket.updated',
                new TicketUpdatedEvent(
                    savedTicket.id,
                    savedTicket.ticketNumber || savedTicket.id.split('-')[0],
                    user.id,
                    changes,
                    savedTicket,
                ),
            );

            this.auditService.logAsync({
                userId,
                action: AuditAction.UPDATE_TICKET,
                entityType: 'ticket',
                entityId: ticketId,
                oldValue: { status: oldStatus },
                newValue: { status: savedTicket.status, priority: savedTicket.priority },
                description: `Ticket #${savedTicket.ticketNumber || ticketId.slice(0, 8)} updated: ${changes.join(', ')}`,
            });

            if (savedTicket.status === TicketStatus.RESOLVED) {
                await this.surveysService.createSurvey(savedTicket);
            }
        }
    }

    async assignTicket(ticketId: string, assigneeId: string | undefined | null, userId: string, reason?: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        if (ticket.status === TicketStatus.CLOSED) {
            throw new BadRequestException(TICKET_CLOSED_MESSAGE);
        }

        const isOracle = isOracleTicket(ticket);
        const oldAssigneeName = ticket.assignedTo ? ticket.assignedTo.fullName : 'Unassigned';
        const oldAssigneeId = ticket.assignedTo ? ticket.assignedTo.id : null;
        const isUnassign = !assigneeId || assigneeId === 'unassigned';

        if (isUnassign) {
            const assigner = await this.userRepo.findOne({ where: { id: userId } });
            if (!assigner) {
                throw new NotFoundException('Assigner not found');
            }

            assertTicketRoleAccess(ticket, assigner.role);
            validateTicketSiteAccess(assigner.role as UserRole, (assigner as any).siteId ?? null, (ticket as any).siteId ?? null);

            ticket.assignedTo = null as any;
            ticket.assignedToId = null as any;
            const savedTicket = await this.ticketRepo.save(ticket);

            const reasonText = reason ? `. Alasan: ${reason}` : '';
            const systemMessageContent = `System: Ticket unassigned (was ${oldAssigneeName}) by ${assigner.fullName}${reasonText}`;
            const systemMessage = this.messageRepo.create({
                content: systemMessageContent,
                ticket: savedTicket,
                senderId: assigner.id,
                systemEvent: systemEvent(assigner, [{ field: 'assignee', from: oldAssigneeId ? oldAssigneeName : null, to: null }], reason),
                isSystemMessage: true,
            });
            await this.messageRepo.save(systemMessage);

            if ((savedTicket as any).siteId) {
                this.eventsGateway.server.to(`site:${(savedTicket as any).siteId}`).emit('ticket:updated', { ticketId });
                this.eventsGateway.server.to(`site:${(savedTicket as any).siteId}`).emit('NEW_MESSAGE', { ticketId });
            }

            if ((savedTicket.status === TicketStatus.TODO || savedTicket.status === TicketStatus.IN_PROGRESS) && oldAssigneeId) {
                try {
                    const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: savedTicket.siteId };
                    await this.workloadService.recalculateAgentWorkload(internalActor, oldAssigneeId, savedTicket.siteId);
                } catch (err) {
                    this.logger.error(`Failed to recalculate workload points during unassignment for ticket ${savedTicket.ticketNumber}: ${err.message}`);
                }
            }

            this.eventsGateway.notifyDashboardStatsUpdate((savedTicket as any).siteId ?? null);
            this.eventsGateway.notifyTicketListUpdate((savedTicket as any).siteId ?? null);

            if (savedTicket.siteId) {
                this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
            }

            this.auditService.logAsync({
                userId,
                action: AuditAction.ASSIGN_TICKET,
                entityType: 'ticket',
                entityId: ticketId,
                oldValue: { assignee: oldAssigneeName },
                newValue: { assignee: 'Unassigned', reason: reason || null },
                description: `Ticket #${ticket.ticketNumber || ticketId.slice(0, 8)} unassigned (was ${oldAssigneeName}) by ${assigner.fullName}${reason ? ` - Alasan: ${reason}` : ''}`,
            });

            return savedTicket;
        }

        const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
        if (!assignee) {
            throw new NotFoundException('Assignee not found');
        }

        if (
            assignee.role !== UserRole.AGENT_OPERATIONAL_SUPPORT &&
            assignee.role !== UserRole.AGENT_ADMIN &&
            assignee.role !== UserRole.AGENT_ORACLE &&
            assignee.role !== UserRole.AGENT_WEB_DEV &&
            assignee.role !== UserRole.AGENT_MOBILE_DEV &&
            assignee.role !== UserRole.AGENT &&
            assignee.role !== UserRole.ADMIN
        ) {
            throw new BadRequestException('Assignee must be an operational support agent, developer agent, or admin');
        }

        const team = ticket.handlingTeam ?? HandlingTeam.OPS_SUPPORT;

        if (team === HandlingTeam.ORACLE_DEV || team === HandlingTeam.WEB_DEV || team === HandlingTeam.MOBILE_DEV) {
            const allowedDevRoles = [
                UserRole.AGENT_ORACLE,
                UserRole.AGENT_WEB_DEV,
                UserRole.AGENT_MOBILE_DEV,
                UserRole.ADMIN,
            ];
            if (!allowedDevRoles.includes(assignee.role)) {
                throw new ForbiddenException('Only Developer agents or ADMIN can be assigned to developer tickets');
            }
        } else {
            if (
                assignee.role === UserRole.AGENT_ORACLE ||
                assignee.role === UserRole.AGENT_WEB_DEV ||
                assignee.role === UserRole.AGENT_MOBILE_DEV
            ) {
                throw new ForbiddenException('General support tickets cannot be assigned to Developer agents');
            }
        }

        // Per-module isolation. When an admin curated an explicit assignee list
        // for this module, that list binds the API too — a dropdown that merely
        // hides names while the endpoint still accepts them is cosmetic.
        const assignable = this.assignmentPolicy.toAssignable(ticket);
        const eligible = await this.assignmentPolicy.isUserEligible(assignable, assignee.id);
        if (!eligible) {
            const moduleName = await this.assignmentPolicy.describeModule(assignable);
            throw new ForbiddenException(ineligibleAssigneeMessage(assignee.fullName, moduleName));
        }

        const assigner = await this.userRepo.findOne({ where: { id: userId } });
        if (!assigner) {
            throw new NotFoundException('Assigner not found');
        }

        assertTicketRoleAccess(ticket, assigner.role);
        assertTicketRoleAccess(ticket, assignee.role);
        validateTicketSiteAccess(assigner.role as UserRole, (assigner as any).siteId ?? null, (ticket as any).siteId ?? null);
        validateTicketSiteAccess(assignee.role as UserRole, (assignee as any).siteId ?? null, (ticket as any).siteId ?? null);

        ticket.assignedTo = assignee;
        ticket.assignedToId = assignee.id;
        const savedTicket = await this.ticketRepo.save(ticket);

        const actionLabel = oldAssigneeId ? 'reassigned to' : 'assigned to';
        const wasOld = oldAssigneeId ? ` (was ${oldAssigneeName})` : '';
        const systemMessageContent = `System: ${describeReassignment(assignee.fullName, oldAssigneeId ? oldAssigneeName : null, assigner.fullName, reason)}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: assigner.id,
            isSystemMessage: true,
            systemEvent: systemEvent(assigner, [{ field: 'assignee', from: oldAssigneeId ? oldAssigneeName : null, to: assignee.fullName }], reason),
        });
        await this.messageRepo.save(systemMessage);

        if ((savedTicket as any).siteId) {
            this.eventsGateway.server.to(`site:${(savedTicket as any).siteId}`).emit('ticket:updated', { ticketId });
            this.eventsGateway.server.to(`site:${(savedTicket as any).siteId}`).emit('NEW_MESSAGE', { ticketId });
        }

        // -------------------------------------------------------------
        // Workload Recalculation (Manual Assignment Handling)
        // -------------------------------------------------------------
        if (savedTicket.status === TicketStatus.TODO || savedTicket.status === TicketStatus.IN_PROGRESS) {
            try {
                const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: savedTicket.siteId };
                // Remove points from old assignee if there was one
                if (oldAssigneeId) {
                    await this.workloadService.recalculateAgentWorkload(internalActor, oldAssigneeId, savedTicket.siteId);
                }
                // Add points to new assignee
                await this.workloadService.recalculateAgentWorkload(internalActor, assignee.id, savedTicket.siteId);
            } catch (err) {
                this.logger.error(`Failed to recalculate workload points during manual assignment for ticket ${savedTicket.ticketNumber}: ${err.message}`);
            }
        }

        this.eventsGateway.notifyDashboardStatsUpdate((savedTicket as any).siteId ?? null);
        this.eventsGateway.notifyTicketListUpdate((savedTicket as any).siteId ?? null);

        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }

        // Emit Domain Event
        this.eventEmitter.emit(
            'ticket.assigned',
            new TicketAssignedEvent(
                ticket.id,
                ticket.ticketNumber || ticket.id.split('-')[0],
                assignee.id,
                assignee.fullName,
                assignee.email,
                assigner.fullName,
                ticket.title,
                ticket.status,
                ticket.user?.email,
                ticket.user?.fullName,
                assigner.id,
            ),
        );

        // Audit log for ticket assignment
        this.auditService.logAsync({
            userId,
            action: AuditAction.ASSIGN_TICKET,
            entityType: 'ticket',
            entityId: ticketId,
            oldValue: { assignee: oldAssigneeName },
            newValue: { assignee: assignee.fullName, reason: reason || null },
            description: `Ticket #${ticket.ticketNumber || ticketId.slice(0, 8)} ${actionLabel} ${assignee.fullName}${wasOld} by ${assigner.fullName}${reason ? ` - Alasan: ${reason}` : ''}`,
        });

        return savedTicket;
    }

    async cancelTicket(ticketId: string, userId: string, userRole: UserRole, reason?: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check permission: User can only cancel their own tickets, Admin/Agent can cancel any
        if (userRole === UserRole.USER && ticket.user.id !== userId) {
            throw new ForbiddenException('You can only cancel your own tickets');
        }

        validateTicketSiteAccess(user.role as UserRole, (user as any).siteId ?? null, (ticket as any).siteId ?? null);

        // Cannot cancel already resolved, closed or cancelled tickets
        if (TICKET_INACTIVE_STATUSES.includes(ticket.status)) {
            throw new BadRequestException('Cannot cancel a ticket that is already resolved or cancelled');
        }

        const oldStatus = ticket.status;
        const previousStatus = ticket.status;
        ticket.status = TicketStatus.CANCELLED;
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log system message
        const cancelReason = reason ? `: ${reason}` : '';
        const systemMessageContent = `System: Ticket cancelled by ${user.fullName}${cancelReason}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: userId,
            isSystemMessage: true,
            systemEvent: systemEvent(user, [{ field: 'status', from: previousStatus, to: TicketStatus.CANCELLED }], reason),
        });
        await this.messageRepo.save(systemMessage);

        // Emit WebSocket events
        this.eventsGateway.notifyStatusChange(ticketId, TicketStatus.CANCELLED, user.fullName, (savedTicket as any).siteId ?? null);
        
        // Recalculate workload points (internal trusted path)
        if (savedTicket.assignedToId && savedTicket.siteId) {
            try {
                const internalActor: SiteActor = { role: UserRole.ADMIN, siteId: savedTicket.siteId };
                await this.workloadService.recalculateAgentWorkload(internalActor, savedTicket.assignedToId, savedTicket.siteId);
            } catch (error) {
                this.logger.error(`Failed to recalculate workload upon cancellation for ticket ${savedTicket.ticketNumber}: ${error.message}`);
            }
        }

        this.eventsGateway.notifyTicketListUpdate((savedTicket as any).siteId ?? null);
        this.eventsGateway.notifyDashboardStatsUpdate((savedTicket as any).siteId ?? null);

        if (savedTicket.siteId) {
            this.eventEmitter.emit('tv-board.ticket-changed', { siteId: savedTicket.siteId });
        }

        // Emit Domain Event
        this.eventEmitter.emit(
            'ticket.cancelled',
            new TicketCancelledEvent(
                ticket.id,
                ticket.ticketNumber || ticket.id.split('-')[0],
                ticket.title,
                user.id,
                user.fullName,
                userRole,
                reason,
                ticket.user.id,
                ticket.assignedTo?.id,
            ),
        );

        // Audit log for ticket cancellation
        this.auditService.logAsync({
            userId,
            action: AuditAction.TICKET_CANCEL,
            entityType: 'ticket',
            entityId: ticketId,
            oldValue: { status: oldStatus },
            newValue: { status: TicketStatus.CANCELLED, reason },
            description: `Ticket #${ticket.ticketNumber || ticketId.slice(0, 8)} cancelled by ${user.fullName}${reason ? ': ' + reason : ''}`,
        });

        return savedTicket;
    }

    async bulkUpdate(
        ticketIds: string[],
        updateData: { status?: TicketStatus; priority?: string; assigneeId?: string; category?: string; reason?: string } & TakeoverOptions,
        userId: string,
    ): Promise<{ updated: number; failed: string[] }> {
        if (updateData.status === TicketStatus.CLOSED) {
            throw new BadRequestException(AGENT_CLOSE_FORBIDDEN_MESSAGE);
        }

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const tickets = await this.ticketRepo.find({
            where: { id: In(ticketIds) },
            relations: ['user', 'assignedTo'],
        });

        if (tickets.length === 0) {
            throw new NotFoundException('No tickets found');
        }

        // Site isolation: every target ticket must belong to the caller's site.
        for (const ticket of tickets) {
            validateTicketSiteAccess(user.role as UserRole, (user as any).siteId ?? null, (ticket as any).siteId ?? null);
        }

        let assignee: User | null = null;
        if (updateData.assigneeId) {
            assignee = await this.userRepo.findOne({ where: { id: updateData.assigneeId } });
            if (!assignee) {
                throw new NotFoundException('Assignee not found');
            }
            if (assignee.role !== UserRole.AGENT && assignee.role !== UserRole.ADMIN) {
                throw new BadRequestException('Assignee must be an AGENT or ADMIN');
            }
        }

        // If a new assignee is requested, validate that the assignee belongs to every ticket's site.
        if (assignee) {
            for (const ticket of tickets) {
                validateTicketSiteAccess(assignee!.role as UserRole, (assignee as any).siteId ?? null, (ticket as any).siteId ?? null);
            }
        }

        const takeoverPlan = await decideBulkTakeovers(tickets, updateData, user, this.moduleEligibilityOf(user));
        const takeovers = new Map<string, AppliedTakeover>();
        const updated: string[] = [];
        const failed: string[] = [];

        // Use transaction for atomic bulk updates
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            for (const ticket of tickets) {
                try {
                    const changes: string[] = [];
                    const before = snapshotTicket(ticket);

                    if (ticket.status === TicketStatus.CLOSED || takeoverPlan.denied.has(ticket.id)) {
                        failed.push(ticket.id);
                        continue;
                    }

                    if (updateData.status && updateData.status !== ticket.status) {
                        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
                            failed.push(ticket.id);
                            continue;
                        }
                        changes.push(`Status: ${ticket.status} → ${updateData.status}`);
                        await this.applyBulkStatusSla(ticket, ticket.status, updateData.status, queryRunner.manager, userId);
                        ticket.status = updateData.status;
                        const decision = takeoverPlan.decisions.get(ticket.id);
                        const takeover = decision ? applyTakeoverDecision(ticket, user, decision, changes) : null;
                        if (takeover) takeovers.set(ticket.id, takeover);
                    }

                    if (updateData.priority && updateData.priority !== ticket.priority) {
                        changes.push(`Priority: ${ticket.priority} → ${updateData.priority}`);
                        await this.slaClock.changePriority(ticket, updateData.priority as string);
                        ticket.priority = updateData.priority as any;
                    }

                    if (updateData.category && updateData.category !== ticket.category) {
                        changes.push(`Category: ${ticket.category} → ${updateData.category}`);
                        ticket.category = updateData.category;
                    }

                    if (assignee && ticket.assignedTo?.id !== assignee.id) {
                        const reasonText = updateData.reason ? ` (Alasan: ${updateData.reason})` : '';
                        changes.push(`Assigned to: ${assignee.fullName}${reasonText}`);
                        ticket.assignedTo = assignee;
                    }

                    if (changes.length > 0) {
                        // Save using transaction manager
                        await queryRunner.manager.save(Ticket, ticket);

                        const systemMessage = queryRunner.manager.create(TicketMessage, {
                            content: `System: Bulk update by ${user.fullName} - ${changes.join(', ')}`,
                            ticket,
                            senderId: userId,
                            isSystemMessage: true,
                            systemEvent: systemEvent(user, diffActivity(before, snapshotTicket(ticket)), updateData.reason ?? null),
                        });
                        await queryRunner.manager.save(TicketMessage, systemMessage);

                        updated.push(ticket.id);
                    }
                } catch (error) {
                    this.logger.error(`Bulk update failed for ticket ${ticket.id}: ${error.message}`);
                    failed.push(ticket.id);
                    // Don't throw - continue with other tickets
                }
            }

            // Commit all changes
            await queryRunner.commitTransaction();
        } catch (error) {
            // Rollback on any unhandled error
            await queryRunner.rollbackTransaction();
            this.logger.error(`Bulk update transaction failed: ${error.message}`);
            throw error;
        } finally {
            await queryRunner.release();
        }

        if (updated.length > 0) {
            // Site-scoped list/dashboard fan-out: every affected site, plus cross-site listeners via the global emits.
            {
                const distinctSites = Array.from(new Set(tickets.filter(t => updated.includes(t.id)).map(t => (t as any).siteId).filter(Boolean)));
                for (const sid of distinctSites) {
                    this.eventsGateway.notifyTicketListUpdate(sid);
                    this.eventsGateway.notifyDashboardStatsUpdate(sid);
                }
                // No global WS fan-out — site-less bulk updates emit no ticket realtime (fail-closed).
            }
            // Recalculate workloads for affected agents
            const affectedAgentsMap = new Map<string, string>(); // Map agentId -> siteId
            for (const ticket of tickets) {
                if (updated.includes(ticket.id)) {
                    if (ticket.assignedToId && ticket.siteId) {
                        affectedAgentsMap.set(ticket.assignedToId, ticket.siteId);
                    }
                    if (updateData.assigneeId && ticket.siteId) {
                        affectedAgentsMap.set(updateData.assigneeId, ticket.siteId);
                    }
                }
            }

            for (const [agentId, siteId] of affectedAgentsMap.entries()) {
                try {
                    const internalActor: SiteActor = { role: UserRole.ADMIN, siteId };
                    await this.workloadService.recalculateAgentWorkload(internalActor, agentId, siteId);
                } catch (error) {
                    this.logger.error(`Failed to recalculate workload for agent ${agentId} after bulk update: ${error.message}`);
                }
            }

            await this.cacheInvalidationService.onTicketChange('bulk');
        }

        for (const ticket of tickets) {
            const takeover = updated.includes(ticket.id) ? takeovers.get(ticket.id) : undefined;
            if (takeover) await recordStatusTakeover(this.takeoverDeps, ticket, user, takeover.previous, takeover.reason);
        }

        return { updated: updated.length, failed };
    }

    /**
     * Bulk-assign tickets to a single assignee.
     *
     * IMPORTANT: Reuses the single-ticket assignTicket path per ticket so that
     * per-team authorization (assertTicketRoleAccess + handlingTeam checks),
     * site isolation (validateTicketSiteAccess), workload recalculation,
     * system messages, WS events, domain events, and audit logs are preserved.
     * This inherits whatever PROD-9 finalizes for oracle/dev team access.
     */
    async bulkAssign(
        ticketIds: string[],
        assigneeId: string,
        userId: string,
        reason?: string,
    ): Promise<{ updated: number; failed: string[] }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
        if (!assignee) {
            throw new NotFoundException('Assignee not found');
        }

        // Fail-fast: validate assignee is an allowed role for assignment.
        if (
            assignee.role !== UserRole.AGENT_OPERATIONAL_SUPPORT &&
            assignee.role !== UserRole.AGENT_ADMIN &&
            assignee.role !== UserRole.AGENT_ORACLE &&
            assignee.role !== UserRole.AGENT_WEB_DEV &&
            assignee.role !== UserRole.AGENT_MOBILE_DEV &&
            assignee.role !== UserRole.AGENT &&
            assignee.role !== UserRole.ADMIN
        ) {
            throw new BadRequestException('Assignee must be an operational support agent, developer agent, or admin');
        }

        const updated: string[] = [];
        const failed: string[] = [];

        for (const ticketId of ticketIds) {
            try {
                await this.assignTicket(ticketId, assigneeId, userId, reason);
                updated.push(ticketId);
            } catch (error) {
                this.logger.error(`Bulk assign failed for ticket ${ticketId}: ${error?.message || error}`);
                failed.push(ticketId);
            }
        }

        return { updated: updated.length, failed };
    }

    /**
     * Soft-deletes tickets in bulk. ADMIN-only — enforced by @Roles on the route.
     *
     * Soft, not hard: seven tables reference ticketId, and none of them should be
     * cascaded away by a delete that an operator may need to undo.
     */
    async bulkSoftDelete(
        ticketIds: string[],
        userId: string,
    ): Promise<{ deleted: number; failed: string[] }> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const tickets = await this.ticketRepo.find({ where: { id: In(ticketIds) } });
        if (tickets.length === 0) {
            throw new NotFoundException('No tickets found');
        }

        // Site isolation, fail-closed: one out-of-site ticket aborts the whole
        // batch, before anything is written.
        for (const ticket of tickets) {
            validateTicketSiteAccess(
                user.role as UserRole,
                (user as any).siteId ?? null,
                (ticket as any).siteId ?? null,
            );
        }

        const found = new Set(tickets.map((t) => t.id));
        const failed = ticketIds.filter((id) => !found.has(id));

        await this.dataSource.transaction(async (manager) => {
            for (const ticket of tickets) {
                await manager.softRemove(ticket);
            }
        });

        // Audit after commit: logAsync is fire-and-forget, so a logging failure
        // must never be able to roll back a delete that already happened.
        for (const ticket of tickets) {
            this.auditService.logAsync({
                userId,
                action: AuditAction.DELETE_TICKET,
                entityType: 'ticket',
                entityId: ticket.id,
                oldValue: {
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    status: ticket.status,
                    siteId: (ticket as any).siteId ?? null,
                },
                description: `Ticket "${ticket.ticketNumber}" deleted (soft) by ${user.fullName}`,
            });
        }

        this.logger.log(`Soft-deleted ${tickets.length} ticket(s) by user ${userId}`);

        return { deleted: tickets.length, failed };
    }
}
