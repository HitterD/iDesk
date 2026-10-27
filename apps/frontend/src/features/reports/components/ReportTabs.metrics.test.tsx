import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentTab, type AgentMetrics } from './ReportTabs';
const row = (name: string, eligible: number, resolved: number): AgentMetrics => ({ agentId: name, agentName: name,
    totalAssigned: eligible + 2, totalCancelled: 2, totalEligible: eligible, totalResolved: resolved,
    resolutionRate: eligible ? resolved / eligible * 100 : null, slaComplianceRate: eligible ? resolved / eligible * 100 : null,
    slaEvaluated: eligible, slaCompliant: resolved, slaBreached: eligible - resolved,
    responseSamples: 0, responseTotalMinutes: 0, resolutionSamples: 0, resolutionTotalMinutes: 0,
    avgResponseTimeMinutes: null, avgResolutionTimeMinutes: null, agentSiteId: 'home', agentSiteName: 'Home',
});
describe('agent report consumer', () => {
    it('shows weighted counts and missing rates without plotting unknown zero', () => {
        render(<AgentTab agents={[row('Small', 1, 1), row('Large', 99, 49), row('Unknown', 0, 0)]}
            loading={false} startDate="2026-10-01" endDate="2026-10-31" onRange={() => {}}
            disabled={false} onPreview={() => {}} onPdf={() => {}} onExcel={() => {}} />);
        expect(screen.getByText(/50\/100 eligible/)).toBeInTheDocument();
        expect(screen.getByText(/50\/100 SLA dievaluasi/)).toBeInTheDocument();
        expect(screen.getByText('Unknown: — (belum ada denominator eligible)')).toBeInTheDocument();
        expect(screen.queryByText('Top performer')).not.toBeInTheDocument();
        expect(screen.getAllByText(/Home/).length).toBe(3);
    });
});
