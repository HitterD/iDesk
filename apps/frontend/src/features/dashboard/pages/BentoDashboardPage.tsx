import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Ticket,
    CheckCircle,
    Clock,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Plus,
    ListTodo,
    Users,
    BarChart3,
    PieChart,
    AlertTriangle,
    Hourglass,
    CalendarDays,
    ArrowRight,
    CircleDot,
    Activity,
    RefreshCw,
    ServerCrash
} from 'lucide-react';
import api from '../../../lib/api';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { Sparkline } from '@/components/ui/Sparkline';
import { cn } from '@/lib/utils';
import { ActivityFeed } from '@/components/ui/ActivityFeed';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { Ticket as TicketType } from '@/types/ticket.types';

interface DashboardStats {
    total: number;
    open: number;
    inProgress: number;
    waitingVendor: number;
    resolved: number;
    overdue: number;
    slaCompliance: number;
    byPriority: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
    byCategory: Record<string, number>;
    todayTickets: number;
    thisWeekTickets: number;
    thisMonthTickets: number;
    resolvedToday: number;
    resolvedThisWeek: number;
    last7Days: { date: string; created: number; resolved: number }[];
    recentTickets: any[];
    topAgents: { name: string; resolved: number; inProgress: number }[];
    avgResolutionTime: string;
}

// Simple Bar Chart Component with embedded legend
const MiniBarChart: React.FC<{ data: { date: string; created: number; resolved: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.created, d.resolved]), 1);

    return (
        <div className="relative">
            {/* Embedded Legend - overlaid in top right corner */}
            <div className="absolute top-0 right-0 flex items-center gap-3 text-xs bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-lg z-10">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-blue-400"></span> Created
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-400"></span> Resolved
                </span>
            </div>
            <div className="flex items-end gap-2 h-32 pt-6">
                {data.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 items-end h-24">
                            <div
                                className="flex-1 bg-blue-400 rounded-t transition-all hover:bg-blue-500 chart-bar-animated"
                                style={{
                                    height: `${(day.created / maxValue) * 100}%`,
                                    minHeight: day.created > 0 ? '4px' : '0',
                                    animationDelay: `${i * 0.1}s`
                                }}
                                title={`Created: ${day.created}`}
                            />
                            <div
                                className="flex-1 bg-emerald-400 rounded-t transition-all hover:bg-emerald-500 chart-bar-animated"
                                style={{
                                    height: `${(day.resolved / maxValue) * 100}%`,
                                    minHeight: day.resolved > 0 ? '4px' : '0',
                                    animationDelay: `${i * 0.1 + 0.05}s`
                                }}
                                title={`Resolved: ${day.resolved}`}
                            />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{day.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Donut Chart Component
// Donut Chart Component
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;

    if (total === 0) {
        return (
            <div className="relative">
                <svg viewBox="0 0 100 100" className="w-32 h-32">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="20" className="dark:stroke-slate-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-slate-400">0</span>
                </div>
            </div>
        );
    }

    const segments = data.map((d, i) => {
        if (d.value === 0) return null;

        const angle = (d.value / total) * 360;

        // Handle full circle case
        if (angle === 360) {
            return (
                <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill={d.color}
                    className="transition-all hover:opacity-80"
                />
            );
        }

        const startAngle = currentAngle;
        currentAngle += angle;

        // Calculate arc path
        const startRad = (startAngle - 90) * Math.PI / 180;
        const endRad = (startAngle + angle - 90) * Math.PI / 180;
        const largeArc = angle > 180 ? 1 : 0;

        const x1 = 50 + 40 * Math.cos(startRad);
        const y1 = 50 + 40 * Math.sin(startRad);
        const x2 = 50 + 40 * Math.cos(endRad);
        const y2 = 50 + 40 * Math.sin(endRad);

        return (
            <path
                key={i}
                d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={d.color}
                className="transition-all hover:opacity-80"
            />
        );
    });

    return (
        <div className="relative">
            <svg viewBox="0 0 100 100" className="w-32 h-32">
                {segments}
                <circle cx="50" cy="50" r="25" className="fill-white/80 dark:fill-slate-800/50" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{total}</span>
            </div>
        </div>
    );
};

// Stat Card Component with Sparkline
const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: any;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down';
    sparklineData?: number[];
    sparklineColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    highlight?: boolean;
    onClick?: () => void;
}> = ({ title, value, icon: Icon, color, subtitle, trend, sparklineData, sparklineColor = 'primary', highlight, onClick }) => (
    <div
        onClick={onClick}
        className={cn(
            "glass-card p-6 hover-lift transition-all group relative flex items-center gap-5 animate-fade-in-up stat-card-enhanced",
            highlight && "ring-2 ring-red-500/20",
            onClick && "cursor-pointer hover:ring-2 hover:ring-primary/30 active:scale-[0.98]"
        )}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
        <div className={cn(
            "p-4 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform shrink-0 icon-scale-hover stat-icon",
            color
        )}>
            <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
                <p className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                    {typeof value === 'number' ? (
                        <AnimatedNumber value={value} duration={800} />
                    ) : (
                        value
                    )}
                </p>
                {sparklineData && sparklineData.length > 1 && (
                    <Sparkline
                        data={sparklineData}
                        width={60}
                        height={24}
                        color={sparklineColor}
                        showDot={false}
                    />
                )}
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        </div>
        {trend && (
            <div className="absolute top-4 right-4">
                <span className={cn(
                    "flex items-center text-xs font-bold px-2.5 py-1 rounded-full",
                    trend === 'up'
                        ? 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400'
                )}>
                    {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                </span>
            </div>
        )}
    </div>
);

// Status Badge
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const config: Record<string, { bg: string; text: string }> = {
        TODO: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300' },
        IN_PROGRESS: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
        WAITING_VENDOR: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
        RESOLVED: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    };
    const { bg, text } = config[status] || config.TODO;
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bg} ${text}`}>
            {status.replace('_', ' ')}
        </span>
    );
};

// Priority Dot
const PriorityDot: React.FC<{ priority: string }> = ({ priority }) => {
    const colors: Record<string, string> = {
        CRITICAL: 'bg-red-500',
        HIGH: 'bg-orange-500',
        MEDIUM: 'bg-yellow-500',
        LOW: 'bg-slate-400',
    };
    return <span className={`w-2 h-2 rounded-full ${colors[priority] || colors.LOW}`} />;
};

export const BentoDashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Date range state for chart filtering
    const [chartDateRange, setChartDateRange] = useState<7 | 14 | 30>(7);

    // Handle new ticket notification for admins/agents
    const handleNewTicket = useCallback((ticket: any) => {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            toast.info('🎫 New Ticket Received', {
                description: `${ticket.ticketNumber || ''}: ${ticket.title}`,
                action: {
                    label: 'View',
                    onClick: () => navigate(`/tickets/${ticket.id}`),
                },
                duration: 8000,
            });
        }
    }, [user, navigate]);

    // Real-time updates for dashboard stats
    useTicketListSocket({ onNewTicket: handleNewTicket });

    // Fetch actual tickets (same as tickets page) for accurate stats
    const { data: tickets = [], isError: ticketsError, error: ticketsErrorData, refetch: refetchTickets, dataUpdatedAt } = useQuery<TicketType[]>({
        queryKey: ['tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    // Format last updated time
    const lastUpdated = useMemo(() => {
        if (!dataUpdatedAt) return null;
        const now = Date.now();
        const diff = now - dataUpdatedAt;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes === 1) return '1 minute ago';
        if (minutes < 60) return `${minutes} minutes ago`;
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1 hour ago';
        return `${hours} hours ago`;
    }, [dataUpdatedAt]);

    // Compute all stats from actual tickets
    const liveStats = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Basic counts
        const total = tickets.length;
        const open = tickets.filter((t) => t.status === 'TODO').length;
        const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
        const waitingVendor = tickets.filter((t) => t.status === 'WAITING_VENDOR').length;
        const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
        const overdue = tickets.filter((t) => t.isOverdue).length;

        // Priority counts
        const byPriority = {
            CRITICAL: tickets.filter((t) => t.priority === 'CRITICAL').length,
            HIGH: tickets.filter((t) => t.priority === 'HIGH').length,
            MEDIUM: tickets.filter((t) => t.priority === 'MEDIUM').length,
            LOW: tickets.filter((t) => t.priority === 'LOW').length,
        };

        // Category counts
        const byCategory: Record<string, number> = {};
        tickets.forEach((t) => {
            const cat = t.category || 'GENERAL';
            byCategory[cat] = (byCategory[cat] || 0) + 1;
        });

        // Time-based counts
        const todayTickets = tickets.filter((t) => new Date(t.createdAt) >= today).length;
        const thisWeekTickets = tickets.filter((t) => new Date(t.createdAt) >= thisWeekStart).length;
        const thisMonthTickets = tickets.filter((t) => new Date(t.createdAt) >= thisMonthStart).length;
        const resolvedToday = tickets.filter((t) => t.status === 'RESOLVED' && new Date(t.updatedAt) >= today).length;
        const resolvedThisWeek = tickets.filter((t) => t.status === 'RESOLVED' && new Date(t.updatedAt) >= thisWeekStart).length;

        // Last N days based on chartDateRange
        const lastNDays: { date: string; created: number; resolved: number }[] = [];
        for (let i = chartDateRange - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const nextDate = new Date(date);
            nextDate.setDate(date.getDate() + 1);

            const created = tickets.filter((t) => {
                const d = new Date(t.createdAt);
                return d >= date && d < nextDate;
            }).length;

            const resolvedCount = tickets.filter((t) => {
                if (t.status !== 'RESOLVED') return false;
                const d = new Date(t.updatedAt);
                return d >= date && d < nextDate;
            }).length;

            lastNDays.push({
                date: date.toLocaleDateString('en-US', { weekday: 'short' }),
                created,
                resolved: resolvedCount,
            });
        }

        // Top agents
        const agentStats: Record<string, { name: string; resolved: number; inProgress: number }> = {};
        tickets.forEach((t) => {
            if (t.assignedTo) {
                const agentId = t.assignedTo.id;
                if (!agentStats[agentId]) {
                    agentStats[agentId] = { name: t.assignedTo.fullName, resolved: 0, inProgress: 0 };
                }
                if (t.status === 'RESOLVED') {
                    agentStats[agentId].resolved++;
                } else if (t.status === 'IN_PROGRESS') {
                    agentStats[agentId].inProgress++;
                }
            }
        });
        const topAgents = Object.values(agentStats)
            .sort((a, b) => b.resolved - a.resolved)
            .slice(0, 5);

        // Recent tickets
        const recentTickets = [...tickets]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);

        // SLA compliance
        const slaCompliance = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

        // Previous week stats for comparison (week before thisWeekStart)
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = thisWeekStart;

        const lastWeekTickets = tickets.filter((t) => {
            const d = new Date(t.createdAt);
            return d >= lastWeekStart && d < lastWeekEnd;
        }).length;

        const lastWeekResolved = tickets.filter((t) => {
            if (t.status !== 'RESOLVED') return false;
            const d = new Date(t.updatedAt);
            return d >= lastWeekStart && d < lastWeekEnd;
        }).length;

        // Calculate trends (percentage change)
        const calcTrend = (current: number, previous: number): 'up' | 'down' | null => {
            if (previous === 0) return current > 0 ? 'up' : null;
            const change = ((current - previous) / previous) * 100;
            if (change > 5) return 'up';
            if (change < -5) return 'down';
            return null;
        };

        return {
            total,
            open,
            inProgress,
            waitingVendor,
            resolved,
            overdue,
            byPriority,
            byCategory,
            todayTickets,
            thisWeekTickets,
            thisMonthTickets,
            resolvedToday,
            resolvedThisWeek,
            last7Days: lastNDays,
            topAgents,
            recentTickets,
            slaCompliance,
            // Trend comparisons
            trends: {
                thisWeek: calcTrend(thisWeekTickets, lastWeekTickets),
                resolved: calcTrend(resolvedThisWeek, lastWeekResolved),
            }
        };
    }, [tickets, chartDateRange]);

    const { data: stats, isLoading, isError: statsError, error: statsErrorData, refetch: refetchStats } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await api.get('/tickets/dashboard/stats');
            return res.data;
        },
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
    });

    // Combined refetch function
    const handleRefresh = () => {
        refetchTickets();
        refetchStats();
        toast.success('Dashboard refreshed');
    };

    // Error state
    if (ticketsError || statsError) {
        const errorMessage = (ticketsErrorData as Error)?.message || (statsErrorData as Error)?.message || 'Failed to load dashboard data';
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="p-6 rounded-full bg-red-100 dark:bg-red-900/20">
                    <ServerCrash className="w-16 h-16 text-red-500" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Unable to Load Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        {errorMessage}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all"
                >
                    <RefreshCw className="w-5 h-5" />
                    Try Again
                </button>
            </div>
        );
    }

    if (isLoading && tickets.length === 0) {
        return <DashboardSkeleton />;
    }

    const statusData = [
        { label: 'Open', value: liveStats.open, color: '#94a3b8' },
        { label: 'In Progress', value: liveStats.inProgress, color: '#60a5fa' },
        { label: 'Waiting', value: liveStats.waitingVendor, color: '#fb923c' },
        { label: 'Resolved', value: liveStats.resolved, color: '#4ade80' },
    ];

    const priorityData = [
        { label: 'Critical', value: liveStats.byPriority.CRITICAL, color: '#ef4444' },
        { label: 'High', value: liveStats.byPriority.HIGH, color: '#f97316' },
        { label: 'Medium', value: liveStats.byPriority.MEDIUM, color: '#eab308' },
        { label: 'Low', value: liveStats.byPriority.LOW, color: '#94a3b8' },
    ];

    const categoryColors = [
        'bg-blue-500',
        'bg-green-500',
        'bg-purple-500',
        'bg-orange-500',
        'bg-pink-500',
        'bg-cyan-500',
        'bg-yellow-500',
        'bg-red-500'
    ];

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Dashboard</h1>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-slate-400 dark:text-slate-500 text-sm font-normal">iDesk performance overview</p>
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Updated {lastUpdated}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                        title="Refresh dashboard"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Create Ticket
                    </button>
                    <button
                        onClick={() => navigate('/tickets/list')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <ListTodo className="w-4 h-4" />
                        My Tasks
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 stagger-1">
                <StatCard
                    title="Total Tickets"
                    value={liveStats.total}
                    icon={Ticket}
                    color="bg-blue-500"
                    onClick={() => navigate('/tickets/list')}
                />
                <StatCard
                    title="Open"
                    value={liveStats.open}
                    icon={CircleDot}
                    color="bg-slate-500"
                    onClick={() => navigate('/tickets/list?status=TODO')}
                />
                <StatCard
                    title="In Progress"
                    value={liveStats.inProgress}
                    icon={Hourglass}
                    color="bg-blue-400"
                    onClick={() => navigate('/tickets/list?status=IN_PROGRESS')}
                />
                <StatCard
                    title="Resolved"
                    value={liveStats.resolved}
                    icon={CheckCircle}
                    color="bg-green-500"
                    onClick={() => navigate('/tickets/list?status=RESOLVED')}
                />
                <StatCard
                    title="Overdue"
                    value={liveStats.overdue}
                    icon={AlertTriangle}
                    color="bg-red-500"
                    highlight={liveStats.overdue > 0}
                    onClick={() => navigate('/tickets/list?overdue=true')}
                />
                <StatCard title="Avg Resolution" value={stats?.avgResolutionTime || '-'} icon={Clock} color="bg-purple-500" />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-2">
                {/* Left Column - Charts */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Weekly Activity Chart */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    Activity
                                    <span className="live-indicator ml-2" title="Live data" />
                                </h3>
                                <p className="text-sm text-slate-500">Tickets created vs resolved (last {chartDateRange} days)</p>
                            </div>
                            <div className="flex items-center">
                                {/* Date Range Picker */}
                                <select
                                    value={chartDateRange}
                                    onChange={(e) => setChartDateRange(Number(e.target.value) as 7 | 14 | 30)}
                                    className="px-3 py-1.5 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                                >
                                    <option value={7}>7 days</option>
                                    <option value={14}>14 days</option>
                                    <option value={30}>30 days</option>
                                </select>
                            </div>
                        </div>
                        <MiniBarChart data={liveStats.last7Days} />
                    </div>

                    {/* SLA & Activity Summary Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* SLA Compliance */}
                        <div className="bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/10 dark:to-primary/5 rounded-2xl border border-primary/20 p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-primary" />
                                SLA Compliance
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="relative w-24 h-24">
                                    <svg className="w-24 h-24 transform -rotate-90">
                                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-slate-200 dark:text-slate-700" />
                                        <circle
                                            cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none"
                                            strokeDasharray={`${liveStats.slaCompliance * 2.51} 251`}
                                            className="text-primary sla-ring-animated"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-slate-800 dark:text-white">
                                            <AnimatedNumber value={liveStats.slaCompliance} duration={1000} suffix="%" />
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-green-600">
                                            <AnimatedNumber value={liveStats.total - liveStats.overdue} duration={800} />
                                        </span> on time
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-red-600">
                                            <AnimatedNumber value={liveStats.overdue} duration={800} />
                                        </span> overdue
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Activity Summary */}
                        <div className="glass-card p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-primary" />
                                Activity Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">Today</span>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => navigate('/tickets/list?created=today')}
                                            className="text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                        >
                                            <span className="font-bold text-blue-600"><AnimatedNumber value={liveStats.todayTickets} duration={600} /></span> new
                                        </button>
                                        <button
                                            onClick={() => navigate('/tickets/list?status=RESOLVED&resolved=today')}
                                            className="text-sm hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors"
                                        >
                                            <span className="font-bold text-green-600"><AnimatedNumber value={liveStats.resolvedToday} duration={600} /></span> resolved
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">This Week</span>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => navigate('/tickets/list?created=week')}
                                            className="text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                        >
                                            <span className="font-bold text-blue-600"><AnimatedNumber value={liveStats.thisWeekTickets} duration={700} /></span> new
                                        </button>
                                        <button
                                            onClick={() => navigate('/tickets/list?status=RESOLVED&resolved=week')}
                                            className="text-sm hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded transition-colors"
                                        >
                                            <span className="font-bold text-green-600"><AnimatedNumber value={liveStats.resolvedThisWeek} duration={700} /></span> resolved
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">This Month</span>
                                    <button
                                        onClick={() => navigate('/tickets/list?created=month')}
                                        className="text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                                    >
                                        <span className="font-bold text-blue-600"><AnimatedNumber value={liveStats.thisMonthTickets} duration={800} /></span> tickets
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status & Priority Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* By Status */}
                        <div className="glass-card p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-primary" />
                                By Status
                            </h3>
                            <div className="flex items-center gap-6">
                                <DonutChart data={statusData} />
                                <div className="space-y-2 flex-1">
                                    {statusData.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color }}></span>
                                                {d.label}
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-white">{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* By Priority */}
                        <div className="glass-card p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-primary" />
                                By Priority
                            </h3>
                            <div className="flex items-center gap-6">
                                <DonutChart data={priorityData} />
                                <div className="space-y-2 flex-1">
                                    {priorityData.map((d, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <span className="w-3 h-3 rounded" style={{ backgroundColor: d.color }}></span>
                                                {d.label}
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-white">{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Live Activity Feed */}
                    <div className="glass-card overflow-hidden">
                        <ActivityFeed
                            activities={liveStats.recentTickets.slice(0, 8).map((ticket: any) => ({
                                id: ticket.id,
                                type: ticket.status === 'RESOLVED' ? 'ticket_resolved' as const :
                                    ticket.assignedTo ? 'ticket_assigned' as const : 'ticket_created' as const,
                                timestamp: ticket.createdAt,
                                user: ticket.user,
                                ticket: {
                                    id: ticket.id,
                                    ticketNumber: ticket.ticketNumber || ticket.id.slice(0, 8),
                                    title: ticket.title,
                                },
                            }))}
                            isLive={true}
                            maxItems={8}
                            onActivityClick={(activity) => navigate(`/tickets/${activity.ticket?.id}`)}
                        />
                    </div>
                </div>

                {/* Right Column - Stats & Info */}
                <div className="space-y-6">
                    {/* Top Agents */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-primary" />
                                Top Agents
                            </h3>
                            <button
                                onClick={() => navigate('/agents')}
                                className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
                            >
                                View All <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {liveStats.topAgents.length > 0 ? liveStats.topAgents.map((agent, i) => (
                                <div key={i} className="flex items-center gap-3 leaderboard-item" style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className={cn(
                                        "avatar-status-ring",
                                        agent.inProgress > 0 ? "online" : "offline"
                                    )}>
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                            {agent.name.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-800 dark:text-white text-sm">{agent.name}</p>
                                        <p className="text-xs text-slate-500">
                                            <span className="text-green-600 font-medium">{agent.resolved}</span> resolved • <span className="text-blue-600 font-medium">{agent.inProgress}</span> in progress
                                        </p>
                                    </div>
                                    {i === 0 && <span className="text-lg">🏆</span>}
                                    {i === 1 && <span className="text-lg">🥈</span>}
                                    {i === 2 && <span className="text-lg">🥉</span>}
                                </div>
                            )) : (
                                <p className="text-sm text-slate-400 text-center py-4">No agent data</p>
                            )}
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="glass-card p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">By Category</h3>
                        <div className="space-y-3">
                            {Object.entries(liveStats.byCategory)
                                .sort(([, a], [, b]) => b - a) // Sort by count descending
                                .map(([cat, count], index) => {
                                    const maxCount = Math.max(...Object.values(liveStats.byCategory), 1);
                                    const percentage = (count / maxCount) * 100;
                                    return (
                                        <div
                                            key={cat}
                                            className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                                            onClick={() => navigate(`/tickets/list?category=${cat}`)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/tickets/list?category=${cat}`)}
                                        >
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <span className="text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                                                    {cat.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                            <div className="relative h-6 w-full bg-slate-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                                                <div
                                                    className={`h-full rounded-lg ${categoryColors[index % categoryColors.length]} transition-all group-hover:brightness-110`}
                                                    style={{ width: `${Math.max(percentage, 8)}%` }}
                                                />
                                                <span className="absolute inset-y-0 right-2 flex items-center text-xs font-bold text-slate-700 dark:text-white">
                                                    {count}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Recent Tickets */}
                    <div className="glass-card overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Ticket className="w-5 h-5 text-primary" />
                                Recent Tickets
                            </h3>
                            <button
                                onClick={() => navigate('/tickets/list')}
                                className="text-sm text-primary font-medium flex items-center gap-1 hover:underline"
                            >
                                View All <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {liveStats.recentTickets.length > 0 ? liveStats.recentTickets.slice(0, 5).map((ticket: any) => (
                                <div
                                    key={ticket.id}
                                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                                    className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <PriorityDot priority={ticket.priority} />
                                                <span className="font-mono text-xs text-slate-400">#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                            </div>
                                            <h4 className="font-medium text-slate-800 dark:text-white truncate">{ticket.title}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {ticket.user?.fullName}
                                            </p>
                                        </div>
                                        <StatusBadge status={ticket.status} />
                                    </div>
                                </div>
                            )) : (
                                <div className="px-6 py-8 text-center text-slate-400">
                                    No tickets yet
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>


        </div>
    );
};
