import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from '../ticketing/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Site } from '../sites/entities/site.entity';
import { UserRole } from '../users/enums/user-role.enum';
import { DashboardQueryDto } from './dto';

interface SiteStats {
    siteCode: string;
    siteName: string;
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
    slaBreach: number;
}

interface AgentStats {
    agentId: string;
    agentName: string;
    siteCode: string;
    openTickets: number;
    resolvedToday: number;
    avgResolutionHours: number;
}

interface TrendData {
    date: string;
    siteCode: string;
    created: number;
    resolved: number;
}

export interface ManagerDashboardStats {
    totalTickets: number;
    ticketsToday: number;
    openTickets: {
        total: number;
        bySite: Record<string, number>;
    };
    criticalTickets: number;
    slaBreach: number;
    siteStats: SiteStats[];
    topAgents: AgentStats[];
    trend: TrendData[];
    recentCritical: any[];
}

@Injectable()
export class ManagerDashboardService {
    constructor(
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Site)
        private readonly siteRepo: Repository<Site>,
    ) { }

    async getDashboardStats(query: DashboardQueryDto): Promise<ManagerDashboardStats> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sites = query.siteIds?.length
            ? await this.siteRepo.find({ where: { id: In(query.siteIds) } })
            : await this.siteRepo.find({ where: { isActive: true } });

        const siteIds = sites.map(s => s.id);

        // Total tickets
        const totalTickets = await this.ticketRepo.count({
            where: siteIds.length ? { siteId: In(siteIds) } : {},
        });

        // Tickets today
        const ticketsToday = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                createdAt: MoreThanOrEqual(today),
            },
        });

        // Open tickets by site
        const openTicketsBySite: Record<string, number> = {};
        let totalOpen = 0;

        for (const site of sites) {
            const count = await this.ticketRepo.count({
                where: {
                    siteId: site.id,
                    status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                },
            });
            openTicketsBySite[site.code] = count;
            totalOpen += count;
        }

        // Critical tickets
        const criticalTickets = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                priority: TicketPriority.CRITICAL,
                status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
            },
        });

        // SLA breach count
        const now = new Date();
        const slaBreach = await this.ticketRepo.count({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                slaTarget: LessThanOrEqual(now),
            },
        });

        // Site stats
        const siteStats: SiteStats[] = [];
        for (const site of sites) {
            const total = await this.ticketRepo.count({ where: { siteId: site.id } });
            const open = openTicketsBySite[site.code] || 0;
            const resolved = await this.ticketRepo.count({
                where: { siteId: site.id, status: TicketStatus.RESOLVED },
            });
            const critical = await this.ticketRepo.count({
                where: {
                    siteId: site.id,
                    priority: TicketPriority.CRITICAL,
                    status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                },
            });
            const breach = await this.ticketRepo.count({
                where: {
                    siteId: site.id,
                    status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                    slaTarget: LessThanOrEqual(now),
                },
            });

            siteStats.push({
                siteCode: site.code,
                siteName: site.name,
                totalTickets: total,
                openTickets: open,
                resolvedTickets: resolved,
                criticalTickets: critical,
                slaBreach: breach,
            });
        }

        // Top agents (by resolved tickets)
        const topAgents = await this.getTopAgents(siteIds);

        // Trend data (last 7 days)
        const trend = await this.getTrendData(siteIds, 7);

        // Recent critical tickets
        const recentCritical = await this.ticketRepo.find({
            where: {
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
                priority: TicketPriority.CRITICAL,
            },
            relations: ['user', 'site', 'assignedTo'],
            order: { createdAt: 'DESC' },
            take: 10,
        });

        return {
            totalTickets,
            ticketsToday,
            openTickets: {
                total: totalOpen,
                bySite: openTicketsBySite,
            },
            criticalTickets,
            slaBreach,
            siteStats,
            topAgents,
            trend,
            recentCritical: recentCritical.map(t => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                title: t.title,
                status: t.status,
                priority: t.priority,
                createdAt: t.createdAt,
                user: t.user ? { fullName: t.user.fullName } : null,
                site: t.site ? { code: t.site.code } : null,
                assignedTo: t.assignedTo ? { fullName: t.assignedTo.fullName } : null,
            })),
        };
    }

    private async getTopAgents(siteIds: string[]): Promise<AgentStats[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const agents = await this.userRepo.find({
            where: {
                role: UserRole.AGENT,
                isActive: true,
                ...(siteIds.length ? { siteId: In(siteIds) } : {}),
            },
            relations: ['site'],
        });

        const agentStats: AgentStats[] = [];

        for (const agent of agents) {
            const openTickets = await this.ticketRepo.count({
                where: {
                    assignedToId: agent.id,
                    status: In([TicketStatus.TODO, TicketStatus.IN_PROGRESS]),
                },
            });

            const resolvedToday = await this.ticketRepo.count({
                where: {
                    assignedToId: agent.id,
                    status: TicketStatus.RESOLVED,
                    resolvedAt: MoreThanOrEqual(today),
                },
            });

            // Calculate avg resolution time (simplified)
            const resolvedTickets = await this.ticketRepo.find({
                where: {
                    assignedToId: agent.id,
                    status: TicketStatus.RESOLVED,
                },
                take: 20,
                order: { resolvedAt: 'DESC' },
            });

            let avgResolutionHours = 0;
            if (resolvedTickets.length > 0) {
                const totalHours = resolvedTickets.reduce((sum, t) => {
                    if (t.resolvedAt && t.createdAt) {
                        return sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60);
                    }
                    return sum;
                }, 0);
                avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
            }

            agentStats.push({
                agentId: agent.id,
                agentName: agent.fullName,
                siteCode: agent.site?.code || 'N/A',
                openTickets,
                resolvedToday,
                avgResolutionHours,
            });
        }

        // Sort by resolved today (desc)
        return agentStats.sort((a, b) => b.resolvedToday - a.resolvedToday).slice(0, 10);
    }

    private async getTrendData(siteIds: string[], days: number): Promise<TrendData[]> {
        const trend: TrendData[] = [];
        const sites = await this.siteRepo.find({
            where: siteIds.length ? { id: In(siteIds) } : { isActive: true },
        });

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            for (const site of sites) {
                const created = await this.ticketRepo.count({
                    where: {
                        siteId: site.id,
                        createdAt: Between(date, nextDate),
                    },
                });

                const resolved = await this.ticketRepo.count({
                    where: {
                        siteId: site.id,
                        resolvedAt: Between(date, nextDate),
                    },
                });

                trend.push({
                    date: date.toISOString().split('T')[0],
                    siteCode: site.code,
                    created,
                    resolved,
                });
            }
        }

        return trend;
    }
}
