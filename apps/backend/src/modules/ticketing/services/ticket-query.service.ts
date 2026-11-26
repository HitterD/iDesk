import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketType, HandlingTeam, TicketStatus, TICKET_DONE_STATUSES } from '../entities/ticket.entity';
import { TicketModule } from '../entities/ticket-module.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CacheService } from '../../../shared/core/cache';
import { resolveTicketViewerAccessWithFlow, TicketViewerAccess } from './ticket-oracle-access';
import { applySiteFilter, siteScopeKey } from '../utils/site-access.util';
import { applyServiceScopeFilter } from '../../../shared/core/utils/service-scope.util';
import { SlaClockService, SlaSnapshot } from './sla-clock.service';
import { presentThread } from '../utils/message-presenter.util';
import { loadMentionNames } from '../utils/mention-names.util';
import { loadFlowListFields } from '../../request-flow/services/request-flow-list-fields';
import { type ReportTeam } from '../../reports/utils/report-team-scope.util';
import { findNonSlaTicketIds, isNonSlaTicket, isNonSlaTicketType, stripSlaFields } from '../utils/non-sla-ticket.util';
import {
    applyHandlingTeamFilter,
    applyOracleFilter,
    applyRequestKindFilter,
    applyStatusFilter,
    canSpanAllTeams,
    computeHasUnreadChat,
    DEV_TICKET_TYPES,
    effectiveQueue,
    ensureSlaTarget,
    FLOW_EXISTS,
    isNonOracleAgent,
    ORACLE_FILTER_PARAMS,
    OVERDUE_SQL,
    QUEUE_KEYS,
    queryDevQueuePage,
    queryQueueStats,
    REQUEST_CENTER_CATEGORIES,
    toPrefixTsQuery,
    type DevQueue,
    type DevQueueOptions,
    type DevQueuePage,
    type QueueKey,
    type QueueStats,
    type RequestKindFilter,
} from './ticket-dev-queue.helper';
import { buildFilteredTicketQb, computeDashboardStatsData } from './ticket-dashboard-stats.helper';

export {
    applyOracleFilter,
    canSpanAllTeams,
    computeHasUnreadChat,
    effectiveQueue,
    ensureSlaTarget,
    isNonOracleAgent,
    OVERDUE_SQL,
    QUEUE_KEYS,
    toPrefixTsQuery,
    type DevQueue,
    type DevQueueOptions,
    type QueueKey,
    type QueueStats,
    type RequestKindFilter,
};

@Injectable()
export class TicketQueryService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(SlaConfig)
        private readonly slaConfigRepo: Repository<SlaConfig>,
        private readonly cacheService: CacheService,
        @Optional()
        @InjectRepository(TicketModule)
        private readonly moduleRepo?: Repository<TicketModule>,
        @Optional()
        private readonly slaClock?: SlaClockService,
    ) { }

    /** SLA config + schedule, loaded only when some SLA-eligible ticket still needs a projected target. */
    private async slaSnapshotFor(tickets: Array<Ticket & { requestKind?: unknown; isNonSla?: boolean }>): Promise<SlaSnapshot | undefined> {
        if (!this.slaClock || tickets.every(t => t.slaTarget || isNonSlaTicketType(t))) return undefined;
        return this.slaClock.snapshot();
    }

    private createFilteredTicketQb(role: UserRole, userSiteId: string | null, excludeCategory?: string) {
        return buildFilteredTicketQb(this.ticketRepo, role, userSiteId, excludeCategory);
    }

    async findAll(
        userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        queue?: string,
        handlingTeam?: ReportTeam,
        requestKind?: RequestKindFilter,
    ): Promise<Ticket[]> {
        const query = this.ticketRepo.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .leftJoinAndSelect('ticket.forwardedFromSite', 'forwardedFromSite')
            .orderBy('ticket.createdAt', 'DESC')
            .take(500);

        queue = effectiveQueue(queue, role);
        if (queue === 'oracle') {
            query.where('(ticket."handlingTeam" = :oracleTeam)', ORACLE_FILTER_PARAMS);
            query.andWhere(
                '(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory OR ticket.category ILIKE :oracleLike OR ticket.category ILIKE :k2Like)',
                { oracleType: TicketType.ORACLE_REQUEST, oracleCategory: 'ORACLE_REQUEST', oracleLike: '%oracle%', k2Like: '%k2%' },
            );
        } else if (queue === 'web-dev') {
            query.where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', { ...ORACLE_FILTER_PARAMS, webTeam: HandlingTeam.WEB_DEV });
            query.andWhere(
                '(ticket.ticketType = :webDevType OR ticket.category = :webDevCategory OR ticket.category ILIKE :webDevLike)',
                { webDevType: TicketType.WEB_DEV_REQUEST, webDevCategory: 'WEB_DEV_REQUEST', webDevLike: '%web%' },
            );
        } else if (queue === 'mobile-dev') {
            query.where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :mobileTeam)', { ...ORACLE_FILTER_PARAMS, mobileTeam: HandlingTeam.MOBILE_DEV });
            query.andWhere(
                '(ticket.ticketType = :mobileDevType OR ticket.category = :mobileDevCategory OR ticket.category ILIKE :mobileDevLike)',
                { mobileDevType: TicketType.MOBILE_DEV_REQUEST, mobileDevCategory: 'MOBILE_DEV_REQUEST', mobileDevLike: '%mobile%' },
            );
        } else if (canSpanAllTeams(role)) {
            query.where(`(ticket.ticketType NOT IN (:...excludedTypes) OR ticket.ticketType IS NULL OR ${FLOW_EXISTS})`, {
                excludedTypes: [TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION],
            });
            query.andWhere('(ticket.category NOT IN (:...requestCenterCategories) OR ticket.category IS NULL)', { requestCenterCategories: REQUEST_CENTER_CATEGORIES });
            applyHandlingTeamFilter(query, handlingTeam);
        } else if (role === UserRole.AGENT_ORACLE) {
            query.where('(ticket."handlingTeam" = :oracleTeam)', ORACLE_FILTER_PARAMS);
        } else if (isNonOracleAgent(role)) {
            query.where('(ticket."handlingTeam" = :opsTeam)', { opsTeam: HandlingTeam.OPS_SUPPORT });
            query.andWhere(`(ticket.ticketType NOT IN (:...excludedTypes) OR ${FLOW_EXISTS})`, {
                excludedTypes: [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST, TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION],
            });
            applySiteFilter(query, role, userSiteId);
        } else {
            query.where('(ticket.userId = :userId OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp."ticketId" = ticket.id AND tp."userId" = :userId))', { userId });
            query.andWhere(`(ticket.ticketType NOT IN (:...excludedTypes) OR ${FLOW_EXISTS})`, {
                excludedTypes: [TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION],
            });
        }

        applyServiceScopeFilter(query, role);
        applyRequestKindFilter(query, requestKind);
        const rawTickets = await query.getMany();
        const flowFields = await loadFlowListFields(this.ticketRepo.manager, rawTickets, { userId, role });
        const withFlow = rawTickets.map((ticket) => ({ ...ticket, ...flowFields.get(ticket.id) }));
        const sla = await this.slaSnapshotFor(withFlow);
        return withFlow.map((ticket) => {
            const nonSla = isNonSlaTicketType(ticket);
            return {
                ...(nonSla ? stripSlaFields(ticket) : ticket),
                isNonSla: nonSla,
                slaTarget: nonSla ? null : ensureSlaTarget(ticket, sla),
                hasUnreadChat: computeHasUnreadChat(ticket, role, { id: userId, siteId: userSiteId }),
                isParticipant: role === UserRole.USER && ticket.userId !== userId,
            };
        }) as Ticket[];
    }

    async findAllPaginated(
        userId: string,
        role: UserRole,
        userSiteId: string | null,
        options: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'ASC' | 'DESC';
            status?: string;
            priority?: string;
            category?: string;
            search?: string;
            siteId?: string;
            siteIds?: string[];
            excludeCategory?: string;
            excludeType?: string;
            ticketType?: string;
            startDate?: string;
            endDate?: string;
            createdByMe?: boolean;
            assignedToMe?: boolean;
            overdue?: boolean;
            allTeams?: boolean;
            handlingTeam?: ReportTeam;
            requestKind?: RequestKindFilter;
        } = {},
    ) {
        const {
            page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC',
            status, priority, category, search, siteId, siteIds,
            excludeCategory, excludeType, ticketType, startDate, endDate,
            createdByMe, assignedToMe, overdue, allTeams, handlingTeam, requestKind,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .leftJoinAndSelect('ticket.forwardedFromSite', 'forwardedFromSite');

        if (createdByMe) {
            qb.andWhere('(ticket.userId = :userId OR ticket."createdById" = :filerId)', { userId, filerId: userId });
        } else if (role !== UserRole.USER) {
            if (!(allTeams && canSpanAllTeams(role))) {
                qb.andWhere('(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)', { opsTeam: HandlingTeam.OPS_SUPPORT });
                qb.andWhere('(ticket.ticketType NOT IN (:...devTypes) OR ticket.ticketType IS NULL)', { devTypes: DEV_TICKET_TYPES });
            }
            applyHandlingTeamFilter(qb, handlingTeam);
            applySiteFilter(qb, role, userSiteId, { siteId, siteIds });
            applyServiceScopeFilter(qb, role);
        }

        if (assignedToMe) qb.andWhere('ticket.assignedToId = :assigneeId', { assigneeId: userId });

        if (role === UserRole.USER) {
            qb.andWhere('(ticket.userId = :userId OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp."ticketId" = ticket.id AND tp."userId" = :userId))', { userId });
            if (!ticketType) {
                qb.andWhere(`(ticket.ticketType NOT IN (:...excludedTypes) OR ${FLOW_EXISTS})`, {
                    excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION'],
                });
            }
        }

        applyRequestKindFilter(qb, requestKind);
        applyStatusFilter(qb, status);
        if (overdue) qb.andWhere(OVERDUE_SQL);
        if (priority) qb.andWhere('ticket.priority = :priority', { priority });
        if (category) qb.andWhere('ticket.category = :category', { category });

        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere('(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)', { search: `%${searchTerm}%` });
            } else {
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` },
                );
            }
        }

        if (excludeCategory) {
            qb.andWhere('ticket.category NOT IN (:...excludeCategories)', { excludeCategories: excludeCategory.split(',').map(c => c.trim()) });
        }

        if (ticketType === 'HARDWARE_INSTALLATION') qb.andWhere('ticket.isHardwareInstallation = true');
        else if (ticketType) qb.andWhere('ticket.ticketType = :ticketType', { ticketType });

        if (excludeType === 'HARDWARE_INSTALLATION') qb.andWhere('ticket.isHardwareInstallation = false');
        else if (excludeType) qb.andWhere('ticket.ticketType != :excludeType', { excludeType });

        if (startDate) qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        if (endDate) qb.andWhere('ticket.createdAt <= :endDate', { endDate });

        const sortColumns: Record<string, string> = {
            createdAt: 'ticket.createdAt', updatedAt: 'ticket.updatedAt', status: 'ticket.status',
            priority: 'ticket.priority', title: 'ticket.title', ticketNumber: 'ticket.ticketNumber', site: 'site.code',
        };
        qb.orderBy(sortColumns[sortBy] ?? sortColumns.createdAt, sortOrder === 'ASC' ? 'ASC' : 'DESC');
        qb.skip((page - 1) * limit).take(limit);

        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        const hwTicketIds = data.filter((t) => t.isHardwareInstallation).map((t) => t.id);
        let hwScheduleMap = new Map<string, string>();
        if (hwTicketIds.length > 0) {
            const schedules = await this.ticketRepo.manager
                .createQueryBuilder()
                .select('s."ticketId"', 'ticketId')
                .addSelect('s."requestId"', 'ictBudgetRequestId')
                .from('installation_schedules', 's')
                .where('s."ticketId" IN (:...hwTicketIds)', { hwTicketIds })
                .getRawMany();
            hwScheduleMap = new Map(schedules.map((s) => [s.ticketId, s.ictBudgetRequestId]));
        }

        const flowFields = await loadFlowListFields(this.ticketRepo.manager, data, { userId, role });
        const withFlow = data.map((ticket) => ({ ...ticket, ...flowFields.get(ticket.id) }));
        const sla = await this.slaSnapshotFor(withFlow);
        const enrichedTickets = withFlow.map((ticket) => {
            const nonSla = isNonSlaTicketType(ticket);
            return {
                ...(nonSla ? stripSlaFields(ticket) : ticket),
                isNonSla: nonSla,
                slaTarget: nonSla ? null : ensureSlaTarget(ticket, sla),
                ictBudgetRequestId: hwScheduleMap.get(ticket.id) || null,
                hasUnreadChat: computeHasUnreadChat(ticket, createdByMe ? UserRole.USER : role, { id: userId, siteId: userSiteId }),
                isParticipant: role === UserRole.USER && ticket.userId !== userId,
                isFiledByMe: ticket.createdById === userId,
            };
        });

        return {
            data: enrichedTickets,
            meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
        };
    }

    async findAllPaginatedOracle(userId: string, role: UserRole, userSiteId: string | null, options: DevQueueOptions = {}): Promise<DevQueuePage> {
        return queryDevQueuePage(this.ticketRepo, (t) => this.slaSnapshotFor(t), 'oracle', userId, role, userSiteId, options);
    }

    async findAllPaginatedWebDev(userId: string, role: UserRole, userSiteId: string | null, options: DevQueueOptions = {}): Promise<DevQueuePage> {
        return queryDevQueuePage(this.ticketRepo, (t) => this.slaSnapshotFor(t), 'web-dev', userId, role, userSiteId, options);
    }

    async findAllPaginatedMobileDev(userId: string, role: UserRole, userSiteId: string | null, options: DevQueueOptions = {}): Promise<DevQueuePage> {
        return queryDevQueuePage(this.ticketRepo, (t) => this.slaSnapshotFor(t), 'mobile-dev', userId, role, userSiteId, options);
    }

    async getQueueStats(queue: QueueKey, userId: string, role: UserRole, userSiteId: string | null, options: DevQueueOptions = {}): Promise<QueueStats> {
        return queryQueueStats(this.ticketRepo, queue, userId, role, userSiteId, options);
    }

    async assertCanView(id: string, user: { id?: string; role: UserRole | string; siteId?: string | null }): Promise<TicketViewerAccess> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            select: ['id', 'userId', 'createdById', 'category', 'ticketType', 'handlingTeam', 'siteId'],
            relations: ['participants'],
        });
        if (!ticket) throw new NotFoundException('Ticket not found');
        return resolveTicketViewerAccessWithFlow(ticket, user, this.ticketRepo.manager);
    }

    async findOne(id: string, user?: { id?: string; role: UserRole | string; siteId?: string | null }): Promise<any> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: [
                'user', 'user.department', 'assignedTo', 'createdBy', 'site', 'forwardedFromSite',
                'messages', 'messages.sender', 'messages.pinnedBy', 'messages.reactions', 'messages.reactions.user',
                'participants', 'participants.user', 'participants.user.department', 'participants.invitedBy',
                'slaAdjustments', 'slaAdjustments.actor',
            ],
            order: {
                messages: { createdAt: 'ASC', id: 'ASC' },
                slaAdjustments: { createdAt: 'DESC' },
            },
        });
        if (!ticket) throw new NotFoundException('Ticket not found');

        let viewerAccess: TicketViewerAccess | undefined;
        if (user) {
            viewerAccess = await resolveTicketViewerAccessWithFlow(ticket, user, this.ticketRepo.manager);
            if (viewerAccess === 'requester') {
                ticket.messages = (ticket.messages ?? []).filter((m) => !m.isInternal);
            }
        }

        const flowFields = user?.id ? await loadFlowListFields(this.ticketRepo.manager, [ticket], { userId: user.id, role: user.role }) : undefined;
        const flow = flowFields?.get(ticket.id);
        const nonSla = flow
            ? isNonSlaTicketType({ ...ticket, ...flow })
            : await isNonSlaTicket(this.ticketRepo.manager, ticket);

        let slaTarget = nonSla ? null : ticket.slaTarget;
        if (!nonSla && !slaTarget && ticket.priority) {
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority: ticket.priority } });
            if (slaConfig) {
                const createdAt = new Date(ticket.createdAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                slaTarget = this.slaClock
                    ? await this.slaClock.targetFor(ticket.priority, createdAt, slaConfig.resolutionTimeMinutes)
                    : new Date(createdAt.getTime() + (slaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);
            }
        }

        const createdBy = ticket.createdBy ? { id: ticket.createdBy.id, fullName: ticket.createdBy.fullName } : null;
        const messages = ticket.messages ?? [];
        const people = await loadMentionNames(this.ticketRepo.manager, messages);
        const pinViewer = user?.id ? { id: user.id, role: user.role, assignedToId: ticket.assignedToId } : undefined;
        const baseTicket = nonSla ? stripSlaFields(ticket) : ticket;
        return {
            ...baseTicket,
            ...flow,
            isNonSla: nonSla,
            messages: presentThread(messages, people, pinViewer),
            createdBy,
            slaTarget,
            viewerAccess,
        };
    }

    async getDashboardStats(
        _userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        excludeCategory?: string,
        days: number = 7,
    ) {
        const cacheKey = `dashboard:stats:${role}:${siteScopeKey(role, userSiteId)}:${excludeCategory || 'none'}:${days}`;
        return this.cacheService.getOrSet(cacheKey, async () => {
            return this.computeDashboardStats(role, userSiteId, excludeCategory, days);
        }, 15);
    }

    private async computeDashboardStats(role: UserRole, userSiteId: string | null, excludeCategory?: string, chartDays: number = 7) {
        return computeDashboardStatsData(() => this.createFilteredTicketQb(role, userSiteId, excludeCategory), chartDays);
    }

    async findAllPaginatedByModule(
        slug: string,
        userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        options: {
            page?: number; limit?: number; sortBy?: string; sortOrder?: 'ASC' | 'DESC';
            status?: string; priority?: string; category?: string; search?: string;
            assignedToId?: string; siteId?: string; siteIds?: string[];
            ticketType?: string; startDate?: string; endDate?: string;
        } = {},
    ) {
        if (!this.moduleRepo) throw new NotFoundException(`Ticket module repository is not available`);
        const module = await this.moduleRepo.findOne({ where: { slug } });
        if (!module) throw new NotFoundException(`Ticket module with slug "${slug}" not found`);

        if (role !== UserRole.ADMIN && module.allowedRoles && module.allowedRoles.length > 0) {
            if (!module.allowedRoles.includes(role)) {
                throw new NotFoundException(`You do not have permission to access the ${module.name} queue`);
            }
        }

        const {
            page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC',
            status, priority, category, search, assignedToId, siteId, siteIds, ticketType, startDate, endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .leftJoinAndSelect('ticket.forwardedFromSite', 'forwardedFromSite');

        if (module.handlingTeams?.length) qb.andWhere('ticket.handlingTeam IN (:...teams)', { teams: module.handlingTeams });
        if (module.ticketTypes?.length) qb.andWhere('ticket.ticketType IN (:...types)', { types: module.ticketTypes });
        if (module.categories?.length) qb.andWhere('ticket.category IN (:...cats)', { cats: module.categories });

        applySiteFilter(qb, role, userSiteId, { siteId, siteIds });
        applyServiceScopeFilter(qb, role);

        if (status) qb.andWhere('ticket.status = :status', { status });
        if (priority) qb.andWhere('ticket.priority = :priority', { priority });
        if (category) qb.andWhere('ticket.category = :category', { category });
        if (ticketType) qb.andWhere('ticket.ticketType = :ticketType', { ticketType });
        if (assignedToId) {
            if (assignedToId === 'unassigned') qb.andWhere('ticket.assignedToId IS NULL');
            else qb.andWhere('ticket.assignedToId = :assignedToId', { assignedToId });
        }

        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.includes('-') || /^[A-Z0-9#-]+$/i.test(searchTerm)) {
                qb.andWhere('ticket.ticketNumber ILIKE :exactSearch', { exactSearch: `%${searchTerm}%` });
            } else {
                const formattedQuery = toPrefixTsQuery(searchTerm);
                qb.andWhere(
                    `(to_tsvector('simple', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ to_tsquery('simple', :ftsQuery) OR ticket.ticketNumber ILIKE :fuzzySearch OR user.fullName ILIKE :fuzzySearch)`,
                    { ftsQuery: formattedQuery, fuzzySearch: `%${searchTerm}%` },
                );
            }
        }

        if (startDate && endDate) {
            qb.andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', { startDate: new Date(startDate), endDate: new Date(endDate) });
        }

        const validSortColumns: Record<string, string> = {
            createdAt: 'ticket.createdAt', updatedAt: 'ticket.updatedAt', priority: 'ticket.priority',
            status: 'ticket.status', ticketNumber: 'ticket.ticketNumber', targetDate: 'ticket.targetDate',
        };
        qb.orderBy(validSortColumns[sortBy] || 'ticket.createdAt', sortOrder);
        qb.skip((page - 1) * limit).take(limit);

        const [tickets, total] = await qb.getManyAndCount();
        const nonSlaIds = await findNonSlaTicketIds(this.ticketRepo.manager, tickets);

        const statsQb = this.ticketRepo.createQueryBuilder('ticket');
        if (module.handlingTeams?.length) statsQb.andWhere('ticket.handlingTeam IN (:...teams)', { teams: module.handlingTeams });
        if (module.ticketTypes?.length) statsQb.andWhere('ticket.ticketType IN (:...types)', { types: module.ticketTypes });
        if (module.categories?.length) statsQb.andWhere('ticket.category IN (:...cats)', { cats: module.categories });
        applySiteFilter(statsQb, role, userSiteId, { siteId, siteIds });
        applyServiceScopeFilter(statsQb, role);

        const [totalCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
            statsQb.clone().getCount(),
            statsQb.clone().andWhere('ticket.status = :s', { s: TicketStatus.TODO }).getCount(),
            statsQb.clone().andWhere('ticket.status = :s', { s: TicketStatus.IN_PROGRESS }).getCount(),
            statsQb.clone().andWhere('ticket.status IN (:...s)', { s: TICKET_DONE_STATUSES }).getCount(),
        ]);

        return {
            data: tickets.map(t => {
                const nonSla = nonSlaIds.has(t.id);
                return {
                    ...(nonSla ? stripSlaFields(t) : t),
                    isNonSla: nonSla,
                    hasUnreadChat: computeHasUnreadChat(t, role, { id: userId, siteId: userSiteId }),
                };
            }),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: page * limit < total },
            stats: { total: totalCount, open: openCount, inProgress: inProgressCount, resolved: resolvedCount },
            module: {
                id: module.id, name: module.name, slug: module.slug, description: module.description,
                icon: module.icon, color: module.color, allowedRoles: module.allowedRoles,
            },
        };
    }
}
