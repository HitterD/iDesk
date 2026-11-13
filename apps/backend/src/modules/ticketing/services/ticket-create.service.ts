import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, MoreThanOrEqual } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Ticket, TicketStatus, TicketSource, TicketPriority, TicketType, HandlingTeam } from '../entities/ticket.entity';
import { AttachmentInfo, TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { SlaConfig } from '../entities/sla-config.entity';
import { EventsGateway } from '../presentation/gateways/events.gateway';
import { CacheService, CacheInvalidationService } from '../../../shared/core/cache';
import { TICKET_ROUTED_EVENT, TicketCreatedEvent, TicketRoutedPayload } from '../events/ticket-created.event';
import { WorkloadService } from '../../workload/workload.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { resolveInitialHandlingTeam } from '../utils/oracle-ticket-access.util';
import { departmentDivision, generateNextTicketNumber, withTicketNumberRetry } from '../utils/ticket-number-generator';
import { SlaClockService } from './sla-clock.service';
import { HandlingSiteService } from '../../sites/handling-site.service';

/** An external system that filed the ticket; (source, ref) is unique, so retries are idempotent. */
export interface ExternalTicketRef {
    source: string;
    ref: string;
    /** Someone else who submitted it in that system for the requester; keeps requester-side access. */
    filedById?: string | null;
}

import type { RequesterDeviceSnapshot } from '../requester-device/requester-device.service';

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
        private readonly slaClock: SlaClockService,
        private readonly handlingSite: HandlingSiteService,
    ) { }

    /** The requester: the caller, or (staff only) the active user they file for. */
    private async resolveRequester(creator: User, requesterId?: string): Promise<User> {
        if (!requesterId || requesterId === creator.id) return creator;
        if (creator.role === UserRole.USER) {
            throw new ForbiddenException('Only staff can file tickets on behalf of another user');
        }
        const requester = await this.userRepo.findOne({
            where: { id: requesterId },
            relations: ['department'],
        });
        if (!requester || !requester.isActive) {
            throw new BadRequestException('Requester not found or inactive');
        }
        return requester;
    }

    async createTicket(
        userId: string,
        createTicketDto: CreateTicketDto,
        files: string[] = [],
        attachmentInfo: AttachmentInfo[] = [],
        external?: ExternalTicketRef,
        /** Resolves where the request came from, given the final requester; web submissions only. */
        requesterDevice?: (requesterId: string) => Promise<RequesterDeviceSnapshot | null>,
    ): Promise<Ticket> {
        try {
            const creator = await this.userRepo.findOne({
                where: { id: userId },
                relations: ['department']
            });
            if (!creator) {
                throw new NotFoundException('User not found');
            }
            // Anyone may submit to any team (handling stays with that team);
            // the filer keeps requester-level access via userId/createdById.
            const user = await this.resolveRequester(creator, createTicketDto.requesterId);
            const handlingTeam = resolveInitialHandlingTeam(
                createTicketDto.category,
                createTicketDto.ticketType,
            );

            const ticket = this.ticketRepo.create({
                title: createTicketDto.title,
                description: createTicketDto.description,
                priority: createTicketDto.priority,
                category: createTicketDto.category || 'GENERAL',
                ticketType: createTicketDto.ticketType || TicketType.SERVICE,
                handlingTeam,
                source: createTicketDto.source || TicketSource.WEB,
                device: createTicketDto.device,
                software: createTicketDto.software,
                user,
                createdById: external?.filedById && external.filedById !== user.id ? external.filedById : creator.id === user.id ? null : creator.id,
                status: TicketStatus.TODO,
                // The site that handles the requester's site (Sukodono → Sepanjang); routing, auto-assign
                // and notifications all follow it. The requester keeps access as the ticket's owner.
                siteId: await this.handlingSite.handlingSiteId(user.siteId),
                criticalReason: createTicketDto.criticalReason || null,
                externalSource: external?.source ?? null,
                externalRef: external?.ref ?? null,
                ...(requesterDevice ? await requesterDevice(user.id) : null),
            } as DeepPartial<Ticket>);

            const date = new Date();
            const division = departmentDivision(user.department, 'GEN');

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
                    ticket.slaTarget = await this.slaClock.hardwareTarget(ticket.scheduledDate);
                }
                ticket.slaStartedAt = new Date();
                ticket.firstResponseTarget = null; // No first response SLA for hardware installation
            } else {
                // === Standard SLA Logic ===
                const priority = createTicketDto.priority || 'MEDIUM';
                // First Response Target - counts from creation (or the next working hour)
                ticket.firstResponseTarget = await this.slaClock.firstResponseTarget(priority);

                // Resolution SLA will only start when agent picks up the ticket (status -> IN_PROGRESS)
                ticket.slaStartedAt = null;
                ticket.slaTarget = null;
            }

            // Wrap in transaction (M7: multiple-write ops)
            const finalTicket = await withTicketNumberRetry(this.logger, () => this.ticketRepo.manager.transaction(async (manager) => {
                // Generate Custom Ticket Number safely within transaction.
                // Shared locked generator (PROD-19): every creation path serializes
                // on the same pessimistic_write lock so concurrent creations
                // can never collide on the unique ticketNumber.
                ticket.ticketNumber = await generateNextTicketNumber(manager, division, date);

                const savedTicket = await manager.save(ticket);

                // The opening report (description + attachments) is the requester's, even when an
                // agent files on their behalf; who filed it is kept in createdById.
                const message = this.messageRepo.create({
                    content: createTicketDto.description,
                    ticket: savedTicket,
                    senderId: user.id,
                    attachments: files,
                    attachmentInfo: attachmentInfo.length > 0 ? attachmentInfo : null,
                });
                await manager.save(message);

                return savedTicket;
            })); // End of transaction

            // Domain events + audit fire AFTER commit: listeners must only react
            // to a ticket that actually persisted (no phantom notifications on rollback).
            const createdEvent = new TicketCreatedEvent(
                finalTicket.id,
                finalTicket.ticketNumber,
                finalTicket.title,
                finalTicket.priority,
                finalTicket.category,
                finalTicket.status,
                user.id,
                user.fullName,
                user.email,
                finalTicket.createdAt,
                finalTicket.siteId,
                finalTicket.ticketType,
                finalTicket.createdById ?? null,
            );
            this.eventEmitter.emit('ticket.created', createdEvent);

            // Audit log for ticket creation
            this.auditService.logAsync({
                userId,
                action: AuditAction.CREATE_TICKET,
                entityType: 'ticket',
                entityId: finalTicket.id,
                newValue: { ticketNumber: finalTicket.ticketNumber, title: finalTicket.title, priority: finalTicket.priority, category: finalTicket.category },
                description: `Ticket #${finalTicket.ticketNumber} created: ${finalTicket.title}`,
            });

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
            // The per-module guard lives in WorkloadService.autoAssignTicket, so
            // this path cannot disagree with forward / SLA breach / the manual
            // API about which tickets may be auto-assigned. A disabled module
            // simply returns a BadRequest, which is caught and logged below.
            if (!(createTicketDto as any).assignedToId && finalTicket.siteId) {
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
                    // Don't fail ticket creation if auto-assign is disabled or
                    // no eligible agent is available — the ticket stays visibly
                    // unassigned instead.
                    this.logger.warn(
                        `⚠️ Auto-assign skipped for ticket ${finalTicket.ticketNumber}: ${autoAssignError.message}`
                    );
                }
            }

            // Team notice once routing is known: an auto-assigned ticket already has its PIC ("Ditugaskan"),
            // so the team is told only about tickets still waiting for someone.
            this.eventEmitter.emit(TICKET_ROUTED_EVENT, {
                created: createdEvent,
                assignedToId: finalTicket.assignedToId ?? null,
            } satisfies TicketRoutedPayload);

            return finalTicket;
        } catch (error) {
            this.logger.error(`Error creating ticket: ${error.message}`, error.stack);
            throw error;
        }
    }
}
