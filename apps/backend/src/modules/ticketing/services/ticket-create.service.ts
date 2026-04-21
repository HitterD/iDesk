import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Ticket, TicketStatus, TicketSource, TicketPriority } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { CacheService, CacheInvalidationService } from '../../../shared/core/cache';
import { TicketCreatedEvent } from '../events/ticket-created.event';
import { WorkloadService } from '../../workload/workload.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CreateTicketDto } from '../dto/create-ticket.dto';

@Injectable()
export class TicketCreateService {
    private readonly logger = new Logger(TicketCreateService.name);

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
        private readonly cacheService: CacheService,
        private readonly cacheInvalidationService: CacheInvalidationService,
        private readonly eventEmitter: EventEmitter2,
        private readonly workloadService: WorkloadService,
        private readonly auditService: AuditService,
    ) { }

    async createTicket(userId: string, createTicketDto: CreateTicketDto, files: string[] = []): Promise<Ticket> {
        try {
            const user = await this.userRepo.findOne({
                where: { id: userId },
                relations: ['department']
            });
            if (!user) {
                throw new NotFoundException('User not found');
            }

            const ticket = this.ticketRepo.create({
                title: createTicketDto.title,
                description: createTicketDto.description,
                priority: createTicketDto.priority,
                category: createTicketDto.category || 'GENERAL',
                source: createTicketDto.source || TicketSource.WEB,
                device: createTicketDto.device,
                software: createTicketDto.software,
                user,
                status: TicketStatus.TODO,
                siteId: user.siteId, // Auto-assign user's site
                criticalReason: createTicketDto.criticalReason || null,
            } as DeepPartial<Ticket>);

            const date = new Date();
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString().slice(-2);
            const dateStr = `${day}${month}${year}`;

            const division = user.department?.name ? user.department.name.substring(0, 3).toUpperCase() : 'GEN';

            // === Hardware Installation: Special Handling ===
            const isHardwareInstallation = createTicketDto.category === 'HARDWARE_INSTALLATION' ||
                createTicketDto.isHardwareInstallation === true;

            if (isHardwareInstallation) {
                // Auto-set priority to HARDWARE_INSTALLATION
                ticket.priority = TicketPriority.HARDWARE_INSTALLATION;
                ticket.isHardwareInstallation = true;
                ticket.scheduledDate = createTicketDto.scheduledDate ? new Date(createTicketDto.scheduledDate) : null;
                ticket.scheduledTime = createTicketDto.scheduledTime || null;
                ticket.hardwareType = createTicketDto.hardwareType || null;
                ticket.userAcknowledged = createTicketDto.userAcknowledged || false;

                // Hardware installation tickets: SLA is based on scheduled date, not creation time
                // SLA Target = scheduled date + 1 day (auto-resolve H+1)
                if (ticket.scheduledDate) {
                    const slaTarget = new Date(ticket.scheduledDate);
                    slaTarget.setDate(slaTarget.getDate() + 1);
                    slaTarget.setHours(17, 0, 0, 0); // End of business day H+1
                    ticket.slaTarget = slaTarget;
                }
                ticket.slaStartedAt = new Date();
                ticket.firstResponseTarget = null; // No first response SLA for hardware installation
            } else {
                // === Standard SLA Logic ===
                const priority = createTicketDto.priority || 'MEDIUM';
                const slaConfig = await this.slaConfigRepo.findOne({ where: { priority } });
                if (slaConfig) {
                    const now = new Date();
                    // First Response Target - starts counting from ticket creation
                    ticket.firstResponseTarget = new Date(now.getTime() + slaConfig.responseTimeMinutes * 60000);
                }

                // Resolution SLA will only start when agent picks up the ticket (status -> IN_PROGRESS)
                ticket.slaStartedAt = null;
                ticket.slaTarget = null;
            }

            // Wrap in transaction (M7: multiple-write ops)
            return await this.ticketRepo.manager.transaction(async (manager) => {
                // Generate Custom Ticket Number safely within transaction
                const todayStart = new Date(date);
                todayStart.setHours(0, 0, 0, 0);

                const latestTicket = await manager.createQueryBuilder(Ticket, 'ticket')
                    .where('ticket.createdAt >= :todayStart', { todayStart })
                    .orderBy('ticket.createdAt', 'DESC')
                    .setLock('pessimistic_write')
                    .getOne();

                let newNumber = 1;
                if (latestTicket && latestTicket.ticketNumber) {
                    const parts = latestTicket.ticketNumber.split('-');
                    if (parts.length === 3) {
                        const lastNumber = parseInt(parts[2], 10);
                        if (!isNaN(lastNumber)) {
                            newNumber = lastNumber + 1;
                        }
                    }
                }
                const numberStr = newNumber.toString().padStart(4, '0');
                ticket.ticketNumber = `${dateStr}-${division}-${numberStr}`;

                const savedTicket = await manager.save(ticket);

            // === Auto-Assignment: Assign to agent with lowest workload ===
            // Only auto-assign if:
            // 1. No manual assignee specified
            // 2. Ticket has a site assigned
            // 3. User creating ticket is not an AGENT (agents pick their own tickets)
            // 4. Ticket is NOT an ORACLE request
            if (!(createTicketDto as any).assignedToId && ticket.siteId && user.role !== 'AGENT' && user.role !== 'AGENT_OPERATIONAL_SUPPORT') {
                const isOracleTicket = createTicketDto.category === 'ORACLE_REQUEST' || (createTicketDto as any).ticketType === 'ORACLE_REQUEST';

                if (!isOracleTicket) {
                    try {
                        const assignedTicket = await this.workloadService.autoAssignTicket(ticket.id);
                        if (assignedTicket.assignedTo) {
                            this.logger.log(
                                `✅ Ticket ${ticket.ticketNumber} auto-assigned to ${assignedTicket.assignedTo.fullName}`
                            );
                            // Update local ticket reference with assignment
                            ticket.assignedToId = assignedTicket.assignedToId;
                            ticket.assignedTo = assignedTicket.assignedTo;
                        }
                    } catch (autoAssignError) {
                        // Don't fail ticket creation if auto-assign fails
                        this.logger.warn(
                            `⚠️ Auto-assign failed for ticket ${ticket.ticketNumber}: ${autoAssignError.message}`
                        );
                    }
                } else {
                    this.logger.log(`⏳ Ticket ${ticket.ticketNumber} bypassed auto-assign (Oracle Request)`);
                }
            }

            // Invalidate caches using centralized service
            await this.cacheInvalidationService.onTicketChange(ticket.id);
            this.eventsGateway.notifyDashboardStatsUpdate();

                // Save initial message with attachments inside transaction
                const message = this.messageRepo.create({
                    content: createTicketDto.description,
                    ticket: savedTicket,
                    senderId: user.id,
                    attachments: files,
                });
                await manager.save(message);

            // Emit WebSocket event for real-time sync
            this.eventsGateway.notifyNewTicket({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                status: ticket.status,
                priority: ticket.priority,
                category: ticket.category,
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                },
                createdAt: ticket.createdAt,
            });

            // Emit Domain Event
            this.eventEmitter.emit(
                'ticket.created',
                new TicketCreatedEvent(
                    ticket.id,
                    ticket.ticketNumber,
                    ticket.title,
                    ticket.priority,
                    ticket.category,
                    ticket.status,
                    user.id,
                    user.fullName,
                    user.email,
                    ticket.createdAt,
                ),
            );

            // Audit log for ticket creation
            this.auditService.logAsync({
                userId,
                action: AuditAction.CREATE_TICKET,
                entityType: 'ticket',
                entityId: ticket.id,
                newValue: { ticketNumber: ticket.ticketNumber, title: ticket.title, priority: ticket.priority, category: ticket.category },
                description: `Ticket #${ticket.ticketNumber} created: ${ticket.title}`,
            });

                return savedTicket;
            }); // End of transaction
        } catch (error) {
            this.logger.error(`Error creating ticket: ${error.message}`, error.stack);
            throw error;
        }
    }
}
