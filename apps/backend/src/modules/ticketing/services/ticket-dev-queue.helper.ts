import { BadRequestException } from '@nestjs/common';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { Ticket, TicketType, HandlingTeam, TicketStatus } from '../entities/ticket.entity';
import { UserRole } from '../../users/enums/user-role.enum';
import { canAccessTicketObject, isTicketRequesterSide } from '../utils/oracle-ticket-access.util';
import { applySiteFilter, canAccessTicketSite } from '../utils/site-access.util';
import { applyServiceScopeFilter } from '../../../shared/core/utils/service-scope.util';
import { TICKET_ACTIVE_STATUSES_SQL, TICKET_DONE_STATUSES_SQL, TICKET_INACTIVE_STATUSES_SQL } from '../utils/ticket-status-sql.util';
import { addSlaMinutes, isBusinessHoursOnly, SlaSnapshot } from './sla-clock.service';
import { applyTeamFilter, type ReportTeam } from '../../reports/utils/report-team-scope.util';
import { findNonSlaTicketIds, isNonSlaTicketType, isSlaTicketSql, stripSlaFields } from '../utils/non-sla-ticket.util';

export const AGENT_ROLES_NON_ORACLE = [UserRole.AGENT_OPERATIONAL_SUPPORT, UserRole.AGENT, UserRole.AGENT_ADMIN] as const;
export const ORACLE_FILTER_PARAMS = { oracleTeam: 'ORACLE_DEV' } as const;
const DEV_QUEUE_ROLES: readonly UserRole[] = [UserRole.AGENT_ORACLE, UserRole.AGENT_WEB_DEV, UserRole.AGENT_MOBILE_DEV, UserRole.ADMIN];
const DEV_QUEUES = ['oracle', 'web-dev', 'mobile-dev'];

export type DevQueue = 'oracle' | 'web-dev' | 'mobile-dev';
/** `all`: every ICT team at once (IT Support + developer queues) — the manager's Ticket Overview. */
export type QueueKey = 'it-support' | 'all' | DevQueue;
export const QUEUE_KEYS: readonly QueueKey[] = ['it-support', 'all', 'oracle', 'web-dev', 'mobile-dev'];
const ALL_TEAMS_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];

export function canSpanAllTeams(role: UserRole): boolean {
    return ALL_TEAMS_ROLES.includes(role);
}

/** Team filter (one team, or ALL_DEV for every developer team): the same rule the reports use. */
export type RequestKindFilter = 'IT' | 'HARDWARE' | 'EFORM';
export const FLOW_EXISTS = 'EXISTS (SELECT 1 FROM request_flows rf WHERE rf."ticketId" = ticket.id)';

/** The persisted flow is authoritative, including for legacy ticket types. */
export function applyRequestKindFilter(qb: SelectQueryBuilder<Ticket>, kind?: RequestKindFilter): void {
    if (kind === 'HARDWARE' || kind === 'EFORM') {
        qb.andWhere('EXISTS (SELECT 1 FROM request_flows rf WHERE rf."ticketId" = ticket.id AND rf.kind = :requestKind)', { requestKind: kind });
    } else if (kind === 'IT') {
        qb.andWhere(`NOT ${FLOW_EXISTS}`);
    }
}

export function applyHandlingTeamFilter(qb: SelectQueryBuilder<Ticket>, team?: ReportTeam): void {
    applyTeamFilter(qb, 'ticket', team);
}

export const DEV_TICKET_TYPES = [TicketType.ORACLE_REQUEST, TicketType.WEB_DEV_REQUEST, TicketType.MOBILE_DEV_REQUEST];
/** Request Center tickets live on their own pages, never in the IT Support queue. */
export const REQUEST_CENTER_CATEGORIES = ['ICT_BUDGET', 'LOST_ITEM', 'ACCESS_REQUEST'];

type SqlPredicate = { sql: string; params: Record<string, unknown> };
/** Which tickets belong to each developer queue: owning team, then ticket type/category. */
export const DEV_QUEUE_FILTERS: Record<DevQueue, { team: SqlPredicate; type: SqlPredicate }> = {
    oracle: {
        team: { sql: '(ticket."handlingTeam" = :oracleTeam)', params: ORACLE_FILTER_PARAMS },
        type: {
            sql: '(ticket.ticketType = :oracleType OR ticket.category = :oracleCategory OR (ticket.category ILIKE :oracleLike AND (ticket.ticketType IS NULL OR ticket.ticketType NOT IN (:...otherDevTypes))))',
            params: { oracleType: 'ORACLE_REQUEST', oracleCategory: 'ORACLE_REQUEST', oracleLike: '%oracle%', otherDevTypes: ['WEB_DEV_REQUEST', 'MOBILE_DEV_REQUEST'] },
        },
    },
    'web-dev': {
        team: { sql: '(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', params: { ...ORACLE_FILTER_PARAMS, webTeam: 'WEB_DEV' } },
        type: {
            sql: '(ticket.ticketType = :webDevType OR ticket.category = :webDevCategory OR ticket.category ILIKE :webDevLike)',
            params: { webDevType: 'WEB_DEV_REQUEST', webDevCategory: 'WEB_DEV_REQUEST', webDevLike: '%web%' },
        },
    },
    'mobile-dev': {
        team: { sql: '(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :mobileTeam)', params: { ...ORACLE_FILTER_PARAMS, mobileTeam: 'MOBILE_DEV' } },
        type: {
            sql: '(ticket.ticketType = :mobileDevType OR ticket.category = :mobileDevCategory OR ticket.category ILIKE :mobileDevLike)',
            params: { mobileDevType: 'MOBILE_DEV_REQUEST', mobileDevCategory: 'MOBILE_DEV_REQUEST', mobileDevLike: '%mobile%' },
        },
    },
};

export interface DevQueueOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    status?: string;
    overdue?: boolean;
    priority?: string;
    search?: string;
    siteId?: string;
    siteIds?: string[];
    startDate?: string;
    endDate?: string;
    createdByMe?: boolean;
    assignedToMe?: boolean;
    handlingTeam?: ReportTeam;
    requestKind?: RequestKindFilter;
}

export type DevQueuePage = {
    data: Ticket[];
    meta: { total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean };
};

export interface QueueStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    overdue: number;
    critical: number;
    /** Every ticket in the queue per priority, any status (dashboard priority donut). */
    byPriority: Record<QueuePriority, number>;
}

const QUEUE_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
type QueuePriority = (typeof QUEUE_PRIORITIES)[number];

/** Comma-separated TicketStatus list (e.g. `RESOLVED,CLOSED`); anything else is a 400. */
export function applyStatusFilter(qb: SelectQueryBuilder<Ticket>, status?: string): void {
    if (!status) return;
    const statuses = status.split(',').map((value) => value.trim()).filter(Boolean);
    if (!statuses.length || statuses.some((value) => !Object.values(TicketStatus).includes(value as TicketStatus))) {
        throw new BadRequestException('Invalid ticket status');
    }
    qb.andWhere('ticket.status IN (:...statuses)', { statuses });
}

/** A dev queue asked for by any other role is ignored, so the caller gets their normal role-scoped list. */
export function effectiveQueue(queue: string | undefined, role: UserRole): string | undefined {
    if (queue && DEV_QUEUES.includes(queue) && !DEV_QUEUE_ROLES.includes(role)) return undefined;
    return queue;
}

// WAITING_VENDOR pauses the SLA clock, so it is never overdue. Non-SLA (Hardware/E-Form) tickets
// are never overdue regardless of stale columns.
export const OVERDUE_SQL = `ticket.status NOT IN (${TICKET_INACTIVE_STATUSES_SQL}) AND ticket.status <> 'WAITING_VENDOR' AND ticket."slaStartedAt" IS NOT NULL AND ticket."slaTarget" IS NOT NULL AND ticket."slaTarget" < NOW() AND ${isSlaTicketSql('ticket')}`;

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

export function applyOracleFilter(qb: SelectQueryBuilder<Ticket>, role: UserRole): void {
    if (isNonOracleAgent(role)) {
        qb.andWhere('(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)', { opsTeam: HandlingTeam.OPS_SUPPORT });
    } else if (role === UserRole.AGENT_ORACLE) {
        qb.andWhere('(ticket."handlingTeam" = :oracleTeam OR ticket."handlingTeam" = :webTeam)', { oracleTeam: 'ORACLE_DEV', webTeam: 'WEB_DEV' });
    } else if (role === UserRole.AGENT_WEB_DEV) {
        qb.andWhere('(ticket."handlingTeam" = :webTeam OR ticket."handlingTeam" = :oracleTeam)', { webTeam: 'WEB_DEV', oracleTeam: 'ORACLE_DEV' });
    } else if (role === UserRole.AGENT_MOBILE_DEV) {
        qb.andWhere('(ticket."handlingTeam" = :mobileTeam)', { mobileTeam: 'MOBILE_DEV' });
    }
}

const DEFAULT_SLA_MINUTES: Record<string, number> = { CRITICAL: 120, HIGH: 240, MEDIUM: 480, LOW: 1440 };

/**
 * Display target for tickets whose resolution clock has not stored one yet.
 * Hardware & E-Form tickets have no SLA so this always returns null for them.
 */
export function ensureSlaTarget(ticket: Ticket & { requestKind?: unknown; isNonSla?: boolean }, sla?: SlaSnapshot): Date | null {
    if (isNonSlaTicketType(ticket)) return null;
    if (ticket.slaTarget) return ticket.slaTarget;
    if (ticket.priority && ticket.createdAt && (ticket.priority as any) !== 'HARDWARE_INSTALLATION') {
        const config = sla?.configs.get(ticket.priority);
        const mins = config?.resolutionTimeMinutes ?? DEFAULT_SLA_MINUTES[ticket.priority] ?? 480;
        if (sla) return addSlaMinutes(new Date(ticket.createdAt), mins, isBusinessHoursOnly(config), sla.schedule);
        return new Date(new Date(ticket.createdAt).getTime() + mins * 60000);
    }
    return null;
}

export function computeHasUnreadChat(
    ticket: Ticket,
    userRole: UserRole,
    viewer?: { id?: string | null; siteId?: string | null },
): boolean {
    if (!ticket.lastMessageAt || !ticket.lastMessageSenderRole) return false;
    const isRequesterStaff = Boolean(
        viewer?.id &&
        userRole !== UserRole.USER &&
        isTicketRequesterSide(viewer.id, ticket) &&
        !(canAccessTicketObject({ role: userRole }, ticket) && canAccessTicketSite(userRole, viewer.siteId ?? null, ticket.siteId)),
    );
    const isAgentSide = userRole !== UserRole.USER && !isRequesterStaff;
    if (isAgentSide) {
        if (ticket.lastMessageSenderRole !== 'USER') return false;
        if (!ticket.agentLastReadAt) return true;
        return new Date(ticket.lastMessageAt) > new Date(ticket.agentLastReadAt);
    }
    if (ticket.lastMessageSenderRole === 'USER') return false;
    if (!ticket.userLastReadAt) return true;
    return new Date(ticket.lastMessageAt) > new Date(ticket.userLastReadAt);
}

export function applyDevQueueScope(
    qb: SelectQueryBuilder<Ticket>,
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: { siteId?: string; siteIds?: string[]; createdByMe?: boolean; assignedToMe?: boolean },
): void {
    if (options.createdByMe) {
        qb.andWhere('(ticket.userId = :userId OR ticket."createdById" = :filerId)', { userId, filerId: userId });
    } else {
        applySiteFilter(qb, role, userSiteId, { siteId: options.siteId, siteIds: options.siteIds });
        applyServiceScopeFilter(qb, role);
    }
    if (options.assignedToMe) {
        qb.andWhere('ticket.assignedToId = :assigneeId', { assigneeId: userId });
    }
}

export function buildDevQueueQb(
    ticketRepo: Repository<Ticket>,
    queue: DevQueue,
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: DevQueueOptions,
): SelectQueryBuilder<Ticket> {
    const filter = DEV_QUEUE_FILTERS[queue];
    const qb = ticketRepo.createQueryBuilder('ticket')
        .where(filter.team.sql, filter.team.params)
        .andWhere(filter.type.sql, filter.type.params);
    applyDevQueueScope(qb, userId, role, userSiteId, options);
    return qb;
}

export function buildAllTeamsQueueQb(
    ticketRepo: Repository<Ticket>,
    role: UserRole,
    userSiteId: string | null,
    options: DevQueueOptions,
): SelectQueryBuilder<Ticket> {
    const qb = ticketRepo.createQueryBuilder('ticket');
    if (!canSpanAllTeams(role)) {
        qb.andWhere('1 = 0');
        return qb;
    }
    applySiteFilter(qb, role, userSiteId, { siteId: options.siteId, siteIds: options.siteIds });
    applyServiceScopeFilter(qb, role);
    applyHandlingTeamFilter(qb, options.handlingTeam);
    qb.andWhere('ticket.category NOT IN (:...requestCenterCategories)', { requestCenterCategories: REQUEST_CENTER_CATEGORIES });
    return qb;
}

export function buildItSupportQueueQb(
    ticketRepo: Repository<Ticket>,
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: DevQueueOptions,
): SelectQueryBuilder<Ticket> {
    const qb = ticketRepo.createQueryBuilder('ticket');
    if (options.createdByMe) {
        qb.andWhere('(ticket.userId = :userId OR ticket."createdById" = :filerId)', { userId, filerId: userId });
    } else {
        qb.andWhere('(ticket."handlingTeam" = :opsTeam OR ticket."handlingTeam" IS NULL)', { opsTeam: HandlingTeam.OPS_SUPPORT });
        qb.andWhere('(ticket.ticketType NOT IN (:...devTypes) OR ticket.ticketType IS NULL)', { devTypes: DEV_TICKET_TYPES });
        applySiteFilter(qb, role, userSiteId, { siteId: options.siteId, siteIds: options.siteIds });
        applyServiceScopeFilter(qb, role);
    }
    if (options.assignedToMe) {
        qb.andWhere('ticket.assignedToId = :assigneeId', { assigneeId: userId });
    }
    qb.andWhere('ticket.category NOT IN (:...requestCenterCategories)', { requestCenterCategories: REQUEST_CENTER_CATEGORIES });
    return qb;
}

export async function queryQueueStats(
    ticketRepo: Repository<Ticket>,
    queue: QueueKey,
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: DevQueueOptions = {},
): Promise<QueueStats> {
    const qb = queue === 'it-support'
        ? buildItSupportQueueQb(ticketRepo, userId, role, userSiteId, options)
        : queue === 'all'
            ? buildAllTeamsQueueQb(ticketRepo, role, userSiteId, options)
            : buildDevQueueQb(ticketRepo, queue, userId, role, userSiteId, options);

    applyRequestKindFilter(qb, options.requestKind);

    const raw = qb
        .select('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN ticket.status = 'TODO' THEN 1 ELSE 0 END)`, 'open')
        .addSelect(`SUM(CASE WHEN ticket.status = 'IN_PROGRESS' THEN 1 ELSE 0 END)`, 'inProgress')
        .addSelect(`SUM(CASE WHEN ticket.status = 'WAITING_VENDOR' THEN 1 ELSE 0 END)`, 'waitingVendor')
        .addSelect(`SUM(CASE WHEN ticket.status IN (${TICKET_DONE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'resolved')
        .addSelect(`SUM(CASE WHEN ${OVERDUE_SQL} THEN 1 ELSE 0 END)`, 'overdue')
        .addSelect(`SUM(CASE WHEN ticket.priority = 'CRITICAL' AND ticket.status IN (${TICKET_ACTIVE_STATUSES_SQL}) THEN 1 ELSE 0 END)`, 'critical');
    QUEUE_PRIORITIES.forEach((priority) => {
        raw.addSelect(`SUM(CASE WHEN ticket.priority = '${priority}' THEN 1 ELSE 0 END)`, `priority_${priority}`);
    });
    const row = await raw.getRawOne();

    const count = (key: string) => parseInt(row?.[key]) || 0;
    return {
        total: count('total'),
        open: count('open'),
        inProgress: count('inProgress'),
        waitingVendor: count('waitingVendor'),
        resolved: count('resolved'),
        overdue: count('overdue'),
        critical: count('critical'),
        byPriority: Object.fromEntries(QUEUE_PRIORITIES.map((priority) => [priority, count(`priority_${priority}`)])) as Record<QueuePriority, number>,
    };
}

export async function queryDevQueuePage(
    ticketRepo: Repository<Ticket>,
    slaSnapshotFor: (tickets: Array<Ticket & { isNonSla?: boolean }>) => Promise<SlaSnapshot | undefined>,
    queue: DevQueue,
    userId: string,
    role: UserRole,
    userSiteId: string | null,
    options: DevQueueOptions,
): Promise<DevQueuePage> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC', status, overdue, priority, search, startDate, endDate } = options;

    const qb = buildDevQueueQb(ticketRepo, queue, userId, role, userSiteId, options)
        .leftJoinAndSelect('ticket.user', 'user')
        .leftJoinAndSelect('user.department', 'department')
        .leftJoinAndSelect('ticket.assignedTo', 'assignedTo')
        .leftJoinAndSelect('ticket.site', 'site')
        .leftJoinAndSelect('ticket.forwardedFromSite', 'forwardedFromSite');

    applyStatusFilter(qb, status);
    if (overdue) qb.andWhere(OVERDUE_SQL);
    if (priority) qb.andWhere('ticket.priority = :priority', { priority });
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
    if (startDate) qb.andWhere('ticket.createdAt >= :startDate', { startDate });
    if (endDate) qb.andWhere('ticket.createdAt <= :endDate', { endDate });

    const validSortFields = ['createdAt', 'updatedAt', 'status', 'priority', 'title'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(`ticket.${safeSortBy}`, safeSortOrder)
        .skip((page - 1) * limit)
        .take(limit);

    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    const nonSlaIds = await findNonSlaTicketIds(ticketRepo.manager, data);
    const tagged = data.map((ticket) => ({ ...ticket, isNonSla: nonSlaIds.has(ticket.id) }));
    const sla = await slaSnapshotFor(tagged);
    const enrichedTickets = tagged.map((ticket) => ({
        ...(ticket.isNonSla ? stripSlaFields(ticket) : ticket),
        slaTarget: ticket.isNonSla ? null : ensureSlaTarget(ticket, sla),
        hasUnreadChat: computeHasUnreadChat(ticket, role, { id: userId, siteId: userSiteId }),
    }));

    return {
        data: enrichedTickets as any,
        meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
}
