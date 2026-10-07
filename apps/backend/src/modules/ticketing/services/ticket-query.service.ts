import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketType, HandlingTeam, TicketStatus, TICKET_DONE_STATUSES } from '../entities/ticket.entity';
import { TicketModule } from '../entities/ticket-module.entity';
import { SlaConfig } from '../entities/sla-config.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { CacheService, CacheKeys } from '../../../shared/core/cache';
import { resolveTicketViewerAccess, TicketViewerAccess } from './ticket-oracle-access';
import { applySiteFilter, siteScopeKey } from '../utils/site-access.util';
import { applyServiceScopeFilter } from '../../../shared/core/utils/service-scope.util';
import { TICKET_DONE_STATUSES_SQL, TICKET_INACTIVE_STATUSES_SQL } from '../utils/ticket-status-sql.util';
import { addSlaMinutes, isBusinessHoursOnly, SlaClockService, SlaSnapshot } from './sla-clock.service';
import { wibDateSql, wibStartOfMonth, wibStartOfToday, wibStartOfWeek } from '../../../shared/core/utils/wib-date.util';
import { DEFAULT_TIMEZONE, localDateKey } from '../../sla-config/business-hours.calc';

const AGENT_ROLES_NON_ORACLE = [UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT, UserRole.AGENT_ADMIN] as const;
const ORACLE_FILTER_PARAMS = { oracleTeam: 'ORACLE_DEV' } as const;

/** Roles that may open the developer queues (mirrors the frontend route guards). */
const DEV_QUEUE_ROLES: readonly UserRole[] = [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV, UserRole.ADMIN];
const DEV_QUEUES = ['oracle', 'web-dev', 'mobile-dev'];

/** A dev queue asked for by any other role is ignored, so the caller gets their normal role-scoped list. */
export function effectiveQueue(queue: string | undefined, role: UserRole): string | undefined {
    if (queue && DEV_QUEUES.includes(queue) && !DEV_QUEUE_ROLES.includes(role)) return undefined;
    return queue;
}

/**
 * When a ticket was resolved. `updatedAt` moves on any later write (auto-close,
 * edits), so it only stands in for legacy rows that predate `resolvedAt`.
 */
const RESOLVED_AT_SQL = 'COALESCE(ticket."resolvedAt", ticket."updatedAt")';
const CREATED_WIB_DATE = wibDateSql('ticket."createdAt"');
const MS_PER_DAY = 86_400_000;

/**
 * Prefix tsquery from free text (`printer lt 2` -> `printer:* & lt:* & 2:*`). Tokens are
 * reduced to letters/digits first: raw input like `a(b` is a tsquery syntax error (500).
 * Returns an always-false query when nothing searchable is left.
 */
export function toPrefixTsQuery(text: string): string {
    const tokens = text.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    return tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : '!_';
}

export function isNonOracleAgent(role: UserRole): boolean {
    return (AGENT_ROLES_NON_ORACLE as readonly UserRole[]).includes(role);
}

export function applyOracleFilter(qb: import('typeorm').SelectQueryBuilder<Ticket>, role: UserRole): void {
    if (isNonOracleAgent(role)) {
        qb.andWhere('(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)', {
            opsTeam: HandlingTeam.OPS_SUPPORT,
        });
    } else if (role === UserRole.AGENT_ORACLE) {
        qb.andWhere('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', {
            oracleTeam: 'ORACLE_DEV',
            webTeam: 'WEB_DEV',
        });
    } else if (role === UserRole.AGENT_WEB_DEV) {
        qb.andWhere('(ticket."handlingTeam" = :webTeam OR ticket."handlingTeam" = :oracleTeam)', {
            webTeam: 'WEB_DEV',
            oracleTeam: 'ORACLE_DEV',
        });
    } else if (role === UserRole.AGENT_MOBILE_DEV) {
        qb.andWhere('(ticket."handlingTeam" = :mobileTeam)', { mobileTeam: 'MOBILE_DEV' });
    }
}

const DEFAULT_SLA_MINUTES: Record<string, number> = {
    CRITICAL: 120,
    HIGH: 240,
    MEDIUM: 480,
    LOW: 1440,
};

/**
 * Display target for tickets whose resolution clock has not stored one yet.
 * With a snapshot it follows the priority's config and business hours.
 */
export function ensureSlaTarget(ticket: Ticket, sla?: SlaSnapshot): Date | null {
    if (ticket.slaTarget) return ticket.slaTarget;
    if (ticket.priority && ticket.createdAt && (ticket.priority as any) !== 'HARDWARE_INSTALLATION') {
        const config = sla?.configs.get(ticket.priority);
        const mins = config?.resolutionTimeMinutes ?? DEFAULT_SLA_MINUTES[ticket.priority] ?? 480;
        if (sla) return addSlaMinutes(new Date(ticket.createdAt), mins, isBusinessHoursOnly(config), sla.schedule);
        return new Date(new Date(ticket.createdAt).getTime() + mins * 60000);
    }
    return null;
}

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

    /** SLA config + schedule, loaded only when some ticket still needs a projected target. */
    private async slaSnapshotFor(tickets: Ticket[]): Promise<SlaSnapshot | undefined> {
        if (!this.slaClock || tickets.every(t => t.slaTarget)) return undefined;
        return this.slaClock.snapshot();
    }

    private createFilteredTicketQb(role: UserRole, userSiteId: string | null, excludeCategory?: string): import('typeorm').SelectQueryBuilder<Ticket> {
        const qb = this.ticketRepo.createQueryBuilder('ticket');
        applyOracleFilter(qb, role);
        applySiteFilter(qb, role, userSiteId);
        applyServiceScopeFilter(qb, role);
        if (excludeCategory) {
            const excludedCategories = excludeCategory.split(',').map((cat) => cat.trim());
            if (excludedCategories.length > 0) {
                qb.andWhere('ticket.category NOT IN (:...excludedCategories)', { excludedCategories });
            }
        }
        return qb;
    }

    async findAll(
        userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        queue?: string,
    ): Promise<Ticket[]> {
        const query = this.ticketRepo.createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .orderBy('ticket.createdAt', 'DESC')
            .take(500); // Safety limit to prevent full table dumps

        queue = effectiveQueue(queue, role);
        if (queue === 'oracle') {
            query.where('(ticket."handlingTeam" = :oracleTeam)', ORACLE_FILTER_PARAMS);
            query.andWhere(
                '(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory OR ticket.category ILIKE :oracleLike OR ticket.category ILIKE :k2Like)',
                {
                    oracleType: TicketType.ORACLE_REQUEST,
                    oracleCategory: 'ORACLE_REQUEST',
                    oracleLike: '%oracle%',
                    k2Like: '%k2%',
                },
            );
        } else if (queue === 'web-dev') {
            query.where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', { ...ORACLE_FILTER_PARAMS, webTeam: HandlingTeam.WEB_DEV });
            query.andWhere(
                '(ticket.ticketType = :webDevType OR ticket.category = :webDevCategory OR ticket.category ILIKE :webDevLike)',
                {
                    webDevType: TicketType.WEB_DEV_REQUEST,
                    webDevCategory: 'WEB_DEV_REQUEST',
                    webDevLike: '%web%',
                },
            );
        } else if (queue === 'mobile-dev') {
            query.where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :mobileTeam)', { ...ORACLE_FILTER_PARAMS, mobileTeam: HandlingTeam.MOBILE_DEV });
            query.andWhere(
                '(ticket.ticketType = :mobileDevType OR ticket.category = :mobileDevCategory OR ticket.category ILIKE :mobileDevLike)',
                {
                    mobileDevType: TicketType.MOBILE_DEV_REQUEST,
                    mobileDevCategory: 'MOBILE_DEV_REQUEST',
                    mobileDevLike: '%mobile%',
                },
            );
        } else if (role === UserRole.ADMIN) {
            // IT Support Queue (default)
            query.where('(ticket."handlingTeam" = :opsTeam)', { opsTeam: HandlingTeam.OPS_SUPPORT });
            query.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', { 
                excludedTypes: [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST, TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION] 
            });
        } else if (role === UserRole.AGENT_ORACLE) {
            // Oracle agent sees only developer requests
            query.where('(ticket."handlingTeam" = :oracleTeam)', ORACLE_FILTER_PARAMS);
        } else if (isNonOracleAgent(role)) {
            // Normal agents see everything EXCEPT developer requests
            query.where('(ticket."handlingTeam" = :opsTeam)', { opsTeam: HandlingTeam.OPS_SUPPORT });
            query.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', { 
                excludedTypes: [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST, TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION] 
            });
            applySiteFilter(query, role, userSiteId);
        } else {
            // Normal user sees only their own tickets OR tickets where they are a participant
            query.where('(ticket.userId = :userId OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp."ticketId" = ticket.id AND tp."userId" = :userId))', { userId });
            query.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', { 
                excludedTypes: [TicketType.ICT_BUDGET, TicketType.HARDWARE_INSTALLATION] 
            });
        }

        applyServiceScopeFilter(query, role);
        const rawTickets = await query.getMany();
        const sla = await this.slaSnapshotFor(rawTickets);
        return rawTickets.map((ticket) => ({
            ...ticket,
            slaTarget: ensureSlaTarget(ticket, sla),
            hasUnreadChat: computeHasUnreadChat(ticket, role),
            isParticipant: role === UserRole.USER && ticket.userId !== userId,
        })) as Ticket[];
    }

    async findAllPaginated(
        userId: string,
        role: UserRole,
        userSiteId: string | null, // User's assigned site (null for cross-site roles)
        options: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'ASC' | 'DESC';
            status?: string;
            priority?: string;
            category?: string;
            search?: string;
            siteId?: string;      // Single site filter
            siteIds?: string[];   // Multiple site filter (ADMIN/MANAGER only)
            excludeCategory?: string;
            excludeType?: string;
            ticketType?: string;
            startDate?: string;
            endDate?: string;
            createdByMe?: boolean; // Requested/filed by the caller, across teams and sites
            assignedToMe?: boolean; // Assigned to the caller (filtered server-side so paging and totals stay right)
        } = {}
    ) {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            category,
            search,
            siteId,
            siteIds,
            excludeCategory,
            excludeType,
            ticketType,
            startDate,
            endDate,
            createdByMe,
            assignedToMe,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site');

        // "Tiket yang saya buat": requester-side access follows the ticket to any
        // team or site, so the team/site scoping below does not apply.
        if (createdByMe) {
            // Separate params: userId is uuid, createdById is varchar, and one shared
            // bind param gets a single inferred type -> "character varying = uuid".
            qb.andWhere('(ticket.userId = :userId OR ticket."createdById" = :filerId)', { userId, filerId: userId });
        } else if (role !== UserRole.USER) {
            // IT Support list must strictly show OPS_SUPPORT tickets only and exclude
            // developer requests (Oracle, Web Dev, Mobile Dev).
            qb.andWhere(
                '(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)',
                { opsTeam: HandlingTeam.OPS_SUPPORT },
            );
            qb.andWhere(
                '(ticket.ticketType NOT IN (:...devTypes) OR ticket.ticketType IS NULL)',
                { devTypes: [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST] }
            );
            // Site isolation: cross-site roles may narrow by site, everyone else is
            // pinned to their own — and fail closed when they have none.
            applySiteFilter(qb, role, userSiteId, { siteId, siteIds });
            applyServiceScopeFilter(qb, role);
        }

        if (assignedToMe) {
            qb.andWhere('ticket.assignedToId = :assigneeId', { assigneeId: userId });
        }

        // Client My Tickets includes every ticket owned by or shared with the requester.
        if (role === UserRole.USER) {
            qb.andWhere('(ticket.userId = :userId OR EXISTS (SELECT 1 FROM ticket_participants tp WHERE tp."ticketId" = ticket.id AND tp."userId" = :userId))', { userId });

            // Only apply default exclusion if an explicit ticketType filter is not provided
            if (!ticketType) {
                qb.andWhere('ticket.ticketType NOT IN (:...excludedTypes)', {
                    excludedTypes: ['ICT_BUDGET', 'HARDWARE_INSTALLATION']
                });
            }
        }

        // Status filter
        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }

        // Priority filter
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }

        // Category filter
        if (category) {
            qb.andWhere('ticket.category = :category', { category });
        }

        // Search in title and description using PostgreSQL Full-Text Search
        // OPTIMIZED: Uses to_tsvector with GIN index for ~10x faster search on large datasets
        // Fallback to ILIKE for ticket number (exact match pattern)
        if (search) {
            const searchTerm = search.trim();

            // For short queries or ticket number patterns, use ILIKE (more flexible)
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere(
                    '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                    { search: `%${searchTerm}%` }
                );
            } else {
                // For longer queries, use Full-Text Search for better performance
                // This requires a GIN index on the search vector (see migration)
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` }
                );
            }
        }

        // Exclude Category filter
        if (excludeCategory) {
            const excludeCategories = excludeCategory.split(',').map(c => c.trim());
            qb.andWhere('ticket.category NOT IN (:...excludeCategories)', { excludeCategories });
        }

        // Ticket Type filter (specific type or exclude type)
        if (ticketType === 'HARDWARE_INSTALLATION') {
            qb.andWhere('ticket.isHardwareInstallation = true');
        } else if (ticketType) {
            qb.andWhere('ticket.ticketType = :ticketType', { ticketType });
        }
        
        if (excludeType === 'HARDWARE_INSTALLATION') {
            qb.andWhere('ticket.isHardwareInstallation = false');
        } else if (excludeType) {
            qb.andWhere('ticket.ticketType != :excludeType', { excludeType });
        }

        // Date range filters
        if (startDate) {
            qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        }
        
        if (endDate) {
            qb.andWhere('ticket.createdAt <= :endDate', { endDate });
        }

        // P1 perf: getCount() + getMany() replaced with getManyAndCount() — single
        // round-trip instead of two. Paginator/sort still applied to the same builder.
        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        qb.orderBy(`ticket.${actualSortBy}`, sortOrder);

        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const [data, total] = await qb.getManyAndCount();

        const totalPages = Math.ceil(total / limit);

        // Enrich HW Installation tickets with ictBudgetRequestId
        const hwTicketIds = data
          .filter((t) => t.isHardwareInstallation)
          .map((t) => t.id);

        let hwScheduleMap = new Map<string, string>();
        if (hwTicketIds.length > 0) {
          const schedules = await this.ticketRepo.manager
            .createQueryBuilder()
            .select('s."ticketId"', 'ticketId')
            .addSelect('s."requestId"', 'ictBudgetRequestId')
            .from('installation_schedules', 's')
            .where('s."ticketId" IN (:...hwTicketIds)', { hwTicketIds })
            .getRawMany();
          hwScheduleMap = new Map(
            schedules.map((s) => [s.ticketId, s.ictBudgetRequestId]),
          );
        }

        const sla = await this.slaSnapshotFor(data);
        const enrichedTickets = data.map((ticket) => ({
          ...ticket,
          slaTarget: ensureSlaTarget(ticket, sla),
          ictBudgetRequestId: hwScheduleMap.get(ticket.id) || null,
          // In "created by me" the caller reads as the requester side.
          hasUnreadChat: computeHasUnreadChat(ticket, createdByMe ? UserRole.USER : role),
          isParticipant: role === UserRole.USER && ticket.userId !== userId,
          isFiledByMe: ticket.createdById === userId,
        }));

        return {
            data: enrichedTickets,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    /**
     * Scoping shared by the developer queues (Oracle/K2, Web Dev, Mobile Dev); the team
     * filter is applied by each caller. "Created by me" skips site and service scoping,
     * like the IT Support list: the caller's own tickets are always visible to them.
     */
    private applyDevQueueScope(
        qb: import('typeorm').SelectQueryBuilder<Ticket>,
        userId: string,
        role: UserRole,
        userSiteId: string | null,
        options: { siteId?: string; siteIds?: string[]; createdByMe?: boolean; assignedToMe?: boolean },
    ): void {
        if (options.createdByMe) {
            // Separate params: userId is uuid, createdById is varchar.
            qb.andWhere('(ticket.userId = :userId OR ticket."createdById" = :filerId)', { userId, filerId: userId });
        } else {
            applySiteFilter(qb, role, userSiteId, { siteId: options.siteId, siteIds: options.siteIds });
            applyServiceScopeFilter(qb, role);
        }
        if (options.assignedToMe) {
            qb.andWhere('ticket.assignedToId = :assigneeId', { assigneeId: userId });
        }
    }

    async findAllPaginatedOracle(
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
            search?: string;
            siteId?: string;
            siteIds?: string[];
            startDate?: string;
            endDate?: string;
            createdByMe?: boolean;
            assignedToMe?: boolean;
        } = {},
    ): Promise<{ data: Ticket[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }> {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            search,
            siteId,
            siteIds,
            startDate,
            endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            // Strict Oracle/K2 filter — handlingTeam is the source of truth,
            // so a ticket forwarded to OPS_SUPPORT disappears from this list.
            .where('(ticket."handlingTeam" = :oracleTeam)', ORACLE_FILTER_PARAMS)
            .andWhere(
                '(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory OR (ticket.category ILIKE :oracleLike AND (ticket.ticketType IS NULL OR ticket.ticketType NOT IN (:...otherDevTypes))))',
                {
                    oracleType: 'ORACLE_REQUEST',
                    oracleCategory: 'ORACLE_REQUEST',
                    oracleLike: '%oracle%',
                    otherDevTypes: ['WEB_DEV_REQUEST', 'MOBILE_DEV_REQUEST'],
                },
            );

        // Site isolation (matches findAllPaginated behaviour)
        this.applyDevQueueScope(qb, userId, role, userSiteId, options);

        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }
        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere(
                    '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                    { search: `%${searchTerm}%` },
                );
            } else {
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` },
                );
            }
        }
        if (startDate) {
            qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('ticket.createdAt <= :endDate', { endDate });
        }

        // Whitelisted sort fields (matches existing service)
        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(`ticket.${safeSortBy}`, safeSortOrder)
          .skip((page - 1) * limit)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        const sla = await this.slaSnapshotFor(data);
        const enrichedTickets = data.map((ticket) => ({
            ...ticket,
            slaTarget: ensureSlaTarget(ticket, sla),
            hasUnreadChat: computeHasUnreadChat(ticket, role),
        }));

        return {
            data: enrichedTickets as any,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    async findAllPaginatedWebDev(
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
            search?: string;
            siteId?: string;
            siteIds?: string[];
            startDate?: string;
            endDate?: string;
            createdByMe?: boolean;
            assignedToMe?: boolean;
        } = {},
    ): Promise<{ data: Ticket[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }> {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            search,
            siteId,
            siteIds,
            startDate,
            endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', { ...ORACLE_FILTER_PARAMS, webTeam: 'WEB_DEV' })
            .andWhere(
                '(ticket.ticketType = :webDevType OR ticket.category = :webDevCategory OR ticket.category ILIKE :webDevLike)',
                {
                    webDevType: 'WEB_DEV_REQUEST',
                    webDevCategory: 'WEB_DEV_REQUEST',
                    webDevLike: '%web%',
                },
            );

        this.applyDevQueueScope(qb, userId, role, userSiteId, options);

        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }
        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere(
                    '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                    { search: `%${searchTerm}%` },
                );
            } else {
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` },
                );
            }
        }
        if (startDate) {
            qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('ticket.createdAt <= :endDate', { endDate });
        }

        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(`ticket.${safeSortBy}`, safeSortOrder)
          .skip((page - 1) * limit)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        const sla = await this.slaSnapshotFor(data);
        const enrichedTickets = data.map((ticket) => ({
            ...ticket,
            slaTarget: ensureSlaTarget(ticket, sla),
            hasUnreadChat: computeHasUnreadChat(ticket, role),
        }));

        return {
            data: enrichedTickets as any,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    async findAllPaginatedMobileDev(
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
            search?: string;
            siteId?: string;
            siteIds?: string[];
            startDate?: string;
            endDate?: string;
            createdByMe?: boolean;
            assignedToMe?: boolean;
        } = {},
    ): Promise<{ data: Ticket[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean } }> {
        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            search,
            siteId,
            siteIds,
            startDate,
            endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site')
            .where('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :mobileTeam)', { ...ORACLE_FILTER_PARAMS, mobileTeam: 'MOBILE_DEV' })
            .andWhere(
                '(ticket.ticketType = :mobileDevType OR ticket.category = :mobileDevCategory OR ticket.category ILIKE :mobileDevLike)',
                {
                    mobileDevType: 'MOBILE_DEV_REQUEST',
                    mobileDevCategory: 'MOBILE_DEV_REQUEST',
                    mobileDevLike: '%mobile%',
                },
            );

        this.applyDevQueueScope(qb, userId, role, userSiteId, options);

        if (status) {
            qb.andWhere('ticket.status = :status', { status });
        }
        if (priority) {
            qb.andWhere('ticket.priority = :priority', { priority });
        }
        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length <= 3 || /^\d{6}-/.test(searchTerm)) {
                qb.andWhere(
                    '(ticket.title ILIKE :search OR ticket.description ILIKE :search OR ticket."ticketNumber" ILIKE :search)',
                    { search: `%${searchTerm}%` },
                );
            } else {
                qb.andWhere(
                    `(to_tsvector('indonesian', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ plainto_tsquery('indonesian', :search) OR ticket."ticketNumber" ILIKE :ticketSearch)`,
                    { search: searchTerm, ticketSearch: `%${searchTerm}%` },
                );
            }
        }
        if (startDate) {
            qb.andWhere('ticket.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('ticket.createdAt <= :endDate', { endDate });
        }

        const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
        const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

        qb.orderBy(`ticket.${safeSortBy}`, safeSortOrder)
          .skip((page - 1) * limit)
          .take(limit);

        const [data, total] = await qb.getManyAndCount();
        const totalPages = Math.ceil(total / limit);

        const sla = await this.slaSnapshotFor(data);
        const enrichedTickets = data.map((ticket) => ({
            ...ticket,
            slaTarget: ensureSlaTarget(ticket, sla),
            hasUnreadChat: computeHasUnreadChat(ticket, role),
        }));

        return {
            data: enrichedTickets as any,
            meta: {
                total,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        };
    }

    async findOne(id: string, user?: { id?: string; role: UserRole | string; siteId?: string | null }): Promise<any> {
        const ticket = await this.ticketRepo.findOne({
            where: { id },
            relations: [
                'user',
                'user.department',
                'assignedTo',
                'messages',
                'messages.sender',
                'participants',
                'participants.user',
                'participants.user.department',
                'participants.invitedBy',
                'slaAdjustments',
                'slaAdjustments.actor',
            ],
            order: {
                slaAdjustments: {
                    createdAt: 'DESC',
                },
            },
        });

        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        let viewerAccess: TicketViewerAccess | undefined;
        if (user) {
            viewerAccess = resolveTicketViewerAccess(ticket, user);
            if (viewerAccess === 'requester') {
                ticket.messages = (ticket.messages ?? []).filter((m) => !m.isInternal);
            }
        }

        // Use stored SLA Target if available, otherwise calculate it for display only.
        // Never persist from this read path: saving the loaded entity would also cascade the
        // (requester-filtered) messages relation, and a stored target on a ticket whose SLA clock
        // has not started makes it count as overdue.
        let slaTarget = ticket.slaTarget;
        if (!slaTarget && ticket.priority) {
            const slaConfig = await this.slaConfigRepo.findOne({ where: { priority: ticket.priority } });
            if (slaConfig) {
                const createdAt = new Date(ticket.createdAt);
                const pausedMinutes = ticket.totalPausedMinutes || 0;
                slaTarget = this.slaClock
                    ? await this.slaClock.targetFor(ticket.priority, createdAt, slaConfig.resolutionTimeMinutes)
                    : new Date(createdAt.getTime() + (slaConfig.resolutionTimeMinutes + pausedMinutes) * 60000);
            }
        }

        return { ...ticket, slaTarget, viewerAccess };
    }

    async getDashboardStats(
        userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        excludeCategory?: string,
        days: number = 7,
    ) {
        // Cache stats for 15 seconds to balance real-time accuracy and DB load.
        // The site scope belongs in the key: without it one site would be served
        // another site's cached numbers.
        const cacheKey = `dashboard:stats:${role}:${siteScopeKey(role, userSiteId)}:${excludeCategory || 'none'}:${days}`;
        return this.cacheService.getOrSet(cacheKey, async () => {
            return this.computeDashboardStats(role, userSiteId, excludeCategory, days);
        }, 15);
    }

    private async computeDashboardStats(role: UserRole, userSiteId: string | null, excludeCategory?: string, chartDays: number = 7) {
        // Day/week/month boundaries in WIB (the process runs in UTC, so local Date math would start days at 07:00 WIB).
        const now = new Date();
        const today = wibStartOfToday(now);
        const thisWeekStart = wibStartOfWeek(now);
        const thisMonthStart = wibStartOfMonth(now);
        const lastDaysStart = new Date(today.getTime() - (chartDays - 1) * MS_PER_DAY);

        // Use QueryBuilder for efficient aggregations
        const qb = this.createFilteredTicketQb(role, userSiteId, excludeCategory);

        // 1. Status counts - single query with CASE statements
        const statusCounts = await qb
            .select('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN ticket.status = 'TODO' THEN 1 ELSE 0 END)`, 'open')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .addSelect(`SUM(CASE WHEN ticket.status = 'WAITING_VENDOR' THEN 1 ELSE 0 END)`, 'waitingVendor')
            .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
            // WAITING_VENDOR pauses the SLA clock (as in SlaCheckerService), so it is never overdue here.
            .addSelect(`SUM(CASE WHEN ticket.status NOT IN (${TICKET_INACTIVE_STATUSES_SQL}) AND ticket.status <> 'WAITING_VENDOR' AND ticket."slaTarget" IS NOT NULL AND ticket."slaTarget" < NOW() THEN 1 ELSE 0 END)`, 'overdue')
            .getRawOne();

        const total = parseInt(statusCounts.total) || 0;
        const open = parseInt(statusCounts.open) || 0;
        const inProgress = parseInt(statusCounts.inProgress) || 0;
        const waitingVendor = parseInt(statusCounts.waitingVendor) || 0;
        const resolved = parseInt(statusCounts.resolved) || 0;
        const overdue = parseInt(statusCounts.overdue) || 0;
        const slaCompliance = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

        // 2. Priority counts - single query
        const priorityQb = this.createFilteredTicketQb(role, userSiteId, excludeCategory);

        const priorityCounts = await priorityQb
            .select('ticket.priority', 'priority')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.priority')
            .getRawMany();

        const byPriority = {
            CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0,
        };
        priorityCounts.forEach(p => {
            if (p.priority in byPriority) {
                byPriority[p.priority as keyof typeof byPriority] = parseInt(p.count) || 0;
            }
        });

        // 3. Category counts - single query
        const categoryQb = this.createFilteredTicketQb(role, userSiteId, excludeCategory);

        const categoryCounts = await categoryQb
            .select(`COALESCE(ticket.category, 'GENERAL')`, 'category')
            .addSelect('COUNT(*)', 'count')
            .groupBy('ticket.category')
            .getRawMany();

        const byCategory: Record<string, number> = {};
        categoryCounts.forEach(c => {
            byCategory[c.category || 'GENERAL'] = parseInt(c.count) || 0;
        });

        // 4. Time-based counts - single query
        const timeCounts = await this.createFilteredTicketQb(role, userSiteId, excludeCategory)
            .select(`SUM(CASE WHEN ticket."createdAt" >= :today THEN 1 ELSE 0 END)`, 'todayTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisWeek THEN 1 ELSE 0 END)`, 'thisWeekTickets')
            .addSelect(`SUM(CASE WHEN ticket."createdAt" >= :thisMonth THEN 1 ELSE 0 END)`, 'thisMonthTickets')
            .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) AND ${RESOLVED_AT_SQL} >= :today THEN 1 ELSE 0 END)`, 'resolvedToday')
            .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) AND ${RESOLVED_AT_SQL} >= :thisWeek THEN 1 ELSE 0 END)`, 'resolvedThisWeek')
            .setParameters({ today, thisWeek: thisWeekStart, thisMonth: thisMonthStart })
            .getRawOne();

        const todayTickets = parseInt(timeCounts.todayTickets) || 0;
        const thisWeekTickets = parseInt(timeCounts.thisWeekTickets) || 0;
        const thisMonthTickets = parseInt(timeCounts.thisMonthTickets) || 0;
        const resolvedToday = parseInt(timeCounts.resolvedToday) || 0;
        const resolvedThisWeek = parseInt(timeCounts.resolvedThisWeek) || 0;

        // 5. Last N days - single query with date grouping
        const dailyStats = await this.createFilteredTicketQb(role, userSiteId, excludeCategory)
            .select(`to_char(${CREATED_WIB_DATE}, 'YYYY-MM-DD')`, 'date')
            .addSelect('COUNT(*)', 'created')
            .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
            .andWhere(`ticket."createdAt" >= :start`, { start: lastDaysStart })
            .groupBy(CREATED_WIB_DATE)
            .orderBy(CREATED_WIB_DATE, 'ASC')
            .getRawMany();

        // Build last N days array
        const dailyActivityData: { date: string; created: number; resolved: number }[] = [];
        const dailyMap = new Map(dailyStats.map(d => [
            d.date as string,
            { created: parseInt(d.created) || 0, resolved: parseInt(d.resolved) || 0 }
        ]));

        for (let i = (chartDays - 1); i >= 0; i--) {
            // Noon WIB of that day: safe to format in any zone without slipping a day.
            const date = new Date(today.getTime() - i * MS_PER_DAY + MS_PER_DAY / 2);
            const stats = dailyMap.get(localDateKey(date)) || { created: 0, resolved: 0 };
            
            // For longer ranges, format date as 'D MMM' instead of weekday
            const formatStr = chartDays > 7 
                ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: DEFAULT_TIMEZONE }) 
                : date.toLocaleDateString('en-US', { weekday: 'short', timeZone: DEFAULT_TIMEZONE });
                
            dailyActivityData.push({
                date: formatStr,
                created: stats.created,
                resolved: stats.resolved,
            });
        }

        // 6. Recent tickets - limited query with joins
        const recentTickets = await this.createFilteredTicketQb(role, userSiteId, excludeCategory)
            .leftJoin('ticket.user', 'user')
            .leftJoin('ticket.assignedTo', 'assignedTo')
            .select([
                'ticket.id', 'ticket.ticketNumber', 'ticket.title',
                'ticket.status', 'ticket.priority', 'ticket.category', 'ticket.updatedAt',
                'user.fullName', 'assignedTo.fullName'
            ])
            .orderBy('ticket.updatedAt', 'DESC')
            .take(5)
            .getMany();

        const formattedRecentTickets = recentTickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            category: t.category,
            updatedAt: t.updatedAt,
            user: t.user ? { fullName: t.user.fullName } : null,
            assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
        }));

        // 7. Top agents - SQL aggregation
        const agentStats = await this.createFilteredTicketQb(role, userSiteId, excludeCategory)
            .innerJoin('ticket.assignedTo', 'agent')
            .select('agent.id', 'agentId')
            .addSelect('agent.fullName', 'name')
            .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
            .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
            .groupBy('agent.id')
            .addGroupBy('agent.fullName')
            .orderBy('resolved', 'DESC')
            .limit(5)
            .getRawMany();

        const topAgents = agentStats.map(a => ({
            name: a.name,
            resolved: parseInt(a.resolved) || 0,
            inProgress: parseInt(a.inProgress) || 0,
        }));

        // 8. Average resolution time - SQL calculation
        const avgTimeResult = await this.createFilteredTicketQb(role, userSiteId, excludeCategory)
            .select(`AVG(EXTRACT(EPOCH FROM (${RESOLVED_AT_SQL} - ticket."createdAt")) / 60)`, 'avgMinutes')
            .andWhere(`ticket.status IN (${TICKET_DONE_STATUSES_SQL})`)
            .getRawOne();

        const avgResolutionMinutes = Math.round(parseFloat(avgTimeResult?.avgMinutes) || 0);
        const avgHours = Math.floor(avgResolutionMinutes / 60);
        const avgMins = avgResolutionMinutes % 60;
        const avgResolutionTime = avgHours > 0 ? `${avgHours}h ${avgMins}m` : `${avgMins}m`;

        return {
            total,
            open,
            inProgress,
            waitingVendor,
            resolved,
            overdue,
            critical: byPriority.CRITICAL,
            slaCompliance,
            byPriority,
            byCategory,
            todayTickets,
            thisWeekTickets,
            thisMonthTickets,
            resolvedToday,
            resolvedThisWeek,
            dailyActivity: dailyActivityData,
            recentTickets: formattedRecentTickets,
            topAgents,
            avgResolutionTime,
        };
    }

    /**
     * Generic paginated query based on dynamic TicketModule configuration
     */
    async findAllPaginatedByModule(
        slug: string,
        userId: string,
        role: UserRole,
        userSiteId: string | null = null,
        options: {
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'ASC' | 'DESC';
            status?: string;
            priority?: string;
            category?: string;
            search?: string;
            assignedToId?: string;
            siteId?: string;
            siteIds?: string[];
            ticketType?: string;
            startDate?: string;
            endDate?: string;
        } = {}
    ) {
        if (!this.moduleRepo) {
            throw new NotFoundException(`Ticket module repository is not available`);
        }
        const module = await this.moduleRepo.findOne({ where: { slug } });
        if (!module) {
            throw new NotFoundException(`Ticket module with slug "${slug}" not found`);
        }

        // Role authorization check
        if (role !== UserRole.ADMIN && module.allowedRoles && module.allowedRoles.length > 0) {
            if (!module.allowedRoles.includes(role)) {
                throw new NotFoundException(`You do not have permission to access the ${module.name} queue`);
            }
        }

        const {
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            status,
            priority,
            category,
            search,
            assignedToId,
            siteId,
            siteIds,
            ticketType,
            startDate,
            endDate,
        } = options;

        const qb = this.ticketRepo
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .leftJoinAndSelect('user.department', 'department')
            .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
            .leftJoinAndSelect('ticket.site', 'site');

        // Apply module criteria
        if (module.handlingTeams && module.handlingTeams.length > 0) {
            qb.andWhere('ticket.handlingTeam IN (:...teams)', { teams: module.handlingTeams });
        }
        if (module.ticketTypes && module.ticketTypes.length > 0) {
            qb.andWhere('ticket.ticketType IN (:...types)', { types: module.ticketTypes });
        }
        if (module.categories && module.categories.length > 0) {
            qb.andWhere('ticket.category IN (:...cats)', { cats: module.categories });
        }

        // Cross-site filter if applicable
        applySiteFilter(qb, role, userSiteId, { siteId, siteIds });
        applyServiceScopeFilter(qb, role);

        if (status) qb.andWhere('ticket.status = :status', { status });
        if (priority) qb.andWhere('ticket.priority = :priority', { priority });
        if (category) qb.andWhere('ticket.category = :category', { category });
        if (ticketType) qb.andWhere('ticket.ticketType = :ticketType', { ticketType });
        if (assignedToId) {
            if (assignedToId === 'unassigned') {
                qb.andWhere('ticket.assignedToId IS NULL');
            } else {
                qb.andWhere('ticket.assignedToId = :assignedToId', { assignedToId });
            }
        }

        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.includes('-') || /^[A-Z0-9#-]+$/i.test(searchTerm)) {
                qb.andWhere('ticket.ticketNumber ILIKE :exactSearch', { exactSearch: `%${searchTerm}%` });
            } else {
                const formattedQuery = toPrefixTsQuery(searchTerm);
                qb.andWhere(
                    `(to_tsvector('simple', COALESCE(ticket.title, '') || ' ' || COALESCE(ticket.description, '')) @@ to_tsquery('simple', :ftsQuery) OR ticket.ticketNumber ILIKE :fuzzySearch OR user.fullName ILIKE :fuzzySearch)`,
                    { ftsQuery: formattedQuery, fuzzySearch: `%${searchTerm}%` }
                );
            }
        }

        if (startDate && endDate) {
            qb.andWhere('ticket.createdAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
        }

        const validSortColumns: Record<string, string> = {
            createdAt: 'ticket.createdAt',
            updatedAt: 'ticket.updatedAt',
            priority: 'ticket.priority',
            status: 'ticket.status',
            ticketNumber: 'ticket.ticketNumber',
            targetDate: 'ticket.targetDate',
        };
        const sortColumn = validSortColumns[sortBy] || 'ticket.createdAt';
        qb.orderBy(sortColumn, sortOrder);

        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const [tickets, total] = await qb.getManyAndCount();

        // Calculate queue stats for this module
        const statsQb = this.ticketRepo.createQueryBuilder('ticket');
        if (module.handlingTeams && module.handlingTeams.length > 0) {
            statsQb.andWhere('ticket.handlingTeam IN (:...teams)', { teams: module.handlingTeams });
        }
        if (module.ticketTypes && module.ticketTypes.length > 0) {
            statsQb.andWhere('ticket.ticketType IN (:...types)', { types: module.ticketTypes });
        }
        if (module.categories && module.categories.length > 0) {
            statsQb.andWhere('ticket.category IN (:...cats)', { cats: module.categories });
        }
        applySiteFilter(statsQb, role, userSiteId, { siteId, siteIds });
        applyServiceScopeFilter(statsQb, role); // same scope as the list, or the counts do not match it

        const [totalCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
            statsQb.clone().getCount(),
            statsQb.clone().andWhere('ticket.status = :s', { s: TicketStatus.TODO }).getCount(),
            statsQb.clone().andWhere('ticket.status = :s', { s: TicketStatus.IN_PROGRESS }).getCount(),
            statsQb.clone().andWhere('ticket.status IN (:...s)', { s: TICKET_DONE_STATUSES }).getCount(),
        ]);

        return {
            data: tickets.map(t => ({
                ...t,
                hasUnreadChat: computeHasUnreadChat(t, role),
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total,
            },
            stats: {
                total: totalCount,
                open: openCount,
                inProgress: inProgressCount,
                resolved: resolvedCount,
            },
            module: {
                id: module.id,
                name: module.name,
                slug: module.slug,
                description: module.description,
                icon: module.icon,
                color: module.color,
                allowedRoles: module.allowedRoles,
            },
        };
    }
}

export function computeHasUnreadChat(ticket: Ticket, userRole: UserRole): boolean {
    if (!ticket.lastMessageAt || !ticket.lastMessageSenderRole) {
        return false;
    }
    const isAgentSide = userRole !== UserRole.USER;
    if (isAgentSide) {
        if (ticket.lastMessageSenderRole !== 'USER') return false;
        if (!ticket.agentLastReadAt) return true;
        return new Date(ticket.lastMessageAt) > new Date(ticket.agentLastReadAt);
    } else {
        if (ticket.lastMessageSenderRole === 'USER') return false;
        if (!ticket.userLastReadAt) return true;
        return new Date(ticket.lastMessageAt) > new Date(ticket.userLastReadAt);
    }
}
