import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Site } from '../sites/entities/site.entity';
import { BusinessHoursService } from '../sla-config/business-hours.service';
import { BusinessSchedule, DEFAULT_TIMEZONE, localDateKey } from '../sla-config/business-hours.calc';
import { wibStartOfMonth, wibStartOfToday } from '../../shared/core/utils/wib-date.util';
import { TICKET_DONE_STATUSES_SQL } from '../ticketing/utils/ticket-status-sql.util';
import { DEV_HANDLING_TEAMS } from './tv-board.service';

/** Leaderboard hour on working days, WIB: 12:00 up to (not including) 13:00. */
export const LEADERBOARD_START_MINUTE = 12 * 60;
export const LEADERBOARD_END_MINUTE = 13 * 60;
const TOP_AGENTS = 10;
const MS_PER_DAY = 86_400_000;
const LOOKBACK_DAYS = 7;

/** Badge thresholds: too few tickets or ratings say nothing about an agent. */
export const BADGE_MIN_TICKETS = 5;
export const BADGE_MIN_RATINGS = 3;

export type BadgeKey = 'champion' | 'fastest' | 'perfectSla' | 'favorite' | 'responsive' | 'criticalSolver';

export interface LeaderboardAgent {
    agentId: string;
    name: string;
    avatarUrl: string | null;
    resolved: number;
    slaRate: number | null;
    avgResolutionMinutes: number | null;
    avgResponseMinutes: number | null;
    rating: number | null;
    ratingCount: number;
    criticalResolved: number;
    badges: BadgeKey[];
}

export interface AgentOfTheDay {
    agent: LeaderboardAgent;
    /** 'today' while someone already resolved a ticket today, otherwise the last working day before. */
    period: 'today' | 'previous';
    date: string;
}

export interface TvLeaderboardData {
    /** Whether the board should show the leaderboard now (server clock, WIB, working days). */
    active: boolean;
    /** Same calendar day for every TV; picks the day's animation theme. */
    dateKey: string;
    monthLabel: string;
    agentOfTheDay: AgentOfTheDay | null;
    topAgents: LeaderboardAgent[];
}

interface AgentRow {
    agentId: string;
    name: string;
    avatarUrl: string | null;
    resolved: string;
    slaEvaluated: string;
    slaCompliant: string;
    resolutionMinutes: string | null;
    responseMinutes: string | null;
    criticalResolved: string;
}

/** Minutes since local midnight in the schedule's zone. */
function localMinuteOfDay(at: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return get('hour') * 60 + get('minute');
}

function localWeekday(at: Date, timezone: string): number {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(at);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** A working day by the business schedule (work days, minus holidays). */
export function isWorkingDay(at: Date, schedule: BusinessSchedule): boolean {
    const timezone = schedule.timezone || DEFAULT_TIMEZONE;
    if (!schedule.workDays?.length) return true;
    return schedule.workDays.includes(localWeekday(at, timezone)) && !(schedule.holidays ?? []).includes(localDateKey(at, timezone));
}

/** 12:00-13:00 WIB on a working day. */
export function isLeaderboardTime(at: Date, schedule: BusinessSchedule): boolean {
    const minute = localMinuteOfDay(at, schedule.timezone || DEFAULT_TIMEZONE);
    return minute >= LEADERBOARD_START_MINUTE && minute < LEADERBOARD_END_MINUTE && isWorkingDay(at, schedule);
}

/** Badges for the month's agents; each special badge goes to one agent who meets its minimum. */
export function assignBadges(agents: LeaderboardAgent[]): LeaderboardAgent[] {
    const withBadges = agents.map((a) => ({ ...a, badges: [] as BadgeKey[] }));
    const award = (key: BadgeKey, pick: LeaderboardAgent | undefined) => { if (pick) pick.badges.push(key); };
    const best = (eligible: LeaderboardAgent[], better: (a: LeaderboardAgent, b: LeaderboardAgent) => number) =>
        [...eligible].sort(better)[0];
    const enough = withBadges.filter((a) => a.resolved >= BADGE_MIN_TICKETS);

    award('champion', withBadges.find((a) => a.resolved > 0));
    award('fastest', best(enough.filter((a) => a.avgResolutionMinutes != null), (a, b) => a.avgResolutionMinutes! - b.avgResolutionMinutes!));
    for (const a of enough.filter((x) => x.slaRate === 100)) a.badges.push('perfectSla');
    award('favorite', best(withBadges.filter((a) => a.rating != null && a.ratingCount >= BADGE_MIN_RATINGS), (a, b) => b.rating! - a.rating! || b.ratingCount - a.ratingCount));
    award('responsive', best(enough.filter((a) => a.avgResponseMinutes != null), (a, b) => a.avgResponseMinutes! - b.avgResponseMinutes!));
    award('criticalSolver', best(withBadges.filter((a) => a.criticalResolved > 0), (a, b) => b.criticalResolved - a.criticalResolved));
    return withBadges;
}

/** Most resolved first, then better SLA, then name (same order as the reports). */
export function rankLeaderboard(agents: LeaderboardAgent[]): LeaderboardAgent[] {
    return [...agents].sort((a, b) => b.resolved - a.resolved
        || (b.slaRate ?? -1) - (a.slaRate ?? -1)
        || a.name.localeCompare(b.name));
}

const toNumber = (v: string | null | undefined): number | null => (v == null ? null : Math.round(Number(v)));

/**
 * Agent leaderboard for one TV board: the agents who resolved the tickets that board shows (its site's
 * IT Support tickets; a dev hub board also the developer teams' tickets from every site).
 */
@Injectable()
export class TvLeaderboardService {
    constructor(
        @InjectRepository(Site) private readonly siteRepo: Repository<Site>,
        private readonly dataSource: DataSource,
        private readonly businessHours: BusinessHoursService,
    ) { }

    async getLeaderboard(siteId: string, now: Date = new Date()): Promise<TvLeaderboardData> {
        const site = await this.siteRepo.findOne({ where: { id: siteId } });
        if (!site) throw new NotFoundException('Site not found');
        const schedule = await this.businessHours.getSchedule();
        const timezone = schedule.timezone || DEFAULT_TIMEZONE;

        const monthStart = wibStartOfMonth(now);
        const month = await this.agentStats(site, monthStart, now);
        const ratings = await this.ratings(month.map((a) => a.agentId), monthStart, now);
        const monthAgents = assignBadges(rankLeaderboard(month.map((a) => ({ ...a, ...ratings.get(a.agentId) }))));

        return {
            active: isLeaderboardTime(now, schedule),
            dateKey: localDateKey(now, timezone),
            monthLabel: new Intl.DateTimeFormat('id-ID', { timeZone: timezone, month: 'long', year: 'numeric' }).format(now),
            agentOfTheDay: await this.agentOfTheDay(site, now, schedule, monthAgents),
            topAgents: monthAgents.filter((a) => a.resolved > 0).slice(0, TOP_AGENTS),
        };
    }

    /** Today's best so far; before anyone resolved a ticket today, the last working day's best. */
    private async agentOfTheDay(site: Site, now: Date, schedule: BusinessSchedule, monthAgents: LeaderboardAgent[]): Promise<AgentOfTheDay | null> {
        const timezone = schedule.timezone || DEFAULT_TIMEZONE;
        const today = wibStartOfToday(now);
        const withMonthBadges = (agent: LeaderboardAgent) => ({ ...agent, badges: monthAgents.find((m) => m.agentId === agent.agentId)?.badges ?? [] });

        const todays = rankLeaderboard(await this.agentStats(site, today, now)).find((a) => a.resolved > 0);
        if (todays) return { agent: withMonthBadges(todays), period: 'today', date: localDateKey(now, timezone) };

        for (let back = 1; back <= LOOKBACK_DAYS; back++) {
            const dayStart = new Date(today.getTime() - back * MS_PER_DAY);
            if (!isWorkingDay(new Date(dayStart.getTime() + MS_PER_DAY / 2), schedule)) continue;
            const best = rankLeaderboard(await this.agentStats(site, dayStart, new Date(dayStart.getTime() + MS_PER_DAY))).find((a) => a.resolved > 0);
            if (best) return { agent: withMonthBadges(best), period: 'previous', date: localDateKey(dayStart, timezone) };
        }
        return null;
    }

    /** Per-agent totals for tickets resolved in [from, to) on this board. */
    private async agentStats(site: Site, from: Date, to: Date): Promise<LeaderboardAgent[]> {
        const params: unknown[] = [from, to, site.id];
        const devClause = site.tvShowsDevTickets ? ` OR t."handlingTeam" = ANY($4)` : '';
        if (site.tvShowsDevTickets) params.push(DEV_HANDLING_TEAMS);
        const rows: AgentRow[] = await this.dataSource.query(
            `SELECT t."assignedToId" AS "agentId", u."fullName" AS name, u."avatarUrl" AS "avatarUrl",
                    COUNT(*) AS resolved,
                    COUNT(*) FILTER (WHERE t."slaTarget" IS NOT NULL) AS "slaEvaluated",
                    COUNT(*) FILTER (WHERE t."slaTarget" IS NOT NULL AND t."resolvedAt" <= t."slaTarget") AS "slaCompliant",
                    AVG(EXTRACT(EPOCH FROM (t."resolvedAt" - t."createdAt")) / 60) AS "resolutionMinutes",
                    AVG(EXTRACT(EPOCH FROM (t."firstResponseAt" - t."createdAt")) / 60) FILTER (WHERE t."firstResponseAt" >= t."createdAt") AS "responseMinutes",
                    COUNT(*) FILTER (WHERE t.priority IN ('CRITICAL', 'HIGH')) AS "criticalResolved"
             FROM tickets t JOIN users u ON u.id = t."assignedToId"
             WHERE t.status IN (${TICKET_DONE_STATUSES_SQL})
               AND t."resolvedAt" >= $1 AND t."resolvedAt" < $2
               AND ((t."siteId" = $3 AND (t."handlingTeam" = 'OPS_SUPPORT' OR t."handlingTeam" IS NULL))${devClause})
             GROUP BY t."assignedToId", u."fullName", u."avatarUrl"`,
            params,
        );
        return rows.map((r) => {
            const evaluated = Number(r.slaEvaluated) || 0;
            return {
                agentId: r.agentId,
                name: r.name || 'Agent',
                avatarUrl: r.avatarUrl ?? null,
                resolved: Number(r.resolved) || 0,
                slaRate: evaluated ? Math.round((Number(r.slaCompliant) / evaluated) * 100) : null,
                avgResolutionMinutes: toNumber(r.resolutionMinutes),
                avgResponseMinutes: toNumber(r.responseMinutes),
                rating: null,
                ratingCount: 0,
                criticalResolved: Number(r.criticalResolved) || 0,
                badges: [],
            };
        });
    }

    /** Average stars per agent from ratings given in the period. */
    private async ratings(agentIds: string[], from: Date, to: Date): Promise<Map<string, { rating: number; ratingCount: number }>> {
        if (agentIds.length === 0) return new Map();
        const rows: Array<{ agentId: string; average: string; count: string }> = await this.dataSource.query(
            `SELECT r."agentId", AVG(r.rating) AS average, COUNT(*) AS count
             FROM agent_ratings r WHERE r."agentId" = ANY($1) AND r."createdAt" >= $2 AND r."createdAt" < $3
             GROUP BY r."agentId"`,
            [agentIds, from, to],
        );
        return new Map(rows.map((r) => [r.agentId, { rating: Math.round(Number(r.average) * 10) / 10, ratingCount: Number(r.count) || 0 }]));
    }
}
