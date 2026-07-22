import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, forwardRef, Optional, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
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
import { TelegramService } from '../../telegram/telegram.service';
import { BusinessHoursService } from '../../sla-config/business-hours.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { WorkloadService } from '../../workload/workload.service';
import { validateTicketAccess } from '../utils/oracle-ticket-access.util';
import { assertTicketRoleAccess } from './ticket-oracle-access';

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
        @Optional() @Inject(forwardRef(() => TelegramService))
        private readonly telegramService: TelegramService,
        @Optional()
        private readonly businessHoursService: BusinessHoursService,
        private readonly auditService: AuditService,
        @InjectDataSource()
        private readonly dataSource: DataSource,
        private readonly workloadService: WorkloadService,
    ) { }

    async updateTicket(ticketId: string, updateData: Partial<Ticket>, userId: string): Promise<Ticket> {
        // P1 fix: status transition, priority change, slaTarget recompute, and
        // ticket save were separate awaits. A crash mid-sequence left the
        // ticket in a half-mutated state. Now atomic via dataSource.transaction.
        // postUpdateActions (events, audit) stays outside so listeners fire on
        // commit, not before.
        const { savedTicket, user, changes, oldStatus } = await this.dataSource.transaction(async (manager) => {
            const ticket = await manager.findOne(Ticket, {
                where: { id: ticketId },
                relations: ['user'],
            });
            if (!ticket) {
                throw new NotFoundException('Ticket not found');
            }

            const user = await manager.findOne(User, { where: { id: userId } });
            if (!user) {
                throw new NotFoundException('User not found');
            }
            validateTicketAccess(user, ticket);

            const changes: string[] = [];
            const oldStatus = ticket.status;

            if (updateData.status && updateData.status !== ticket.status) {
                await this.applyStatusTransition(ticket, oldStatus, updateData.status, changes, user, manager);
            }

            if (updateData.priority && updateData.priority !== ticket.priority) {
                await this.applyPriorityChange(ticket, updateData.priority, changes, manager);
            }

            // Apply updates
            Object.assign(ticket, updateData);
            const savedTicket = await manager.save(Ticket, ticket);
            return { savedTicket, user, changes, oldStatus };
        });

        await this.postUpdateActions(savedTicket, user, changes, oldStatus, ticketId, userId);
        return savedTicket;
    }

    private async applyStatusTransition(
        ticket: Ticket, oldStatus: TicketStatus, newStatus: TicketStatus, changes: string[], user: User, manager?: any
    ): Promise<void> {
        changes.push(`Status changed from ${oldStatus} to ${newStatus}`);

        if (newStatus === TicketStatus.IN_PROGRESS && oldStatus === TicketStatus.TODO) {
            await this.startSlaClock(ticket, changes, manager);
        }

        if (newStatus === TicketStatus.WAITING_VENDOR) {
            this.pauseForVendor(ticket);
            await this.handleWaitingVendorStatus(ticket, user, manager);
        } else if (oldStatus === TicketStatus.WAITING_VENDOR) {
            this.resumeFromVendor(ticket, changes);
        }

        if (newStatus === TicketStatus.RESOLVED) {
            ticket.resolvedAt = new Date();
        }
    }

    private async startSlaClock(ticket: Ticket, changes: string[], manager?: any): Promise<void> {
        const now = new Date();
        ticket.slaStartedAt = now;
        const slaConfig = await (manager ?? this.ticketRepo.manager).findOne(SlaConfig, { where: { priority: ticket.priority } });
        if (!slaConfig) return;

        if (this.businessHoursService) {
            ticket.slaTarget = await this.businessHoursService.calculateSlaTarget(now, slaConfig.resolutionTimeMinutes);
            changes.push(`SLA Timer started (business hours). Target: ${ticket.slaTarget.toISOString()}`);
        } else {
            ticket.slaTarget = new Date(now.getTime() + slaConfig.resolutionTimeMinutes * 60000);
            changes.push(`SLA Timer started. Target: ${ticket.slaTarget.toISOString()}`);
        }
    }

    private pauseForVendor(ticket: Ticket): void {
        ticket.lastPausedAt = new Date();
        ticket.waitingVendorAt = new Date();
    }

    private resumeFromVendor(ticket: Ticket, changes: string[]): void {
        if (!ticket.lastPausedAt) return;
        const diffMs = Date.now() - new Date(ticket.lastPausedAt).getTime();
        const diffMinutes = Math.floor(diffMs / 60000);

        ticket.totalPausedMinutes = (ticket.totalPausedMinutes || 0) + diffMinutes;
        ticket.totalWaitingVendorMinutes = (ticket.totalWaitingVendorMinutes || 0) + diffMinutes;

        if (ticket.slaTarget) {
            ticket.slaTarget = new Date(ticket.slaTarget.getTime() + diffMs);
            changes.push(`SLA Target adjusted by ${diffMinutes} minutes (Waiting Vendor Duration)`);
        }
        if (ticket.firstResponseTarget && !ticket.firstResponseAt) {
            ticket.firstResponseTarget = new Date(ticket.firstResponseTarget.getTime() + diffMs);
        }
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

        if (ticket.slaStartedAt) {
            const newSlaConfig = await this.slaConfigRepo.findOne({ where: { priority: newPriority as string } });
            if (newSlaConfig) {
                const slaStartedAt = new Date(ticket.slaStartedAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                const newSlaTarget = new Date(slaStartedAt.getTime() + (newSlaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);
                ticket.slaTarget = newSlaTarget;
                changes.push(`SLA Target updated to ${newSlaTarget.toISOString()} (${newSlaConfig.resolutionTimeMinutes} minutes for ${newPriority})`);
            }
        }
    }

    private async postUpdateActions(
        savedTicket: Ticket, user: User, changes: string[], oldStatus: TicketStatus, ticketId: string, userId: string
    ): Promise<void> {
        await this.cacheInvalidationService.onTicketChange(savedTicket.id);

        // Ensure workload is recalculated if ticket is assigned
        if (savedTicket.assignedToId && savedTicket.siteId) {
            try {
                await this.workloadService.recalculateAgentWorkload(savedTicket.assignedToId, savedTicket.siteId);
            } catch (error) {
                this.logger.error(`Failed to recalculate workload for ticket ${savedTicket.ticketNumber}: ${error.message}`);
            }
        }

        this.eventsGateway.notifyDashboardStatsUpdate();
        this.eventsGateway.notifyTicketListUpdate();

        if (changes.length > 0) {
            const systemMessageContent = `System: ${changes.join(', ')} by ${user.fullName}`;
            const systemMessage = this.messageRepo.create({
                content: systemMessageContent,
                ticket: savedTicket,
                senderId: user.id,
                isSystemMessage: true,
            });
            await this.messageRepo.save(systemMessage);

            this.eventsGateway.server.emit('ticket:updated', { ticketId });

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

    async assignTicket(ticketId: string, assigneeId: string, userId: string): Promise<Ticket> {
        const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['user', 'assignedTo'] });
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        const assignee = await this.userRepo.findOne({ where: { id: assigneeId } });
        if (!assignee) {
            throw new NotFoundException('Assignee not found');
        }

        if (
            assignee.role !== UserRole.AGENT_OPERATIONAL_SUPPORT &&
            assignee.role !== UserRole.AGENT_ORACLE &&
            assignee.role !== UserRole.AGENT &&
            assignee.role !== UserRole.ADMIN
        ) {
            throw new BadRequestException('Assignee must be an operational support agent, oracle agent, or admin');
        }

        // Oracle/K2 tickets vs General support tickets assignment role enforcement
        const isOracleTicket = ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST';
        if (isOracleTicket) {
            if (assignee.role !== UserRole.AGENT_ORACLE && assignee.role !== UserRole.ADMIN) {
                throw new ForbiddenException('Only AGENT_ORACLE or ADMIN can be assigned to Oracle/K2 tickets');
            }
        } else {
            if (assignee.role === UserRole.AGENT_ORACLE) {
                throw new ForbiddenException('General support tickets cannot be assigned to AGENT_ORACLE');
            }
        }

        const assigner = await this.userRepo.findOne({ where: { id: userId } });
        if (!assigner) {
            throw new NotFoundException('Assigner not found');
        }

        if (isOracleTicket) {
            if (assigner.role && assigner.role !== UserRole.AGENT_ORACLE && assigner.role !== UserRole.ADMIN) {
                throw new ForbiddenException('Only AGENT_ORACLE or ADMIN can assign Oracle/K2 tickets');
            }
        } else {
            if (assigner.role === UserRole.AGENT_ORACLE) {
                throw new ForbiddenException('AGENT_ORACLE cannot assign general support tickets');
            }
        }
        assertTicketRoleAccess(ticket, assigner.role);
        assertTicketRoleAccess(ticket, assignee.role);

        const oldAssigneeName = ticket.assignedTo ? ticket.assignedTo.fullName : 'Unassigned';
        const oldAssigneeId = ticket.assignedTo ? ticket.assignedTo.id : null;

        ticket.assignedTo = assignee;
        const savedTicket = await this.ticketRepo.save(ticket);

        // Log system message
        const systemMessageContent = `System: Ticket assigned to ${assignee.fullName} (was ${oldAssigneeName}) by ${assigner.fullName}`;
        const systemMessage = this.messageRepo.create({
            content: systemMessageContent,
            ticket: savedTicket,
            senderId: assigner.id,
            isSystemMessage: true,
        });
        await this.messageRepo.save(systemMessage);

        this.eventsGateway.server.emit('ticket:updated', { ticketId });
        this.eventsGateway.server.emit('NEW_MESSAGE', systemMessage);

        // -------------------------------------------------------------
        // Workload Recalculation (Manual Assignment Handling)
        // -------------------------------------------------------------
        if (savedTicket.status === TicketStatus.TODO || savedTicket.status === TicketStatus.IN_PROGRESS) {
            try {
                // Remove points from old assignee if there was one
                if (oldAssigneeId) {
                    await this.workloadService.recalculateAgentWorkload(oldAssigneeId, savedTicket.siteId);
                }
                // Add points to new assignee
                await this.workloadService.recalculateAgentWorkload(assignee.id, savedTicket.siteId);
            } catch (err) {
                this.logger.error(`Failed to recalculate workload points during manual assignment for ticket ${savedTicket.ticketNumber}: ${err.message}`);
            }
        }

        this.eventsGateway.notifyDashboardStatsUpdate();
        this.eventsGateway.notifyTicketListUpdate();

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
            ),
        );

        // Audit log for ticket assignment
        this.auditService.logAsync({
            userId,
            action: AuditAction.ASSIGN_TICKET,
            entityType: 'ticket',
            entityId: ticketId,
            oldValue: { assignee: oldAssigneeName },
            newValue: { assignee: assignee.fullName },
            description: `Ticket #${ticket.ticketNumber || ticketId.slice(0, 8)} assigned to ${assignee.fullName} by ${assigner.fullName}`,
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

        // Cannot cancel already resolved or cancelled tickets
        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
            throw new BadRequestException('Cannot cancel a ticket that is already resolved or cancelled');
        }

        const oldStatus = ticket.status;
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
        });
        await this.messageRepo.save(systemMessage);

        // Emit WebSocket events
        this.eventsGateway.notifyStatusChange(ticketId, TicketStatus.CANCELLED, user.fullName);
        
        // Recalculate workload points
        if (savedTicket.assignedToId && savedTicket.siteId) {
            try {
                await this.workloadService.recalculateAgentWorkload(savedTicket.assignedToId, savedTicket.siteId);
            } catch (error) {
                this.logger.error(`Failed to recalculate workload upon cancellation for ticket ${savedTicket.ticketNumber}: ${error.message}`);
            }
        }

        this.eventsGateway.notifyTicketListUpdate();
        this.eventsGateway.notifyDashboardStatsUpdate();

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
        updateData: { status?: TicketStatus; priority?: string; assigneeId?: string; category?: string },
        userId: string,
    ): Promise<{ updated: number; failed: string[] }> {
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

                    if (updateData.status && updateData.status !== ticket.status) {
                        if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CANCELLED) {
                            failed.push(ticket.id);
                            continue;
                        }
                        changes.push(`Status: ${ticket.status} → ${updateData.status}`);
                        ticket.status = updateData.status;
                    }

                    if (updateData.priority && updateData.priority !== ticket.priority) {
                        changes.push(`Priority: ${ticket.priority} → ${updateData.priority}`);
                        ticket.priority = updateData.priority as any;
                    }

                    if (updateData.category && updateData.category !== ticket.category) {
                        changes.push(`Category: ${ticket.category} → ${updateData.category}`);
                        ticket.category = updateData.category;
                    }

                    if (assignee && ticket.assignedTo?.id !== assignee.id) {
                        changes.push(`Assigned to: ${assignee.fullName}`);
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
                    await this.workloadService.recalculateAgentWorkload(agentId, siteId);
                } catch (error) {
                    this.logger.error(`Failed to recalculate workload for agent ${agentId} after bulk update: ${error.message}`);
                }
            }

            await this.cacheInvalidationService.onTicketChange('bulk');
            this.eventsGateway.notifyDashboardStatsUpdate();
            this.eventsGateway.notifyTicketListUpdate();
        }

        return { updated: updated.length, failed };
    }

    /**
     * Handle WAITING_VENDOR status change
     * - Send Telegram notification with vendor schedule info
     * - Add system message to ticket notes/discussion
     */
    private async handleWaitingVendorStatus(ticket: Ticket, changedBy: User, _manager?: any): Promise<void> {
        const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];

        // Calculate next Thursday (vendor visit day)
        const nextThursday = this.getNextThursday();
        const formattedDate = nextThursday.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        // === 1. Add System Message to Notes & Discussion ===
        const systemNote = `⏳ Status Tiket Diubah ke Waiting Vendor

📋 Tiket ini menunggu kunjungan vendor.
📅 Jadwal vendor datang: Setiap hari Kamis
📆 Perkiraan kunjungan terdekat: ${formattedDate}

ℹ️ Estimasi waktu tunggu minimal: 1 minggu
👤 Diubah oleh: ${changedBy.fullName}
🕐 Waktu: ${new Date().toLocaleString('id-ID')}

---
SLA Timer di-pause selama menunggu vendor.`;

        const systemMessage = this.messageRepo.create({
            content: systemNote,
            ticket,
            senderId: changedBy.id,
            isSystemMessage: true,
        });
        await this.messageRepo.save(systemMessage);

        // === 2. Send Telegram Notification ===
        if (this.telegramService && ticket.user) {
            const telegramMessage =
                `🟠 <b>Status Tiket Menunggu Vendor</b>\n\n` +
                `📋 Tiket: <b>#${ticketNumber}</b>\n` +
                `📌 ${ticket.title}\n\n` +
                `📅 <b>Jadwal Kunjungan Vendor:</b>\n` +
                `   • Vendor datang setiap hari <b>Kamis</b>\n` +
                `   • Perkiraan kunjungan: <b>${formattedDate}</b>\n` +
                `   • Estimasi waktu tunggu: minimal 1 minggu\n\n` +
                `⏸️ <i>SLA Timer di-pause sampai vendor selesai.</i>`;

            try {
                // Try to get user's telegram chat ID
                const userWithTelegram = await this.userRepo.findOne({
                    where: { id: ticket.userId },
                    select: ['id', 'telegramChatId'],
                });

                if (userWithTelegram?.telegramChatId) {
                    await this.telegramService.sendNotification(
                        userWithTelegram.telegramChatId,
                        telegramMessage
                    );
                    this.logger.log(`Waiting vendor notification sent to user ${ticket.userId}`);
                }
            } catch (error) {
                this.logger.error(`Failed to send waiting vendor notification: ${error.message}`);
            }
        }

        // Emit WebSocket event for real-time update
        this.eventsGateway.notifyNewMessage(ticket.id, systemMessage);
    }

    /**
     * Get next Thursday date (vendor visit day)
     */
    private getNextThursday(): Date {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 4 = Thursday
        const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7; // If today is Thursday, get next week

        const nextThursday = new Date(now);
        nextThursday.setDate(now.getDate() + daysUntilThursday);
        nextThursday.setHours(9, 0, 0, 0); // Set to 9 AM

        return nextThursday;
    }
}
