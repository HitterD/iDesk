import {
    TICKET_DONE_STATUSES,
    TICKET_INACTIVE_STATUSES,
    TicketPriority,
    TicketStatus,
} from '../ticketing/entities/ticket.entity';
import { DEFAULT_TIMEZONE, localDateKey, startOfLocalDay } from '../sla-config/business-hours.calc';

/** Dashboard periods (days) the UI may ask for; anything else falls back to the default. */
export const AGENT_DASHBOARD_PERIODS = [7, 30, 90] as const;
export const DEFAULT_AGENT_DASHBOARD_PERIOD = 30;
export const AGENT_DASHBOARD_TIMEZONE = DEFAULT_TIMEZONE;
/** How many active tickets the "nearest SLA" list shows. */
export const ACTIVE_TICKET_LIST_LIMIT = 10;
const TOP_CATEGORY_LIMIT = 8;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
/** Aging bucket upper bounds in days: <3, 3-7, 7-14, >14. */
const AGING_BOUNDS_DAYS = [3, 7, 14] as const;

export function normalizePeriod(days?: number | string | null): number {
    const n = Number(days);
    return (AGENT_DASHBOARD_PERIODS as readonly number[]).includes(n) ? n : DEFAULT_AGENT_DASHBOARD_PERIOD;
}

/** Minimal ticket shape the dashboard needs (one row per assigned ticket). */
export interface DashboardTicket {
    id: string;
    ticketNumber: string | null;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: string;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    slaTarget: Date | null;
}

export interface ActiveTicketItem {
    id: string;
    ticketNumber: string | null;
    title: string;
    status: TicketStatus;
    priority: TicketPriority;
    slaTarget: string | null;
    isOverdue: boolean;
}

export interface AgentTicketStats {
    periodDays: number;
    active: number;
    todo: number;
    inProgress: number;
    waitingVendor: number;
    overdue: number;
    resolvedToday: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    resolvedInPeriod: number;
    /** % of tickets resolved in the period that met their SLA; null when none had an SLA. */
    slaCompliance: number | null;
    /** Average minutes from creation to resolution in the period; null when nothing resolved. */
    avgResolveMinutes: number | null;
    trend: { date: string; assigned: number; resolved: number }[];
    activeTickets: ActiveTicketItem[];
    byStatus: Record<string, number>;
    byCategory: { category: string; count: number }[];
    aging: { lt3: number; d3to7: number; d7to14: number; gt14: number };
}

/** WIB boundaries the stats are measured against. */
export interface DashboardWindows {
    now: Date;
    today: Date;
    weekStart: Date;
    monthStart: Date;
    periodStart: Date;
    /** Earliest boundary: tickets resolved/created before it never matter. */
    since: Date;
}

export function dashboardWindows(now: Date, periodDays: number, tz = AGENT_DASHBOARD_TIMEZONE): DashboardWindows {
    const today = startOfLocalDay(now, tz);
    const key = localDateKey(now, tz);
    // Weekday of the WIB date (0 = Sunday); weeks start on Monday.
    const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
    const weekStart = new Date(today.getTime() - ((weekday + 6) % 7) * MS_PER_DAY);
    const monthStart = startOfLocalDay(new Date(`${key.slice(0, 8)}01T12:00:00.000Z`), tz);
    const periodStart = new Date(today.getTime() - (periodDays - 1) * MS_PER_DAY);
    const since = new Date(Math.min(weekStart.getTime(), monthStart.getTime(), periodStart.getTime()));
    return { now, today, weekStart, monthStart, periodStart, since };
}

const isDone = (t: DashboardTicket) => TICKET_DONE_STATUSES.includes(t.status);
const isActive = (t: DashboardTicket) => !TICKET_INACTIVE_STATUSES.includes(t.status);
/** Legacy rows resolved before `resolvedAt` existed fall back to their last update. */
const resolvedTime = (t: DashboardTicket): Date | null => (isDone(t) ? t.resolvedAt ?? t.updatedAt : null);
const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

function bySlaThenAge(a: DashboardTicket, b: DashboardTicket): number {
    const sa = a.slaTarget?.getTime() ?? Number.POSITIVE_INFINITY;
    const sb = b.slaTarget?.getTime() ?? Number.POSITIVE_INFINITY;
    return sa - sb || a.createdAt.getTime() - b.createdAt.getTime();
}

function agingBuckets(active: DashboardTicket[], now: Date): AgentTicketStats['aging'] {
    const aging = { lt3: 0, d3to7: 0, d7to14: 0, gt14: 0 };
    const [b3, b7, b14] = AGING_BOUNDS_DAYS;
    for (const t of active) {
        const days = (now.getTime() - t.createdAt.getTime()) / MS_PER_DAY;
        if (days < b3) aging.lt3++;
        else if (days < b7) aging.d3to7++;
        else if (days < b14) aging.d7to14++;
        else aging.gt14++;
    }
    return aging;
}

function dailyTrend(tickets: DashboardTicket[], w: DashboardWindows, periodDays: number, tz: string) {
    const days = Array.from({ length: periodDays }, (_, i) => localDateKey(new Date(w.periodStart.getTime() + i * MS_PER_DAY + MS_PER_DAY / 2), tz));
    const rows = new Map(days.map((date) => [date, { date, assigned: 0, resolved: 0 }]));
    for (const t of tickets) {
        if (t.createdAt >= w.periodStart) {
            const row = rows.get(localDateKey(t.createdAt, tz));
            if (row) row.assigned++;
        }
        const resolved = resolvedTime(t);
        if (resolved && resolved >= w.periodStart) {
            const row = rows.get(localDateKey(resolved, tz));
            if (row) row.resolved++;
        }
    }
    return [...rows.values()];
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) out[keyOf(item)] = (out[keyOf(item)] ?? 0) + 1;
    return out;
}

/** Per-agent ticket stats; `tickets` are the agent's assigned tickets (active or touched since `w.since`). */
export function computeAgentTicketStats(
    tickets: DashboardTicket[],
    w: DashboardWindows,
    periodDays: number,
    tz = AGENT_DASHBOARD_TIMEZONE,
): AgentTicketStats {
    const active = tickets.filter(isActive);
    // WAITING_VENDOR freezes the SLA clock (sla-checker skips it too), so its stale target is not "overdue".
    const overdueOf = (t: DashboardTicket) => t.status !== TicketStatus.WAITING_VENDOR && !!t.slaTarget && t.slaTarget < w.now;
    const resolvedSince = (from: Date) => tickets.filter((t) => (resolvedTime(t) ?? 0) >= from);
    const resolvedInPeriod = resolvedSince(w.periodStart);

    const withSla = resolvedInPeriod.filter((t) => t.slaTarget);
    const metSla = withSla.filter((t) => (resolvedTime(t) as Date) <= (t.slaTarget as Date));
    const totalResolveMs = resolvedInPeriod.reduce((sum, t) => sum + ((resolvedTime(t) as Date).getTime() - t.createdAt.getTime()), 0);

    const byCategory = Object.entries(countBy(active, (t) => t.category || 'GENERAL'))
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_CATEGORY_LIMIT);

    return {
        periodDays,
        active: active.length,
        todo: active.filter((t) => t.status === TicketStatus.TODO).length,
        inProgress: active.filter((t) => t.status === TicketStatus.IN_PROGRESS).length,
        waitingVendor: active.filter((t) => t.status === TicketStatus.WAITING_VENDOR).length,
        overdue: active.filter(overdueOf).length,
        resolvedToday: resolvedSince(w.today).length,
        resolvedThisWeek: resolvedSince(w.weekStart).length,
        resolvedThisMonth: resolvedSince(w.monthStart).length,
        resolvedInPeriod: resolvedInPeriod.length,
        slaCompliance: withSla.length > 0 ? percent(metSla.length, withSla.length) : null,
        avgResolveMinutes: resolvedInPeriod.length > 0 ? Math.round(totalResolveMs / resolvedInPeriod.length / MS_PER_MINUTE) : null,
        trend: dailyTrend(tickets, w, periodDays, tz),
        activeTickets: [...active].sort(bySlaThenAge).slice(0, ACTIVE_TICKET_LIST_LIMIT).map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            slaTarget: t.slaTarget ? t.slaTarget.toISOString() : null,
            isOverdue: overdueOf(t),
        })),
        byStatus: countBy(active, (t) => t.status),
        byCategory,
        aging: agingBuckets(active, w.now),
    };
}
