import React from 'react';
import { Users, BarChart3, CheckCircle, Crown, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Site {
    id: string;
    code: string;
    name: string;
}

interface AgentStats {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    department?: string;
    site?: Site;
    openTickets: number;
    inProgressTickets: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    resolvedTotal: number;
    slaCompliance: number;
    // Optional: weekly trend data for sparkline
    weeklyResolved?: number[];
}

interface AgentStatsSectionProps {
    stats: {
        totalAgents: number;
        totalResolved: number;
        totalActive: number;
        topPerformer: string;
        topPerformerTickets: number;
    };
    statsFilter: 'all' | 'active' | 'resolved' | 'top';
    onFilterChange: (filter: 'all' | 'active' | 'resolved' | 'top') => void;
}

// Mini Sparkline Component
const MiniSparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = 'stroke-green-500' }) => {
    if (!data || data.length < 2) return null;

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = data.map((value, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    // Determine trend
    const trend = data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'flat';
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400';
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

    return (
        <div className="flex items-center gap-1">
            <svg width={width} height={height} className="overflow-visible">
                <polyline
                    points={points}
                    fill="none"
                    className={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <TrendIcon className={cn("w-3 h-3", trendColor)} />
        </div>
    );
};

// Enhanced StatCard with gradient support AND click-to-filter AND sparkline
const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    variant?: 'default' | 'blue' | 'green' | 'purple' | 'amber';
    onClick?: () => void;
    isActive?: boolean;
    sparklineData?: number[];
}> = ({ title, value, subtitle, icon: Icon, variant = 'default', onClick, isActive, sparklineData }) => {
    const variantStyles = {
        default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        blue: 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/30 text-white',
        green: 'bg-gradient-to-br from-green-500 to-green-600 border-green-400/30 text-white',
        purple: 'bg-gradient-to-br from-purple-500 to-purple-600 border-purple-400/30 text-white',
        amber: 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400/30 text-white',
    };

    const isColored = variant !== 'default';
    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            onClick={onClick}
            className={cn(
                "rounded-2xl p-5 border hover:shadow-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:-translate-y-0.5 text-left w-full",
                variantStyles[variant],
                onClick && "cursor-pointer",
                isActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
            )}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className={cn("text-sm mb-1", isColored ? "text-white/80" : "text-slate-500 dark:text-slate-400")}>{title}</p>
                    <div className="flex items-center gap-3">
                        <p className={cn("text-2xl font-bold", isColored ? "text-white" : "text-slate-800 dark:text-white")}>{value}</p>
                        {sparklineData && sparklineData.length > 0 && (
                            <MiniSparkline data={sparklineData} color={isColored ? "stroke-white/70" : "stroke-green-500"} />
                        )}
                    </div>
                    {subtitle && <p className={cn("text-xs mt-1", isColored ? "text-white/70" : "text-slate-400")}>{subtitle}</p>}
                </div>
                <div className={cn("p-3 rounded-xl", isColored ? "bg-white/20" : "bg-slate-100 dark:bg-slate-700")}>
                    <Icon className={cn("w-5 h-5", isColored ? "text-white" : "text-slate-600 dark:text-slate-300")} />
                </div>
            </div>
        </Component>
    );
};

// Top Performer Hero Card with gold gradient
const TopPerformerCard: React.FC<{ name: string; tickets: number; onClick?: () => void; isActive?: boolean }> = ({ name, tickets, onClick, isActive }) => (
    <div
        onClick={onClick}
        className={cn(
            "rounded-2xl p-5 border border-amber-400/30 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/20 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:-translate-y-0.5 animate-golden-pulse cursor-pointer",
            isActive && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900"
        )}
    >
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-amber-100/90 mb-1 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    Top Performer
                </p>
                <p className="text-xl font-bold text-white truncate max-w-[140px]">{name}</p>
                <p className="text-xs text-amber-100/80 mt-1">{tickets} tickets this month</p>
            </div>
            <div className="p-3 rounded-xl bg-white/20">
                <Award className="w-5 h-5 text-white" />
            </div>
        </div>
    </div>
);

export const AgentStatsSection: React.FC<AgentStatsSectionProps> = ({
    stats,
    statsFilter,
    onFilterChange
}) => {
    // Mock weekly data for sparklines (in production, this would come from API)
    const mockWeeklyData = [12, 15, 10, 18, 22, 19, 25];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
                title="Total Agents"
                value={stats.totalAgents}
                icon={Users}
                variant="blue"
                onClick={() => onFilterChange('all')}
                isActive={statsFilter === 'all'}
            />
            <StatCard
                title="Active (In Progress)"
                value={stats.totalActive}
                subtitle="Click to filter"
                icon={BarChart3}
                variant="purple"
                onClick={() => onFilterChange(statsFilter === 'active' ? 'all' : 'active')}
                isActive={statsFilter === 'active'}
            />
            <StatCard
                title="Resolved (Month)"
                value={stats.totalResolved}
                subtitle="Click to filter"
                icon={CheckCircle}
                variant="green"
                onClick={() => onFilterChange(statsFilter === 'resolved' ? 'all' : 'resolved')}
                isActive={statsFilter === 'resolved'}
                sparklineData={mockWeeklyData}
            />
            <TopPerformerCard
                name={stats.topPerformer}
                tickets={stats.topPerformerTickets}
                onClick={() => onFilterChange(statsFilter === 'top' ? 'all' : 'top')}
                isActive={statsFilter === 'top'}
            />
        </div>
    );
};

export { StatCard, TopPerformerCard, MiniSparkline };
export type { AgentStats };
