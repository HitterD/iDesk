import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useHealthSocket, DetailedHealthStatus, ServiceStatus } from '../hooks/useHealthSocket';

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

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format uptime
const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

// Format relative time
const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 5) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    return `${Math.floor(diffSecs / 86400)}d ago`;
};

// Status indicator component
const StatusBadge: React.FC<{ status: 'operational' | 'degraded' | 'down' | 'connected' | 'disconnected' | 'disabled' | 'error' }> = ({ status }) => {
    const configs = {
        operational: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Operational' },
        connected: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Connected' },
        degraded: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertTriangle, label: 'Degraded' },
        down: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Down' },
        disconnected: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Disconnected' },
        error: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Error' },
        disabled: { color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', icon: AlertCircle, label: 'Disabled' },
    };

    const config = configs[status] || configs.down;
    const Icon = config.icon;

    return (
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.color)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </div>
    );
};

// Circular progress gauge
const CircularGauge: React.FC<{ value: number; label: string; color: string; size?: 'sm' | 'md' }> = ({
    value, label, color, size = 'md'
}) => {
    const radius = size === 'sm' ? 24 : 32;
    const stroke = size === 'sm' ? 4 : 5;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const dimension = size === 'sm' ? 56 : 72;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: dimension, height: dimension }}>
                <svg className="transform -rotate-90" width={dimension} height={dimension}>
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        stroke="currentColor"
                        strokeWidth={stroke}
                        fill="transparent"
                        className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                        cx={dimension / 2}
                        cy={dimension / 2}
                        r={radius}
                        stroke={color}
                        strokeWidth={stroke}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="transition-[opacity,transform,colors] duration-200 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("font-bold", size === 'sm' ? 'text-sm' : 'text-lg')}>
                        {Math.round(value)}%
                    </span>
                </div>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label}</span>
        </div>
    );
};

// Live pulse indicator
const LivePulse: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
    <div className="flex items-center gap-2">
        <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
        )} />
        <span className="text-xs text-slate-500 dark:text-slate-400">
            {isConnected ? 'Live' : 'Disconnected'}
        </span>
    </div>
);

export const SystemHealthPage: React.FC = () => {
    // Real-time WebSocket connection
    const {
        healthData,
        isConnected,
        isSubscribed,
        lastUpdate,
        incidents,
    } = useHealthSocket(true);

    // Fallback API fetch (for initial load or if WebSocket fails)
    const { data: apiHealth, isLoading, refetch } = useQuery<DetailedHealthStatus>({
        queryKey: ['system-health-detailed'],
        queryFn: async () => {
            const res = await api.get('/health/detailed');
            return res.data;
        },
        refetchInterval: isConnected ? false : 30000, // Only poll if WS disconnected
        enabled: !healthData, // Disable if we have WS data
    });

    // Use WebSocket data if available, otherwise fall back to API
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

    // Animation state for updates
    const [isUpdating, setIsUpdating] = useState(false);
    useEffect(() => {
        if (lastUpdate) {
            setIsUpdating(true);
            const timer = setTimeout(() => setIsUpdating(false), 500);
            return () => clearTimeout(timer);
        }
    }, [lastUpdate]);

    const isInitialLoading = isLoading && !health;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">System Health</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        Monitor system status and performance
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <LivePulse isConnected={isConnected && isSubscribed} />
                    <button
                        onClick={() => refetch()}
                        disabled={isInitialLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={cn("w-4 h-4", (isInitialLoading || isUpdating) && "animate-spin")} />
                        Refresh
                    </button>
                </div>
            </div>

            {isInitialLoading ? (
                <div className="bg-[hsl(var(--card))] rounded-xl p-12 border border-[hsl(var(--border))] flex items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Loading system health...
                </div>
            ) : (
                <>
                    {/* Overall Status Banner */}
                    <div className={cn(
                        "rounded-xl p-5 flex items-center justify-between transition-[opacity,transform,colors] duration-200 ease-out border",
                        health?.status === 'ok'
                            ? "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
                            : health?.status === 'degraded'
                                ? "bg-yellow-50/50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20"
                                : "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
                    )}>
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-lg flex items-center justify-center",
                                health?.status === 'ok' ? "bg-green-100 dark:bg-green-900/40"
                                    : health?.status === 'degraded' ? "bg-yellow-100 dark:bg-yellow-900/40"
                                        : "bg-red-100 dark:bg-red-900/40"
                            )}>
                                {health?.status === 'ok' ? (
                                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                                ) : health?.status === 'degraded' ? (
                                    <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                ) : (
                                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                                    {health?.status === 'ok'
                                        ? 'All Systems Operational'
                                        : health?.status === 'degraded'
                                            ? 'Some Services Degraded'
                                            : 'System Issues Detected'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-1">
                                    Last checked: {lastUpdate ? formatRelativeTime(lastUpdate.toISOString()) : health?.timestamp ? formatRelativeTime(health.timestamp) : '-'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Version</p>
                            <p className="text-slate-800 dark:text-white font-bold text-xl">{health?.version || '1.5.0'}</p>
                        </div>
                    </div>

                    {/* System Metrics */}
                    {health?.system && (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-5 border border-[hsl(var(--border))]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-bold text-slate-800 dark:text-white">System Metrics</h3>
                                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                                    {health.system.platform} | {health.system.arch} | Node {health.system.nodeVersion}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="flex items-center gap-4">
                                    <CircularGauge
                                        value={health.system.cpuUsage}
                                        label="CPU"
                                        color={health.system.cpuUsage > 80 ? '#ef4444' : health.system.cpuUsage > 60 ? '#f59e0b' : '#22c55e'}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mb-1">
                                            <Cpu className="w-4 h-4" />
                                            <span className="text-sm font-medium">CPU Usage</span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Load: {health.system.loadAverage.map(l => l.toFixed(2)).join(', ')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <CircularGauge
                                        value={health.system.memoryUsage}
                                        label="RAM"
                                        color={health.system.memoryUsage > 85 ? '#ef4444' : health.system.memoryUsage > 70 ? '#f59e0b' : '#22c55e'}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mb-1">
                                            <MemoryStick className="w-4 h-4" />
                                            <span className="text-sm font-medium">Memory</span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {formatBytes(health.system.memoryTotal - health.system.memoryFree)} / {formatBytes(health.system.memoryTotal)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <CircularGauge
                                        value={health.system.diskUsage || 0}
                                        label="Disk"
                                        color={health.system.diskUsage > 90 ? '#ef4444' : health.system.diskUsage > 75 ? '#f59e0b' : '#22c55e'}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mb-1">
                                            <Disc className="w-4 h-4" />
                                            <span className="text-sm font-medium">Disk</span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {health.system.diskTotal > 0
                                                ? `${formatBytes(health.system.diskTotal - health.system.diskFree)} / ${formatBytes(health.system.diskTotal)}`
                                                : 'N/A'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="w-[72px] h-[72px] rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                        <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 mb-1">
                                            <TrendingUp className="w-4 h-4" />
                                            <span className="text-sm font-medium">Uptime</span>
                                        </div>
                                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                            {formatUptime(health.uptime)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Infrastructure Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Database Status */}
                        <div className={cn(
                            "bg-[hsl(var(--card))] rounded-xl p-5 border transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                            health?.infrastructure?.database?.status === 'connected'
                                ? "border-[hsl(var(--border))]"
                                : "border-red-300 dark:border-red-700/50"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <StatusBadge status={health?.infrastructure?.database?.status || 'disconnected'} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">Database</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                PostgreSQL • {health?.infrastructure?.database?.latency || 0}ms
                            </p>
                        </div>

                        {/* Redis Status */}
                        <div className={cn(
                            "bg-[hsl(var(--card))] rounded-xl p-5 border transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                            "border-[hsl(var(--border))]"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <Radio className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <StatusBadge status={health?.infrastructure?.redis?.status || 'disabled'} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">Redis Cache</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {health?.infrastructure?.redis?.status === 'disabled'
                                    ? 'Not configured'
                                    : health?.infrastructure?.redis?.latency
                                        ? `${health.infrastructure.redis.latency}ms`
                                        : 'Queue system'
                                }
                            </p>
                        </div>

                        {/* WebSocket Status */}
                        <div className={cn(
                            "bg-[hsl(var(--card))] rounded-xl p-5 border transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                            "border-[hsl(var(--border))]"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <StatusBadge status={isConnected ? 'operational' : 'down'} />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">WebSocket</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {health?.infrastructure?.websocket?.clients || 0} connected clients
                            </p>
                        </div>

                        {/* Backup Status */}
                        <div className={cn(
                            "bg-[hsl(var(--card))] rounded-xl p-5 border transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out",
                            "border-[hsl(var(--border))]"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <HardDrive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                {synologyLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                                ) : (
                                    <StatusBadge
                                        status={
                                            !health?.infrastructure?.backup?.configured && !synology?.configured
                                                ? 'disabled'
                                                : synology?.connected || health?.infrastructure?.backup?.connected
                                                    ? 'connected'
                                                    : 'disconnected'
                                        }
                                    />
                                )}
                            </div>
                            <h3 className="text-base font-bold text-slate-800 dark:text-white">Backup</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {synology?.lastBackup || health?.infrastructure?.backup?.lastBackup
                                    ? `Last: ${formatRelativeTime(synology?.lastBackup || health?.infrastructure?.backup?.lastBackup || '')}`
                                    : 'Synology NAS'}
                            </p>
                        </div>
                    </div>

                    {/* Services Grid */}
                    <div className="bg-[hsl(var(--card))] rounded-xl p-5 border border-[hsl(var(--border))]">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Service Status</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {(health?.services || []).map((service) => {
                                const Icon = serviceIcons[service.name] || Server;
                                return (
                                    <div
                                        key={service.name}
                                        className={cn(
                                            "p-3 rounded-lg border flex flex-col items-center text-center transition-colors duration-150 cursor-default",
                                            service.status === 'operational'
                                                ? "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10 hover:border-green-300 dark:hover:border-green-500/30 hover:bg-green-100/50 dark:hover:bg-green-900/20"
                                                : service.status === 'degraded'
                                                    ? "border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10 hover:border-yellow-300 dark:hover:border-yellow-500/30 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20"
                                                    : "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 hover:border-red-300 dark:hover:border-red-500/30 hover:bg-red-100/50 dark:hover:bg-red-900/20"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                                            service.status === 'operational'
                                                ? "bg-green-100 dark:bg-green-900/30"
                                                : service.status === 'degraded'
                                                    ? "bg-yellow-100 dark:bg-yellow-900/30"
                                                    : "bg-red-100 dark:bg-red-900/30"
                                        )}>
                                            <Icon className={cn(
                                                "w-4 h-4",
                                                service.status === 'operational'
                                                    ? "text-green-600 dark:text-green-400"
                                                    : service.status === 'degraded'
                                                        ? "text-yellow-600 dark:text-yellow-400"
                                                        : "text-red-600 dark:text-red-400"
                                            )} />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                            {service.name}
                                        </span>
                                        <span className={cn(
                                            "text-xs mt-1",
                                            service.status === 'operational'
                                                ? "text-green-600 dark:text-green-400"
                                                : service.status === 'degraded'
                                                    ? "text-yellow-600 dark:text-yellow-400"
                                                    : "text-red-600 dark:text-red-400"
                                        )}>
                                            {service.status === 'operational' ? 'Operational' : service.status === 'degraded' ? 'Degraded' : 'Down'}
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                            {service.latency}ms
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Incident History */}
                    {(health?.recentIncidents?.length || incidents.length > 0) && (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-5 border border-[hsl(var(--border))]">
                            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Recent Incidents
                            </h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {[...(health?.recentIncidents || []), ...incidents]
                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                    .slice(0, 10)
                                    .map((incident) => (
                                        <div
                                            key={incident.id}
                                            className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-[hsl(var(--border))]"
                                        >
                                            <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                incident.newStatus === 'operational' ? 'bg-green-500' :
                                                    incident.newStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                    {incident.service}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {incident.previousStatus} → {incident.newStatus}
                                                </p>
                                            </div>
                                            <span className="text-xs text-slate-400">
                                                {formatRelativeTime(incident.timestamp)}
                                            </span>
                                        </div>
                                    ))}
                                {(!health?.recentIncidents?.length && !incidents.length) && (
                                    <p className="text-sm text-slate-400 text-center py-4">
                                        No recent incidents
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* System Info */}
                    <div className="bg-[hsl(var(--card))] rounded-xl p-5 border border-[hsl(var(--border))]">
                        <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">System Information</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Environment</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                                    {import.meta.env.MODE || 'production'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">API Version</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                                    {health?.version || '1.5.0'}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Timezone</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Server Time</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                                    {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SystemHealthPage;
