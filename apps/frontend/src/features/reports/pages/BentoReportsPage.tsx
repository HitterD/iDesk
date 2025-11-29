import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileSpreadsheet, BarChart3, Clock, AlertCircle,
    Users, FileText, Calendar, TrendingUp, Target, CheckCircle,
    Loader2, ChevronDown
} from 'lucide-react';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { DATE_PRESETS, getDefaultDateRange } from '@/lib/constants/date-presets';
import { cn } from '@/lib/utils';

// Types
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

type ReportTab = 'monthly' | 'agent' | 'volume';

// Reusable Report Card Component
const ReportCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subtext?: string;
}> = ({ title, value, icon: Icon, color, subtext }) => (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all duration-300 group">
        <div className="flex justify-between items-start mb-4">
            <div className={cn("p-3 rounded-2xl text-white group-hover:scale-110 transition-transform duration-300 shadow-lg", color)}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
        <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1 ml-1">{title}</h3>
        <p className="text-3xl font-bold text-slate-800 dark:text-white ml-1">{value}</p>
        {subtext && <p className="text-xs text-slate-400 mt-2 ml-1 font-medium">{subtext}</p>}
    </div>
);

// Loading Skeleton
const ReportSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 animate-pulse">
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl mb-4" />
                <div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
        ))}
    </div>
);

// Date Range Picker with Presets
const DateRangePicker: React.FC<{
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
    const [showPresets, setShowPresets] = useState(false);

    const handlePresetSelect = (preset: typeof DATE_PRESETS[0]) => {
        const { startDate: start, endDate: end } = preset.getValue();
        onStartDateChange(start);
        onEndDateChange(end);
        setShowPresets(false);
    };

    return (
        <div className="flex flex-wrap gap-4 items-center">
            <div className="relative">
                <button
                    onClick={() => setShowPresets(!showPresets)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                    Quick Select
                    <ChevronDown className="w-4 h-4" />
                </button>
                {showPresets && (
                    <div className="absolute top-full mt-2 left-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2 min-w-[160px]">
                        {DATE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetSelect(preset)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">From:</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">To:</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200"
                />
            </div>
        </div>
    );
};

export const BentoReportsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ReportTab>('monthly');
    const [month, setMonth] = useState<string>((new Date().getMonth() + 1).toString());
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    
    const defaultDateRange = useMemo(() => getDefaultDateRange(), []);
    const [startDate, setStartDate] = useState<string>(defaultDateRange.startDate);
    const [endDate, setEndDate] = useState<string>(defaultDateRange.endDate);
    const [exporting, setExporting] = useState(false);

    // Monthly Stats Query
    const {
        data: monthlyStats,
        isLoading: monthlyLoading,
        error: monthlyError,
    } = useQuery<MonthlyStats>({
        queryKey: ['reports', 'monthly', month, year],
        queryFn: async () => {
            const response = await api.get(`/reports/monthly?month=${month}&year=${year}`);
            return response.data;
        },
        enabled: activeTab === 'monthly',
        staleTime: 60000, // 1 minute
        retry: 2,
    });

    // Agent Performance Query
    const {
        data: agentMetricsData,
        isLoading: agentLoading,
        error: agentError,
    } = useQuery<{ data: AgentMetrics[] }>({
        queryKey: ['reports', 'agent-performance', startDate, endDate],
        queryFn: async () => {
            const response = await api.get(`/reports/agent-performance?startDate=${startDate}&endDate=${endDate}`);
            return response.data;
        },
        enabled: activeTab === 'agent',
        staleTime: 60000,
        retry: 2,
    });

    const agentMetrics = agentMetricsData?.data || [];

    // Ticket Volume Query
    const {
        data: volumeDataResponse,
        isLoading: volumeLoading,
        error: volumeError,
    } = useQuery<{ data: TicketVolumeData }>({
        queryKey: ['reports', 'ticket-volume', startDate, endDate],
        queryFn: async () => {
            const response = await api.get(`/reports/ticket-volume?startDate=${startDate}&endDate=${endDate}`);
            return response.data;
        },
        enabled: activeTab === 'volume',
        staleTime: 60000,
        retry: 2,
    });

    const volumeData = volumeDataResponse?.data || null;

    // Download handler with proper error handling
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
            window.URL.revokeObjectURL(blobUrl);
            toast.success('Report downloaded successfully');
        } catch (error) {
            logger.error('Failed to download report:', error);
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

    // Show error if any query failed
    const currentError = activeTab === 'monthly' ? monthlyError : activeTab === 'agent' ? agentError : volumeError;
    if (currentError) {
        logger.error('Report fetch error:', currentError);
    }

    const tabs = [
        { id: 'monthly' as ReportTab, label: 'Monthly Summary', icon: Calendar },
        { id: 'agent' as ReportTab, label: 'Agent Performance', icon: Users },
        { id: 'volume' as ReportTab, label: 'Ticket Volume', icon: BarChart3 },
    ];

    const loading = activeTab === 'monthly' ? monthlyLoading : activeTab === 'agent' ? agentLoading : volumeLoading;

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
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        )}
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
                            disabled={exporting || monthlyLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            Excel
                        </button>
                        <button
                            onClick={handleExportMonthlyPDF}
                            disabled={exporting || monthlyLoading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            PDF
                        </button>
                    </div>

                    {monthlyLoading ? (
                        <ReportSkeleton />
                    ) : monthlyStats ? (
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
                    ) : (
                        <div className="text-center py-12 text-slate-500">No data available for selected period</div>
                    )}
                </div>
            )}

            {/* Agent Performance Tab */}
            {activeTab === 'agent' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={setStartDate}
                            onEndDateChange={setEndDate}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportAgentPDF}
                                disabled={exporting || agentLoading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                Export PDF
                            </button>
                            <button
                                onClick={handleExportCustomExcel}
                                disabled={exporting || agentLoading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                Export Excel
                            </button>
                        </div>
                    </div>

                    {agentLoading ? (
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
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full text-xs font-medium",
                                                    agent.resolutionRate >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    agent.resolutionRate >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                )}>
                                                    {agent.resolutionRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">{agent.avgResponseTimeMinutes}m</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full text-xs font-medium",
                                                    agent.slaComplianceRate >= 90 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    agent.slaComplianceRate >= 70 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                )}>
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
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={setStartDate}
                            onEndDateChange={setEndDate}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportVolumePDF}
                                disabled={exporting || volumeLoading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                Export PDF
                            </button>
                            <button
                                onClick={handleExportCustomExcel}
                                disabled={exporting || volumeLoading}
                                className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                Export Excel
                            </button>
                        </div>
                    </div>

                    {volumeLoading ? (
                        <ReportSkeleton />
                    ) : volumeData ? (
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
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-medium",
                                                    priority === 'CRITICAL' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                    priority === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                )}>
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
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-medium",
                                                    status === 'RESOLVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    status === 'TODO' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                )}>
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
                    ) : (
                        <div className="text-center py-12 text-slate-500">No data available for selected period</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BentoReportsPage;
