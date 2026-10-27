import { metricRate, summarizeAgentMetrics, rankAgents, reportMetricSql } from './report-metrics.util';

const agent = (overrides: Record<string, unknown> = {}) => ({
    agentId: 'a', agentName: 'A', totalAssigned: 10, totalCancelled: 2, totalEligible: 8,
    totalResolved: 8, slaEvaluated: 8, slaCompliant: 8, slaBreached: 0,
    responseSamples: 1, responseTotalMinutes: 0.5, resolutionSamples: 8,
    resolutionTotalMinutes: 80, slaComplianceRate: 100, ...overrides,
});

describe('report metrics shared contract', () => {
    it('excludes cancellations from resolution denominator', () => {
        expect(summarizeAgentMetrics([agent()]).resolutionRate).toBe(100);
    });
    it('uses summed denominators rather than means of agent rates', () => {
        const summary = summarizeAgentMetrics([
            agent({ totalAssigned: 500, totalCancelled: 0, totalEligible: 500, totalResolved: 460,
                slaEvaluated: 500, slaCompliant: 460, slaBreached: 40 }),
            agent({ totalAssigned: 48, totalCancelled: 0, totalEligible: 48, totalResolved: 45,
                slaEvaluated: 48, slaCompliant: 45, slaBreached: 3,
                responseSamples: 9, responseTotalMinutes: 89.5 }),
        ]);
        expect(summary.resolutionRate).toBe(92.15);
        expect(summary.slaComplianceRate).toBe(92.15);
        expect(summary.avgResponseTimeMinutes).toBe(9);
    });
    it('preserves missing measurements and sub-minute response', () => {
        expect(metricRate(0, 0)).toBeNull();
        expect(summarizeAgentMetrics([]).avgResponseTimeMinutes).toBeNull();
        expect(summarizeAgentMetrics([agent()]).avgResponseTimeMinutes).toBe(0.5);
    });
    it('ranks resolved count, then SLA null last, then name without mutating input', () => {
        const rows = [agent({ agentName: 'Z', slaComplianceRate: null }), agent({ agentName: 'B' }), agent()];
        expect(rankAgents(rows).map(a => a.agentName)).toEqual(['A', 'B', 'Z']);
        expect(rows[0].agentName).toBe('Z');
        expect(summarizeAgentMetrics([agent({ totalResolved: 0 })]).topAgent).toBeNull();
    });
    it('excludes responded cancellations from SQL response samples, totals and averages', () => {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(':memory:');
        try {
            db.exec('CREATE TABLE ticket(status TEXT, createdAt INTEGER, firstResponseAt INTEGER)');
            db.exec("INSERT INTO ticket VALUES ('CANCELLED', 0, 600), ('IN_PROGRESS', 0, 30), ('TODO', 0, NULL)");
            // SQLite lacks PostgreSQL EXTRACT: adapt only duration arithmetic, preserve production CASE/eligibility.
            const expression = reportMetricSql().responseMinutes.replace(
                'EXTRACT(EPOCH FROM (ticket.firstResponseAt - ticket.createdAt))',
                '(1.0 * (ticket.firstResponseAt - ticket.createdAt))',
            );
            const result = db.prepare(`SELECT COUNT(${expression}) AS samples, SUM(${expression}) AS total, AVG(${expression}) AS average FROM ticket`).get({ asOf: 1000 });
            expect({ ...result }).toEqual({ samples: 1, total: 0.5, average: 0.5 });
            db.exec("DELETE FROM ticket WHERE status != 'CANCELLED'");
            const cancelledOnly = db.prepare(`SELECT COUNT(${expression}) AS samples, SUM(${expression}) AS total, AVG(${expression}) AS average FROM ticket`).get({ asOf: 1000 });
            expect({ ...cancelledOnly }).toEqual({ samples: 0, total: null, average: null });
        } finally { db.close(); }
    });

    it.each([
        ['done exact boundary', 'RESOLVED', '2026-01-02T12:00:00Z', null, null, 1],
        ['done after target', 'CLOSED', '2026-01-02T12:00:01Z', null, null, 0],
        ['done missing timestamp', 'CLOSED', null, null, null, null],
        ['invalid legacy timestamp', 'RESOLVED', '2025-01-01T00:00:00Z', null, null, null],
        ['pause before target', 'WAITING_VENDOR', null, '2026-01-02T11:59:00Z', null, null],
        ['pause exact boundary', 'WAITING_VENDOR', null, '2026-01-02T12:00:00Z', null, null],
        ['pause after target', 'WAITING_VENDOR', null, '2026-01-02T12:00:01Z', null, 0],
        ['vendor timestamp fallback', 'WAITING_VENDOR', null, null, '2026-01-02T12:00:01Z', 0],
        ['pause unknown', 'WAITING_VENDOR', null, null, null, null],
        ['cancelled', 'CANCELLED', null, null, null, null],
        ['active breached', 'TODO', null, null, null, 0],
    ])('evaluates SQL fixture: %s', (_label, status, resolvedAt, lastPausedAt, waitingVendorAt, expected) => {
        // Execute the production CASE itself; no mirrored JS SLA evaluator.
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(':memory:');
        try {
            db.exec('CREATE TABLE ticket(status TEXT, createdAt TEXT, resolvedAt TEXT, slaTarget TEXT, lastPausedAt TEXT, waitingVendorAt TEXT)');
            db.prepare('INSERT INTO ticket VALUES (?, ?, ?, ?, ?, ?)').run(status, '2026-01-01T00:00:00Z', resolvedAt, '2026-01-02T12:00:00Z', lastPausedAt, waitingVendorAt);
            const result = db.prepare(`SELECT ${reportMetricSql().slaEvaluation} AS result FROM ticket`).get({ asOf: '2026-01-03T00:00:00Z' });
            expect(result.result).toBe(expected);
        } finally { db.close(); }
    });

    it.each([
        ['targetless', null, null],
        ['active exact boundary', '2026-01-03T00:00:00Z', null],
        ['legitimately extended target', '2026-01-04T00:00:00Z', null],
    ])('does not invent a breach: %s', (_label, target, expected) => {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(':memory:');
        try {
            db.exec('CREATE TABLE ticket(status TEXT, createdAt TEXT, resolvedAt TEXT, slaTarget TEXT, lastPausedAt TEXT, waitingVendorAt TEXT)');
            db.prepare('INSERT INTO ticket VALUES (?, ?, ?, ?, ?, ?)').run('IN_PROGRESS', '2026-01-01T00:00:00Z', null, target, null, null);
            expect(db.prepare(`SELECT ${reportMetricSql().slaEvaluation} AS result FROM ticket`).get({ asOf: '2026-01-03T00:00:00Z' }).result).toBe(expected);
        } finally { db.close(); }
    });

    it('SQL freezes waiting-vendor clock and uses strict target boundary, not remaining minutes or mutable updatedAt', () => {
        const sql = reportMetricSql();
        expect(sql.slaEvaluation).toContain('COALESCE(ticket.lastPausedAt, ticket.waitingVendorAt)');
        expect(sql.slaEvaluation).toContain('> ticket.slaTarget');
        expect(sql.slaEvaluation).not.toContain('NOW()');
        expect(sql.slaEvaluation).not.toContain('slaRemainingMinutes');
        expect(sql.resolutionMinutes).not.toContain('updatedAt');
        expect(sql.responseMinutes).toContain('ticket.firstResponseAt');
    });
});
