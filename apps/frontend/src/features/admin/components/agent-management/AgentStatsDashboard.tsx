import { Users, BarChart3, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard } from './StatCard';
import { TopPerformerCard } from './AgentTopPerformerCard';

type StatsFilter = 'all' | 'active' | 'resolved' | 'top';

interface DashboardStats {
    totalAgents: number;
    totalActive: number;
    totalResolved: number;
    topPerformer: string;
    topPerformerTickets: number;
}

interface AgentStatsDashboardProps {
    total: number | undefined;
    dashboardStats: DashboardStats;
    statsFilter: StatsFilter;
    onStatsFilterChange: (filter: StatsFilter) => void;
}

export function AgentStatsDashboard({ total, dashboardStats, statsFilter, onStatsFilterChange }: AgentStatsDashboardProps) {
    return (
        <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={total ?? dashboardStats.totalAgents}
                    icon={Users}
                    variant="blue"
                    onClick={() => onStatsFilterChange('all')}
                    isActive={statsFilter === 'all'}
                />
                <StatCard
                    title="Active (In Progress)"
                    value={dashboardStats.totalActive}
                    subtitle="Click to filter"
                    icon={BarChart3}
                    variant="purple"
                    onClick={() => onStatsFilterChange(statsFilter === 'active' ? 'all' : 'active')}
                    isActive={statsFilter === 'active'}
                />
                <StatCard
                    title="Resolved (Month)"
                    value={dashboardStats.totalResolved}
                    subtitle="Click to filter"
                    icon={CheckCircle}
                    variant="green"
                    onClick={() => onStatsFilterChange(statsFilter === 'resolved' ? 'all' : 'resolved')}
                    isActive={statsFilter === 'resolved'}
                />
                <div
                    onClick={() => onStatsFilterChange(statsFilter === 'top' ? 'all' : 'top')}
                    className={cn("cursor-pointer transition-[opacity,transform,colors] duration-200 ease-out", statsFilter === 'top' && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 rounded-2xl")}
                >
                    <TopPerformerCard
                        name={dashboardStats.topPerformer}
                        tickets={dashboardStats.topPerformerTickets}
                    />
                </div>
            </div>

            {/* P2-3: Active filter indicator */}
            {statsFilter !== 'all' && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Filtering by:</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                        {statsFilter === 'top' ? 'Top Performer' : statsFilter}
                    </span>
                    <button
                        onClick={() => onStatsFilterChange('all')}
                        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    >
                        Clear filter
                    </button>
                </div>
            )}
        </>
    );
}
