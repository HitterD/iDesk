import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    HardDrive,
    Database,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    Sliders,
    Layers,
    FileText,
    Image,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Server,
    ShieldAlert,
    ExternalLink,
    Zap,
    Info,
    ArrowUpRight,
} from 'lucide-react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    Legend,
} from 'recharts';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface StorageVitals {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    diskPath: string;
    platform: string;
    ideskUsedBytes?: number;
    ideskSaturationPercent?: number;
    serverFreeBytes?: number;
    serverTotalBytes?: number;
}

export interface TableStorageInfo {
    tableName: string;
    totalBytes: number;
    prettySize: string;
}

export interface StorageBreakdown {
    attachmentsBytes: number;
    databaseBytes: number;
    systemOverheadBytes: number;
    byFolder: Record<string, { count: number; sizeBytes: number }>;
    topTables: TableStorageInfo[];
}

export interface ProjectionPoint {
    timestamp: string;
    dayOffset: number;
    isProjected: boolean;
    baselineUsedBytes: number;
    highGrowthUsedBytes: number;
    peakGrowthUsedBytes: number;
    warningThresholdBytes: number;
    criticalThresholdBytes: number;
    totalCapacityBytes: number;
}

export interface ForecastingMetrics {
    growthRateBytesPerDay: number;
    growthRateBytesPerMonth: number;
    daysToWarningThreshold: number | null;
    daysToCriticalThreshold: number | null;
    estimatedWarningDate: string | null;
    estimatedFullDate: string | null;
    runwayStatus: 'healthy' | 'warning' | 'critical';
    timeToWarningFormatted: string;
    timeToCriticalFormatted: string;
}

export interface MitigationSavings {
    imageCompressionSavingsBytes: number;
    autoCleanupSavingsBytes: number;
    totalPotentialSavingsBytes: number;
}

export interface StorageAnalyticsData {
    vitals: StorageVitals;
    breakdown: StorageBreakdown;
    forecasting: ForecastingMetrics;
    projections: ProjectionPoint[];
    mitigations: MitigationSavings;
    sampledAt: string;
}

export const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
};

export const bytesToGB = (bytes: number): number => {
    return parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2));
};

const formatDateShort = (iso: string): string => {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch {
        return iso;
    }
};

const formatDateFull = (iso?: string | null): string => {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return iso;
    }
};

const formatRunwayDate = (iso?: string | null, days?: number | null): string => {
    if (!iso) return '-';
    if (days !== null && days !== undefined && days > 1095) {
        return '> 3 Tahun ke Depan (Aman)';
    }
    return formatDateFull(iso);
};

type HorizonMode = '30d' | '90d' | '180d' | '365d';
type ScenarioMode = 'all' | 'baseline' | 'high' | 'peak';

export const StorageForecastingTab: React.FC = () => {
    const [horizon, setHorizon] = useState<HorizonMode>('180d');
    const [scenario, setScenario] = useState<ScenarioMode>('all');
    const [simulatedExtraGB, setSimulatedExtraGB] = useState<number>(0);
    const [expandedPlatform, setExpandedPlatform] = useState<string | null>('synology');

    const {
        data,
        isLoading,
        isFetching,
        refetch,
    } = useQuery<StorageAnalyticsData>({
        queryKey: ['storage-analytics'],
        queryFn: async () => {
            const res = await api.get('/health/storage-analytics');
            return res.data;
        },
        refetchInterval: 30000,
    });

    // Fallback dummy for safe rendering before loaded
    const vitals = data?.vitals;
    const forecasting = data?.forecasting;
    const breakdown = data?.breakdown;
    const mitigations = data?.mitigations;
    const projections = data?.projections || [];

    // Filter projections by selected Horizon
    const filteredProjections = useMemo(() => {
        if (!projections.length) return [];
        const maxDays = horizon === '30d' ? 30 : horizon === '90d' ? 90 : horizon === '180d' ? 180 : 365;
        return projections
            .filter((p) => p.dayOffset <= maxDays)
            .map((p) => ({
                ...p,
                dateLabel: p.dayOffset === 0 ? 'Hari Ini' : formatDateShort(p.timestamp),
                baselineGB: bytesToGB(p.baselineUsedBytes),
                highGrowthGB: bytesToGB(p.highGrowthUsedBytes),
                peakGrowthGB: bytesToGB(p.peakGrowthUsedBytes),
                warningLimitGB: bytesToGB(p.warningThresholdBytes),
                criticalLimitGB: bytesToGB(p.criticalThresholdBytes),
                totalCapacityGB: bytesToGB(p.totalCapacityBytes),
                // Simulated capacity with extra GB
                simulatedTotalGB: bytesToGB(p.totalCapacityBytes) + simulatedExtraGB,
                simulatedWarningLimitGB: (bytesToGB(p.totalCapacityBytes) + simulatedExtraGB) * 0.85,
                simulatedCriticalLimitGB: (bytesToGB(p.totalCapacityBytes) + simulatedExtraGB) * 0.95,
            }));
    }, [projections, horizon, simulatedExtraGB]);

    // Calculate simulated runway with extra GB
    const simulatedRunway = useMemo(() => {
        if (!vitals || !forecasting) return null;
        const currentTotal = vitals.totalBytes;
        const simulatedTotal = currentTotal + (simulatedExtraGB * 1024 * 1024 * 1024);
        const criticalLimit = simulatedTotal * 0.95;
        const bytesLeft = Math.max(0, criticalLimit - vitals.usedBytes);
        const dailyVelocity = forecasting.growthRateBytesPerDay || (15 * 1024 * 1024);
        const daysRemaining = Math.round(bytesLeft / dailyVelocity);
        const extraDaysGained = daysRemaining - (forecasting.daysToCriticalThreshold || 0);
        const isCapped = daysRemaining > 1095;

        return {
            simulatedTotalBytes: simulatedTotal,
            daysRemaining,
            extraDaysGained: Math.max(0, extraDaysGained),
            newFullDate: new Date(Date.now() + Math.min(daysRemaining, 1095) * 86_400_000).toISOString(),
            isCapped,
        };
    }, [vitals, forecasting, simulatedExtraGB]);

    // Proportional breakdown percentages
    const breakdownPercentages = useMemo(() => {
        if (!vitals || !breakdown) return { attachments: 0, database: 0, system: 0 };
        const used = vitals.usedBytes || 1;
        return {
            attachments: Math.round((breakdown.attachmentsBytes / used) * 1000) / 10,
            database: Math.round((breakdown.databaseBytes / used) * 1000) / 10,
            system: Math.max(0, Math.round((breakdown.systemOverheadBytes / used) * 1000) / 10),
        };
    }, [vitals, breakdown]);

    if (isLoading) {
        return (
            <div className="bg-[hsl(var(--card))] rounded-2xl p-16 border border-[hsl(var(--border))] flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                    Memuat Analisa Disk Storage & Telemetri Forecasting...
                </p>
                <p className="text-xs text-slate-400">
                    Menganalisa kapasitas partisi sistem operasi, tabel database PostgreSQL, dan repositori berkas
                </p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="bg-[hsl(var(--card))] rounded-2xl p-12 border border-[hsl(var(--border))] text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Gagal Memuat Analisa Storage
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Tidak dapat membaca metrik partisi disk atau database. Pastikan backend iDesk berjalan normal.
                </p>
                <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Coba Lagi
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 1. Hero Runway Vitals Banner */}
            <div className="rounded-2xl p-5 lg:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-xs">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            Storage Analytics & Capacity Forecasting
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/15 text-primary border border-primary/30">
                            Datadog Capacity Planning
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                        Observabilitas kapasitas disk secara mendalam dengan proyeksi laju pertumbuhan (*time-to-full runway*),
                        dekomposisi data multi-tier, serta simulasi resolusi ekspansi volume server.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    {/* Status Badge */}
                    <div
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-xs",
                            forecasting?.runwayStatus === 'healthy'
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                                : forecasting?.runwayStatus === 'warning'
                                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40"
                        )}
                    >
                        {forecasting?.runwayStatus === 'healthy' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <AlertTriangle className="w-4 h-4" />
                        )}
                        <span>
                            Runway:{' '}
                            {forecasting?.runwayStatus === 'healthy'
                                ? 'Healthy (Aman)'
                                : forecasting?.runwayStatus === 'warning'
                                    ? 'Warning (Waspada)'
                                    : 'Critical (Kritis)'}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs text-slate-700 dark:text-slate-300"
                        title="Perbarui data sekarang"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-primary")} />
                        <span>{isFetching ? 'Memuat...' : 'Refresh'}</span>
                    </button>
                </div>
            </div>

            {/* 2. Key Metric Stat Cards (4 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Current iDesk Storage Saturation */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Kapasitas Data iDesk</span>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                            <Database className="w-3 h-3" />
                            <span>App Saturation</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Existing Sekarang:
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-2xl lg:text-3xl font-black font-mono text-slate-900 dark:text-white">
                                {formatBytes(vitals?.ideskUsedBytes ?? ((breakdown?.attachmentsBytes || 0) + (breakdown?.databaseBytes || 0)))}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                                ({vitals?.ideskSaturationPercent !== undefined ? `${vitals.ideskSaturationPercent}%` : '< 1%'})
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Uploads: <strong className="text-slate-800 dark:text-slate-200">{formatBytes(breakdown?.attachmentsBytes)}</strong> · DB: <strong className="text-cyan-600 dark:text-cyan-400">{formatBytes(breakdown?.databaseBytes)}</strong>
                        </p>
                    </div>
                    <div className="space-y-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                            <div
                                className="bg-primary h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(2, Math.min(100, vitals?.ideskSaturationPercent || 1))}%` }}
                                title={`Porsi Data iDesk: ${vitals?.ideskSaturationPercent || 0}%`}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>0 B</span>
                            <span>Total Volume: {formatBytes(vitals?.totalBytes)}</span>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <span>Sisa Kapasitas Server:</span>
                            <span className="font-mono">{formatBytes(vitals?.freeBytes)} Bebas</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[10px]">
                            <span>Host OS & Overhead:</span>
                            <span className="font-mono">{formatBytes(breakdown?.systemOverheadBytes)}</span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Runway to Warning Threshold (85%) */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Runway ke 85% (Warning)</span>
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 dark:text-white">
                            {forecasting?.timeToWarningFormatted || 'N/A'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Ambang Waspada (85%): <strong className="text-amber-600 dark:text-amber-400">{formatBytes(Math.round((vitals?.totalBytes || 0) * 0.85))}</strong>
                        </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Estimasi Tanggal:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatRunwayDate(forecasting?.estimatedWarningDate, forecasting?.daysToWarningThreshold)}
                        </span>
                    </div>
                </div>

                {/* Card 3: Runway to Critical Threshold (95% Full) */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Time-To-Full (95%)</span>
                        <Clock className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                        <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 dark:text-white">
                            {forecasting?.timeToCriticalFormatted || 'N/A'}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Kapasitas Penuh Kritis (95%): <strong className="text-rose-600 dark:text-rose-400">{formatBytes(Math.round((vitals?.totalBytes || 0) * 0.95))}</strong>
                        </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Estimasi Penuh:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatRunwayDate(forecasting?.estimatedFullDate, forecasting?.daysToCriticalThreshold)}
                        </span>
                    </div>
                </div>

                {/* Card 4: Daily Growth Velocity */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 border border-[hsl(var(--border))] shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Laju Pertumbuhan (Velocity)</span>
                        <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <div className="text-2xl lg:text-3xl font-black font-mono text-primary">
                            +{formatBytes(forecasting?.growthRateBytesPerDay)}
                            <span className="text-xs font-normal text-slate-400"> / hr</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Laju Bulanan: <strong className="text-slate-800 dark:text-slate-200">+{formatBytes(forecasting?.growthRateBytesPerMonth)} / bln</strong>
                        </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Run-rate 1 Tahun:</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            ~{formatBytes((forecasting?.growthRateBytesPerDay || 0) * 365)}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3. Datadog Capacity Planning Curve Chart */}
            <div className="bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-xs space-y-5">
                {/* Chart Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            <h3 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white">
                                Proyeksi Kurva Pertumbuhan & Capacity Runway
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Visualisasi proyeksi tren volume storage berdasarkan data historis dan skenario lonjakan beban
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Scenario Selector */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setScenario('all')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                                    scenario === 'all'
                                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                Semua Skenario
                            </button>
                            <button
                                type="button"
                                onClick={() => setScenario('baseline')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                                    scenario === 'baseline'
                                        ? "bg-white dark:bg-slate-900 text-primary shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                Baseline (1x)
                            </button>
                            <button
                                type="button"
                                onClick={() => setScenario('high')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                                    scenario === 'high'
                                        ? "bg-white dark:bg-slate-900 text-amber-600 shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                High (+50%)
                            </button>
                            <button
                                type="button"
                                onClick={() => setScenario('peak')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                                    scenario === 'peak'
                                        ? "bg-white dark:bg-slate-900 text-rose-600 shadow-2xs"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                Peak (2x)
                            </button>
                        </div>

                        {/* Horizon Selector */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
                            {(['30d', '90d', '180d', '365d'] as HorizonMode[]).map((h) => (
                                <button
                                    key={h}
                                    type="button"
                                    onClick={() => setHorizon(h)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg transition-all cursor-pointer",
                                        horizon === h
                                            ? "bg-primary text-primary-foreground shadow-2xs"
                                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                    )}
                                >
                                    {h === '30d' ? '30 Hari' : h === '90d' ? '90 Hari' : h === '180d' ? '180 Hari' : '1 Tahun'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chart Canvas */}
                <div className="w-full h-[360px] select-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={filteredProjections} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <defs>
                                <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
                            <XAxis
                                dataKey="dateLabel"
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
                                unit=" GB"
                                domain={[0, 'dataMax + 20']}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const dataPoint = payload[0].payload;
                                        return (
                                            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                                                <div className="font-bold border-b border-slate-800 pb-1 flex justify-between items-center">
                                                    <span>{dataPoint.dateLabel}</span>
                                                    <span className="text-[10px] font-mono text-slate-400">
                                                        {formatDateFull(dataPoint.timestamp)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-primary">
                                                    <span>Baseline (1.0x):</span>
                                                    <span className="font-mono font-bold">{dataPoint.baselineGB} GB</span>
                                                </div>
                                                {(scenario === 'all' || scenario === 'high') && (
                                                    <div className="flex justify-between items-center text-amber-400">
                                                        <span>High Load (+50%):</span>
                                                        <span className="font-mono font-bold">{dataPoint.highGrowthGB} GB</span>
                                                    </div>
                                                )}
                                                {(scenario === 'all' || scenario === 'peak') && (
                                                    <div className="flex justify-between items-center text-rose-400">
                                                        <span>Peak Surge (2.0x):</span>
                                                        <span className="font-mono font-bold">{dataPoint.peakGrowthGB} GB</span>
                                                    </div>
                                                )}
                                                <div className="border-t border-slate-800 pt-1 text-[11px] text-slate-400 flex justify-between">
                                                    <span>Warning (85%):</span>
                                                    <span className="font-mono text-amber-400">{dataPoint.warningLimitGB} GB</span>
                                                </div>
                                                <div className="text-[11px] text-slate-400 flex justify-between">
                                                    <span>Critical (95%):</span>
                                                    <span className="font-mono text-rose-400">{dataPoint.criticalLimitGB} GB</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />

                            {/* Reference Lines */}
                            {filteredProjections[0] && (
                                <>
                                    <ReferenceLine
                                        y={filteredProjections[0].criticalLimitGB}
                                        stroke="#f43f5e"
                                        strokeDasharray="4 4"
                                        strokeWidth={1.5}
                                        label={{
                                            value: `Kritis 95% (${filteredProjections[0].criticalLimitGB} GB)`,
                                            fill: '#f43f5e',
                                            fontSize: 10,
                                            position: 'insideTopRight',
                                        }}
                                    />
                                    <ReferenceLine
                                        y={filteredProjections[0].warningLimitGB}
                                        stroke="#f59e0b"
                                        strokeDasharray="4 4"
                                        strokeWidth={1.5}
                                        label={{
                                            value: `Waspada 85% (${filteredProjections[0].warningLimitGB} GB)`,
                                            fill: '#f59e0b',
                                            fontSize: 10,
                                            position: 'insideTopRight',
                                        }}
                                    />
                                    {simulatedExtraGB > 0 && (
                                        <ReferenceLine
                                            y={filteredProjections[0].simulatedTotalGB}
                                            stroke="#10b981"
                                            strokeDasharray="3 3"
                                            strokeWidth={2}
                                            label={{
                                                value: `Simulasi Resize (${filteredProjections[0].simulatedTotalGB} GB)`,
                                                fill: '#10b981',
                                                fontSize: 10,
                                                position: 'insideTopRight',
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {/* Projections curves */}
                            {(scenario === 'all' || scenario === 'baseline') && (
                                <Area
                                    type="monotone"
                                    dataKey="baselineGB"
                                    name="Baseline Growth (1.0x)"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2.5}
                                    fill="url(#baselineGradient)"
                                    activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                                />
                            )}

                            {(scenario === 'all' || scenario === 'high') && (
                                <Line
                                    type="monotone"
                                    dataKey="highGrowthGB"
                                    name="High Load (+50%)"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="4 4"
                                    dot={false}
                                />
                            )}

                            {(scenario === 'all' || scenario === 'peak') && (
                                <Line
                                    type="monotone"
                                    dataKey="peakGrowthGB"
                                    name="Peak Surge (2.0x)"
                                    stroke="#f43f5e"
                                    strokeWidth={2}
                                    strokeDasharray="3 3"
                                    dot={false}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart Legend Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-primary" />
                            <strong className="text-slate-700 dark:text-slate-300">Baseline</strong> (Tren aktual saat ini)
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 bg-amber-500 border-dashed" />
                            <strong className="text-amber-600 dark:text-amber-400">High (+50%)</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 bg-rose-500 border-dashed" />
                            <strong className="text-rose-600 dark:text-rose-400">Peak (2.0x)</strong>
                        </span>
                    </div>

                    <div className="text-[11px] text-slate-400">
                        * Titik "Hari Ini" menunjukkan posisi aktual volume data tersimpan saat ini.
                    </div>
                </div>
            </div>

            {/* 4. Multi-Tier Composition & PostgreSQL Table Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Multi-Tier Storage Volume breakdown */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Dekomposisi Komponen Storage
                            </h3>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-mono font-bold text-primary block">
                                iDesk App: {formatBytes(vitals?.ideskUsedBytes ?? ((breakdown?.attachmentsBytes || 0) + (breakdown?.databaseBytes || 0)))}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                                Partisi Host: {formatBytes(vitals?.usedBytes)} / {formatBytes(vitals?.totalBytes)}
                            </span>
                        </div>
                    </div>

                    {/* Stacked Visual Bar */}
                    <div className="space-y-1.5">
                        <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                            <div
                                style={{ width: `${breakdownPercentages.attachments}%` }}
                                className="bg-primary h-full"
                                title={`Lampiran Tiket: ${breakdownPercentages.attachments}%`}
                            />
                            <div
                                style={{ width: `${breakdownPercentages.database}%` }}
                                className="bg-cyan-500 h-full"
                                title={`Database PostgreSQL: ${breakdownPercentages.database}%`}
                            />
                            <div
                                style={{ width: `${breakdownPercentages.system}%` }}
                                className="bg-slate-400 dark:bg-slate-600 h-full"
                                title={`System Overhead: ${breakdownPercentages.system}%`}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>0 GB</span>
                            <span>{formatBytes(vitals?.usedBytes)} Terpakai</span>
                        </div>
                    </div>

                    {/* Tier Rows */}
                    <div className="space-y-2.5 pt-1">
                        {/* Tier 1: Attachments */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">
                                        Lampiran Tiket & Berkas Uploads
                                    </h4>
                                    <p className="text-[11px] text-slate-400">
                                        Gambar screenshot, file PDF, dan dokumen tiket klien
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatBytes(breakdown?.attachmentsBytes)}
                                </div>
                                <span className="text-[10px] font-mono text-primary font-bold">
                                    {breakdownPercentages.attachments}%
                                </span>
                            </div>
                        </div>

                        {/* Tier 2: PostgreSQL Database */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                                    <Database className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">
                                        Database PostgreSQL
                                    </h4>
                                    <p className="text-[11px] text-slate-400">
                                        Tabel data transaksi, chat messages, riwayat audit, dan konfigurasi
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatBytes(breakdown?.databaseBytes)}
                                </div>
                                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                                    {breakdownPercentages.database}%
                                </span>
                            </div>
                        </div>

                        {/* Tier 3: System Overhead */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                    <Server className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">
                                        Sistem Operasi & Berkas Aplikasi
                                    </h4>
                                    <p className="text-[11px] text-slate-400">
                                        OS root binaries, Node.js packages, log file, dan berkas sistem
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                    {formatBytes(breakdown?.systemOverheadBytes)}
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 font-bold">
                                    {breakdownPercentages.system}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Top PostgreSQL Database Tables */}
                <div className="bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-cyan-500" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Tabel Database Terbesar (Top 6)
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            PostgreSQL Engine
                        </span>
                    </div>

                    <div className="space-y-3">
                        {breakdown?.topTables && breakdown.topTables.length > 0 ? (
                            breakdown.topTables.map((t, idx) => {
                                const maxTableBytes = breakdown.topTables[0]?.totalBytes || 1;
                                const pctOfMax = Math.round((t.totalBytes / maxTableBytes) * 100);

                                return (
                                    <div key={t.tableName} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                                                <span>{t.tableName}</span>
                                            </span>
                                            <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                                                {t.prettySize}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                className="bg-cyan-500 h-full rounded-full transition-all duration-300"
                                                style={{ width: `${Math.max(4, pctOfMax)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs text-slate-400">
                                Sedang mengindeks ukuran tabel database...
                            </div>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/50 dark:border-cyan-900/40 text-xs text-cyan-800 dark:text-cyan-300 flex items-start gap-2.5">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
                        <p className="text-[11px] leading-relaxed">
                            Ukuran tabel mencakup data baris beserta <em>Index (B-Tree/GIN)</em> dan <em>TOAST storage</em> untuk lampiran JSON & teks panjang.
                        </p>
                    </div>
                </div>
            </div>

            {/* 5. Actionable Resolution & Resizing Simulator (Dual-Path) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Interactive Disk Resizing Simulator (7 Cols) */}
                <div className="lg:col-span-7 bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-primary" />
                            <h3 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white">
                                Simulator Resizing Disk (Capacity Planning)
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                            Interactive
                        </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                        Geser slider di bawah untuk mensimulasikan penambahan kapasitas volume disk server (fisik/VM)
                        dan melihat secara instan perpanjangan waktu *runway* yang didapatkan.
                    </p>

                    {/* Simulation Slider Controls */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Tambah Kapasitas Disk:
                            </span>
                            <span className="text-sm font-mono font-bold text-primary">
                                +{simulatedExtraGB} GB{' '}
                                <span className="text-xs font-normal text-slate-400">
                                    (Total:{' '}
                                    {bytesToGB(vitals?.totalBytes || 0) + simulatedExtraGB} GB)
                                </span>
                            </span>
                        </div>

                        <input
                            type="range"
                            min={0}
                            max={1500}
                            step={25}
                            value={simulatedExtraGB}
                            onChange={(e) => setSimulatedExtraGB(parseInt(e.target.value, 10))}
                            className="w-full accent-primary h-2 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                        />

                        {/* Preset Chips */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                            <span className="text-[10px] text-slate-400 font-medium">Preset Cepat:</span>
                            {[50, 100, 250, 500, 1000].map((gb) => (
                                <button
                                    key={gb}
                                    type="button"
                                    onClick={() => setSimulatedExtraGB(gb)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border",
                                        simulatedExtraGB === gb
                                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                >
                                    +{gb} GB
                                </button>
                            ))}
                            {simulatedExtraGB > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSimulatedExtraGB(0)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Simulation Result Box */}
                    {simulatedExtraGB > 0 ? (
                        <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                <Sparkles className="w-4 h-4 text-emerald-600" />
                                <span>Hasil Estimasi Simulasi Ekstensi Volume:</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                                        Tambahan Waktu Runway:
                                    </span>
                                    <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
                                        {simulatedRunway?.isCapped
                                            ? '> 3 Tahun (Kapasitas Sangat Longgar)'
                                            : `+${simulatedRunway?.extraDaysGained} Hari (~${Math.round((simulatedRunway?.extraDaysGained || 0) / 30)} Bulan)`}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                                        Estimasi Kritis Baru (95%):
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {formatRunwayDate(simulatedRunway?.newFullDate, simulatedRunway?.daysRemaining)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                                Rekomendasi ideal: Tambahkan minimal <strong>+100 GB</strong> bila ingin mengamankan operasional sistem tanpa intervensi selama 2 tahun ke depan.
                            </span>
                        </div>
                    )}

                    {/* Technical Platform Expansion Checklist */}
                    <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Panduan Teknis Langkah Resize Volume Server:
                        </span>

                        <div className="space-y-1.5 text-xs">
                            {/* Synology NAS */}
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpandedPlatform(expandedPlatform === 'synology' ? null : 'synology')}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between font-bold text-slate-900 dark:text-white text-left cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Server className="w-4 h-4 text-primary" />
                                        <span>Synology DSM NAS (Storage Pool & Volume)</span>
                                    </span>
                                    {expandedPlatform === 'synology' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {expandedPlatform === 'synology' && (
                                    <div className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed text-[11px]">
                                        <p>1. Buka <strong>Storage Manager</strong> di Synology DSM.</p>
                                        <p>2. Pilih <strong>Storage Pool</strong> &gt; klik <em>Action</em> &gt; <em>Add Drive</em> atau ganti HDD/SSD dengan kapasitas lebih besar.</p>
                                        <p>3. Pilih <strong>Volume</strong> tempat iDesk berada &gt; klik titik tiga &gt; <em>Settings</em> &gt; Ubah <em>Modify Allocated Size</em> ke ukuran baru.</p>
                                    </div>
                                )}
                            </div>

                            {/* Proxmox / VMware VM */}
                            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpandedPlatform(expandedPlatform === 'vm' ? null : 'vm')}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between font-bold text-slate-900 dark:text-white text-left cursor-pointer"
                                >
                                    <span className="flex items-center gap-2">
                                        <Server className="w-4 h-4 text-cyan-600" />
                                        <span>Virtual Machine (VMware ESXi / Proxmox VE)</span>
                                    </span>
                                    {expandedPlatform === 'vm' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {expandedPlatform === 'vm' && (
                                    <div className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed text-[11px]">
                                        <p>1. Edit konfigurasi VM di Hypervisor &gt; naikkan ukuran <em>Virtual Disk</em> (misal +100 GB).</p>
                                        <p>2. Di dalam guest OS Linux: jalankan <code>growpart /dev/sda 1</code> kemudian <code>resize2fs /dev/sda1</code>.</p>
                                        <p>3. Di Windows Server: buka <em>diskmgmt.msc</em> &gt; klik kanan partisi C: &gt; <em>Extend Volume</em>.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Zero-Cost Quick Mitigations (5 Cols) */}
                <div className="lg:col-span-5 bg-[hsl(var(--card))] rounded-2xl p-5 lg:p-6 border border-[hsl(var(--border))] shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <h3 className="text-sm lg:text-base font-bold text-slate-900 dark:text-white">
                                Mitigasi Cepat (Zero-Cost)
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                            Tanpa Biaya
                        </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                        Kosongkan ruang disk yang terpakai tanpa harus menambah hardware baru melalui fitur optimasi yang sudah tersedia di iDesk:
                    </p>

                    <div className="space-y-3">
                        {/* Mitigation 1: Sharp Image Compression */}
                        <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                                        <Image className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                            Kompresi Gambar Lampiran (Sharp)
                                        </h4>
                                        <span className="text-[10px] text-slate-400">
                                            Kompres berkas foto JPEG/PNG lama tanpa mengurangi keterbacaan
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-xs text-slate-500">Estimasi Penghematan:</span>
                                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    ~{formatBytes(mitigations?.imageCompressionSavingsBytes)}
                                </span>
                            </div>
                            <Link
                                to="/admin/settings/storage"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold shadow-2xs transition-colors"
                            >
                                <span>Buka Pengaturan Kompresi</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>

                        {/* Mitigation 2: Ticket Retention Auto-cleanup */}
                        <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                            Retensi Tiket Lama (&gt;90 Hari)
                                        </h4>
                                        <span className="text-[10px] text-slate-400">
                                            Hapus lampiran dari tiket terselesaikan yang telah melewati masa retensi
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <span className="text-xs text-slate-500">Estimasi Penghematan:</span>
                                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    ~{formatBytes(mitigations?.autoCleanupSavingsBytes)}
                                </span>
                            </div>
                            <Link
                                to="/admin/settings/storage"
                                className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold shadow-2xs transition-colors"
                            >
                                <span>Konfigurasi Retensi Tiket</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>

                    {/* Total potential savings summary */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
                        <span className="font-medium text-emerald-800 dark:text-emerald-300">
                            Total Potensi Pengosongan:
                        </span>
                        <span className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300">
                            ~{formatBytes(mitigations?.totalPotentialSavingsBytes)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
