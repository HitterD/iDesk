import { useState, useEffect } from 'react';
import {
    Download, FileSpreadsheet, BarChart3, Clock, AlertCircle,
    Users, FileText, Calendar, TrendingUp, Target, CheckCircle,
    Loader2
} from 'lucide-react';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface MonthlyStats {
    month: number;
    year: number;
    totalTickets: number;
    resolvedTickets: number;
    openTickets: number;
    avgResolutionTimeHours: string;
}

interface AgentMetrics {
    agentId: string;
    agentName: string;
    totalAssigned: number;
    totalResolved: number;
    resolutionRate: number;
    avgResponseTimeMinutes: number;
    avgResolutionTimeMinutes: number;
    slaComplianceRate: number;
}

interface TicketVolumeData {
    daily: { date: string; created: number; resolved: number; pending: number }[];
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    summary: {
        totalCreated: number;
        totalResolved: number;
        totalPending: number;
        avgPerDay: number;
        peakDay: string;
        peakCount: number;
    };
}

const ReportCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} text-white group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
        <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 ml-1">{title}</h3>
        <p className="text-3xl font-bold text-slate-800 dark:text-white ml-1">{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-2 ml-1 font-medium">{subtext}</p>}
    </div>
);

type ReportTab = 'monthly' | 'agent' | 'volume';

export const BentoReportsPage = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('monthly');
    const [month, setMonth] = useState<string>(new Date().getMonth() + 1 + '');
    const [year, setYear] = useState<string>(new Date().getFullYear() + '');
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
    const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([]);
    const [volumeData, setVolumeData] = useState<TicketVolumeData | null>(null);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    // Fetch Monthly Stats
    const fetchMonthlyStats = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/reports/monthly?month=${month}&year=${year}`);
            setMonthlyStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            toast.error('Failed to fetch monthly statistics');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Agent Performance
    const fetchAgentPerformance = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/reports/agent-performance?startDate=${startDate}&endDate=${endDate}`);
            setAgentMetrics(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch agent performance:', error);
            toast.error('Failed to fetch agent performance data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch Ticket Volume
    const fetchTicketVolume = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/reports/ticket-volume?startDate=${startDate}&endDate=${endDate}`);
            setVolumeData(response.data.data || null);
        } catch (error) {
            console.error('Failed to fetch ticket volume:', error);
            toast.error('Failed to fetch ticket volume data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'monthly') fetchMonthlyStats();
        else if (activeTab === 'agent') fetchAgentPerformance();
        else if (activeTab === 'volume') fetchTicketVolume();
    }, [activeTab, month, year, startDate, endDate]);

    // Download handlers
    const downloadFile = async (url: string, filename: string) => {
        setExporting(true);
        try {
            const response = await api.get(url, { responseType: 'blob' });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report downloaded successfully');
        } catch (error) {
            console.error('Failed to download report:', error);
            toast.error('Failed to download report');
        } finally {
            setExporting(false);
        }
    };

    const handleExportMonthlyExcel = () => {
        downloadFile(`/reports/export/excel?month=${month}&year=${year}`, `monthly-report-${month}-${year}.xlsx`);
    };

    const handleExportMonthlyPDF = () => {
        downloadFile(`/reports/export/pdf/monthly?month=${month}&year=${year}`, `monthly-report-${month}-${year}.pdf`);
    };

    const handleExportAgentPDF = () => {
        downloadFile(`/reports/export/pdf/agent-performance?startDate=${startDate}&endDate=${endDate}`, `agent-performance-${startDate}-to-${endDate}.pdf`);
    };

    const handleExportVolumePDF = () => {
        downloadFile(`/reports/export/pdf/ticket-volume?startDate=${startDate}&endDate=${endDate}`, `ticket-volume-${startDate}-to-${endDate}.pdf`);
    };

    const handleExportCustomExcel = () => {
        downloadFile(`/reports/export/excel/custom?startDate=${startDate}&endDate=${endDate}`, `comprehensive-report-${startDate}-to-${endDate}.xlsx`);
    };

    const tabs = [
        { id: 'monthly' as ReportTab, label: 'Monthly Summary', icon: Calendar },
        { id: 'agent' as ReportTab, label: 'Agent Performance', icon: Users },
        { id: 'volume' as ReportTab, label: 'Ticket Volume', icon: BarChart3 },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Reports & Analytics</h1>
                    <p className="text-slate-500 dark:text-slate-400">Analyze performance, track metrics, and export data</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Monthly Summary Tab */}
            {activeTab === 'monthly' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="w-[140px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                    <SelectItem key={m} value={m.toString()}>
                                        {new Date(0, m - 1).toLocaleString('en-US', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="w-[100px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 rounded-xl">
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                            </SelectContent>
                        </Select>
                        <button
                            onClick={handleExportMonthlyExcel}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            Excel
                        </button>
                        <button
                            onClick={handleExportMonthlyPDF}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            PDF
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : monthlyStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <ReportCard title="Total Tickets" value={monthlyStats.totalTickets} icon={FileSpreadsheet} color="bg-blue-500" />
                            <ReportCard
                                title="Resolved"
                                value={monthlyStats.resolvedTickets}
                                icon={CheckCircle}
                                color="bg-green-500"
                                subtext={`${monthlyStats.totalTickets > 0 ? ((monthlyStats.resolvedTickets / monthlyStats.totalTickets) * 100).toFixed(1) : 0}% Resolution Rate`}
                            />
                            <ReportCard title="Open Tickets" value={monthlyStats.openTickets} icon={AlertCircle} color="bg-orange-500" />
                            <ReportCard title="Avg Resolution Time" value={`${monthlyStats.avgResolutionTimeHours}h`} icon={Clock} color="bg-purple-500" />
                        </div>
                    )}
                </div>
            )}

            {/* Agent Performance Tab */}
            {activeTab === 'agent' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <button
                            onClick={handleExportAgentPDF}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Export PDF
                        </button>
                        <button
                            onClick={handleExportCustomExcel}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            Export Excel
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Agent</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Assigned</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Resolved</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Resolution %</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Avg Response</th>
                                        <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">SLA %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {agentMetrics.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                No agent data found for this period
                                            </td>
                                        </tr>
                                    ) : agentMetrics.map((agent) => (
                                        <tr key={agent.agentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{agent.agentName}</td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">{agent.totalAssigned}</td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">{agent.totalResolved}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${agent.resolutionRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        agent.resolutionRate >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {agent.resolutionRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">{agent.avgResponseTimeMinutes}m</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${agent.slaComplianceRate >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        agent.slaComplianceRate >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                    {agent.slaComplianceRate.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Ticket Volume Tab */}
            {activeTab === 'volume' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">From:</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">To:</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <button
                            onClick={handleExportVolumePDF}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Export PDF
                        </button>
                        <button
                            onClick={handleExportCustomExcel}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            Export Excel
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : volumeData && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <ReportCard title="Total Created" value={volumeData.summary.totalCreated} icon={TrendingUp} color="bg-blue-500" />
                                <ReportCard title="Total Resolved" value={volumeData.summary.totalResolved} icon={CheckCircle} color="bg-green-500" />
                                <ReportCard title="Pending" value={volumeData.summary.totalPending} icon={AlertCircle} color="bg-orange-500" />
                                <ReportCard
                                    title="Peak Day"
                                    value={volumeData.summary.peakCount}
                                    icon={Target}
                                    color="bg-purple-500"
                                    subtext={volumeData.summary.peakDay || 'N/A'}
                                />
                            </div>

                            {/* By Priority & Status */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">By Priority</h3>
                                    <div className="space-y-3">
                                        {Object.entries(volumeData.byPriority).map(([priority, count]) => (
                                            <div key={priority} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${priority === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        priority === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                            priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                                'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    }`}>
                                                    {priority}
                                                </span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">By Status</h3>
                                    <div className="space-y-3">
                                        {Object.entries(volumeData.byStatus).map(([status, count]) => (
                                            <div key={status} className="flex items-center justify-between">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${status === 'RESOLVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            status === 'TODO' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
                                                    {status.replace('_', ' ')}
                                                </span>
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">{count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Daily Volume Table */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Daily Volume</h3>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Date</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Created</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Resolved</th>
                                                <th className="px-6 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">Pending</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {volumeData.daily.map((day) => (
                                                <tr key={day.date} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-6 py-3 text-slate-800 dark:text-white">{day.date}</td>
                                                    <td className="px-6 py-3 text-center text-blue-600 dark:text-blue-400 font-medium">{day.created}</td>
                                                    <td className="px-6 py-3 text-center text-green-600 dark:text-green-400 font-medium">{day.resolved}</td>
                                                    <td className="px-6 py-3 text-center text-orange-600 dark:text-orange-400 font-medium">{day.pending}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
