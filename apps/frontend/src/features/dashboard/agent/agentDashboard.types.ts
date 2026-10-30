import type { ServiceScope } from '@/lib/constants/service-scope';

/** Periods (days) the agent dashboard supports; mirrors the backend. */
export const AGENT_DASHBOARD_PERIODS = [7, 30, 90] as const;
export type AgentDashboardPeriod = (typeof AGENT_DASHBOARD_PERIODS)[number];
export const DEFAULT_AGENT_DASHBOARD_PERIOD: AgentDashboardPeriod = 30;
export const DASHBOARD_TIMEZONE = 'Asia/Jakarta';

export interface ActiveTicketItem {
    id: string;
    ticketNumber: string | null;
    title: string;
    status: string;
    priority: string;
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
    slaCompliance: number | null;
    avgResolveMinutes: number | null;
    trend: { date: string; assigned: number; resolved: number }[];
    activeTickets: ActiveTicketItem[];
    byStatus: Record<string, number>;
    byCategory: { category: string; count: number }[];
    aging: { lt3: number; d3to7: number; d7to14: number; gt14: number };
}

export interface InstallItem {
    id: string;
    ticketNumber: string | null;
    title: string;
    scheduledDate: string;
    scheduledTime: string | null;
    day: 'today' | 'tomorrow';
}

export interface AgentDashboardData {
    agent: {
        id: string;
        fullName: string;
        role: string;
        avatarUrl: string | null;
        appraisalPoints: number;
        scope: ServiceScope | null;
        site: { code: string; name: string } | null;
    };
    kind: 'support' | 'dev';
    generatedAt: string;
    stats: AgentTicketStats;
    rating: { average: number | null; count: number };
    support: { workloadPointsToday: number; installs: InstallItem[] } | null;
}
