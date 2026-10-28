import type { Ticket } from '@/types/ticket.types';
import { localIsoDate } from '../components/dashboardChart';

export const TEAM_RANGES = [7, 14, 30] as const;
export type TeamRange = (typeof TEAM_RANGES)[number];

const TOP_AGENT_LIMIT = 5;
const RECENT_LIMIT = 10;
const DAYS_PER_WEEK = 7;
const PERCENT = 100;
const ONE_DECIMAL = 10;

/** CLOSED is a RESOLVED ticket the requester confirmed (or that auto-closed); both count as done. */
export const isDoneStatus = (status: string): boolean => status === 'RESOLVED' || status === 'CLOSED';

/** Statuses whose SLA clock is running. WAITING_VENDOR pauses it, so it cannot be overdue. */
const SLA_RUNNING_STATUSES = new Set(['TODO', 'IN_PROGRESS']);

/**
 * Overdue now: a ticket still being worked on whose SLA target has passed. Same rule as the
 * ticket list's overdue filter; the stored isOverdue flag is not used because it lags and is
 * not cleared when a ticket finishes or waits on a vendor.
 */
export function isTicketOverdue(t: Pick<Ticket, 'status' | 'slaTarget'>, now: Date = new Date()): boolean {
    return SLA_RUNNING_STATUSES.has(t.status) && !!t.slaTarget && new Date(t.slaTarget).getTime() < now.getTime();
}

/**
 * Share of tickets finished in the last `range` days that were resolved by their SLA target,
 * to one decimal. Null when none of them had a target to measure against.
 */
function slaCompliance(tickets: readonly Ticket[], from: Date): number | null {
    const measured = tickets.filter((t) => isDoneStatus(t.status) && t.slaTarget && t.resolvedAt && new Date(t.resolvedAt) >= from);
    if (measured.length === 0) return null;
    const onTime = measured.filter((t) => new Date(t.resolvedAt!).getTime() <= new Date(t.slaTarget!).getTime()).length;
    return Math.round((onTime / measured.length) * PERCENT * ONE_DECIMAL) / ONE_DECIMAL;
}

export interface TeamAgentStat { id: string; name: string; resolved: number; inProgress: number }
export interface TeamDay { date: string; created: number; resolved: number }

export interface TeamStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    overdue: number;
    byPriority: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    byCategory: { category: string; count: number }[];
    todayTickets: number;
    thisWeekTickets: number;
    resolvedToday: number;
    resolvedThisWeek: number;
    days: TeamDay[];
    topAgents: TeamAgentStat[];
    recentTickets: Ticket[];
    /** Done-in-range tickets resolved by their SLA target, in percent; null when none had a target. */
    slaCompliance: number | null;
    /**
     * Percent change of this week so far (Sunday 00:00 → now) vs the same elapsed span of last week
     * (last Sunday 00:00 → now − 7 days), so a Monday morning is not compared with a full week.
     * Null when that span of last week had nothing to compare with.
     */
    weekChange: { created: number | null; resolved: number | null };
}

/** Rounded percent change, null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * PERCENT);
}

const countIn = (tickets: readonly Ticket[], from: Date, to: Date | null, field: 'createdAt' | 'updatedAt', done: boolean) =>
    tickets.filter((t) => {
        if (done && !isDoneStatus(t.status)) return false;
        const d = new Date(t[field]);
        return d >= from && (to === null || d < to);
    }).length;

function topAgents(tickets: readonly Ticket[]): TeamAgentStat[] {
    const byAgent = new Map<string, TeamAgentStat>();
    for (const t of tickets) {
        if (!t.assignedTo) continue;
        const cur = byAgent.get(t.assignedTo.id) ?? { id: t.assignedTo.id, name: t.assignedTo.fullName, resolved: 0, inProgress: 0 };
        byAgent.set(t.assignedTo.id, {
            ...cur,
            resolved: cur.resolved + (isDoneStatus(t.status) ? 1 : 0),
            inProgress: cur.inProgress + (t.status === 'IN_PROGRESS' ? 1 : 0),
        });
    }
    return [...byAgent.values()].sort((a, b) => b.resolved - a.resolved).slice(0, TOP_AGENT_LIMIT);
}

function dailySeries(tickets: readonly Ticket[], today: Date, range: number): TeamDay[] {
    return Array.from({ length: range }, (_, idx) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (range - 1 - idx));
        const next = new Date(date);
        next.setDate(date.getDate() + 1);
        return {
            date: localIsoDate(date),
            created: countIn(tickets, date, next, 'createdAt', false),
            resolved: countIn(tickets, date, next, 'updatedAt', true),
        };
    });
}

/** Team dashboard numbers from the ticket list (same rules the page used before round 2). */
export function computeTeamStats(tickets: readonly Ticket[], range: number, now: Date = new Date()): TeamStats {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(weekStart.getDate() - DAYS_PER_WEEK);
    // Same moment one week ago (calendar days, so DST-free local clocks line up).
    const lastWeekSameMoment = new Date(now);
    lastWeekSameMoment.setDate(now.getDate() - DAYS_PER_WEEK);

    const byStatus = (s: string) => tickets.filter((t) => t.status === s).length;
    const byPriority = (p: string) => tickets.filter((t) => t.priority === p).length;
    const categories = new Map<string, number>();
    for (const t of tickets) {
        const cat = t.category || 'GENERAL';
        categories.set(cat, (categories.get(cat) ?? 0) + 1);
    }
    const total = tickets.length;
    const overdue = tickets.filter((t) => isTicketOverdue(t, now)).length;
    const rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - (range - 1));
    const thisWeekTickets = countIn(tickets, weekStart, null, 'createdAt', false);
    const resolvedThisWeek = countIn(tickets, weekStart, null, 'updatedAt', true);

    return {
        total,
        open: byStatus('TODO'),
        inProgress: byStatus('IN_PROGRESS'),
        waitingVendor: byStatus('WAITING_VENDOR'),
        resolved: tickets.filter((t) => isDoneStatus(t.status)).length,
        overdue,
        byPriority: { CRITICAL: byPriority('CRITICAL'), HIGH: byPriority('HIGH'), MEDIUM: byPriority('MEDIUM'), LOW: byPriority('LOW') },
        byCategory: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
        todayTickets: countIn(tickets, today, null, 'createdAt', false),
        thisWeekTickets,
        resolvedToday: countIn(tickets, today, null, 'updatedAt', true),
        resolvedThisWeek,
        days: dailySeries(tickets, today, range),
        topAgents: topAgents(tickets),
        recentTickets: [...tickets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, RECENT_LIMIT),
        slaCompliance: slaCompliance(tickets, rangeStart),
        weekChange: {
            created: percentChange(thisWeekTickets, countIn(tickets, lastWeekStart, lastWeekSameMoment, 'createdAt', false)),
            resolved: percentChange(resolvedThisWeek, countIn(tickets, lastWeekStart, lastWeekSameMoment, 'updatedAt', true)),
        },
    };
}

/** Backend avgResolutionTime ("4h 20m", h = hours) in the mockup's Indonesian units ("4j 20m"). */
export const toIndonesianDuration = (value: string | undefined): string => (value ? value.replace(/(\d+)h\b/g, '$1j') : '-');
