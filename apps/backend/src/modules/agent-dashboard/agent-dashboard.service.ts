import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import { TICKET_INACTIVE_STATUSES, Ticket } from '../ticketing/entities/ticket.entity';
import { AgentRating } from '../ticketing/entities/agent-rating.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { AgentDailyWorkload } from '../workload/entities/agent-daily-workload.entity';
import { workloadDay } from '../workload/workload.service';
import { CacheService } from '../../shared/core/cache';
import { ServiceScope, canHandleScope, scopeOfRole } from '../../shared/core/utils/service-scope.util';
import { localDateKey } from '../sla-config/business-hours.calc';
import {
    AGENT_DASHBOARD_TIMEZONE,
    AgentTicketStats,
    DashboardTicket,
    computeAgentTicketStats,
    dashboardWindows,
    normalizePeriod,
} from './agent-dashboard.calc';

const CACHE_TTL_SECONDS = 30;
const MS_PER_DAY = 86_400_000;
const INSTALL_LOOKAHEAD_DAYS = 2;

/** Agents whose work is the ops queue: workload points and hardware installs apply. */
export const SUPPORT_AGENT_ROLES: readonly UserRole[] = [
    UserRole.AGENT,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT_ADMIN,
];
/** Developer agents: their dashboard adds status/module breakdown and aging. */
export const DEV_AGENT_ROLES: readonly UserRole[] = [
    UserRole.AGENT_ORACLE,
    UserRole.AGENT_WEB_DEV,
    UserRole.AGENT_MOBILE_DEV,
];
const AGENT_ROLES: readonly UserRole[] = [...SUPPORT_AGENT_ROLES, ...DEV_AGENT_ROLES];

export type AgentDashboardKind = 'support' | 'dev';

export interface DashboardActor {
    userId: string;
    role: UserRole | string;
}

export interface InstallItem {
    id: string;
    ticketNumber: string | null;
    title: string;
    scheduledDate: string;
    scheduledTime: string | null;
    day: 'today' | 'tomorrow';
}

export interface AgentDashboard {
    agent: {
        id: string;
        fullName: string;
        role: UserRole;
        avatarUrl: string | null;
        appraisalPoints: number;
        scope: ServiceScope | null;
        site: { code: string; name: string } | null;
    };
    kind: AgentDashboardKind;
    generatedAt: string;
    stats: AgentTicketStats;
    rating: { average: number | null; count: number };
    support: { workloadPointsToday: number; installs: InstallItem[] } | null;
}

export const isAgentRole = (role?: string | null): boolean => AGENT_ROLES.includes(role as UserRole);

/**
 * Who may open an agent's dashboard: the agent themself, ADMIN, or a MANAGER
 * of the same department scope (ICT managers never see HC agents).
 */
export function canViewAgentDashboard(actor: DashboardActor, target: { id: string; role: UserRole | string }): boolean {
    if (!isAgentRole(target.role)) return false;
    if (actor.userId === target.id) return true;
    if (actor.role === UserRole.ADMIN) return true;
    if (actor.role !== UserRole.MANAGER) return false;
    const targetScope = scopeOfRole(target.role);
    return targetScope !== null && canHandleScope(actor.role, targetScope);
}

@Injectable()
export class AgentDashboardService {
    constructor(
        @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User) private readonly userRepo: Repository<User>,
        @InjectRepository(AgentDailyWorkload) private readonly workloadRepo: Repository<AgentDailyWorkload>,
        @InjectRepository(AgentRating) private readonly ratingRepo: Repository<AgentRating>,
        private readonly cacheService: CacheService,
    ) { }

    async getDashboard(actor: DashboardActor, agentId: string, days?: number | string): Promise<AgentDashboard> {
        const agent = await this.userRepo.findOne({ where: { id: agentId }, relations: ['site'] });
        if (!agent) throw new NotFoundException('Agent not found');
        if (!canViewAgentDashboard(actor, agent)) {
            throw new ForbiddenException('Access to this dashboard is forbidden');
        }
        const periodDays = normalizePeriod(days);
        return this.cacheService.getOrSet(
            `agent-dashboard:${agent.id}:${periodDays}`,
            () => this.compute(agent, periodDays),
            CACHE_TTL_SECONDS,
        );
    }

    private async compute(agent: User, periodDays: number): Promise<AgentDashboard> {
        const now = new Date();
        const windows = dashboardWindows(now, periodDays);
        const kind: AgentDashboardKind = DEV_AGENT_ROLES.includes(agent.role) ? 'dev' : 'support';

        const [tickets, rating, support] = await Promise.all([
            this.loadTickets(agent.id, windows.since),
            this.loadRating(agent.id),
            kind === 'support' ? this.loadSupport(agent.id, now, windows.today) : Promise.resolve(null),
        ]);

        return {
            agent: {
                id: agent.id,
                fullName: agent.fullName,
                role: agent.role,
                avatarUrl: agent.avatarUrl ?? null,
                appraisalPoints: agent.appraisalPoints ?? 0,
                scope: scopeOfRole(agent.role),
                site: agent.site ? { code: agent.site.code, name: agent.site.name } : null,
            },
            kind,
            generatedAt: now.toISOString(),
            stats: computeAgentTicketStats(tickets, windows, periodDays),
            rating,
            support,
        };
    }

    /** Assigned tickets that are still open, or were created/resolved inside the widest window. */
    private loadTickets(agentId: string, since: Date): Promise<DashboardTicket[]> {
        return this.ticketRepo
            .createQueryBuilder('ticket')
            .select([
                'ticket.id', 'ticket.ticketNumber', 'ticket.title', 'ticket.status', 'ticket.priority',
                'ticket.category', 'ticket.createdAt', 'ticket.updatedAt', 'ticket.resolvedAt', 'ticket.slaTarget',
            ])
            .where('ticket.assignedToId = :agentId', { agentId })
            .andWhere(
                '(ticket.status NOT IN (:...inactive) OR ticket.createdAt >= :since OR COALESCE(ticket.resolvedAt, ticket.updatedAt) >= :since)',
                { inactive: TICKET_INACTIVE_STATUSES, since },
            )
            .getMany();
    }

    private async loadRating(agentId: string): Promise<AgentDashboard['rating']> {
        const row = await this.ratingRepo
            .createQueryBuilder('r')
            .select('AVG(r.rating)', 'average')
            .addSelect('COUNT(*)', 'count')
            .where('r.agentId = :agentId', { agentId })
            .getRawOne<{ average: string | null; count: string }>();
        const count = Number(row?.count ?? 0);
        return { average: count > 0 ? Math.round(Number(row?.average) * 100) / 100 : null, count };
    }

    private async loadSupport(agentId: string, now: Date, today: Date): Promise<NonNullable<AgentDashboard['support']>> {
        const [workloads, installs] = await Promise.all([
            this.workloadRepo.find({ where: { agentId, workDate: workloadDay(now) } }),
            this.ticketRepo.find({
                select: ['id', 'ticketNumber', 'title', 'scheduledDate', 'scheduledTime'],
                where: {
                    assignedToId: agentId,
                    isHardwareInstallation: true,
                    status: Not(In(TICKET_INACTIVE_STATUSES)),
                    scheduledDate: Between(today, new Date(today.getTime() + INSTALL_LOOKAHEAD_DAYS * MS_PER_DAY - 1)),
                },
                order: { scheduledDate: 'ASC' },
            }),
        ]);
        const todayKey = localDateKey(now, AGENT_DASHBOARD_TIMEZONE);
        return {
            workloadPointsToday: workloads.reduce((sum, w) => sum + (w.totalPoints ?? 0), 0),
            installs: installs.map((t) => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                title: t.title,
                scheduledDate: (t.scheduledDate as Date).toISOString(),
                scheduledTime: t.scheduledTime,
                day: localDateKey(t.scheduledDate as Date, AGENT_DASHBOARD_TIMEZONE) === todayKey ? 'today' : 'tomorrow',
            })),
        };
    }
}
