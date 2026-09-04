import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    Database,
    Server,
    Clock,
    HardDrive,
    CheckCircle,
    XCircle,
    RefreshCw,
    Loader2,
    AlertTriangle,
    Zap,
    Wifi,
    Cpu,
    MemoryStick,
    Disc,
    Radio,
    AlertCircle,
    TrendingUp,
    Users,
    Shield,
    Bell,
    FileText,
    BookOpen,
    Settings,
    Video,
    MessageCircle,
    ClipboardList,
    History,
    Pause,
    Play,
    Copy,
    Check,
    Download,
    Search,
    Terminal,
    Layers,
    Gauge,
    Flame,
    Box,
    ArrowUpRight,
    Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useHealthSocket, DetailedHealthStatus, ServiceStatus } from '../hooks/useHealthSocket';
import { Sparkline } from '@/components/ui/Sparkline';
import { EndToEndServiceMap } from '../components/system-health/EndToEndServiceMap';

// Service icon mapping
const serviceIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    'Authentication': Shield,
    'Tickets': ClipboardList,
    'Notifications': Bell,
    'Reports': FileText,
    'Knowledge Base': BookOpen,
    'Automation': Settings,
    'Zoom Booking': Video,
    'Telegram': MessageCircle,
    'Audit Logs': History,
    'User Management': Users,
};

// Format bytes to human readable with NaN / undefined protection
const formatBytes = (bytes?: number): string => {
    if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
};

// Format uptime with padded seconds
const formatUptime = (seconds: number = 0): string => {
    const secNum = Math.max(0, Math.floor(seconds));
    const days = Math.floor(secNum / 86400);
    const hours = Math.floor((secNum % 86400) / 3600);
    const minutes = Math.floor((secNum % 3600) / 60);
    const secs = Math.floor(secNum % 60).toString().padStart(2, '0');

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
};

// Format relative time
const formatRelativeTime = (timestamp?: string): string => {
    if (!timestamp) return '-';
    const now = new Date();
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 5) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
};

// Status indicator badge
const StatusBadge: React.FC<{
    status: 'operational' | 'degraded' | 'down' | 'connected' | 'disconnected' | 'disabled' | 'error';
    size?: 'sm' | 'md';
}> = ({ status, size = 'md' }) => {
    const configs = {
        operational: {
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
            dot: 'bg-emerald-500',
            icon: CheckCircle,
            label: 'Operational',
        },
        connected: {
            color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
            dot: 'bg-emerald-500',
            icon: CheckCircle,
            label: 'Connected',
        },
        degraded: {
            color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
            dot: 'bg-amber-500',
            icon: AlertTriangle,
            label: 'Degraded',
        },
        down: {
            color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
            dot: 'bg-rose-500',
            icon: XCircle,
            label: 'Down',
        },
        disconnected: {
            color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
            dot: 'bg-rose-500',
            icon: XCircle,
            label: 'Disconnected',
        },
        error: {
            color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
            dot: 'bg-rose-500',
            icon: XCircle,
            label: 'Error',
        },
        disabled: {
            color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700/60',
            dot: 'bg-slate-400',
            icon: AlertCircle,
            label: 'Disabled',
        },
    };

    const config = configs[status] || configs.down;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 font-medium border rounded-full transition-all",
                size === 'sm' ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
                config.color
            )}
        >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
            {config.label}
        </span>
    );
};

// Circular gauge with precision ring
const CircularGauge: React.FC<{
    value: number;
    label?: string;
    color?: string;
    size?: 'sm' | 'md' | 'lg';
    subtext?: string;
}> = ({ value, label, color, size = 'md', subtext }) => {
    const radius = size === 'sm' ? 22 : size === 'lg' ? 38 : 30;
    const stroke = size === 'sm' ? 3.5 : size === 'lg' ? 5 : 4.5;
    const circumference = 2 * Math.PI * radius;
    const safeValue = Math.min(100, Math.max(0, isNaN(value) ? 0 : value));
    const offset = circumference - (safeValue / 100) * circumference;
    const dimension = size === 'sm' ? 54 : size === 'lg' ? 92 : 72;

    const strokeColor =
        color ||
        (safeValue > 85 ? '#ef4444' : safeValue > 70 ? '#f59e0b' : '#10b981');

    return (
        <div className="flex flex-col items-center shrink-0">
            <div className="relative flex items-center justify-center" style={{ width: dimension, height: dimension }}>
                <svg className="transform -rotate-90" width={dimension} height={dimension}>
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={stroke}
                        fill="transparent"
                        className="text-slate-100 dark:text-slate-800"
                    />
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        stroke={strokeColor}
                        strokeWidth={stroke}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-all duration-500 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={cn("font-bold tracking-tight text-slate-800 dark:text-slate-100", size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-base')}>
                        {Math.round(safeValue)}%
                    </span>
                    {subtext && (
                        <span className="text-[10px] text-slate-400 -mt-0.5">{subtext}</span>
                    )}
                </div>
            </div>
            {label && <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{label}</span>}
        </div>
    );
};

// Telemetry Live Pulse Indicator
const TelemetryLiveBadge: React.FC<{
    isConnected: boolean;
    isSubscribed: boolean;
    isStale: boolean;
    isPaused: boolean;
    pingLatency: number | null;
    lastUpdate: Date | null;
}> = ({ isConnected, isSubscribed, isStale, isPaused, pingLatency, lastUpdate }) => {
    const elapsedSeconds = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : 0;

    if (isPaused) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Pause className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
                <span>Stream Paused</span>
            </div>
        );
    }

    if (isStale) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Stale ({elapsedSeconds}s)</span>
            </div>
        );
    }

    if (isConnected && isSubscribed) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Stream</span>
                {pingLatency !== null && (
                    <span className="text-[11px] font-mono opacity-80 pl-1 border-l border-emerald-300 dark:border-emerald-700/60">
                        {pingLatency}ms
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Disconnected</span>
        </div>
    );
};

export const SystemHealthPage: React.FC = () => {
    // Real-time WebSocket connection
    const {
        healthData,
        uptime,
        history,
        isStale,
        isConnected,
        isSubscribed,
        isPaused,
        pingLatency,
        lastUpdate,
        incidents,
        realTraces,
        togglePause,
        forceRefresh,
    } = useHealthSocket(true);

    // Fallback API fetch
    const { data: apiHealth, isLoading, refetch, isFetching } = useQuery<DetailedHealthStatus>({
        queryKey: ['system-health-detailed'],
        queryFn: async () => {
            const res = await api.get('/health/detailed');
            return res.data;
        },
        refetchInterval: isConnected ? false : 30000,
        enabled: !healthData,
    });

    const health = healthData || apiHealth;

    // Fetch Synology backup status
    const { data: synology, isLoading: synologyLoading } = useQuery({
        queryKey: ['backup-status'],
        queryFn: async () => {
            try {
                const res = await api.get('/backup/status');
                return res.data;
            } catch {
                return { configured: false };
            }
        },
        retry: false,
    });

    // UI state
    const [activeTab, setActiveTab] = useState<'vitals' | 'service-map'>('vitals');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [serviceFilter, setServiceFilter] = useState<'all' | 'operational' | 'degraded' | 'down'>('all');
    const [serviceSearch, setServiceSearch] = useState('');
    const [copied, setCopied] = useState(false);

    // Manual full diagnostics trigger
    const handleRunDiagnostics = async () => {
        setIsDiagnosing(true);
        try {
            await forceRefresh();
            await refetch();
            toast.success('System diagnostics refreshed successfully');
        } catch {
            toast.error('Failed to trigger complete diagnostics');
        } finally {
            setTimeout(() => setIsDiagnosing(false), 800);
        }
    };

    // Copy diagnostic report
    const handleCopyReport = () => {
        const report = {
            status: health?.status,
            version: health?.version,
            timestamp: new Date().toISOString(),
            uptime: uptime || health?.uptime,
            system: health?.system,
            infrastructure: health?.infrastructure,
            services: health?.services,
            recentIncidents: [...(health?.recentIncidents || []), ...incidents].slice(0, 5),
        };

        navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        setCopied(true);
        toast.success('System diagnostic snapshot copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    // Download diagnostic JSON file
    const handleDownloadReport = () => {
        const report = {
            status: health?.status,
            version: health?.version,
            timestamp: new Date().toISOString(),
            uptime: uptime || health?.uptime,
            system: health?.system,
            infrastructure: health?.infrastructure,
            services: health?.services,
            recentIncidents: [...(health?.recentIncidents || []), ...incidents],
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `idesk-system-health-${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success('Diagnostic snapshot downloaded');
    };

    const isInitialLoading = isLoading && !health;
    const redisDetail = health?.infrastructure?.redis?.detail;

    // Accurate memory calculation
    const memTotal = health?.system?.memoryTotal || 0;
    const memFree = health?.system?.memoryFree || 0;
    const memUsed = Math.max(0, memTotal - memFree);
    const proc = health?.system?.process;

    // Filtered services
    const services = health?.services || [];
    const filteredServices = useMemo(() => {
        return services.filter(service => {
            const matchesStatus = serviceFilter === 'all' || service.status === serviceFilter;
            const matchesSearch = service.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                service.module.toLowerCase().includes(serviceSearch.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [services, serviceFilter, serviceSearch]);

    const serviceCounts = useMemo(() => {
        const counts = { all: services.length, operational: 0, degraded: 0, down: 0 };
        services.forEach(s => {
            if (s.status === 'operational') counts.operational++;
            else if (s.status === 'degraded') counts.degraded++;
            else if (s.status === 'down') counts.down++;
        });
        return counts;
    }, [services]);

    return (
        <div className="space-y-6 animate-fade-in-up pb-10 max-w-[1540px] mx-auto">
            {/* Header & Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                System Health & Telemetry
                            </h1>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                Real-time operational observability, infrastructure metrics, and service integrity
                            </p>
                        </div>
                    </div>
                </div>

                {/* Real-time Control Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <TelemetryLiveBadge
                        isConnected={isConnected}
                        isSubscribed={isSubscribed}
                        isStale={isStale}
                        isPaused={isPaused}
                        pingLatency={pingLatency}
                        lastUpdate={lastUpdate}
                    />

                    {/* Pause / Resume button */}
                    <button
                        onClick={togglePause}
                        title={isPaused ? "Resume real-time telemetry stream" : "Pause telemetry stream"}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-sm",
                            isPaused
                                ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        )}
                    >
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        <span>{isPaused ? "Resume" : "Pause"}</span>
                    </button>

                    {/* Run Diagnostics / Force Refresh */}
                    <button
                        onClick={handleRunDiagnostics}
                        disabled={isInitialLoading || isDiagnosing}
                        title="Force instantaneous full-tier probe"
                        className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 text-blue-500", (isInitialLoading || isDiagnosing || isFetching) && "animate-spin")} />
                        <span>Run Diagnostics</span>
                    </button>

                    {/* Export JSON Report */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                        <button
                            onClick={handleCopyReport}
                            title="Copy diagnostic snapshot to clipboard"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-r border-slate-200 dark:border-slate-700"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? "Copied" : "Copy JSON"}</span>
                        </button>
                        <button
                            onClick={handleDownloadReport}
                            title="Download JSON telemetry snapshot"
                            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Primary Navigation Tabs: Overview & Vitals vs End-to-End Service Map (Datadog Style) */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('vitals')}
                    data-testid="tab-vitals"
                    className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border",
                        activeTab === 'vitals'
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                >
                    <Activity className="w-4 h-4 text-blue-500" />
                    <span>Overview & Vitals</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('service-map')}
                    data-testid="tab-service-map"
                    className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border",
                        activeTab === 'service-map'
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                >
                    <Layers className="w-4 h-4 text-blue-500" />
                    <span>End-to-End Service Map</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300">
                        Datadog APM
                    </span>
                </button>
            </div>

            {isInitialLoading ? (
                <div className="bg-[hsl(var(--card))] rounded-2xl p-16 border border-[hsl(var(--border))] flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Connecting to system telemetry stream...</p>
                    <p className="text-xs text-slate-400">Probing infrastructure services and metrics</p>
                </div>
            ) : activeTab === 'service-map' ? (
                <EndToEndServiceMap health={health} realTraces={realTraces} incidents={incidents} />
            ) : (
                <>
                    {/* Hero Operational Banner */}
                    <div className={cn(
                        "rounded-2xl p-5 lg:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-300 border shadow-sm",
                        health?.status === 'ok'
                            ? "bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-500/20"
                            : health?.status === 'degraded'
                                ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-200 dark:border-amber-500/20"
                                : "bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-200 dark:border-rose-500/20"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                                health?.status === 'ok' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                                    : health?.status === 'degraded' ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                                        : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                            )}>
                                {health?.status === 'ok' ? (
                                    <CheckCircle className="w-8 h-8" />
                                ) : health?.status === 'degraded' ? (
                                    <AlertTriangle className="w-8 h-8" />
                                ) : (
                                    <XCircle className="w-8 h-8" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        {health?.status === 'ok'
                                            ? 'All Core Systems Operational'
                                            : health?.status === 'degraded'
                                                ? 'Degraded Performance Detected'
                                                : 'System Outage / Issues Detected'}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                                        {import.meta.env.MODE || 'Production'}
                                    </span>
                                </div>
                                <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                    <span>Last sampled: {lastUpdate ? formatRelativeTime(lastUpdate.toISOString()) : health?.timestamp ? formatRelativeTime(health.timestamp) : '-'}</span>
                                    <span>•</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{serviceCounts.operational}/{serviceCounts.all} Subsystems Healthy</span>
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats Pill */}
                        <div className="flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-700/60">
                            <div className="text-left md:text-right">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Engine Uptime</p>
                                <p className="text-lg lg:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                                    {formatUptime(uptime || health?.uptime || 0)}
                                </p>
                            </div>
                            <div className="text-left md:text-right border-l pl-6 border-slate-200 dark:border-slate-700/60">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">iDesk Build</p>
                                <p className="text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                                    v{health?.version || '1.5.0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bento Tier 1: Core System Vitals & Node.js Engine (4 Grid Cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* 1. CPU Usage Card */}
                        <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                            <Cpu className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">CPU Usage</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400">
                                        {health?.system?.arch || 'x64'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 my-2">
                                    <CircularGauge
                                        value={health?.system?.cpuUsage || 0}
                                        color={health?.system?.cpuUsage && health.system.cpuUsage > 80 ? '#ef4444' : health?.system?.cpuUsage && health.system.cpuUsage > 60 ? '#f59e0b' : '#10b981'}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Trend</span>
                                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                                                {health?.system?.cpuUsage || 0}%
                                            </span>
                                        </div>
                                        <Sparkline
                                            data={history.cpu}
                                            width={110}
                                            height={26}
                                            filled
                                            color={health?.system?.cpuUsage && health.system.cpuUsage > 80 ? 'danger' : health?.system?.cpuUsage && health.system.cpuUsage > 60 ? 'warning' : 'success'}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Load Avg:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                                    {(health?.system?.loadAverage || [0, 0, 0]).map(l => l.toFixed(2)).join(' · ')}
                                </span>
                            </div>
                        </div>

                        {/* 2. System RAM & Node.js Heap Card */}
                        <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                            <MemoryStick className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Memory (RAM)</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400">
                                        {formatBytes(memTotal)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 my-2">
                                    <CircularGauge
                                        value={health?.system?.memoryUsage || 0}
                                        color={health?.system?.memoryUsage && health.system.memoryUsage > 85 ? '#ef4444' : health?.system?.memoryUsage && health.system.memoryUsage > 70 ? '#f59e0b' : '#10b981'}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Used / Total</span>
                                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                                                {formatBytes(memUsed)}
                                            </span>
                                        </div>
                                        <Sparkline
                                            data={history.memory}
                                            width={110}
                                            height={26}
                                            filled
                                            color={health?.system?.memoryUsage && health.system.memoryUsage > 85 ? 'danger' : health?.system?.memoryUsage && health.system.memoryUsage > 70 ? 'warning' : 'success'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Node.js Heap Bar & Free RAM */}
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex flex-col gap-1.5 text-xs">
                                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                                    <span>Node.js Heap:</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                                        {proc ? `${formatBytes(proc.heapUsed)} / ${formatBytes(proc.heapTotal)}` : `${formatBytes(memFree)} Free`}
                                    </span>
                                </div>
                                {proc && (
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, (proc.heapUsed / (proc.heapTotal || 1)) * 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Disk & Storage Card */}
                        <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                                            <Disc className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Disk Storage</span>
                                    </div>
                                    <span className="text-xs font-mono text-slate-400">
                                        {health?.system?.diskTotal ? formatBytes(health.system.diskTotal) : 'Mount'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 my-2">
                                    <CircularGauge
                                        value={health?.system?.diskUsage || 0}
                                        color={health?.system?.diskUsage && health.system.diskUsage > 90 ? '#ef4444' : health?.system?.diskUsage && health.system.diskUsage > 75 ? '#f59e0b' : '#10b981'}
                                    />
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 dark:text-slate-400">Used:</span>
                                            <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                                {health?.system?.diskTotal ? formatBytes(health.system.diskTotal - (health.system.diskFree || 0)) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 dark:text-slate-400">Free Space:</span>
                                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                                {health?.system?.diskFree ? formatBytes(health.system.diskFree) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-amber-500 h-full rounded-full"
                                                style={{ width: `${Math.min(100, health?.system?.diskUsage || 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Platform:</span>
                                <span className="font-mono uppercase font-semibold text-slate-700 dark:text-slate-300">
                                    {health?.system?.platform || 'Node'} · Node {health?.system?.nodeVersion?.replace('v', '') || '24'}
                                </span>
                            </div>
                        </div>

                        {/* 4. Active Process & Server Clock Card */}
                        <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Runtime & Clock</span>
                                    </div>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                                        PID {proc?.pid || 'Active'}
                                    </span>
                                </div>

                                <div className="py-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Active Uptime</p>
                                    <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tracking-tight mt-0.5">
                                        {formatUptime(uptime || health?.uptime || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Server Clock:</span>
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bento Tier 2: Infrastructure & Bull Queues Intelligence (4 Balanced Cards) */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-blue-500" />
                                Infrastructure & Message Brokers
                            </h3>
                            <span className="text-xs text-slate-400 font-medium">4 Core Connectors</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Database (PostgreSQL) */}
                            <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Database className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">PostgreSQL DB</h4>
                                                <p className="text-[11px] text-slate-400">TypeORM Primary Pool</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={health?.infrastructure?.database?.status || 'disconnected'} size="sm" />
                                    </div>

                                    <div className="flex items-center justify-between my-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Ping Latency</p>
                                            <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">
                                                {health?.infrastructure?.database?.latency || 0} <span className="text-xs font-normal text-slate-400">ms</span>
                                            </p>
                                        </div>
                                        <Sparkline data={history.dbLatency} width={75} height={26} color="info" />
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    <span>Query Probe:</span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Active (SELECT 1)</span>
                                </div>
                            </div>

                            {/* Redis Cache & Bull Queues */}
                            <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
                                                <Radio className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Redis & Bull</h4>
                                                <p className="text-[11px] text-slate-400">
                                                    {redisDetail ? `${redisDetail.keys} Keys · ${formatBytes(redisDetail.usedMemory)}` : 'Key-Value & Queues'}
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge status={health?.infrastructure?.redis?.status || 'disabled'} size="sm" />
                                    </div>

                                    {redisDetail ? (
                                        <div className="my-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                                            <div className="flex justify-between items-center text-[11px] text-slate-400 font-semibold px-1 pb-1 border-b border-slate-200/60 dark:border-slate-800">
                                                <span>Queue Name</span>
                                                <span>Wait · Act · Fail</span>
                                            </div>
                                            <div className="space-y-1 max-h-[92px] overflow-y-auto pr-1 custom-scrollbar">
                                                {redisDetail.queues.map((q) => (
                                                    <div key={q.name} className="flex justify-between items-center text-[11px]">
                                                        <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[90px]">{q.name}</span>
                                                        <span className={cn(
                                                            "font-mono px-1.5 py-0.5 rounded text-[10px]",
                                                            q.failed > 0
                                                                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold"
                                                                : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                        )}>
                                                            {q.waiting} · {q.active} · {q.failed}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="my-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                                            {health?.infrastructure?.redis?.status === 'disabled'
                                                ? "Redis is disabled. Set REDIS_ENABLED=true in backend .env."
                                                : `Latency: ${health?.infrastructure?.redis?.latency ?? 0}ms`}
                                        </div>
                                    )}
                                </div>

                                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    <span>Latency:</span>
                                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {health?.infrastructure?.redis?.latency ?? 0} ms
                                    </span>
                                </div>
                            </div>

                            {/* WebSocket Gateway */}
                            <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                <Wifi className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">WebSocket Gateway</h4>
                                                <p className="text-[11px] text-slate-400">Socket.IO /health</p>
                                            </div>
                                        </div>
                                        <StatusBadge status={health?.infrastructure?.websocket?.status === 'active' ? 'operational' : 'down'} size="sm" />
                                    </div>

                                    <div className="flex items-center justify-between my-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <div>
                                            <p className="text-[10px] text-slate-400 uppercase font-semibold">Active Clients</p>
                                            <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">
                                                {health?.infrastructure?.websocket?.clients || 0} <span className="text-xs font-normal text-slate-400">connected</span>
                                            </p>
                                        </div>
                                        <Sparkline data={history.wsClients?.length ? history.wsClients : [1, 1]} width={75} height={26} color="success" />
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    <span>Transport:</span>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">WebSocket / Fast 2s</span>
                                </div>
                            </div>

                            {/* Backup & Storage (Synology NAS) */}
                            <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                <HardDrive className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-white">Synology Backup</h4>
                                                <p className="text-[11px] text-slate-400">Automated Snapshots</p>
                                            </div>
                                        </div>
                                        {synologyLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                        ) : (
                                            <StatusBadge
                                                status={
                                                    !health?.infrastructure?.backup?.configured && !synology?.configured
                                                        ? 'disabled'
                                                        : synology?.connected || health?.infrastructure?.backup?.connected
                                                            ? 'connected'
                                                            : 'disconnected'
                                                }
                                                size="sm"
                                            />
                                        )}
                                    </div>

                                    <div className="my-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Last Backup Run</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                                            {synology?.lastBackup || health?.infrastructure?.backup?.lastBackup
                                                ? formatRelativeTime(synology?.lastBackup || health?.infrastructure?.backup?.lastBackup)
                                                : 'No backup recorded'}
                                        </p>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    <span>Target:</span>
                                    <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">Synology NAS</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bento Tier 3: Subsystem Microservices Health Matrix */}
                    <div className="bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Box className="w-4 h-4 text-blue-500" />
                                    Subsystem Services Integrity
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Monitoring {serviceCounts.all} core modules with database query checks and latency telemetry
                                </p>
                            </div>

                            {/* Filters & Search */}
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search module..."
                                        value={serviceSearch}
                                        onChange={(e) => setServiceSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                                    />
                                </div>

                                <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5 text-xs font-semibold">
                                    <button
                                        onClick={() => setServiceFilter('all')}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md transition-all",
                                            serviceFilter === 'all'
                                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        )}
                                    >
                                        All ({serviceCounts.all})
                                    </button>
                                    <button
                                        onClick={() => setServiceFilter('operational')}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md transition-all",
                                            serviceFilter === 'operational'
                                                ? "bg-emerald-500 text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        )}
                                    >
                                        Healthy ({serviceCounts.operational})
                                    </button>
                                    {serviceCounts.degraded > 0 && (
                                        <button
                                            onClick={() => setServiceFilter('degraded')}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md transition-all",
                                                serviceFilter === 'degraded'
                                                    ? "bg-amber-500 text-white shadow-sm"
                                                    : "text-amber-600 dark:text-amber-400"
                                            )}
                                        >
                                            Degraded ({serviceCounts.degraded})
                                        </button>
                                    )}
                                    {serviceCounts.down > 0 && (
                                        <button
                                            onClick={() => setServiceFilter('down')}
                                            className={cn(
                                                "px-2.5 py-1 rounded-md transition-all",
                                                serviceFilter === 'down'
                                                    ? "bg-rose-500 text-white shadow-sm"
                                                    : "text-rose-600 dark:text-rose-400"
                                            )}
                                        >
                                            Down ({serviceCounts.down})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Services Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {filteredServices.map((service) => {
                                const Icon = serviceIcons[service.name] || Server;
                                const isOp = service.status === 'operational';
                                const isDeg = service.status === 'degraded';

                                return (
                                    <div
                                        key={service.name}
                                        className={cn(
                                            "p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between",
                                            isOp
                                                ? "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800"
                                                : isDeg
                                                    ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60"
                                                    : "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                isOp ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                    : isDeg ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                            )}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <StatusBadge status={service.status} size="sm" />
                                        </div>

                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                                {service.name}
                                            </h4>
                                            <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                                                {service.module}
                                            </p>
                                        </div>

                                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/60 mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                            <span>Latency</span>
                                            <span className={cn("font-mono font-bold", isOp ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                                {service.latency}ms
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {filteredServices.length === 0 && (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                No microservices match your active filter or search criteria.
                            </div>
                        )}
                    </div>

                    {/* Bento Tier 4: Incidents Feed & System Information (2-column split) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Incident History Feed (2 Cols) */}
                        <div className="lg:col-span-2 bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <History className="w-4 h-4 text-blue-500" />
                                        Recent Incident Stream & Status Transitions
                                    </h3>
                                    <span className="text-xs font-mono text-slate-400">
                                        {[...(health?.recentIncidents || []), ...incidents].length} Events Recorded
                                    </span>
                                </div>

                                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                    {[...(health?.recentIncidents || []), ...incidents]
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                        .slice(0, 15)
                                        .map((incident) => (
                                            <div
                                                key={incident.id}
                                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={cn(
                                                        "w-2.5 h-2.5 rounded-full shrink-0",
                                                        incident.newStatus === 'operational' ? 'bg-emerald-500' :
                                                            incident.newStatus === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'
                                                    )} />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                                                {incident.service}
                                                            </p>
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                                {incident.previousStatus} → {incident.newStatus}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                            {incident.message}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                                                    {formatRelativeTime(incident.timestamp)}
                                                </span>
                                            </div>
                                        ))}

                                    {(!health?.recentIncidents?.length && !incidents.length) && (
                                        <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <CheckCircle className="w-8 h-8 text-emerald-500/60" />
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">All systems stable</p>
                                            <p className="text-xs">No degradation or service incidents recorded in recent window.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 text-xs text-slate-400 flex items-center justify-between">
                                <span>Ring Buffer Retention: Last 50 Events</span>
                                <button
                                    onClick={handleCopyReport}
                                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                                >
                                    Copy Diagnostics JSON
                                </button>
                            </div>
                        </div>

                        {/* System Specs & Environment (1 Col) */}
                        <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-sm flex flex-col justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Terminal className="w-4 h-4 text-blue-500" />
                                    Environment & Specs
                                </h3>

                                <div className="space-y-3">
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">App Environment</span>
                                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100 uppercase">
                                            {import.meta.env.MODE || 'Production'}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Node.js Engine</span>
                                        <span className="text-xs font-mono text-slate-800 dark:text-slate-100">
                                            {health?.system?.nodeVersion || process.version || 'v24.x'}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">OS Architecture</span>
                                        <span className="text-xs font-mono text-slate-800 dark:text-slate-100">
                                            {health?.system?.platform || 'win32'} / {health?.system?.arch || 'x64'}
                                        </span>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Local Timezone</span>
                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">
                                            {Intl.DateTimeFormat().resolvedOptions().timeZone}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex items-center justify-between text-xs text-slate-400">
                                <span>Cadence: 2s Fast / 30s Slow</span>
                                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Synchronized
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SystemHealthPage;
