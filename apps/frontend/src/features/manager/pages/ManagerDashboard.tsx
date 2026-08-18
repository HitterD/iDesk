import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend,
} from 'recharts';
import {
    Ticket,
    AlertTriangle,
    TrendingUp,
    Users,
    Building2,
    RefreshCw,
    Clock,
    AlertCircle,
} from 'lucide-react';
import { SiteSelector } from '@/components/site/SiteSelector';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DashboardStats {
    totalTickets: number;
    ticketsToday: number;
    openTickets: {
        total: number;
        bySite: Record<string, number>;
    };
    criticalTickets: number;
    slaBreach: number;
    siteStats: Array<{
        siteCode: string;
        siteName: string;
        totalTickets: number;
        openTickets: number;
        resolvedTickets: number;
        criticalTickets: number;
        slaBreach: number;
    }>;
    topAgents: Array<{
        agentId: string;
        agentName: string;
        siteCode: string;
        openTickets: number;
        resolvedToday: number;
        avgResolutionHours: number;
    }>;
    trend: Array<{
        date: string;
        siteCode: string;
        created: number;
        resolved: number;
    }>;
    recentCritical: Array<{
        id: string;
        ticketNumber: string;
        title: string;
        status: string;
        priority: string;
        createdAt: string;
        user?: { fullName: string };
        site?: { code: string };
        assignedTo?: { fullName: string };
    }>;
}

const SITE_COLORS: Record<string, string> = {
    SPJ: '#3b82f6',
    SMG: '#22c55e',
    KRW: '#f97316',
    JTB: '#8b5cf6',
};

export const ManagerDashboard = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSites, setSelectedSites] = useState<string[]>([]);

    useEffect(() => {
        fetchDashboard();
    }, [selectedSites]);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedSites.length > 0) {
                selectedSites.forEach(id => params.append('siteIds', id));
            }

            const response = await api.get(`/manager/dashboard?${params.toString()}`);
            setStats(response.data);
        } catch (err: any) {
            console.error('Failed to fetch dashboard:', err);
            const message = err.response?.data?.message || 'Gagal memuat data dashboard';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Transform trend data for chart
    const getTrendChartData = () => {
        if (!stats?.trend) return [];

        const dateMap: Record<string, any> = {};
        stats.trend.forEach(item => {
            if (!dateMap[item.date]) {
                dateMap[item.date] = { date: item.date };
            }
            dateMap[item.date][`${item.siteCode}_created`] = item.created;
            dateMap[item.date][`${item.siteCode}_resolved`] = item.resolved;
        });

        return Object.values(dateMap);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'TODO':
                return <Badge variant="outline">To Do</Badge>;
            case 'IN_PROGRESS':
                return <Badge className="bg-blue-500">In Progress</Badge>;
            case 'AWAITING':
                return <Badge className="bg-yellow-500">Awaiting</Badge>;
            case 'RESOLVED':
                return <Badge className="bg-green-500">Resolved</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Gagal Memuat Dashboard</h2>
                <p className="text-muted-foreground text-center max-w-md">{error}</p>
                <Button onClick={fetchDashboard} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Coba Lagi
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 animate-fade-in-up">
            {/* Header & Unified Action Bar */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[hsl(var(--card))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Manager Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-1">Overview semua site</p>
                </div>
                <div className="flex items-center gap-3">
                    <SiteSelector
                        selectedSiteIds={selectedSites}
                        onSelectionChange={setSelectedSites}
                        mode="multi"
                    />
                    <Button variant="outline" onClick={fetchDashboard} className="rounded-xl border-[hsl(var(--border))] bg-white dark:bg-slate-800">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Main Asymmetric Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: The Big Picture */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                    {/* 2x2 Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Tickets</CardTitle>
                                <Ticket className="h-4 w-4 text-slate-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-800 dark:text-white">{stats?.totalTickets || 0}</div>
                                <p className="text-xs text-muted-foreground mt-1">+{stats?.ticketsToday || 0} hari ini</p>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Open Tickets</CardTitle>
                                <Clock className="h-4 w-4 text-slate-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-800 dark:text-white">{stats?.openTickets?.total || 0}</div>
                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                    {stats?.openTickets?.bySite && Object.entries(stats.openTickets.bySite).map(([code, count]) => (
                                        <Badge key={code} style={{ backgroundColor: SITE_COLORS[code] }} className="text-xs px-1.5 py-0.5">
                                            {code}: {count}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl shadow-sm border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">Critical</CardTitle>
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats?.criticalTickets || 0}</div>
                                <p className="text-xs text-red-500/80 mt-1">Butuh perhatian segera</p>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl shadow-sm border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">SLA Breach</CardTitle>
                                <TrendingUp className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats?.slaBreach || 0}</div>
                                <p className="text-xs text-orange-500/80 mt-1">Sudah melewati target SLA</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trend Chart */}
                    <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <TrendingUp className="h-5 w-5 text-primary" />
                                Trend 7 Hari Terakhir
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={320}>
                                <LineChart data={getTrendChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                    {stats?.siteStats?.map(site => (
                                        <Line
                                            key={site.siteCode}
                                            type="monotone"
                                            dataKey={`${site.siteCode}_created`}
                                            name={`${site.siteCode} Created`}
                                            stroke={SITE_COLORS[site.siteCode]}
                                            strokeWidth={3}
                                            dot={{ r: 4, strokeWidth: 2 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Action Center */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
                    {/* Site Distribution */}
                    <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Building2 className="h-5 w-5 text-primary" />
                                Distribusi per Site
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={stats?.siteStats || []} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="siteCode" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                    <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', backgroundColor: 'hsl(var(--card))' }} />
                                    <Bar dataKey="openTickets" name="Open" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="criticalTickets" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Recent Critical Tickets Feed */}
                    <Card className="rounded-xl shadow-sm border-red-200 dark:border-red-900/50">
                        <CardHeader className="pb-3 border-b border-[hsl(var(--border))] bg-red-50/30 dark:bg-red-900/10 rounded-t-xl">
                            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
                                <AlertTriangle className="h-4 w-4" />
                                Recent Critical Tickets
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col">
                                {stats?.recentCritical?.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Tidak ada tiket kritis.</div>
                                ) : (
                                    stats?.recentCritical?.slice(0, 5).map((ticket) => (
                                        <div key={ticket.id} className="flex items-start gap-3 p-4 border-b border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors last:border-0">
                                            <div className="mt-1">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{ticket.ticketNumber}</span>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: idLocale })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{ticket.title}</p>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs bg-[hsl(var(--card))]">
                                                        {ticket.site?.code || 'N/A'}
                                                    </Badge>
                                                    {getStatusBadge(ticket.status)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Agents List */}
                    <Card className="rounded-xl shadow-sm border-[hsl(var(--border))]">
                        <CardHeader className="pb-3 border-b border-[hsl(var(--border))]">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Users className="h-5 w-5 text-primary" />
                                Top Agents (Resolved Today)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="flex flex-col">
                                {stats?.topAgents?.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Belum ada agen aktif hari ini.</div>
                                ) : (
                                    stats?.topAgents?.slice(0, 5).map((agent) => (
                                        <div key={agent.agentId} className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors last:border-0">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 border border-[hsl(var(--border))]">
                                                    {agent.agentName?.charAt(0) || 'A'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{agent.agentName}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge style={{ backgroundColor: SITE_COLORS[agent.siteCode] }} className="text-xs px-1 py-0 h-4">
                                                            {agent.siteCode}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">{agent.avgResolutionHours}h avg</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0 ml-2">
                                                <span className="text-lg font-bold text-green-600 dark:text-green-500">{agent.resolvedToday}</span>
                                                <span className="text-xs text-muted-foreground uppercase font-medium">Resolved</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
