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
    dashboardStats: DashboardStats;
    statsFilter: StatsFilter;
    onStatsFilterChange: (filter: StatsFilter) => void;
}

export function AgentStatsDashboard({ dashboardStats, statsFilter, onStatsFilterChange }: AgentStatsDashboardProps) {
    return (
        <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Agents"
                    value={dashboardStats.totalAgents}
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
                {/* Was a bare clickable <div>: the other three tiles are buttons, so this
                    one alone was unreachable by keyboard and announced nothing. */}
                <button
                    type="button"
                    onClick={() => onStatsFilterChange(statsFilter === 'top' ? 'all' : 'top')}
                    aria-pressed={statsFilter === 'top'}
                    aria-label={`Filter by top performer: ${dashboardStats.topPerformer}`}
                    className={cn("text-left w-full transition-[opacity,transform,colors] duration-200 ease-out rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", statsFilter === 'top' && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900")}
                >
                    <TopPerformerCard
                        name={dashboardStats.topPerformer}
                        tickets={dashboardStats.topPerformerTickets}
                    />
                </button>
            </div>

            {/* P2-3: Active filter indicator */}
            {statsFilter !== 'all' && (
                <div role="status" className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Filtering by:</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                        {statsFilter === 'top' ? 'Top Performer' : statsFilter}
                    </span>
                    <button
                        type="button"
                        onClick={() => onStatsFilterChange('all')}
                        className="text-sm min-h-[44px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    >
                        Clear filter
                    </button>
                </div>
            )}
        </>
    );
}
