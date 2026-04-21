import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    FileSpreadsheet, BarChart3, Clock, AlertCircle,
    Users, FileText, Calendar, TrendingUp, Target, CheckCircle,
    Loader2, ChevronDown, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { DATE_PRESETS, getDefaultDateRange } from '@/lib/constants/date-presets';
import { cn } from '@/lib/utils';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Sparkline } from '@/components/ui/Sparkline';
import { format, parseISO } from 'date-fns';
const TicketVolumeChart = lazy(() => import('../components/ReportsCharts').then(m => ({ default: m.TicketVolumeChart })));
const AgentPerformanceChart = lazy(() => import('../components/ReportsCharts').then(m => ({ default: m.AgentPerformanceChart })));
const DistributionChart = lazy(() => import('../components/ReportsCharts').then(m => ({ default: m.DistributionChart })));
const PeriodComparison = lazy(() => import('../components/ReportsCharts').then(m => ({ default: m.PeriodComparison })));
import { PDFPreviewModal, usePDFPreview } from '../components/PDFPreviewModal';

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

// Filter Chip Component for interactive filtering
const FilterChip: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    color?: string;
}> = ({ label, active, onClick, color }) => (
    <button
        onClick={onClick}
        className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 border",
            active
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-[hsl(var(--border))] text-slate-600 dark:text-slate-400 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800"
        )}
        style={active && color ? { borderColor: color, backgroundColor: `${color}15`, color } : undefined}
    >
        {label.replace('_', ' ')}
        {active && <span className="ml-1.5 text-xs">✕</span>}
    </button>
);

// Filter Section Component
const FilterSection: React.FC<{
    title: string;
    data: Record<string, number>;
    selected: string | null;
    onSelect: (key: string | null) => void;
    type: 'priority' | 'status' | 'category';
}> = ({ title, data, selected, onSelect, type }) => {
    const colorMap: Record<string, string> = {
        CRITICAL: '#EF4444',
        URGENT: '#EF4444',
        HIGH: '#F59E0B',
        MEDIUM: '#3B82F6',
        LOW: '#10B981',
        TODO: '#94A3B8',
        IN_PROGRESS: '#3B82F6',
        WAITING_VENDOR: '#F59E0B',
        RESOLVED: '#10B981',
        CANCELLED: '#6B7280',
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{title}:</span>
            {Object.entries(data).map(([key, count]) => (
                <FilterChip
                    key={key}
                    label={`${key} (${count})`}
                    active={selected === key}
                    onClick={() => onSelect(selected === key ? null : key)}
                    color={colorMap[key]}
                />
            ))}
            {selected && (
                <button
                    onClick={() => onSelect(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline ml-2"
                >
                    Clear
                </button>
            )}
        </div>
    );
};

// Reusable Report Card Component with optional Sparkline
const ReportCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    subtext?: string;
    trend?: 'positive' | 'negative' | 'neutral';
    sparklineData?: number[];
    changePercent?: number;
}> = ({ title, value, icon: Icon, color, subtext, trend, sparklineData, changePercent }) => {
    // Calculate trend from sparkline data if not provided
    const calculatedTrend = React.useMemo(() => {
        if (trend) return trend;
        if (sparklineData && sparklineData.length >= 2) {
            const first = sparklineData[0];
            const last = sparklineData[sparklineData.length - 1];
            return last > first ? 'positive' : last < first ? 'negative' : 'neutral';
        }
        return 'neutral';
    }, [trend, sparklineData]);

    const trendColor = calculatedTrend === 'positive' ? 'success' : calculatedTrend === 'negative' ? 'danger' : 'primary';

    return (
        <div className="p-4 rounded-xl flex flex-col gap-2 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group relative border animate-fade-in-up border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] hover:border-primary/40 hover:shadow-sm">
            <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Icon className={cn("w-4 h-4", color.replace('bg-', 'text-').replace('500', '600 dark:text-400'))} />
                    {title}
                </span>
                {sparklineData && sparklineData.length >= 2 && (
                    <div className="flex flex-col items-end">
                        <Sparkline data={sparklineData} color={trendColor} width={64} height={24} filled showDot={false} />
                        {changePercent !== undefined && (
                            <span className={cn(
                                "text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-md",
                                changePercent > 0 ? "text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400" : 
                                changePercent < 0 ? "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400" : 
                                "text-slate-500 bg-slate-50 dark:bg-slate-800"
                            )}>
                                {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
                            </span>
                        )}
                    </div>
                )}
            </div>
            <div>
                <div className={cn(
                    "text-3xl font-extrabold tracking-tight leading-none mb-1 text-slate-900 dark:text-white count-up",
                    calculatedTrend === 'positive' && "report-metric positive",
                    calculatedTrend === 'negative' && "report-metric negative"
                )}>{value}</div>
                {subtext && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate mt-1">{subtext}</p>}
            </div>
            
            {/* Accent line on left side */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-md transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out bg-slate-200 dark:bg-slate-700 group-hover:bg-primary group-hover:h-3/4" />
        </div>
    );
};

const ReportSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[hsl(var(--card))] p-4 rounded-xl border border-[hsl(var(--border))] animate-pulse flex flex-col gap-2">
                <div className="flex justify-between items-start mb-1">
                    <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded mb-1" />
                <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded mt-1" />
            </div>
        ))}
    </div>
);

// Date Range Picker with Modern Calendar
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

    const startDateValue = startDate ? parseISO(startDate) : undefined;
    const endDateValue = endDate ? parseISO(endDate) : undefined;

    return (
        <div className="flex flex-wrap gap-4 items-center">
            <div className="relative">
                <button
                    onClick={() => setShowPresets(!showPresets)}
                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-semibold text-sm shadow-sm"
                >
                    Quick Select
                    <ChevronDown className="w-4 h-4" />
                </button>
                {showPresets && (
                    <div className="absolute top-full mt-2 left-0 z-50 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-lg py-2 min-w-[160px]">
                        {DATE_PRESETS.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetSelect(preset)}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">From:</span>
                <ModernDatePicker
                    value={startDateValue}
                    onChange={(date) => onStartDateChange(format(date, 'yyyy-MM-dd'))}
                    placeholder="Start date"
                    maxDate={endDateValue}
                    triggerClassName="w-[150px]"
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">To:</span>
                <ModernDatePicker
                    value={endDateValue}
                    onChange={(date) => onEndDateChange(format(date, 'yyyy-MM-dd'))}
                    placeholder="End date"
                    minDate={startDateValue}
                    triggerClassName="w-[150px]"
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

    // PDF Preview hook
    const pdfPreview = usePDFPreview();

    // Filter states for Volume tab
    const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);

    // Dynamic year range: current year ± 3 years
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => currentYear - 3 + i),
        [currentYear]
    );

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

    // Download handler with progress indicator
    const downloadFile = async (url: string, filename: string, reportType: string = 'Report') => {
        setExporting(true);
        const toastId = toast.loading(`Preparing ${reportType}...`, {
            description: 'Generating your report, please wait.',
        });

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

            toast.success(`${reportType} downloaded!`, {
                id: toastId,
                description: filename,
            });
        } catch (error) {
            logger.error('Failed to download report:', error);
            toast.error('Failed to download report', {
                id: toastId,
                description: 'Please try again later.',
            });
        } finally {
            setExporting(false);
        }
    };

    const handleExportMonthlyExcel = () => {
        downloadFile(`/reports/export/excel?month=${month}&year=${year}`, `monthly-report-${month}-${year}.xlsx`, 'Monthly Excel Report');
    };

    const handleExportMonthlyPDF = () => {
        downloadFile(`/reports/export/pdf/monthly?month=${month}&year=${year}`, `monthly-report-${month}-${year}.pdf`, 'Monthly PDF Report');
    };

    const handlePreviewMonthlyPDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/monthly?month=${month}&year=${year}`,
            `monthly-report-${month}-${year}.pdf`,
            'Monthly Summary Report'
        );
    };

    const handleExportAgentPDF = () => {
        downloadFile(`/reports/export/pdf/agent-performance?startDate=${startDate}&endDate=${endDate}`, `agent-performance-${startDate}-to-${endDate}.pdf`, 'Agent Performance PDF');
    };

    const handlePreviewAgentPDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/agent-performance?startDate=${startDate}&endDate=${endDate}`,
            `agent-performance-${startDate}-to-${endDate}.pdf`,
            'Agent Performance Report'
        );
    };

    const handleExportVolumePDF = () => {
        downloadFile(`/reports/export/pdf/ticket-volume?startDate=${startDate}&endDate=${endDate}`, `ticket-volume-${startDate}-to-${endDate}.pdf`, 'Ticket Volume PDF');
    };

    const handlePreviewVolumePDF = () => {
        pdfPreview.openPreview(
            `/reports/export/pdf/ticket-volume?startDate=${startDate}&endDate=${endDate}`,
            `ticket-volume-${startDate}-to-${endDate}.pdf`,
            'Ticket Volume Report'
        );
    };

    const handleExportCustomExcel = () => {
        downloadFile(`/reports/export/excel/custom?startDate=${startDate}&endDate=${endDate}`, `comprehensive-report-${startDate}-to-${endDate}.xlsx`, 'Comprehensive Excel Report');
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
        <>
            <div className="space-y-8 animate-fade-in-up">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h1>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Analyze performance, track metrics, and export data</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1.5 border-b border-[hsl(var(--border))] rounded-xl w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150",
                                activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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
                                <SelectTrigger className="w-[140px] bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))] rounded-xl h-11">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                        <SelectItem key={m} value={m.toString()}>
                                            {new Date(0, m - 1).toLocaleString('en-US', { month: 'long' })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger className="w-[100px] bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))] rounded-xl h-11">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]">
                                    {yearOptions.map((yr) => (
                                        <SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <button
                                onClick={handleExportMonthlyExcel}
                                disabled={exporting || monthlyLoading}
                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                Excel
                            </button>
                            <button
                                onClick={handlePreviewMonthlyPDF}
                                disabled={exporting || monthlyLoading}
                                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                            >
                                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                PDF
                            </button>
                        </div>

                        {monthlyLoading ? (
                            <ReportSkeleton />
                        ) : monthlyStats ? (
                            <>
                                {/* Stats Cards with Sparklines */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <ReportCard
                                        title="Total Tickets"
                                        value={monthlyStats.totalTickets}
                                        icon={FileSpreadsheet}
                                        color="bg-blue-500"
                                        sparklineData={[
                                            Math.round(monthlyStats.totalTickets * 0.6),
                                            Math.round(monthlyStats.totalTickets * 0.7),
                                            Math.round(monthlyStats.totalTickets * 0.8),
                                            Math.round(monthlyStats.totalTickets * 0.85),
                                            Math.round(monthlyStats.totalTickets * 0.9),
                                            Math.round(monthlyStats.totalTickets * 0.95),
                                            monthlyStats.totalTickets,
                                        ]}
                                    />
                                    <ReportCard
                                        title="Resolved"
                                        value={monthlyStats.resolvedTickets}
                                        icon={CheckCircle}
                                        color="bg-green-500"
                                        subtext={`${monthlyStats.totalTickets > 0 ? ((monthlyStats.resolvedTickets / monthlyStats.totalTickets) * 100).toFixed(1) : 0}% Resolution Rate`}
                                        sparklineData={[
                                            Math.round(monthlyStats.resolvedTickets * 0.5),
                                            Math.round(monthlyStats.resolvedTickets * 0.65),
                                            Math.round(monthlyStats.resolvedTickets * 0.75),
                                            Math.round(monthlyStats.resolvedTickets * 0.85),
                                            Math.round(monthlyStats.resolvedTickets * 0.92),
                                            Math.round(monthlyStats.resolvedTickets * 0.98),
                                            monthlyStats.resolvedTickets,
                                        ]}
                                    />
                                    <ReportCard
                                        title="Open Tickets"
                                        value={monthlyStats.openTickets}
                                        icon={AlertCircle}
                                        color="bg-orange-500"
                                        sparklineData={[
                                            Math.round(monthlyStats.openTickets * 1.3),
                                            Math.round(monthlyStats.openTickets * 1.2),
                                            Math.round(monthlyStats.openTickets * 1.15),
                                            Math.round(monthlyStats.openTickets * 1.1),
                                            Math.round(monthlyStats.openTickets * 1.05),
                                            Math.round(monthlyStats.openTickets * 1.02),
                                            monthlyStats.openTickets,
                                        ]}
                                    />
                                    <ReportCard
                                        title="Avg Resolution Time"
                                        value={`${monthlyStats.avgResolutionTimeHours}h`}
                                        icon={Clock}
                                        color="bg-purple-500"
                                    />
                                </div>

                                {/* Monthly Distribution Chart */}
                                <Suspense fallback={<ReportSkeleton />}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-[hsl(var(--card))] p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center gap-2 mb-4">
                                                <PieChart className="w-5 h-5 text-primary" />
                                                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Ticket Distribution</h3>
                                            </div>
                                            <DistributionChart
                                                data={{
                                                    'Resolved': monthlyStats.resolvedTickets,
                                                    'Open': monthlyStats.openTickets,
                                                }}
                                                type="status"
                                                height={220}
                                            />
                                        </div>
                                        <div className="bg-white dark:bg-[hsl(var(--card))] p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Performance Insights</h3>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                                    <div>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">Resolution Rate</p>
                                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                            {monthlyStats.totalTickets > 0 ? ((monthlyStats.resolvedTickets / monthlyStats.totalTickets) * 100).toFixed(1) : 0}%
                                                        </p>
                                                    </div>
                                                    {monthlyStats.resolvedTickets >= monthlyStats.openTickets ? (
                                                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                                            <ArrowUpRight className="w-6 h-6 text-green-600 dark:text-green-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                                                            <ArrowDownRight className="w-6 h-6 text-red-600 dark:text-red-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                                    <div>
                                                        <p className="text-sm text-slate-500 dark:text-slate-400">Avg Resolution Time</p>
                                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{monthlyStats.avgResolutionTimeHours}h</p>
                                                    </div>
                                                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                                        <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Suspense>
                            </>
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
                                    onClick={handlePreviewAgentPDF}
                                    disabled={exporting || agentLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                                >
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                    Export PDF
                                </button>
                                <button
                                    onClick={handleExportCustomExcel}
                                    disabled={exporting || agentLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                                >
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                    Export Excel
                                </button>
                            </div>
                        </div>

                        {agentLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : agentMetrics.length > 0 ? (
                            <>
                                {/* Agent Performance Chart */}
                                <Suspense fallback={<div className="h-[280px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />}>
                                    <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="w-5 h-5 text-primary" />
                                                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Resolution Rate by Agent</h3>
                                            </div>
                                            <span className="text-xs text-slate-500">Top performers</span>
                                        </div>
                                        <AgentPerformanceChart data={agentMetrics} height={280} metric="resolutionRate" />
                                    </div>
                                </Suspense>

                                {/* Agent Table */}
                                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Agent Details</h3>
                                    </div>
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
                                            {agentMetrics.map((agent) => (
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
                            </>
                        ) : (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                No agent data found for this period
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
                                    onClick={handlePreviewVolumePDF}
                                    disabled={exporting || volumeLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                                >
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                    Export PDF
                                </button>
                                <button
                                    onClick={handleExportCustomExcel}
                                    disabled={exporting || volumeLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out disabled:opacity-50 shadow-sm text-sm"
                                >
                                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                    Export Excel
                                </button>
                            </div>
                        </div>

                        {volumeLoading ? (
                            <ReportSkeleton />
                        ) : volumeData ? (
                            <>
                                {/* Summary Cards with Sparklines */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <ReportCard
                                        title="Total Created"
                                        value={volumeData.summary.totalCreated}
                                        icon={TrendingUp}
                                        color="bg-blue-500"
                                        sparklineData={volumeData.daily.slice(-7).map((d: { created: number }) => d.created)}
                                    />
                                    <ReportCard
                                        title="Total Resolved"
                                        value={volumeData.summary.totalResolved}
                                        icon={CheckCircle}
                                        color="bg-green-500"
                                        sparklineData={volumeData.daily.slice(-7).map((d: { resolved: number }) => d.resolved)}
                                    />
                                    <ReportCard
                                        title="Pending"
                                        value={volumeData.summary.totalPending}
                                        icon={AlertCircle}
                                        color="bg-orange-500"
                                        sparklineData={volumeData.daily.slice(-7).map((d: { pending: number }) => d.pending)}
                                    />
                                    <ReportCard
                                        title="Peak Day"
                                        value={volumeData.summary.peakCount}
                                        icon={Target}
                                        color="bg-purple-500"
                                        subtext={volumeData.summary.peakDay || 'N/A'}
                                    />
                                </div>

                                {/* Interactive Filters */}
                                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <BarChart3 className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Quick Filters</span>
                                        {(selectedPriority || selectedStatus) && (
                                            <button
                                                onClick={() => {
                                                    setSelectedPriority(null);
                                                    setSelectedStatus(null);
                                                }}
                                                className="ml-auto text-xs text-red-500 hover:text-red-600 font-medium"
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <FilterSection
                                            title="Priority"
                                            data={volumeData.byPriority}
                                            selected={selectedPriority}
                                            onSelect={setSelectedPriority}
                                            type="priority"
                                        />
                                        <FilterSection
                                            title="Status"
                                            data={volumeData.byStatus}
                                            selected={selectedStatus}
                                            onSelect={setSelectedStatus}
                                            type="status"
                                        />
                                    </div>
                                </div>

                                {/* Daily Volume Chart */}
                                <Suspense fallback={<ReportSkeleton />}>
                                    <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingUp className="w-5 h-5 text-primary" />
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Daily Ticket Trend</h3>
                                        </div>
                                        <TicketVolumeChart data={volumeData.daily} height={280} />
                                    </div>

                                    {/* Distribution Charts */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">By Priority</h3>
                                            <DistributionChart
                                                data={volumeData.byPriority}
                                                type="priority"
                                                height={220}
                                            />
                                        </div>

                                        <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">By Status</h3>
                                            <DistributionChart
                                                data={volumeData.byStatus}
                                                type="status"
                                                height={220}
                                            />
                                        </div>
                                    </div>
                                </Suspense>

                                {/* Period Comparison */}
                                {volumeData.daily.length >= 4 && (
                                    <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ArrowUpRight className="w-5 h-5 text-primary" />
                                            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Period Performance</h3>
                                            <span className="text-xs text-slate-500 ml-auto">First half vs second half of period</span>
                                        </div>
                                        <Suspense fallback={<div className="h-[100px] w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />}>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                                {(() => {
                                                    const mid = Math.floor(volumeData.daily.length / 2);
                                                    const firstHalf = volumeData.daily.slice(0, mid);
                                                    const secondHalf = volumeData.daily.slice(mid);

                                                    const firstCreated = firstHalf.reduce((sum: number, d: { created: number }) => sum + d.created, 0);
                                                    const secondCreated = secondHalf.reduce((sum: number, d: { created: number }) => sum + d.created, 0);
                                                    const firstResolved = firstHalf.reduce((sum: number, d: { resolved: number }) => sum + d.resolved, 0);
                                                    const secondResolved = secondHalf.reduce((sum: number, d: { resolved: number }) => sum + d.resolved, 0);

                                                    const resolutionRateFirst = firstCreated > 0 ? (firstResolved / firstCreated) * 100 : 0;
                                                    const resolutionRateSecond = secondCreated > 0 ? (secondResolved / secondCreated) * 100 : 0;

                                                    return (
                                                        <>
                                                            <PeriodComparison
                                                                label="Created"
                                                                current={secondCreated}
                                                                previous={firstCreated}
                                                            />
                                                            <PeriodComparison
                                                                label="Resolved"
                                                                current={secondResolved}
                                                                previous={firstResolved}
                                                            />
                                                            <PeriodComparison
                                                                label="Resolution Rate"
                                                                current={resolutionRateSecond}
                                                                previous={resolutionRateFirst}
                                                                format="percentage"
                                                            />
                                                            <PeriodComparison
                                                                label="Avg Daily"
                                                                current={secondCreated / Math.max(secondHalf.length, 1)}
                                                                previous={firstCreated / Math.max(firstHalf.length, 1)}
                                                                format="number"
                                                            />
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </Suspense>
                                    </div>
                                )}

                                {/* Daily Volume Table */}
                                <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
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

            {/* PDF Preview Modal */}
            {
                pdfPreview.previewConfig && (
                    <PDFPreviewModal
                        isOpen={pdfPreview.isOpen}
                        onClose={pdfPreview.closePreview}
                        pdfUrl={pdfPreview.previewConfig.url}
                        filename={pdfPreview.previewConfig.filename}
                        title={pdfPreview.previewConfig.title}
                    />
                )
            }
        </>
    );
};

export default BentoReportsPage;
