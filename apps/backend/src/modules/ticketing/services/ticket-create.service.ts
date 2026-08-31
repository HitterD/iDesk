import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Ticket, TicketStatus, TicketSource, TicketPriority, TicketType, HandlingTeam } from '../entities/ticket.entity';
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
import { assertTicketRoleAccess } from './ticket-oracle-access';
import { isOracleK2Category } from '../utils/oracle-ticket-access.util';

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
            assertTicketRoleAccess({
                category: createTicketDto.category || 'GENERAL',
                ticketType: createTicketDto.ticketType || TicketType.SERVICE,
                handlingTeam: isOracleK2Category(
                    createTicketDto.category,
                    createTicketDto.ticketType,
                ) ? HandlingTeam.ORACLE_DEV : HandlingTeam.OPS_SUPPORT,
            }, user.role);

            const ticket = this.ticketRepo.create({
                title: createTicketDto.title,
                description: createTicketDto.description,
                priority: createTicketDto.priority,
                category: createTicketDto.category || 'GENERAL',
                ticketType: createTicketDto.ticketType || TicketType.SERVICE,
                handlingTeam: isOracleK2Category(
                    createTicketDto.category,
                    createTicketDto.ticketType,
                ) ? HandlingTeam.ORACLE_DEV : HandlingTeam.OPS_SUPPORT,
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
                ticket.ticketType = TicketType.HARDWARE_INSTALLATION;
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
            const finalTicket = await this.ticketRepo.manager.transaction(async (manager) => {
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

                // Save initial message with attachments inside transaction
                const message = this.messageRepo.create({
                    content: createTicketDto.description,
                    ticket: savedTicket,
                    senderId: user.id,
                    attachments: files,
                });
                await manager.save(message);

            // Emit Domain Event
            this.eventEmitter.emit(
                'ticket.created',
                new TicketCreatedEvent(
                    savedTicket.id,
                    savedTicket.ticketNumber,
                    savedTicket.title,
                    savedTicket.priority,
                    savedTicket.category,
                    savedTicket.status,
                    user.id,
                    user.fullName,
                    user.email,
                    savedTicket.createdAt,
                    savedTicket.siteId,
                    savedTicket.ticketType,
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

            // Site-isolated real-time fan-out (outside transaction, after commit)
            this.eventsGateway.notifyDashboardStatsUpdate((finalTicket as any).siteId ?? null);
            this.eventsGateway.notifyNewTicket({
                id: finalTicket.id,
                ticketNumber: finalTicket.ticketNumber,
                title: finalTicket.title,
                status: finalTicket.status,
                priority: finalTicket.priority,
                category: finalTicket.category,
                siteId: (finalTicket as any).siteId ?? null,
                user: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                },
                createdAt: finalTicket.createdAt,
            });
            if ((finalTicket as any).siteId) {
                this.eventEmitter.emit('tv-board.ticket-changed', { siteId: (finalTicket as any).siteId });
            }

            // === Auto-Assignment: Assign to agent with lowest workload ===
            if (!(createTicketDto as any).assignedToId && finalTicket.siteId) {
                // handlingTeam is the source of truth: only OPS_SUPPORT tickets
                // get auto-assigned to the workload pool.
                const isOracleTicket = finalTicket.handlingTeam === HandlingTeam.ORACLE_DEV;

                if (!isOracleTicket) {
                    try {
                        const assignedTicket = await this.workloadService.autoAssignTicket(finalTicket.id);
                        if (assignedTicket.assignedTo) {
                            this.logger.log(
                                `✅ Ticket ${finalTicket.ticketNumber} auto-assigned to ${assignedTicket.assignedTo.fullName}`
                            );
                            // Update local ticket reference with assignment
                            finalTicket.assignedToId = assignedTicket.assignedToId;
                            finalTicket.assignedTo = assignedTicket.assignedTo;
                        }
                    } catch (autoAssignError) {
                        // Don't fail ticket creation if auto-assign fails
                        this.logger.warn(
                            `⚠️ Auto-assign failed for ticket ${finalTicket.ticketNumber}: ${autoAssignError.message}`
                        );
                    }
                } else {
                    this.logger.log(`⏳ Ticket ${finalTicket.ticketNumber} bypassed auto-assign (Oracle Request)`);
                }
            }

            return finalTicket;
        } catch (error) {
            this.logger.error(`Error creating ticket: ${error.message}`, error.stack);
            throw error;
        }
    }
}
