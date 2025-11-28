import React, { useCallback } from 'react';
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
    CircleDot
} from 'lucide-react';
import api from '../../../lib/api';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useAuth } from '@/stores/useAuth';
import { toast } from 'sonner';
import { DashboardSkeleton } from '../components/DashboardSkeleton';

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

// Simple Bar Chart Component
const MiniBarChart: React.FC<{ data: { date: string; created: number; resolved: number }[] }> = ({ data }) => {
    const maxValue = Math.max(...data.flatMap(d => [d.created, d.resolved]), 1);

    return (
        <div className="flex items-end gap-2 h-32">
            {data.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 items-end h-24">
                        <div
                            className="flex-1 bg-blue-400 rounded-t transition-all hover:bg-blue-500"
                            style={{ height: `${(day.created / maxValue) * 100}%`, minHeight: day.created > 0 ? '4px' : '0' }}
                            title={`Created: ${day.created}`}
                        />
                        <div
                            className="flex-1 bg-green-400 rounded-t transition-all hover:bg-green-500"
                            style={{ height: `${(day.resolved / maxValue) * 100}%`, minHeight: day.resolved > 0 ? '4px' : '0' }}
                            title={`Resolved: ${day.resolved}`}
                        />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{day.date}</span>
                </div>
            ))}
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
                <circle cx="50" cy="50" r="25" fill="white" className="dark:fill-slate-800" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{total}</span>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{
    title: string;
    value: number | string;
    icon: any;
    color: string;
    subtitle?: string;
    trend?: 'up' | 'down';
}> = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all group relative flex items-center gap-5">
        <div className={`p-4 rounded-2xl ${color} text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform shrink-0`}>
            <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
        </div>
        {trend && (
            <div className="absolute top-4 right-4">
                <span className={`flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${trend === 'up' ? 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400' : 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
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

    const { data: stats, isLoading } = useQuery<DashboardStats>({
        queryKey: ['dashboard-stats'],
        queryFn: async () => {
            const res = await api.get('/tickets/dashboard/stats');
            return res.data;
        },
    });

    if (isLoading || !stats) {
        return <DashboardSkeleton />;
    }

    const statusData = [
        { label: 'Open', value: stats.open, color: '#94a3b8' },
        { label: 'In Progress', value: stats.inProgress, color: '#60a5fa' },
        { label: 'Waiting', value: stats.waitingVendor, color: '#fb923c' },
        { label: 'Resolved', value: stats.resolved, color: '#4ade80' },
    ];

    const priorityData = [
        { label: 'Critical', value: stats.byPriority.CRITICAL, color: '#ef4444' },
        { label: 'High', value: stats.byPriority.HIGH, color: '#f97316' },
        { label: 'Medium', value: stats.byPriority.MEDIUM, color: '#eab308' },
        { label: 'Low', value: stats.byPriority.LOW, color: '#94a3b8' },
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Helpdesk performance overview</p>
                </div>
                <div className="flex gap-3">
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <StatCard title="Total Tickets" value={stats.total} icon={Ticket} color="bg-blue-500" />
                <StatCard title="Open" value={stats.open} icon={CircleDot} color="bg-slate-500" />
                <StatCard title="In Progress" value={stats.inProgress} icon={Hourglass} color="bg-blue-400" />
                <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle} color="bg-green-500" />
                <StatCard title="Overdue" value={stats.overdue} icon={AlertTriangle} color="bg-red-500" />
                <StatCard title="Avg Resolution" value={stats.avgResolutionTime} icon={Clock} color="bg-purple-500" />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Charts */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Weekly Activity Chart */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    Weekly Activity
                                </h3>
                                <p className="text-sm text-slate-500">Tickets created vs resolved (last 7 days)</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded bg-blue-400"></span> Created
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded bg-green-400"></span> Resolved
                                </span>
                            </div>
                        </div>
                        <MiniBarChart data={stats.last7Days} />
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
                                            strokeDasharray={`${stats.slaCompliance * 2.51} 251`}
                                            className="text-primary"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats.slaCompliance}%</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-green-600">{stats.total - stats.overdue}</span> on time
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        <span className="font-bold text-red-600">{stats.overdue}</span> overdue
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Activity Summary */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <CalendarDays className="w-5 h-5 text-primary" />
                                Activity Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">Today</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm"><span className="font-bold text-blue-600">{stats.todayTickets}</span> new</span>
                                        <span className="text-sm"><span className="font-bold text-green-600">{stats.resolvedToday}</span> resolved</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">This Week</span>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm"><span className="font-bold text-blue-600">{stats.thisWeekTickets}</span> new</span>
                                        <span className="text-sm"><span className="font-bold text-green-600">{stats.resolvedThisWeek}</span> resolved</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-600 dark:text-slate-300">This Month</span>
                                    <span className="text-sm"><span className="font-bold text-blue-600">{stats.thisMonthTickets}</span> tickets</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status & Priority Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* By Status */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
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
                </div>

                {/* Right Column - Stats & Info */}
                <div className="space-y-6">
                    {/* Top Agents */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Top Agents
                        </h3>
                        <div className="space-y-3">
                            {stats.topAgents.length > 0 ? stats.topAgents.map((agent, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                        {agent.name.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-slate-800 dark:text-white text-sm">{agent.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {agent.resolved} resolved • {agent.inProgress} in progress
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-400 text-center py-4">No agent data</p>
                            )}
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6">
                        <h3 className="font-bold text-slate-800 dark:text-white mb-4">By Category</h3>
                        <div className="space-y-4">
                            {Object.entries(stats.byCategory).map(([cat, count], index) => (
                                <div key={cat} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600 dark:text-slate-300">{cat}</span>
                                        <span className="font-bold text-slate-800 dark:text-white">{count}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${categoryColors[index % categoryColors.length]}`}
                                            style={{ width: `${(count / Math.max(...Object.values(stats.byCategory), 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Tickets */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
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
                            {stats.recentTickets.length > 0 ? stats.recentTickets.slice(0, 5).map((ticket: any) => (
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
