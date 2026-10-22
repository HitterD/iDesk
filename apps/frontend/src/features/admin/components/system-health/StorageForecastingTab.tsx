import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle2, Database, FileText, Info, RefreshCw, Server } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ResEmpty, resVars } from '@/components/resources/ResourceParts';
import { MgBanner } from '@/components/management/MgmtParts';
import { DashEmpty, DashSkeletonList } from '@/features/dashboard/components/DashboardParts';
import { Mitigations, ProjectionChart, ResizeSimulator, StorageBar, type HorizonMode, type ScenarioMode } from './StorageForecastingParts';
import './system-health.css';

const WARN_RATIO = 0.85;
const CRIT_RATIO = 0.95;
const DAYS_PER_YEAR = 365;

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
            <section className="dash-panel" aria-busy="true" aria-label="Memuat analisa storage">
                <h3>Memuat analisa disk storage &amp; forecasting… <small>Partisi OS, tabel PostgreSQL, dan repositori berkas</small></h3>
                <DashSkeletonList rows={4} />
            </section>
        );
    }

    if (!data) {
        return (
            <section className="dash-panel" aria-label="Gagal memuat analisa storage">
                <ResEmpty icon={AlertCircle} title="Gagal Memuat Analisa Storage"
                    cta={<Button variant="soft" onClick={() => refetch()}><RefreshCw aria-hidden="true" />Coba Lagi</Button>}>
                    <p>Tidak dapat membaca metrik partisi disk atau database. Pastikan backend iDesk berjalan normal.</p>
                </ResEmpty>
            </section>
        );
    }

    const runway = forecasting?.runwayStatus;
    const runwayTone = runway === 'healthy' ? 'ok' : runway === 'warning' ? 'warn' : 'crit';
    const runwayLabel = runway === 'healthy' ? 'Healthy (Aman)' : runway === 'warning' ? 'Warning (Waspada)' : 'Critical (Kritis)';
    const ideskBytes = vitals?.ideskUsedBytes ?? ((breakdown?.attachmentsBytes || 0) + (breakdown?.databaseBytes || 0));
    const topTables = breakdown?.topTables ?? [];
    const maxTableBytes = topTables[0]?.totalBytes || 1;

    return (
        <div className="hl-section">
            <MgBanner tone={runwayTone} icon={runway === 'healthy' ? CheckCircle2 : AlertTriangle} title={<>Storage Analytics &amp; Capacity Forecasting · Runway: {runwayLabel}</>}
                actions={<Button variant="soft" size="sm" onClick={() => refetch()} disabled={isFetching} title="Perbarui data sekarang">
                    <RefreshCw aria-hidden="true" className={isFetching ? 'animate-spin' : undefined} />{isFetching ? 'Memuat…' : 'Refresh'}
                </Button>}>
                Perkiraan kritis (95%) {formatRunwayDate(forecasting?.estimatedFullDate, forecasting?.daysToCriticalThreshold)} pada laju saat ini · partisi {vitals?.diskPath} ({vitals?.platform})
            </MgBanner>

            <section className="res-kpis" aria-label="Metrik kapasitas">
                <div className="res-kpi">
                    <span>Kapasitas Data iDesk · Current Saturation</span>
                    <span className="res-kpi-n">{formatBytes(ideskBytes)}<small> {vitals?.ideskSaturationPercent !== undefined ? `${vitals.ideskSaturationPercent}%` : '< 1%'}</small></span>
                    <span className="res-meter hl-meter" style={resVars({ '--c': 'hsl(var(--idesk-sapphire))' })} title={`Porsi Data iDesk: ${vitals?.ideskSaturationPercent || 0}%`}>
                        <i style={resVars({ '--p': `${Math.max(2, Math.min(100, vitals?.ideskSaturationPercent || 1))}%` })} />
                    </span>
                    <p>Uploads {formatBytes(breakdown?.attachmentsBytes)} · DB {formatBytes(breakdown?.databaseBytes)} · bebas {formatBytes(vitals?.freeBytes)} dari {formatBytes(vitals?.totalBytes)} · host OS {formatBytes(breakdown?.systemOverheadBytes)}</p>
                </div>
                <div className="res-kpi">
                    <span>Runway ke 85% (Warning)</span>
                    <span className="res-kpi-n">{forecasting?.timeToWarningFormatted || 'N/A'}</span>
                    <p>Ambang waspada {formatBytes(Math.round((vitals?.totalBytes || 0) * WARN_RATIO))} · estimasi {formatRunwayDate(forecasting?.estimatedWarningDate, forecasting?.daysToWarningThreshold)}</p>
                </div>
                <div className="res-kpi" style={resVars({ '--ink': 'var(--dash-ink-red)' })}>
                    <span>Time-To-Full (95%)</span>
                    <span className="res-kpi-n">{forecasting?.timeToCriticalFormatted || 'N/A'}</span>
                    <p>Penuh kritis {formatBytes(Math.round((vitals?.totalBytes || 0) * CRIT_RATIO))} · estimasi {formatRunwayDate(forecasting?.estimatedFullDate, forecasting?.daysToCriticalThreshold)}</p>
                </div>
                <div className="res-kpi">
                    <span>Laju Pertumbuhan (Velocity)</span>
                    <span className="res-kpi-n">+{formatBytes(forecasting?.growthRateBytesPerDay)}<small> / hr</small></span>
                    <p>+{formatBytes(forecasting?.growthRateBytesPerMonth)} / bln · run-rate 1 tahun ~{formatBytes((forecasting?.growthRateBytesPerDay || 0) * DAYS_PER_YEAR)}</p>
                </div>
            </section>

            <ProjectionChart rows={filteredProjections} scenario={scenario} onScenario={setScenario} horizon={horizon} onHorizon={setHorizon}
                simulatedExtraGB={simulatedExtraGB} fullDate={formatDateFull} />

            <div className="res-grid2">
                <section className="dash-panel" aria-label="Dekomposisi komponen storage">
                    <h3>Dekomposisi Komponen Storage <small>iDesk {formatBytes(ideskBytes)} · partisi {formatBytes(vitals?.usedBytes)} / {formatBytes(vitals?.totalBytes)}</small></h3>
                    <div className="dash-hbars">
                        <StorageBar label="Lampiran tiket" pct={breakdownPercentages.attachments} value={`${breakdownPercentages.attachments}%`} color="hsl(var(--idesk-sapphire))"
                            title={`Lampiran Tiket & Berkas Uploads: ${formatBytes(breakdown?.attachmentsBytes)}`} />
                        <StorageBar label="Database PostgreSQL" pct={breakdownPercentages.database} value={`${breakdownPercentages.database}%`} color="var(--dash-teal)"
                            title={`Database PostgreSQL: ${formatBytes(breakdown?.databaseBytes)}`} />
                        <StorageBar label="OS & aplikasi" pct={breakdownPercentages.system} value={`${breakdownPercentages.system}%`} color="var(--dash-gray)"
                            title={`Sistem Operasi & Berkas Aplikasi: ${formatBytes(breakdown?.systemOverheadBytes)}`} />
                    </div>
                    <ul className="dash-list hl-mt">
                        <li><div className="dash-li"><span className="dash-ico" style={resVars({ '--c': 'hsl(var(--idesk-sapphire))' })}><FileText aria-hidden="true" /></span>
                            <div className="grow1"><b>Lampiran Tiket &amp; Berkas Uploads</b><small>Screenshot, PDF, dan dokumen tiket klien</small></div><b className="hl-num">{formatBytes(breakdown?.attachmentsBytes)}</b></div></li>
                        <li><div className="dash-li"><span className="dash-ico" style={resVars({ '--c': 'var(--dash-teal)' })}><Database aria-hidden="true" /></span>
                            <div className="grow1"><b>Database PostgreSQL</b><small>Transaksi, chat, riwayat audit, konfigurasi</small></div><b className="hl-num">{formatBytes(breakdown?.databaseBytes)}</b></div></li>
                        <li><div className="dash-li"><span className="dash-ico" style={resVars({ '--c': 'var(--dash-gray)' })}><Server aria-hidden="true" /></span>
                            <div className="grow1"><b>Sistem Operasi &amp; Berkas Aplikasi</b><small>Binary OS, paket Node.js, log, berkas sistem</small></div><b className="hl-num">{formatBytes(breakdown?.systemOverheadBytes)}</b></div></li>
                    </ul>
                </section>

                <section className="dash-panel" aria-label="Tabel database terbesar">
                    <h3>Tabel Database Terbesar (Top 6) <small>PostgreSQL</small></h3>
                    {topTables.length > 0 ? (
                        <div className="dash-hbars">
                            {topTables.map((t) => (
                                <StorageBar key={t.tableName} mono label={t.tableName} pct={Math.max(4, Math.round((t.totalBytes / maxTableBytes) * 100))} value={t.prettySize} color="var(--dash-teal)" />
                            ))}
                        </div>
                    ) : (
                        <DashEmpty icon={<Database aria-hidden="true" />}>Sedang mengindeks ukuran tabel database…</DashEmpty>
                    )}
                    <div className="res-note"><Info aria-hidden="true" /><span>Ukuran tabel mencakup baris data, index (B-Tree/GIN), dan TOAST storage untuk JSON &amp; teks panjang.</span></div>
                </section>
            </div>

            <div className="res-grid-main">
                <ResizeSimulator extraGB={simulatedExtraGB} onExtra={setSimulatedExtraGB} totalGB={bytesToGB(vitals?.totalBytes || 0)} result={simulatedRunway}
                    runwayDate={formatRunwayDate} expanded={expandedPlatform} onExpand={setExpandedPlatform} />
                <Mitigations imageBytes={formatBytes(mitigations?.imageCompressionSavingsBytes)} cleanupBytes={formatBytes(mitigations?.autoCleanupSavingsBytes)}
                    totalBytes={formatBytes(mitigations?.totalPotentialSavingsBytes)} />
            </div>
        </div>
    );
};
