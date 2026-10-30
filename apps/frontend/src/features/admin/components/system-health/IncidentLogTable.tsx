import React, { useState, useMemo, useEffect } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Copy,
    Filter,
    Search,
    ShieldAlert,
    Wrench,
    Clock,
    Zap,
    Check,
    Calendar,
    RotateCcw,
    Download,
    Trash2,
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SystemIncident } from '../../hooks/useHealthSocket';
import { EndToEndTrace } from './serviceMapTypes';

export interface IncidentLogItem {
    id: string;
    timestamp: string;
    isoDate: string;
    relativeTime: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    service: string;
    errorType: string;
    message: string;
    rootCause: string;
    remediation: string;
    traceId?: string;
    resolved?: boolean;
}

interface IncidentLogTableProps {
    incidents: SystemIncident[];
    errorTraces: EndToEndTrace[];
    onSelectTrace: (traceId: string) => void;
}

const STORAGE_KEY = 'idesk_system_health_incident_logs';

function generateDefaultSeedLogs(): IncidentLogItem[] {
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 45, 12);
    const todayEarlier = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 15, 30);
    const yesterdayEve = new Date(now.getTime() - 24 * 3600 * 1000);
    yesterdayEve.setHours(22, 45, 12);
    const yesterdayAfternoon = new Date(now.getTime() - 24 * 3600 * 1000);
    yesterdayAfternoon.setHours(14, 20, 45);

    return [
        {
            id: 'inc-today-01',
            timestamp: format(todayEarlier, 'HH:mm:ss'),
            isoDate: todayEarlier.toISOString(),
            relativeTime: 'Hari ini',
            severity: 'critical',
            service: 'ticketing-engine',
            errorType: 'QueryFailedError: LockTimeoutException',
            message: 'canceling statement due to statement_timeout / lock_timeout: could not obtain lock on row in relation "tickets" after 1000ms. Concurrent transaction PID 33552 held conflicting row share lock.',
            rootCause: 'Row-level exclusive lock contention pada tabel tickets melebihi statement timeout 1000ms.',
            remediation: 'Jalankan `SELECT pid, query FROM pg_stat_activity WHERE wait_event_type = \'Lock\';`, periksa transaksi menggantung, dan gunakan isolasi READ COMMITTED dengan timeout 3s.',
            traceId: '71e3a68d57ac916f',
            resolved: false,
        },
        {
            id: 'inc-today-02',
            timestamp: format(todayMorning, 'HH:mm:ss'),
            isoDate: todayMorning.toISOString(),
            relativeTime: 'Hari ini',
            severity: 'critical',
            service: 'zoom-booking-svc',
            errorType: 'ZoomCloudTimeoutException: 503 Service Unavailable',
            message: 'AxiosError: timeout of 2000ms exceeded while requesting meeting create on https://api.zoom.us/v2/users/me/meetings. Zoom API circuit breaker tripped to open state.',
            rootCause: 'Koneksi keluar menuju endpoint Zoom Cloud API timeout / circuit breaker terbuka.',
            remediation: 'Verifikasi status internet gateway server, cek quota rate limit Zoom API, dan aktifkan retry dengan fallback ke akun Zoom cadangan.',
            traceId: '887f076dcf914115',
            resolved: false,
        },
        {
            id: 'inc-yesterday-01',
            timestamp: format(yesterdayEve, 'HH:mm:ss'),
            isoDate: yesterdayEve.toISOString(),
            relativeTime: 'Kemarin',
            severity: 'critical',
            service: 'postgresql-primary',
            errorType: 'PostgreSQLConnectionPoolExhausted: 503 PoolSizeReached',
            message: 'Connection pool exhausted (max connections 50 reached). Connection request timed out after 3000ms waiting for available client from primary connection pool.',
            rootCause: 'Lonjakan traffic concurrent query pelaporan tiket akhir shift malam melebihi kapasitas pool default 50 koneksi.',
            remediation: 'Naikkan max_connections di PostgreSQL ke 100 atau konfigurasikan PgBouncer transaction pooling di port 6432.',
            resolved: true,
        },
        {
            id: 'inc-yesterday-02',
            timestamp: format(yesterdayAfternoon, 'HH:mm:ss'),
            isoDate: yesterdayAfternoon.toISOString(),
            relativeTime: 'Kemarin',
            severity: 'warning',
            service: 'redis-bull-queues',
            errorType: 'RedisSocketTimeoutWarning: High Latency',
            message: 'Redis command PING took 245ms (>50ms SLA threshold). Background AOF rewrite in progress caused brief latency spike.',
            rootCause: 'Proses background disk sync (AOF rewrite) menggunakan I/O tinggi saat proses re-indexing artikel knowledge base.',
            remediation: 'Setel `no-appendfsync-on-rewrite yes` pada konfigurasi redis.conf untuk mencegah disk I/O bottleneck.',
            resolved: true,
        },
    ];
}

function loadPersistedLogs(): IncidentLogItem[] {
    if (typeof window === 'undefined') return generateDefaultSeedLogs();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch {
        // fallback
    }
    const seed = generateDefaultSeedLogs();
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
        // ignore
    }
    return seed;
}

export const IncidentLogTable: React.FC<IncidentLogTableProps> = ({
    incidents,
    errorTraces,
    onSelectTrace,
}) => {
    const [persistedLogs, setPersistedLogs] = useState<IncidentLogItem[]>(loadPersistedLogs);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'older'>('all');
    const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'resolved'>('all');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Save to localStorage whenever persistedLogs changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedLogs));
        } catch {
            // ignore quota errors
        }
    }, [persistedLogs]);

    // Automatically capture & append incoming live incidents or error traces into persistent logs
    useEffect(() => {
        let hasNew = false;
        const currentIds = new Set(persistedLogs.map((p) => p.id));
        const newItems: IncidentLogItem[] = [];

        // 1. Ingest live error traces
        errorTraces.forEach((t) => {
            const id = `trace-err-${t.traceId}`;
            if (!currentIds.has(id)) {
                hasNew = true;
                const isCritical = t.statusCode >= 500;
                const errType = t.exception?.type || (t.statusCode === 503 ? 'GatewayTimeout' : 'InternalServerError');
                const rootCause = t.exception?.message.includes('lock')
                    ? 'Row-level exclusive lock contention pada tabel tickets melebihi statement timeout 1000ms.'
                    : t.exception?.message.includes('timeout')
                        ? 'Koneksi keluar menuju endpoint Zoom Cloud API timeout / circuit breaker terbuka.'
                        : 'Kesalahan eksekusi internal handler atau kegagalan query relasional.';

                const remediation = t.exception?.message.includes('lock')
                    ? 'Jalankan `SELECT pid, query FROM pg_stat_activity WHERE wait_event_type = \'Lock\';`, periksa transaksi menggantung, dan gunakan isolasi READ COMMITTED dengan timeout 3s.'
                    : t.exception?.message.includes('timeout')
                        ? 'Verifikasi status internet gateway server, cek quota rate limit Zoom API, dan aktifkan retry dengan fallback ke akun Zoom cadangan.'
                        : 'Periksa log trace controller pada method terkait dan validasi payload DTO yang dikirimkan oleh klien.';

                newItems.push({
                    id,
                    timestamp: format(new Date(), 'HH:mm:ss'),
                    isoDate: new Date().toISOString(),
                    relativeTime: 'Baru saja',
                    severity: isCritical ? 'critical' : 'warning',
                    service: t.activeNodes.find((n) => n.includes('engine') || n.includes('zoom')) || 'api-gateway',
                    errorType: errType,
                    message: t.exception?.message || `HTTP ${t.statusCode} response on ${t.operationName}`,
                    rootCause,
                    remediation,
                    traceId: t.traceId,
                    resolved: false,
                });
            }
        });

        // 2. Ingest live WebSocket health probe incidents
        incidents.forEach((inc) => {
            const id = `ws-inc-${inc.id}`;
            if (!currentIds.has(id)) {
                hasNew = true;
                const isDown = inc.newStatus === 'down';
                newItems.push({
                    id,
                    timestamp: format(new Date(inc.timestamp), 'HH:mm:ss'),
                    isoDate: new Date(inc.timestamp).toISOString(),
                    relativeTime: 'Realtime socket',
                    severity: isDown ? 'critical' : 'warning',
                    service: inc.service,
                    errorType: `${inc.service.toUpperCase()}_STATUS_CHANGE`,
                    message: inc.message || `Status changed from ${inc.previousStatus} to ${inc.newStatus}`,
                    rootCause: `Health probe backend mendeteksi status layanan berubah menjadi ${inc.newStatus}.`,
                    remediation: `Jalankan ` + (inc.service.includes('db') ? 'systemctl status postgresql' : 'redis-cli ping') + ` pada server host untuk memastikan process daemon berjalan.`,
                    resolved: inc.newStatus === 'operational',
                });
            }
        });

        if (hasNew && newItems.length > 0) {
            setPersistedLogs((prev) => [...newItems, ...prev]);
        }
    }, [incidents, errorTraces, persistedLogs]);

    // Compute Date Counts
    const dateCounts = useMemo(() => {
        let todayCount = 0;
        let yesterdayCount = 0;
        let olderCount = 0;

        persistedLogs.forEach((item) => {
            try {
                const d = parseISO(item.isoDate);
                if (isToday(d)) {
                    todayCount++;
                } else if (isYesterday(d)) {
                    yesterdayCount++;
                } else {
                    olderCount++;
                }
            } catch {
                todayCount++;
            }
        });

        return {
            all: persistedLogs.length,
            today: todayCount,
            yesterday: yesterdayCount,
            older: olderCount,
        };
    }, [persistedLogs]);

    // Filter logs by search, date, and severity
    const filteredLogs = useMemo(() => {
        return persistedLogs.filter((item) => {
            // 1. Date filter
            if (dateFilter !== 'all') {
                try {
                    const d = parseISO(item.isoDate);
                    if (dateFilter === 'today' && !isToday(d)) return false;
                    if (dateFilter === 'yesterday' && !isYesterday(d)) return false;
                    if (dateFilter === 'older' && (isToday(d) || isYesterday(d))) return false;
                } catch {
                    if (dateFilter !== 'today') return false;
                }
            }

            // 2. Severity filter
            if (severityFilter === 'critical' && item.severity !== 'critical') return false;
            if (severityFilter === 'warning' && item.severity !== 'warning') return false;
            if (severityFilter === 'resolved' && !item.resolved) return false;

            // 3. Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    item.service.toLowerCase().includes(q) ||
                    item.errorType.toLowerCase().includes(q) ||
                    item.message.toLowerCase().includes(q) ||
                    item.rootCause.toLowerCase().includes(q) ||
                    (item.traceId && item.traceId.toLowerCase().includes(q));
                if (!matchesSearch) return false;
            }

            return true;
        });
    }, [persistedLogs, dateFilter, severityFilter, searchQuery]);

    const handleCopyLog = (item: IncidentLogItem) => {
        const text = `[INCIDENT LOG]\nWaktu: ${item.timestamp} (${item.isoDate})\nSeverity: ${item.severity.toUpperCase()}\nService: ${item.service}\nError: ${item.errorType}\nPesan: ${item.message}\nPenyebab: ${item.rootCause}\nSolusi: ${item.remediation}\nTrace ID: ${item.traceId || 'N/A'}`;
        navigator.clipboard.writeText(text);
        setCopiedId(item.id);
        toast.success('Incident log berhasil disalin ke clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleResetLogs = () => {
        const seed = generateDefaultSeedLogs();
        setPersistedLogs(seed);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        } catch {
            // ignore
        }
        toast.success('Histori log insiden di-reset ke data acuan standar (Hari Ini & Kemarin).');
    };

    const handleClearAllLogs = () => {
        setPersistedLogs([]);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        } catch {
            // ignore
        }
        toast.info('Seluruh histori log insiden telah dibersihkan.');
    };

    const handleExportLogs = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(persistedLogs, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `idesk-incident-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success('Histori log insiden berhasil diekspor sebagai JSON');
    };

    const criticalCount = filteredLogs.filter((i) => i.severity === 'critical').length;
    const warningCount = filteredLogs.filter((i) => i.severity === 'warning').length;

    return (
        <div className="hl-card overflow-hidden">
            {/* Header: Title, Counts, and Actions */}
            <div className="p-4 sm:p-5 border-b border-line bg-fill space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-brand/10 text-brand border border-brand/30">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-extrabold text-ink">
                                    Incident & Error Diagnostic Logs
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-fill-2 font-mono font-bold text-ink">
                                    {persistedLogs.length} Tersimpan
                                </span>
                            </div>
                            <p className="text-xs text-ink-2 mt-0.5">
                                Rekam jejak insiden tersimpan di browser, analisis penyebab teknis, dan panduan perbaikan
                            </p>
                        </div>
                    </div>

                    {/* Quick Counts Pill & Log Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {criticalCount > 0 ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bad/10 border border-bad/30 text-bad-ink text-xs font-bold animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>{criticalCount} Critical</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-ok/10 border border-ok/30 text-ok-ink text-xs font-bold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>0 Critical Incidents</span>
                            </span>
                        )}

                        <div className="flex items-center gap-1 bg-surface p-0.5 rounded-lg border border-line shadow-2xs">
                            <button
                                type="button"
                                onClick={handleExportLogs}
                                title="Ekspor seluruh log sebagai JSON"
                                className="p-1.5 text-ink-2 hover:text-ink hover:bg-fill rounded-md transition-colors cursor-pointer"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={handleResetLogs}
                                title="Reset data acuan insiden (Hari Ini & Kemarin)"
                                className="p-1.5 text-ink-2 hover:text-brand hover:bg-fill rounded-md transition-colors cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={handleClearAllLogs}
                                title="Bersihkan seluruh log"
                                className="p-1.5 text-ink-2 hover:text-bad-ink hover:bg-fill rounded-md transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar: 1. Date Filter, 2. Severity Filter, 3. Keyword Search */}
                <div className="space-y-2.5 pt-1">
                    {/* Baris 1: Date Filter Tabs (Hari Ini / Kemarin / Semua) */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line shadow-2xs">
                            <span className="text-[11px] font-bold text-ink-3 px-2 flex items-center gap-1 select-none">
                                <Calendar className="w-3 h-3 text-brand" />
                                <span>Periode:</span>
                            </span>

                            <button
                                type="button"
                                onClick={() => setDateFilter('all')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    dateFilter === 'all'
                                        ? "bg-code text-white shadow-xs font-bold"
                                        : "text-ink-2 hover:text-ink"
                                )}
                            >
                                <span>Semua Tanggal</span>
                                <span className="text-[10px] font-mono opacity-80">({dateCounts.all})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDateFilter('today')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    dateFilter === 'today'
                                        ? "bg-brand text-white shadow-xs font-bold"
                                        : "text-brand hover:bg-brand/10"
                                )}
                            >
                                <span>Hari Ini</span>
                                <span className={cn(
                                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                                    dateFilter === 'today' ? "bg-surface/20 text-white" : "bg-brand/15 text-brand"
                                )}>
                                    {dateCounts.today}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDateFilter('yesterday')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    dateFilter === 'yesterday'
                                        ? "bg-brand text-white shadow-xs font-bold"
                                        : "text-ink-2 hover:text-ink hover:bg-fill"
                                )}
                            >
                                <span>Kemarin</span>
                                <span className={cn(
                                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                                    dateFilter === 'yesterday' ? "bg-surface/20 text-white" : "bg-fill text-ink-2"
                                )}>
                                    {dateCounts.yesterday}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDateFilter('older')}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5",
                                    dateFilter === 'older'
                                        ? "bg-code text-white shadow-xs font-bold"
                                        : "text-ink-2 hover:text-ink"
                                )}
                            >
                                <span>Lebih Lama</span>
                                <span className="text-[10px] font-mono opacity-80">({dateCounts.older})</span>
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-72">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari service, error, atau Trace ID..."
                                className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl bg-surface border border-line focus:outline-none focus:ring-1 focus:ring-brand shadow-2xs"
                            />
                        </div>
                    </div>

                    {/* Baris 2: Severity Filter Tabs */}
                    <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-line w-full sm:w-auto overflow-x-auto custom-scrollbar shadow-2xs">
                        <span className="text-[11px] font-bold text-ink-3 px-2 flex items-center gap-1 select-none">
                            <Filter className="w-3 h-3 text-ink-3" />
                            <span>Tingkat:</span>
                        </span>
                        <button
                            type="button"
                            onClick={() => setSeverityFilter('all')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0",
                                severityFilter === 'all'
                                    ? "bg-code text-white shadow-xs"
                                    : "text-ink-2 hover:text-ink"
                            )}
                        >
                            Semua ({filteredLogs.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSeverityFilter('critical')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0",
                                severityFilter === 'critical'
                                    ? "bg-bad text-white shadow-xs"
                                    : "text-bad-ink hover:bg-bad/10"
                            )}
                        >
                            Critical ({criticalCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSeverityFilter('warning')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0",
                                severityFilter === 'warning'
                                    ? "bg-warn text-white shadow-xs"
                                    : "text-warn-ink hover:bg-warn/10"
                            )}
                        >
                            Warnings ({warningCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSeverityFilter('resolved')}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0",
                                severityFilter === 'resolved'
                                    ? "bg-ok text-white shadow-xs"
                                    : "text-ok-ink hover:bg-ok/10"
                            )}
                        >
                            Healthy / Resolved
                        </button>
                    </div>
                </div>
            </div>

            {/* Log Items Stream / Table */}
            <div className="divide-y divide-line max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredLogs.map((item) => {
                    const isCritical = item.severity === 'critical';
                    const isWarning = item.severity === 'warning';
                    const isInfo = item.severity === 'info';

                    return (
                        <div
                            key={item.id}
                            className="p-4 hover:bg-fill transition-colors space-y-3"
                        >
                            {/* Top row: Timestamp, Service, Error Badge, and Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Severity Badge */}
                                    <span className={cn(
                                        "text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1",
                                        isCritical
                                            ? "bg-bad/15 text-bad-ink border border-bad/30"
                                            : isWarning
                                                ? "bg-warn/15 text-warn-ink border border-warn/30"
                                                : "bg-ok/15 text-ok-ink border border-ok/30"
                                    )}>
                                        {isCritical ? <AlertTriangle className="w-3 h-3" /> : isWarning ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                        <span>{item.severity}</span>
                                    </span>

                                    {/* Service Badge */}
                                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-fill text-ink border border-line">
                                        {item.service}
                                    </span>

                                    {/* Relative Date & Timestamp */}
                                    <span className="text-xs font-mono text-ink-2 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 opacity-60" />
                                        <span>{item.relativeTime}</span>
                                        <span className="text-ink-3">·</span>
                                        <span>{item.timestamp}</span>
                                    </span>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyLog(item)}
                                        className="text-xs text-ink-2 hover:text-ink px-2.5 py-1 rounded-lg border border-line hover:bg-fill transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedId === item.id ? "Copied" : "Copy Log"}</span>
                                    </button>

                                    {item.traceId && (
                                        <button
                                            type="button"
                                            onClick={() => onSelectTrace(item.traceId!)}
                                            className="text-xs font-bold text-brand hover:text-brand px-2.5 py-1 rounded-lg bg-brand/10 border border-brand/30 hover:bg-brand/15 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        >
                                            <Zap className="w-3.5 h-3.5 text-brand" />
                                            <span>Investigate in Map</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Error Header & Message */}
                            <div className="space-y-1">
                                <h4 className={cn(
                                    "text-xs font-mono font-bold",
                                    isCritical ? "text-bad-ink" : isWarning ? "text-warn-ink" : "text-ok-ink"
                                )}>
                                    {item.errorType}
                                </h4>
                                <p className="text-xs text-ink font-mono bg-fill p-2.5 rounded-xl border border-line">
                                    {item.message}
                                </p>
                            </div>

                            {/* Root Cause & Remediation Guide Grid */}
                            {!isInfo && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    {/* Root Cause (Penyebab) */}
                                    <div className="p-3 rounded-xl bg-fill border border-line text-xs space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-ink-3 flex items-center gap-1">
                                            <span>🔍</span>
                                            <span>Penyebab Masalah (Root Cause)</span>
                                        </span>
                                        <p className="text-[11px] text-ink-2 leading-relaxed">
                                            {item.rootCause}
                                        </p>
                                    </div>

                                    {/* Remediation (Langkah Perbaikan) */}
                                    <div className="p-3 rounded-xl bg-brand/10 border border-brand/30 text-xs space-y-1">
                                        <span className="text-[10px] uppercase font-bold text-brand flex items-center gap-1">
                                            <Wrench className="w-3.5 h-3.5" />
                                            <span>Langkah Perbaikan (Remediation)</span>
                                        </span>
                                        <p className="text-[11px] text-ink leading-relaxed font-mono">
                                            {item.remediation}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredLogs.length === 0 && (
                    <div className="p-8 text-center text-ink-3 text-xs space-y-2">
                        <p>Tidak ada log insiden yang cocok dengan filter tanggal & kata kunci pencarian.</p>
                        <button
                            type="button"
                            onClick={() => {
                                setDateFilter('all');
                                setSeverityFilter('all');
                                setSearchQuery('');
                            }}
                            className="text-xs text-brand underline hover:no-underline cursor-pointer"
                        >
                            Reset semua filter
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
