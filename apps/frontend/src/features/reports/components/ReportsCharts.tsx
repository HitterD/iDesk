import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { cn } from '@/lib/utils';

// Color palette for charts
const CHART_COLORS = {
    primary: '#4F46E5',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    purple: '#8B5CF6',
    pink: '#EC4899',
    cyan: '#06B6D4',
};

const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: '#EF4444',
    HIGH: '#F59E0B',
    MEDIUM: '#3B82F6',
    LOW: '#10B981',
    URGENT: '#EF4444',
};

const STATUS_COLORS: Record<string, string> = {
    TODO: '#94A3B8',
    IN_PROGRESS: '#3B82F6',
    WAITING_VENDOR: '#F59E0B',
    RESOLVED: '#10B981',
    CANCELLED: '#6B7280',
};

// ===========================================
// Ticket Volume Line Chart
// ===========================================
interface VolumeDataPoint {
    date: string;
    created: number;
    resolved: number;
    pending: number;
}

interface TicketVolumeChartProps {
    data: VolumeDataPoint[];
    height?: number;
    showLegend?: boolean;
    showArea?: boolean;
}

export const TicketVolumeChart: React.FC<TicketVolumeChartProps> = ({
    data,
    height = 300,
    showLegend = true,
    showArea = true,
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                No data available
            </div>
        );
    }

    // Format date for display
    const formattedData = data.map(d => ({
        ...d,
        displayDate: new Date(d.date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short'
        }),
    }));

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                {showArea ? (
                    <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.info} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_COLORS.info} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis
                            dataKey="displayDate"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1E293B',
                                border: 'none',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                            }}
                            labelStyle={{ color: '#F8FAFC', fontWeight: 600 }}
                            itemStyle={{ color: '#CBD5E1' }}
                        />
                        {showLegend && (
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }}
                                iconType="circle"
                            />
                        )}
                        <Area
                            type="monotone"
                            dataKey="created"
                            name="Created"
                            stroke={CHART_COLORS.info}
                            strokeWidth={2}
                            fill="url(#colorCreated)"
                            dot={{ r: 3, fill: CHART_COLORS.info }}
                            activeDot={{ r: 6, fill: CHART_COLORS.info }}
                        />
                        <Area
                            type="monotone"
                            dataKey="resolved"
                            name="Resolved"
                            stroke={CHART_COLORS.success}
                            strokeWidth={2}
                            fill="url(#colorResolved)"
                            dot={{ r: 3, fill: CHART_COLORS.success }}
                            activeDot={{ r: 6, fill: CHART_COLORS.success }}
                        />
                    </AreaChart>
                ) : (
                    <LineChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                        <XAxis
                            dataKey="displayDate"
                            stroke="#94A3B8"
                            fontSize={11}
                            tickLine={false}
                        />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1E293B',
                                border: 'none',
                                borderRadius: '12px',
                            }}
                        />
                        {showLegend && <Legend />}
                        <Line
                            type="monotone"
                            dataKey="created"
                            name="Created"
                            stroke={CHART_COLORS.info}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="resolved"
                            name="Resolved"
                            stroke={CHART_COLORS.success}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                        />
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

// ===========================================
// Agent Performance Bar Chart
// ===========================================
interface AgentMetric {
    agentId: string;
    agentName: string;
    totalAssigned: number;
    totalResolved: number;
    resolutionRate: number;
    slaComplianceRate: number;
}

interface AgentPerformanceChartProps {
    data: AgentMetric[];
    height?: number;
    metric?: 'resolutionRate' | 'slaComplianceRate' | 'totalResolved';
}

export const AgentPerformanceChart: React.FC<AgentPerformanceChartProps> = ({
    data,
    height = 300,
    metric = 'resolutionRate',
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                No agent data available
            </div>
        );
    }

    // Sort by metric descending and take top 10
    const sortedData = [...data]
        .sort((a, b) => b[metric] - a[metric])
        .slice(0, 10)
        .map(agent => ({
            ...agent,
            displayName: agent.agentName.length > 12
                ? agent.agentName.substring(0, 12) + '...'
                : agent.agentName,
        }));

    const metricLabel = metric === 'resolutionRate'
        ? 'Resolution Rate (%)'
        : metric === 'slaComplianceRate'
            ? 'SLA Compliance (%)'
            : 'Total Resolved';

    const getBarColor = (value: number) => {
        if (metric === 'totalResolved') return CHART_COLORS.primary;
        if (value >= 90) return CHART_COLORS.success;
        if (value >= 70) return CHART_COLORS.warning;
        return CHART_COLORS.danger;
    };

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={sortedData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis
                        type="number"
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                        domain={metric !== 'totalResolved' ? [0, 100] : undefined}
                    />
                    <YAxis
                        type="category"
                        dataKey="displayName"
                        stroke="#94A3B8"
                        fontSize={11}
                        tickLine={false}
                        width={75}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1E293B',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                        }}
                        labelStyle={{ color: '#F8FAFC', fontWeight: 600 }}
                        itemStyle={{ color: '#CBD5E1' }}
                        formatter={(value: any) => [
                            metric !== 'totalResolved' ? `${Number(value).toFixed(1)}%` : value,
                            metricLabel
                        ]}
                    />
                    <Bar
                        dataKey={metric}
                        name={metricLabel}
                        radius={[0, 6, 6, 0]}
                        barSize={24}
                    >
                        {sortedData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getBarColor(entry[metric])}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// ===========================================
// Distribution Pie/Donut Chart
// ===========================================
interface DistributionChartProps {
    data: Record<string, number>;
    height?: number;
    type?: 'priority' | 'status' | 'category' | 'custom';
    showLegend?: boolean;
    innerRadius?: number;
    title?: string;
}

const DEFAULT_PIE_COLORS = [
    CHART_COLORS.primary,
    CHART_COLORS.success,
    CHART_COLORS.warning,
    CHART_COLORS.danger,
    CHART_COLORS.info,
    CHART_COLORS.purple,
    CHART_COLORS.pink,
    CHART_COLORS.cyan,
];

export const DistributionChart: React.FC<DistributionChartProps> = ({
    data,
    height = 250,
    type = 'custom',
    showLegend = true,
    innerRadius = 60,
    title,
}) => {
    const chartData = Object.entries(data).map(([name, value]) => ({
        name,
        value,
    }));

    if (chartData.length === 0 || chartData.every(d => d.value === 0)) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                No data available
            </div>
        );
    }

    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    const getColor = (name: string, index: number): string => {
        if (type === 'priority') return PRIORITY_COLORS[name] || DEFAULT_PIE_COLORS[index];
        if (type === 'status') return STATUS_COLORS[name] || DEFAULT_PIE_COLORS[index];
        return DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length];
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const percentage = ((data.value / total) * 100).toFixed(1);
            return (
                <div className="bg-slate-800 px-4 py-3 rounded-xl shadow-lg border border-slate-700">
                    <p className="text-white font-semibold">{data.name}</p>
                    <p className="text-slate-300 text-sm">
                        {data.value} tickets ({percentage}%)
                    </p>
                </div>
            );
        }
        return null;
    };

    const renderCustomLabel = ({ cx, cy }: any) => {
        return (
            <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-800 dark:fill-white"
            >
                <tspan x={cx} dy="-0.5em" className="text-2xl font-bold">{total}</tspan>
                <tspan x={cx} dy="1.5em" className="text-xs fill-slate-500">Total</tspan>
            </text>
        );
    };

    return (
        <div className="w-full" style={{ height }}>
            {title && (
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 text-center">
                    {title}
                </h4>
            )}
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={innerRadius > 0 ? renderCustomLabel : undefined}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={getColor(entry.name, index)}
                                stroke="none"
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    {showLegend && (
                        <Legend
                            layout="horizontal"
                            align="center"
                            verticalAlign="bottom"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingTop: '10px' }}
                            formatter={(value) => (
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                    {value.replace('_', ' ')}
                                </span>
                            )}
                        />
                    )}
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

// ===========================================
// Mini Sparkline Bar Chart (for inline use)
// ===========================================
interface MiniBarProps {
    data: { label: string; value: number }[];
    height?: number;
    color?: string;
}

export const MiniBarChart: React.FC<MiniBarProps> = ({
    data,
    height = 100,
    color = CHART_COLORS.primary,
}) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="flex items-end gap-1" style={{ height }}>
            {data.map((item, index) => (
                <div
                    key={index}
                    className="flex-1 flex flex-col items-center gap-1"
                >
                    <div
                        className="w-full rounded-t transition-[opacity,transform,colors] duration-200 ease-out hover:opacity-80"
                        style={{
                            height: `${(item.value / maxValue) * 100}%`,
                            backgroundColor: color,
                            minHeight: item.value > 0 ? 4 : 0,
                        }}
                        title={`${item.label}: ${item.value}`}
                    />
                    <span className="text-[9px] text-slate-500 truncate w-full text-center">
                        {item.label}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ===========================================
// Period Comparison Component
// ===========================================
interface PeriodComparisonProps {
    current: number;
    previous: number;
    label: string;
    format?: 'number' | 'percentage' | 'time';
    invertColors?: boolean;
}

export const PeriodComparison: React.FC<PeriodComparisonProps> = ({
    current,
    previous,
    label,
    format = 'number',
    invertColors = false,
}) => {
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const isPositive = invertColors ? change < 0 : change > 0;
    const isNeutral = Math.abs(change) < 1;

    const formatValue = (value: number): string => {
        switch (format) {
            case 'percentage':
                return `${value.toFixed(1)}%`;
            case 'time':
                return `${value.toFixed(1)}h`;
            default:
                return value.toLocaleString();
        }
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{label}:</span>
            <span className="font-semibold text-slate-800 dark:text-white">
                {formatValue(current)}
            </span>
            {!isNeutral && (
                <span
                    className={cn(
                        "text-xs font-medium px-1.5 py-0.5 rounded-full",
                        isPositive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}
                >
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
            )}
        </div>
    );
};

export default {
    TicketVolumeChart,
    AgentPerformanceChart,
    DistributionChart,
    MiniBarChart,
    PeriodComparison,
};
