import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentTab, type AgentMetrics } from './ReportTabs';

// Cancelled tickets never reach agent metrics: totalAssigned ("Tugas") is already net of them.
const row = (name: string, assigned: number, resolved: number): AgentMetrics => ({ agentId: name, agentName: name,
    totalAssigned: assigned, totalResolved: resolved,
    resolutionRate: assigned ? resolved / assigned * 100 : null, slaComplianceRate: assigned ? resolved / assigned * 100 : null,
    slaEvaluated: assigned, slaCompliant: resolved, slaBreached: assigned - resolved,
    responseSamples: 0, responseTotalMinutes: 0, resolutionSamples: 0, resolutionTotalMinutes: 0,
    avgResponseTimeMinutes: null, avgResolutionTimeMinutes: null,
});

describe('agent report consumer', () => {
    it('shows weighted counts and missing rates without plotting unknown zero', () => {
        render(<AgentTab agents={[row('Small', 1, 1), row('Large', 99, 49), row('Unknown', 0, 0)]}
            loading={false} startDate="2026-10-01" endDate="2026-10-31" onRange={() => {}}
            disabled={false} onPreview={() => {}} onPdf={() => {}} onExcel={() => {}} />);
        expect(screen.getByText(/50\/100 tiket/)).toBeInTheDocument();
        expect(screen.getByText(/50\/100 SLA dievaluasi/)).toBeInTheDocument();
        expect(screen.getByText('Unknown: — (belum ada tiket)')).toBeInTheDocument();
        expect(screen.queryByText('Top performer')).not.toBeInTheDocument();
    });

    it('does not show cancelled counts, eligible counts or a cross-site marker', () => {
        const { container } = render(<AgentTab agents={[row('Hasby', 1, 1)]}
            loading={false} startDate="2026-10-01" endDate="2026-10-31" onRange={() => {}}
            disabled={false} onPreview={() => {}} onPdf={() => {}} onExcel={() => {}} />);
        expect(container.textContent).not.toMatch(/dibatalkan|eligible|lintas site/i);
    });
});
