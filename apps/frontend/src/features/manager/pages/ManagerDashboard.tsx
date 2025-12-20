import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Manager Dashboard</h1>
                    <p className="text-muted-foreground">Overview semua site</p>
                </div>
                <div className="flex items-center gap-3">
                    <SiteSelector
                        selectedSiteIds={selectedSites}
                        onSelectionChange={setSelectedSites}
                        mode="multi"
                    />
                    <Button variant="outline" onClick={fetchDashboard}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.totalTickets || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            +{stats?.ticketsToday || 0} hari ini
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.openTickets?.total || 0}</div>
                        <div className="flex gap-2 mt-1">
                            {stats?.openTickets?.bySite && Object.entries(stats.openTickets.bySite).map(([code, count]) => (
                                <Badge key={code} style={{ backgroundColor: SITE_COLORS[code] }}>
                                    {code}: {count}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">Critical</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats?.criticalTickets || 0}</div>
                        <p className="text-xs text-red-500">
                            Butuh perhatian segera
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-orange-200 dark:border-orange-900">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-orange-600">SLA Breach</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{stats?.slaBreach || 0}</div>
                        <p className="text-xs text-orange-500">
                            Sudah melewati target SLA
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
                {/* Site Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Distribusi per Site
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats?.siteStats || []}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="siteCode" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="openTickets" name="Open" fill="#3b82f6" />
                                <Bar dataKey="criticalTickets" name="Critical" fill="#ef4444" />
                                <Bar dataKey="resolvedTickets" name="Resolved" fill="#22c55e" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Trend Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Trend 7 Hari Terakhir
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={getTrendChartData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {stats?.siteStats?.map(site => (
                                    <Line
                                        key={site.siteCode}
                                        type="monotone"
                                        dataKey={`${site.siteCode}_created`}
                                        name={`${site.siteCode} Created`}
                                        stroke={SITE_COLORS[site.siteCode]}
                                        strokeWidth={2}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-2 gap-6">
                {/* Top Agents */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Top Agents
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Site</TableHead>
                                    <TableHead className="text-center">Open</TableHead>
                                    <TableHead className="text-center">Resolved</TableHead>
                                    <TableHead className="text-right">Avg Hours</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats?.topAgents?.slice(0, 5).map((agent) => (
                                    <TableRow key={agent.agentId}>
                                        <TableCell className="font-medium">{agent.agentName}</TableCell>
                                        <TableCell>
                                            <Badge style={{ backgroundColor: SITE_COLORS[agent.siteCode] }}>
                                                {agent.siteCode}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">{agent.openTickets}</TableCell>
                                        <TableCell className="text-center font-medium text-green-600">
                                            {agent.resolvedToday}
                                        </TableCell>
                                        <TableCell className="text-right">{agent.avgResolutionHours}h</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Recent Critical */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Recent Critical Tickets
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ticket</TableHead>
                                    <TableHead>Site</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats?.recentCritical?.slice(0, 5).map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{ticket.ticketNumber}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                    {ticket.title}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge style={{ backgroundColor: SITE_COLORS[ticket.site?.code || ''] }}>
                                                {ticket.site?.code || 'N/A'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(ticket.createdAt), {
                                                addSuffix: true,
                                                locale: idLocale,
                                            })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ManagerDashboard;
