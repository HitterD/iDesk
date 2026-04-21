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
    RefreshCcw,
    ServerCrash,
    Trophy,
    Medal
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
    cancelled: number;
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
            <div className="flex items-end gap-1.5 h-40 pt-2">
                {data.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full flex gap-0.5 items-end h-24">
                            <div
                                className="flex-1 bg-blue-400 dark:bg-blue-500 hover:opacity-75 rounded-t-sm chart-bar-animated origin-bottom"
                                style={{
                                    height: `${(day.created / maxValue) * 100}%`,
                                    minHeight: day.created > 0 ? '4px' : '0',
                                    animationDelay: `${i * 0.1}s`
                                }}
                                title={`Created: ${day.created}`}
                            />
                            <div
                                className="flex-1 bg-[hsl(var(--success-400))] dark:bg-[hsl(var(--success-500))] hover:opacity-75 rounded-t-sm chart-bar-animated origin-bottom"
                                style={{
                                    height: `${(day.resolved / maxValue) * 100}%`,
                                    minHeight: day.resolved > 0 ? '4px' : '0',
                                    animationDelay: `${i * 0.1 + 0.05}s`
                                }}
                                title={`Resolved: ${day.resolved}`}
                            />
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-600 dark:group-hover:text-slate-300 cursor-default">{day.date}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Donut Chart Component
const DonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;

    if (total === 0) {
        return (
            <div className="relative">
                <svg viewBox="0 0 100 100" className="w-28 h-28">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="20" className="text-slate-200 dark:text-slate-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-400">0</span>
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
            <svg viewBox="0 0 100 100" className="w-28 h-28">
                <circle cx="50" cy="50" r="40" fill="currentColor" className="text-slate-100 dark:text-slate-800" />
                {segments}
                <circle cx="50" cy="50" r="25" fill="currentColor" className="text-white dark:text-[hsl(var(--card))]" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-extrabold tracking-tight text-slate-800 dark:text-white">{total}</span>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{
    title: string;
    value: number | string;
    subtitle?: string;
    trend?: 'up' | 'down' | null;
    highlight?: boolean;
    onClick?: () => void;
    sparklineData?: number[];
}> = ({ title, value, subtitle, trend, highlight, onClick, sparklineData }) => (
    <div
        onClick={onClick}
        className={cn(
            "p-4 rounded-xl flex flex-col gap-2 transition-all group relative border animate-fade-in-up",
            highlight ? "border-[hsl(var(--error-500))] bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-900))]/10" : "border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))]",
            onClick && "cursor-pointer hover:border-primary/40 hover:shadow-sm"
        )}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
        <div className="flex justify-between items-start mb-1">
            <span className={cn(
                "text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400",
                highlight && "text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))]"
            )}>
                {title}
            </span>
            {trend && (
                <div className={cn(
                    "flex items-center text-xs font-bold px-2 py-0.5 rounded-full",
                    trend === 'up'
                        ? 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400'
                        : 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400'
                )}>
                    {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                </div>
            )}
        </div>
        <div>
            <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none mb-1">
                {typeof value === 'number' ? <AnimatedNumber value={value} duration={800} /> : value}
            </div>
            {subtitle && (
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
            )}
        </div>
        
        {/* Mini Sparkline to fill void */}
        {sparklineData && sparklineData.length > 0 && (
            <div className="h-8 mt-auto pt-2">
                <Sparkline data={sparklineData} height={32} width={100} showDot={false} color={highlight ? 'danger' : 'primary'} />
            </div>
        )}
        
        {/* Accent line on left side */}
        <div className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-md transition-all duration-300 group-hover:h-3/4",
            highlight ? "bg-[hsl(var(--error-500))]" : "bg-slate-200 dark:bg-slate-700 group-hover:bg-primary"
        )} />
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
    const [dashboardTab, setDashboardTab] = useState<'live' | 'recent'>('live');
    const [breakdownTab, setBreakdownTab] = useState<'status' | 'priority' | 'category'>('status');

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
            // Force silent refetch to update live metrics automatically
            refetchTickets();
            refetchStats();
        }
    }, [user, navigate]);

    const handleTicketUpdate = useCallback((data: { ticketId: string, updates: any }) => {
        refetchTickets();
        refetchStats();
    }, []);

    // Real-time updates for dashboard stats
    useTicketListSocket({
        onNewTicket: handleNewTicket,
        onTicketUpdated: handleTicketUpdate
    });

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
        const cancelled = tickets.filter((t) => t.status === 'CANCELLED').length;
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
            cancelled,
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
                <div className="p-6 rounded-full bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-900))]/20">
                    <ServerCrash className="w-16 h-16 text-[hsl(var(--error-500))]" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Unable to Load Dashboard</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        {errorMessage}
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold rounded-xl hover:bg-[hsl(var(--primary))]/90 transition-all"
                >
                    <RefreshCcw className="w-5 h-5" />
                    Try Again
                </button>
            </div>
        );
    }

    if (isLoading && tickets.length === 0) {
        return <DashboardSkeleton />;
    }

    const statusData = [
        { label: 'Open', value: liveStats.open, color: 'hsl(var(--slate-400))' },
        { label: 'In Progress', value: liveStats.inProgress, color: 'hsl(var(--chart-1))' },
        { label: 'Waiting', value: liveStats.waitingVendor, color: 'hsl(var(--chart-3))' },
        { label: 'Resolved', value: liveStats.resolved, color: 'hsl(var(--success-500))' },
    ];

    const priorityData = [
        { label: 'Critical', value: liveStats.byPriority.CRITICAL, color: 'hsl(var(--error-500))' },
        { label: 'High', value: liveStats.byPriority.HIGH, color: 'hsl(var(--chart-3))' },
        { label: 'Medium', value: liveStats.byPriority.MEDIUM, color: 'hsl(var(--chart-4))' },
        { label: 'Low', value: liveStats.byPriority.LOW, color: 'hsl(var(--slate-400))' },
    ];

    const categoryColors = [
        'bg-[hsl(var(--chart-1))]',
        'bg-[hsl(var(--chart-2))]',
        'bg-[hsl(var(--chart-3))]',
        'bg-[hsl(var(--chart-4))]',
        'bg-[hsl(var(--chart-5))]',
        'bg-[hsl(var(--primary))]',
        'bg-[hsl(var(--success-500))]',
        'bg-[hsl(var(--error-500))]'
    ];

    return (
        <div className="min-h-0 h-auto lg:h-[calc(100vh-2rem)] flex flex-col gap-6 animate-fade-in-up overflow-y-auto custom-scrollbar -m-2 p-2 pb-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">iDesk performance overview</p>
                        {lastUpdated && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-700 pl-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success-500))] animate-pulse"></span>
                                Updated {lastUpdated}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm"
                        title="Refresh dashboard"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Create Ticket
                    </button>
                    <button
                        onClick={() => navigate('/tickets/list')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all shadow-sm"
                    >
                        <ListTodo className="w-4 h-4" />
                        My Tasks
                    </button>
                </div>
            </div>

            {/* Asymmetric 2-Row Grid */}
            <div className="flex flex-col gap-6">
                
                {/* Row 1: Summary Stats (3 large + 3 compact) */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 stagger-1">
                    {/* 3 Large Stat Panels */}
                    <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            title="Total Tickets"
                            value={liveStats.total}
                            subtitle={`${liveStats.thisWeekTickets} this week`}
                            trend={liveStats.trends.thisWeek}
                            onClick={() => navigate('/tickets/list')}
                            sparklineData={liveStats.last7Days.map(d => d.created)}
                        />
                        <StatCard
                            title="Open & Active"
                            value={liveStats.open + liveStats.inProgress}
                            subtitle={`${liveStats.todayTickets} new today`}
                            trend={liveStats.todayTickets > 0 ? 'up' : null}
                            onClick={() => navigate('/tickets/list?status=TODO,IN_PROGRESS')}
                            highlight={liveStats.open + liveStats.inProgress > 10}
                            sparklineData={liveStats.last7Days.map(d => Math.max(0, d.created - d.resolved))}
                        />
                        <StatCard
                            title="Resolved"
                            value={liveStats.resolved}
                            subtitle={`${liveStats.resolvedToday} resolved today`}
                            trend={liveStats.trends.resolved}
                            onClick={() => navigate('/tickets/list?status=RESOLVED')}
                            sparklineData={liveStats.last7Days.map(d => d.resolved)}
                        />
                    </div>
                    
                    {/* 3 Compact Panels (Overdue, AvgRes, SLA) */}
                    <div className="xl:col-span-1 flex flex-col gap-4">
                        <div className="flex-1 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all group" onClick={() => navigate('/tickets/list?overdue=true')}>
                            <div className="flex items-center gap-3">
                                <div className={cn("p-2 rounded-lg transition-colors", liveStats.overdue > 0 ? "bg-[hsl(var(--error-50))] text-[hsl(var(--error-500))] group-hover:bg-[hsl(var(--error-100))]" : "bg-slate-50 dark:bg-slate-800 text-slate-500")}>
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue</p>
                                    <p className={cn("text-xl font-bold leading-none mt-0.5", liveStats.overdue > 0 ? "text-[hsl(var(--error-500))]" : "text-slate-900 dark:text-white")}>{liveStats.overdue}</p>
                                </div>
                            </div>
                            {liveStats.overdue > 0 && <span className="text-[10px] font-bold text-[hsl(var(--error-500))] bg-[hsl(var(--error-50))] dark:bg-[hsl(var(--error-500))]/10 px-2 py-0.5 rounded-md">Action Req</span>}
                        </div>
                        
                        <div className="flex-1 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[hsl(var(--primary))]/10 text-primary">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Res Time</p>
                                    <p className="text-xl font-bold leading-none mt-0.5 text-slate-900 dark:text-white">{stats?.avgResolutionTime || '-'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 flex flex-col justify-center gap-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> SLA</p>
                                <span className="font-bold text-sm text-slate-900 dark:text-white">{liveStats.slaCompliance}%</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-[hsl(var(--success-500))] rounded-full transition-all" style={{ width: `${liveStats.slaCompliance}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Row 2: Charts and Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-2">
                    {/* Left Column: Weekly Activity Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 flex flex-col min-h-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    Activity Overview
                                    <span className="live-indicator ml-2" title="Live data" />
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tickets created vs resolved (last {chartDateRange} days)</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs ml-auto">
                                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500"></span> Created
                                </span>
                                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                                    <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(var(--success-500))]"></span> Resolved
                                </span>
                            </div>
                            <div className="flex items-center w-full sm:w-auto">
                                {/* Date Range Picker */}
                                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 border border-[hsl(var(--border))] rounded-lg">
                                    {( [7, 14, 30] as const ).map(days => (
                                        <button
                                            key={days}
                                            onClick={() => setChartDateRange(days)}
                                            className={cn(
                                                "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                                chartDateRange === days
                                                    ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                            )}
                                        >
                                            {days}d
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 mt-auto">
                           <MiniBarChart data={liveStats.last7Days} />
                        </div>
                    </div>

                    {/* Right Column: Ticket Breakdown/Donut */}
                    <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden flex flex-col min-h-0">
                        <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 border-b border-[hsl(var(--border))] shrink-0">
                            {(['status', 'priority', 'category'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setBreakdownTab(t)}
                                    className={cn(
                                        "flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg transition-all duration-300 capitalize",
                                        breakdownTab === t
                                            ? "bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                                            : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col justify-center">
                            {breakdownTab === 'status' && (
                                <div className="flex items-center gap-6 h-full justify-center">
                                    <DonutChart data={statusData} />
                                    <div className="space-y-2 flex-1 max-w-[150px]">
                                        {statusData.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 truncate font-medium">
                                                    <span className="w-2h h-2.5 rounded shrink-0" style={{ backgroundColor: d.color }}></span>
                                                    {d.label}
                                                </span>
                                                <span className="font-bold text-xs text-slate-900 dark:text-white shrink-0 ml-2">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {breakdownTab === 'priority' && (
                                <div className="flex items-center gap-6 h-full justify-center">
                                    <DonutChart data={priorityData} />
                                    <div className="space-y-2 flex-1 max-w-[150px]">
                                        {priorityData.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 truncate font-medium">
                                                    <span className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: d.color }}></span>
                                                    {d.label}
                                                </span>
                                                <span className="font-bold text-xs text-slate-900 dark:text-white shrink-0 ml-2">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {breakdownTab === 'category' && (
                                <div className="space-y-3">
                                    {Object.entries(liveStats.byCategory)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([cat, count], index) => {
                                            const maxCount = Math.max(...Object.values(liveStats.byCategory), 1);
                                            const percentage = (count / maxCount) * 100;
                                            return (
                                                <div
                                                    key={cat}
                                                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                                                    onClick={() => navigate(`/tickets/list?category=${cat}`)}
                                                >
                                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                                        <span className="text-slate-600 dark:text-slate-300 font-medium group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
                                                            {cat.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${categoryColors[index % categoryColors.length]} transition-all`}
                                                            style={{ width: `${Math.max(percentage, 8)}%` }}
                                                        />
                                                        <span className="absolute inset-y-0 right-1.5 flex items-center text-[9px] font-bold text-slate-700 dark:text-white">
                                                            {count}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Row 3: Activity Feed & Top Agents */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 stagger-3">
                    {/* Live Activity Feed */}
                    <div className="lg:col-span-2 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl flex flex-col items-stretch overflow-hidden min-h-0">
                        <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 border-b border-[hsl(var(--border))] shrink-0">
                            <button
                                onClick={() => setDashboardTab('live')}
                                className={cn(
                                    "flex-1 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all duration-300",
                                    dashboardTab === 'live'
                                        ? "bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                Live Activity
                            </button>
                            <button
                                onClick={() => setDashboardTab('recent')}
                                className={cn(
                                    "flex-1 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all duration-300",
                                    dashboardTab === 'recent'
                                        ? "bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600"
                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                )}
                            >
                                Recent Tickets
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {dashboardTab === 'live' ? (
                                <ActivityFeed
                                    className="!bg-transparent !border-0 rounded-none"
                                    activities={liveStats.recentTickets.slice(0, 10).map((ticket: any) => ({
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
                                    maxItems={10}
                                    onActivityClick={(activity) => navigate(`/tickets/${activity.ticket?.id}`)}
                                />
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800/50 p-2">
                                    {liveStats.recentTickets.length > 0 ? liveStats.recentTickets.slice(0, 8).map((ticket: any) => (
                                        <div
                                            key={ticket.id}
                                            onClick={() => navigate(`/tickets/${ticket.id}`)}
                                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors rounded-xl mb-1 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                        >
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <PriorityDot priority={ticket.priority} />
                                                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-medium">#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                                    </div>
                                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate mb-0.5">{ticket.title}</h4>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {ticket.user?.fullName}
                                                    </p>
                                                </div>
                                                <StatusBadge status={ticket.status} />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                <ListTodo className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No recent tickets</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Agents */}
                    <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-6 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-5 shrink-0">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary" />
                                Top Agents
                            </h3>
                            <button
                                onClick={() => navigate('/agents')}
                                className="text-xs text-primary font-semibold flex items-center gap-1 hover:text-primary/80 transition-colors"
                            >
                                View All <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 -mx-2 px-2">
                            {liveStats.topAgents.length > 0 ? liveStats.topAgents.map((agent, i) => (
                                <div key={i} className="flex items-center gap-4 leaderboard-item p-2 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className={cn(
                                        "avatar-status-ring shrink-0 w-8 h-8",
                                        agent.inProgress > 0 ? "online" : "offline"
                                    )}>
                                        <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                            {agent.name.charAt(0)}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{agent.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            <span className="text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-500))] font-semibold">{agent.resolved}</span> res • <span className="text-blue-600 dark:text-blue-400 font-semibold">{agent.inProgress}</span> prog
                                        </p>
                                    </div>
                                    {i === 0 && <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"><Trophy className="w-4 h-4 text-amber-600 dark:text-amber-500" /></div>}
                                    {i === 1 && <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0"><Medal className="w-4 h-4 text-slate-500 dark:text-slate-400" /></div>}
                                    {i === 2 && <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0"><Medal className="w-4 h-4 text-orange-700 dark:text-orange-500" /></div>}
                                </div>
                            )) : (
                                <div className="py-8 flex flex-col items-center justify-center text-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                        <Users className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No agent data</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
