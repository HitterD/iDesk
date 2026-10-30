import type { ReportTeam } from '../../reportTeams';

export type ReportType = 'MONTHLY_SUMMARY' | 'AGENT_PERFORMANCE' | 'TICKET_VOLUME';
export type ScheduleType = 'DAILY' | 'WEEKLY' | 'MONTHLY';
/** Legacy; superseded by targetTeam. */
export type TargetAgentCategory = 'REGULAR' | 'ORACLE' | null;

export interface ScheduledReportConfig {
    id: string;
    name: string;
    reportType: ReportType;
    schedule: ScheduleType;
    sendTime: string; // HH:mm format
    siteId: string;
    site?: {
        id: string;
        code: string;
        name: string;
    };
    recipientUserIds: string[];
    targetAgentCategory: TargetAgentCategory;
    /** Team the report covers; null = every team. */
    targetTeam?: ReportTeam | null;
    isActive: boolean;
    lastRunAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ScheduledReportExecution {
    id: string;
    configId: string;
    executedAt: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    recipientsCount: number;
    emailsSent: number;
    errorMessage?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface RecipientUser {
    id: string;
    fullName: string;
    email: string;
    role: string;
    siteId?: string;
    avatarUrl?: string | null;
}

export interface SiteOption {
    id: string;
    code: string;
    name: string;
}
