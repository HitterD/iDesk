import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Check, CheckCircle, Copy, Download, HardDrive, Layers, Pause, Play, Stethoscope, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ResHead } from '@/components/resources/ResourceParts';
import { MgBanner, MgPanel, MgTabs, useTabDirection } from '@/components/management/MgmtParts';
import { DashSkeletonList } from '@/features/dashboard/components/DashboardParts';
import { useHealthSocket, DetailedHealthStatus } from '../hooks/useHealthSocket';
import { EndToEndServiceMap } from '../components/system-health/EndToEndServiceMap';
import { StorageForecastingTab } from '../components/system-health/StorageForecastingTab';
import { WebSocketDiagnosticsModal } from '../components/system-health/WebSocketDiagnosticsModal';
import { HealthConnectors, HealthKpis } from '../components/system-health/HealthVitals';
import { HealthEnvPanel, HealthIncidentPanel, HealthLatencyPanel, HealthServicesPanel, type ServiceFilter } from '../components/system-health/HealthPanels';
import { formatRelativeTime } from '../components/system-health/healthFormat';
import '../components/system-health/system-health.css';

type HealthTab = 'vitals' | 'service-map' | 'storage-forecasting';
const TAB_ORDER: readonly HealthTab[] = ['vitals', 'service-map', 'storage-forecasting'];
const TAB_OPTIONS = [
    { value: 'vitals' as const, label: <span data-testid="tab-vitals">Overview &amp; Vitals</span>, icon: Activity },
    { value: 'service-map' as const, label: <span data-testid="tab-service-map">End-to-End Service Map</span>, icon: Layers },
    { value: 'storage-forecasting' as const, label: <span data-testid="tab-storage-forecasting">Storage Forecasting</span>, icon: HardDrive },
];

/** Live-stream state next to the title (mockup crumbs `.live`). */
const TelemetryLiveBadge: React.FC<{ isConnected: boolean; isSubscribed: boolean; isStale: boolean; isPaused: boolean; pingLatency: number | null; lastUpdate: Date | null }> = ({ isConnected, isSubscribed, isStale, isPaused, pingLatency, lastUpdate }) => {
    const elapsedSeconds = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : 0;
    if (isPaused) return <span className="hl-live is-off"><i />Stream dijeda</span>;
    if (isStale) return <span className="hl-live is-warn"><i />Basi ({elapsedSeconds} dtk)</span>;
    if (isConnected && isSubscribed) return <span className="hl-live"><i />Live{pingLatency !== null && <em>{pingLatency} ms</em>}</span>;
    return <span className="hl-live is-bad"><i />Terputus</span>;
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
        recentFrames,
        transportType,
        gatewayTelemetry,
        reconnectCount,
        togglePause,
        forceRefresh,
        triggerPingTest,
        clearFrames,
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
    const [activeTab, setActiveTab] = useState<HealthTab>('vitals');
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    const [isWsModalOpen, setIsWsModalOpen] = useState(false);
    const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
    const [serviceSearch, setServiceSearch] = useState('');
    const [copied, setCopied] = useState(false);

    // Manual full diagnostics trigger
    const handleRunDiagnostics = async () => {
        setIsDiagnosing(true);
        try {
            await forceRefresh();
            await refetch();
            toast.success('Diagnostik sistem diperbarui');
        } catch {
            toast.error('Gagal menjalankan diagnostik lengkap');
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
        toast.success('Snapshot diagnostik disalin ke clipboard');
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
        toast.success('Snapshot diagnostik diunduh');
    };

    const isInitialLoading = isLoading && !health;

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
        const counts: Record<ServiceFilter, number> = { all: services.length, operational: 0, degraded: 0, down: 0 };
        services.forEach(s => {
            if (s.status === 'operational') counts.operational++;
            else if (s.status === 'degraded') counts.degraded++;
            else if (s.status === 'down') counts.down++;
        });
        return counts;
    }, [services]);

    const tabDir = useTabDirection(TAB_ORDER, activeTab);
    const allIncidents = [...(health?.recentIncidents || []), ...incidents];
    const status = health?.status;
    const troubled = services.filter((s) => s.status !== 'operational').map((s) => s.name);
    const bannerTitle = status === 'ok' ? 'Semua sistem stabil' : status === 'degraded' ? 'Performa menurun terdeteksi' : 'Gangguan sistem terdeteksi';
    const sampled = lastUpdate ? formatRelativeTime(lastUpdate.toISOString()) : health?.timestamp ? formatRelativeTime(health.timestamp) : '-';

    return (
        <div className="res-page mg-page health-page">
            <ResHead icon={Activity} tone="green" title="System Health & Telemetry"
                description="Observabilitas operasional, metrik infrastruktur, dan integritas layanan"
                titleAdornment={<TelemetryLiveBadge isConnected={isConnected} isSubscribed={isSubscribed} isStale={isStale}
                    isPaused={isPaused} pingLatency={pingLatency} lastUpdate={lastUpdate} />}
                actions={<>
                    <Button variant="soft" onClick={togglePause}>
                        {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                        {isPaused ? 'Lanjutkan stream' : 'Jeda stream'}
                    </Button>
                    <Button variant="soft" onClick={handleDownloadReport}><Download aria-hidden="true" />Snapshot</Button>
                    <Button variant="subtle" onClick={handleCopyReport} aria-label="Salin snapshot JSON" title="Salin snapshot JSON">
                        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </Button>
                    <Button variant="primary" onClick={handleRunDiagnostics} disabled={isInitialLoading || isDiagnosing} loading={isDiagnosing}>
                        <Stethoscope aria-hidden="true" />Run Diagnostics
                    </Button>
                </>} />

            {!isInitialLoading && (
                <MgBanner tone={status === 'ok' ? 'ok' : status === 'degraded' ? 'warn' : 'crit'}
                    icon={status === 'ok' ? CheckCircle : status === 'degraded' ? AlertTriangle : XCircle} title={bannerTitle}>
                    {serviceCounts.operational}/{serviceCounts.all} subsistem sehat
                    {troubled.length > 0 && <> · terganggu: {troubled.join(', ')}</>}
                    {' '}· sampel {sampled} · cadence 2s fast / 30s slow · {import.meta.env.MODE || 'production'}
                </MgBanner>
            )}

            <div className="mb-4"><MgTabs label="System health" options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} /></div>

            {isInitialLoading ? (
                <section className="dash-panel" aria-label="Memuat telemetri" aria-busy="true">
                    <h3>Menghubungkan stream telemetri… <small>Memeriksa layanan infrastruktur dan metrik</small></h3>
                    <DashSkeletonList rows={5} />
                </section>
            ) : (
                <MgPanel key={activeTab} dir={tabDir}>
                    {activeTab === 'service-map' ? (
                        <EndToEndServiceMap health={health} realTraces={realTraces} incidents={incidents} />
                    ) : activeTab === 'storage-forecasting' ? (
                        <StorageForecastingTab />
                    ) : (
                        <>
                            <HealthKpis health={health} uptime={uptime} history={history} onOpenStorage={() => setActiveTab('storage-forecasting')} />
                            <div className="res-grid-main">
                                <div className="res-stack">
                                    {isDiagnosing ? (
                                        <section className="dash-panel" aria-busy="true" aria-label="5 Core Connectors"><h3>5 Core Connectors <small>Menjalankan diagnostik…</small></h3><DashSkeletonList rows={5} /></section>
                                    ) : (
                                        <HealthConnectors health={health} history={history} isConnected={isConnected} pingLatency={pingLatency}
                                            transportType={transportType} wsClients={gatewayTelemetry?.subscribers || health?.infrastructure?.websocket?.clients}
                                            synology={synology} synologyLoading={synologyLoading} onOpenWs={() => setIsWsModalOpen(true)} />
                                    )}
                                    <HealthServicesPanel services={filteredServices} counts={serviceCounts} filter={serviceFilter}
                                        onFilter={setServiceFilter} search={serviceSearch} onSearch={setServiceSearch} />
                                </div>
                                <div className="res-stack">
                                    <HealthLatencyPanel history={history} />
                                    <HealthIncidentPanel incidents={allIncidents} onCopy={handleCopyReport} />
                                    <HealthEnvPanel nodeVersion={health?.system?.nodeVersion} platform={health?.system?.platform} arch={health?.system?.arch} />
                                </div>
                            </div>
                        </>
                    )}
                </MgPanel>
            )}

            <WebSocketDiagnosticsModal
                isOpen={isWsModalOpen}
                onClose={() => setIsWsModalOpen(false)}
                isConnected={isConnected}
                pingLatency={pingLatency}
                transportType={transportType}
                gatewayTelemetry={gatewayTelemetry}
                recentFrames={recentFrames}
                reconnectCount={reconnectCount}
                triggerPingTest={triggerPingTest}
                clearFrames={clearFrames}
            />
        </div>
    );
};

export default SystemHealthPage;
