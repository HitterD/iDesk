import { Users, CircleDot, CircleCheck, Trophy, X } from 'lucide-react';
import { MgStat } from '@/components/management/MgmtParts';

type StatsFilter = 'all' | 'active' | 'resolved' | 'top';

interface DashboardStats {
    totalAgents: number;
    totalActive: number;
    totalResolved: number;
    topPerformer: string;
    topPerformerTickets: number;
}

interface AgentStatsDashboardProps {
    dashboardStats: DashboardStats;
    statsFilter: StatsFilter;
    onStatsFilterChange: (filter: StatsFilter) => void;
}

const FILTER_LABEL: Readonly<Record<Exclude<StatsFilter, 'all'>, string>> = { active: 'Active', resolved: 'Resolved', top: 'Top Performer' };

/** Mockup `.stats.four`: click a card to filter the agent list, click again to clear. */
export function AgentStatsDashboard({ dashboardStats, statsFilter, onStatsFilterChange }: AgentStatsDashboardProps) {
    const toggle = (f: StatsFilter) => onStatsFilterChange(statsFilter === f ? 'all' : f);
    return (
        <>
            <section className="res-stats is-four" aria-label="Ringkasan agent">
                <MgStat icon={Users} tone="navy" label="Total Agents" value={dashboardStats.totalAgents}
                    active={statsFilter === 'all'} onClick={() => onStatsFilterChange('all')} />
                <MgStat icon={CircleDot} tone="blue" label="Active (In Progress)" value={dashboardStats.totalActive}
                    active={statsFilter === 'active'} onClick={() => toggle('active')} />
                <MgStat icon={CircleCheck} tone="green" label="Resolved (Month)" value={dashboardStats.totalResolved}
                    active={statsFilter === 'resolved'} onClick={() => toggle('resolved')} />
                <MgStat icon={Trophy} tone="teal" label="Top Performer" value={dashboardStats.topPerformerTickets}
                    sub={dashboardStats.topPerformer} active={statsFilter === 'top'} onClick={() => toggle('top')}
                    ariaLabel={`Filter by top performer: ${dashboardStats.topPerformer}`} />
            </section>
            {statsFilter !== 'all' && (
                <div role="status" className="res-filters">
                    <span className="res-muted">Filtering by:</span>
                    <span className="res-tag">{FILTER_LABEL[statsFilter]}</span>
                    <button type="button" className="res-reset" onClick={() => onStatsFilterChange('all')}><X aria-hidden="true" />Clear filter</button>
                </div>
            )}
        </>
    );
}
