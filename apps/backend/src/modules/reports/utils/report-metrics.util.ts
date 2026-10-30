import { TICKET_DONE_STATUSES_SQL } from '../../ticketing/utils/ticket-status-sql.util';

export interface MetricCounts {
    agentName: string;
    /** Tickets given to the agent in the period, excluding cancelled ones ("Tugas"). */
    totalAssigned: number;
    totalResolved: number;
    slaEvaluated: number;
    slaCompliant: number;
    slaBreached: number;
    responseSamples: number;
    responseTotalMinutes: number;
    resolutionSamples: number;
    resolutionTotalMinutes: number;
    slaComplianceRate: number | null;
}

export function metricRate(numerator: number, denominator: number): number | null {
    return denominator > 0 ? Math.round(numerator / denominator * 10000) / 100 : null;
}

export function rankAgents<T extends Pick<MetricCounts, 'totalResolved' | 'slaComplianceRate' | 'agentName'>>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => b.totalResolved - a.totalResolved
        || (b.slaComplianceRate ?? -1) - (a.slaComplianceRate ?? -1)
        || a.agentName.localeCompare(b.agentName));
}

export function summarizeAgentMetrics<T extends MetricCounts>(rows: readonly T[]) {
    const sum = (key: keyof Omit<MetricCounts, 'agentName' | 'slaComplianceRate'>) => rows.reduce((total, row) => total + row[key], 0);
    const responseSamples = sum('responseSamples');
    const resolutionSamples = sum('resolutionSamples');
    const totalAssigned = sum('totalAssigned');
    const totalResolved = sum('totalResolved');
    const slaEvaluated = sum('slaEvaluated');
    const slaCompliant = sum('slaCompliant');
    return {
        totalAssigned, totalResolved,
        slaEvaluated, slaCompliant, slaBreached: sum('slaBreached'),
        responseSamples, responseTotalMinutes: sum('responseTotalMinutes'),
        resolutionSamples, resolutionTotalMinutes: sum('resolutionTotalMinutes'),
        resolutionRate: metricRate(totalResolved, totalAssigned),
        slaComplianceRate: metricRate(slaCompliant, slaEvaluated),
        avgResponseTimeMinutes: responseSamples ? sum('responseTotalMinutes') / responseSamples : null,
        avgResolutionTimeMinutes: resolutionSamples ? sum('resolutionTotalMinutes') / resolutionSamples : null,
        topAgent: rankAgents(rows).find(row => row.totalResolved > 0) ?? null,
    };
}

/** Shared SQL expressions. Keep ticket.<property> followed by a space/punctuation, never a newline:
 * TypeORM's property replacer otherwise consumes the newline and misses the column mapping.
 * Completion uses resolvedAt only: closedAt is an administrative event, not a resolution timestamp.
 * SLA is tri-state: 1 compliant, 0 breached, NULL not evaluated/unknown.
 */
export function reportMetricSql() {
    const done = `ticket.status IN (${TICKET_DONE_STATUSES_SQL})`;
    const pending = `ticket.status IN ('TODO', 'IN_PROGRESS', 'WAITING_VENDOR')`;
    const completion = 'ticket.resolvedAt';
    const validCompletion = `${completion} >= ticket.createdAt AND ${completion} <= :asOf`;
    const responseMinutes = `CASE WHEN ticket.status <> 'CANCELLED' AND ticket.firstResponseAt >= ticket.createdAt AND ticket.firstResponseAt <= :asOf THEN EXTRACT(EPOCH FROM (ticket.firstResponseAt - ticket.createdAt)) / 60 ELSE NULL END`;
    const resolutionMinutes = `CASE WHEN ${done} AND ${validCompletion} THEN EXTRACT(EPOCH FROM (${completion} - ticket.createdAt)) / 60 ELSE NULL END`;
    const pause = 'COALESCE(ticket.lastPausedAt, ticket.waitingVendorAt)';
    const activeClock = `CASE WHEN ticket.status = 'WAITING_VENDOR' THEN ${pause} ELSE :asOf END`;
    const slaEvaluation = `CASE WHEN ticket.slaTarget IS NULL OR ticket.status = 'CANCELLED' THEN NULL WHEN ${done} AND ${validCompletion} THEN CASE WHEN ${completion} > ticket.slaTarget THEN 0 ELSE 1 END WHEN ${pending} AND (${activeClock}) >= ticket.createdAt AND (${activeClock}) <= :asOf AND (${activeClock}) > ticket.slaTarget THEN 0 ELSE NULL END`;
    return { done, pending, responseMinutes, resolutionMinutes, slaEvaluation };
}
