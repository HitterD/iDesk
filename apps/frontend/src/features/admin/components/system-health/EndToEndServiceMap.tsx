import React, { useState, useMemo, useEffect } from 'react';
import {
    Activity,
    AlertCircle,
    CheckCircle,
    ChevronRight,
    Clock,
    Flame,
    Globe,
    Laptop,
    Layers,
    Play,
    RefreshCw,
    Search,
    Shield,
    Sparkles,
    Terminal,
    Radio,
    Zap,
    Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BASE_NODES, MOCK_TRACES, syncNodesWithLiveHealth } from './mockTraceData';
import { ServiceMapCanvas } from './ServiceMapCanvas';
import { TraceExceptionDrawer } from './TraceExceptionDrawer';
import { DetailedHealthStatus, SystemIncident } from '../../hooks/useHealthSocket';
import { EndToEndTrace } from './serviceMapTypes';
import { IncidentLogTable } from './IncidentLogTable';

interface EndToEndServiceMapProps {
    health: DetailedHealthStatus | null | undefined;
    realTraces?: EndToEndTrace[];
    incidents?: SystemIncident[];
}

export const EndToEndServiceMap: React.FC<EndToEndServiceMapProps> = ({
    health,
    realTraces = [],
    incidents = [],
}) => {
    // Combine real traces from backend with incident simulations
    const allTraces = useMemo(() => {
        if (realTraces && realTraces.length > 0) {
            const realIds = new Set(realTraces.map((t) => t.traceId));
            return [...realTraces, ...MOCK_TRACES.filter((t) => !realIds.has(t.traceId))];
        }
        return MOCK_TRACES;
    }, [realTraces]);

    const [selectedTraceId, setSelectedTraceId] = useState<string>(allTraces[0]?.traceId || MOCK_TRACES[0].traceId);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
    const [activeSubTab, setActiveSubTab] = useState<'overview' | 'errors' | 'infrastructure' | 'queries'>('overview');

    // Automatically follow incoming real-time backend traces if not inspecting an incident
    useEffect(() => {
        if (realTraces && realTraces.length > 0) {
            setSelectedTraceId((prevId) => {
                const isPrevIncident = MOCK_TRACES.some((m) => m.traceId === prevId && m.statusCode >= 400);
                return isPrevIncident ? prevId : realTraces[0].traceId;
            });
        }
    }, [realTraces]);

    const activeTrace = useMemo(() => {
        return allTraces.find((t) => t.traceId === selectedTraceId) || allTraces[0] || MOCK_TRACES[0];
    }, [allTraces, selectedTraceId]);

    // Live synced nodes based on active trace and real useHealthSocket telemetry
    const nodes = useMemo(() => {
        return syncNodesWithLiveHealth(BASE_NODES, health, activeTrace);
    }, [health, activeTrace]);

    const handleNodeClick = (nodeId: string) => {
        setSelectedNodeId(nodeId);
        setIsDrawerOpen(true);
    };

    const isErrorTrace = activeTrace.statusCode >= 400;
    const isRealLiveTrace = realTraces.some((t) => t.traceId === activeTrace.traceId);

    // Split traces into Live Healthy vs Incident Scenarios
    const healthyTraces = allTraces.filter((t) => t.statusCode < 400);
    const incidentTraces = allTraces.filter((t) => t.statusCode >= 400);

    return (
        <div className="space-y-4">
            {/* Top Trace Information & APM Observability Header */}
            <div className="bg-[hsl(var(--card))] rounded-2xl p-4 sm:p-5 border border-[hsl(var(--border))] shadow-xs space-y-4">
                {/* Layer 1: Stream Status & Scenario Selector */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-2xs">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            <span>Live Topology Feed</span>
                            {realTraces.length > 0 && (
                                <span className="ml-1 text-[10px] bg-emerald-200/80 dark:bg-emerald-900/80 px-1.5 py-0.2 rounded-full font-mono">
                                    {realTraces.length} real
                                </span>
                            )}
                        </div>
                        <span className="text-xs text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {realTraces.length > 0
                                ? 'Menerima transaksi HTTP riil dari backend iDesk'
                                : 'Pilih skenario alur transaksi untuk inspeksi topologi:'}
                        </span>
                    </div>

                    {/* Scenario Switcher: Normal vs Uji Insiden */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Normal Traffic Pills */}
                        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-850 p-1 rounded-xl border border-slate-200 dark:border-slate-800 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2">
                                Trafik Normal:
                            </span>
                            {healthyTraces.slice(0, 4).map((tr) => {
                                const isSelected = tr.traceId === selectedTraceId;
                                const isReal = realTraces.some((rt) => rt.traceId === tr.traceId);

                                return (
                                    <button
                                        key={tr.traceId}
                                        type="button"
                                        onClick={() => {
                                             setSelectedTraceId(tr.traceId);
                                             setSelectedNodeId(null);
                                        }}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                            isSelected
                                                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold border border-slate-200 dark:border-slate-700"
                                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                    >
                                        <span className={cn(
                                            "w-2 h-2 rounded-full shrink-0",
                                            isReal ? "bg-cyan-500 animate-pulse" : "bg-emerald-500"
                                        )} />
                                        <span className="truncate max-w-[150px]">{tr.operationName}</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                            {isReal ? `[${tr.statusCode}]` : '[200 OK]'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Incident Simulations */}
                        <div className="flex items-center gap-1 bg-rose-50/70 dark:bg-rose-950/30 p-1 rounded-xl border border-rose-200/80 dark:border-rose-900/60 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 px-2">
                                Uji Insiden:
                            </span>
                            {incidentTraces.map((tr) => {
                                const isSelected = tr.traceId === selectedTraceId;
                                return (
                                    <button
                                        key={tr.traceId}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTraceId(tr.traceId);
                                            setSelectedNodeId(null);
                                            setIsDrawerOpen(true);
                                        }}
                                        className={cn(
                                            "px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer",
                                            isSelected
                                                ? "bg-rose-600 text-white shadow-xs font-bold"
                                                : "text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                                        )}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-pulse" />
                                        <span>{tr.operationName}</span>
                                        <span className="text-[10px] opacity-80">[{tr.statusCode}]</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Layer 2: Active Trace Breadcrumbs, Metrics & Inspector Action */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">Traces</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">{activeTrace.clientInfo.app}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-900 dark:text-white font-mono font-bold">{activeTrace.operationName}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400">trace_id</span>
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(activeTrace.traceId);
                                toast.success(`Trace ID ${activeTrace.traceId} disalin`);
                            }}
                            title="Klik untuk menyalin Trace ID"
                            className="font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 px-2 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-200/80 dark:border-slate-700"
                        >
                            {isRealLiveTrace && <Zap className="w-3 h-3 text-cyan-500 shrink-0" />}
                            <span>{activeTrace.traceId}</span>
                            <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0" />
                        </button>
                    </div>

                    {/* Metrics Cluster & APM Drawer Trigger */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {isRealLiveTrace && (
                            <span className="px-2.5 py-1 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-[11px] flex items-center gap-1 border border-cyan-200 dark:border-cyan-800">
                                <Sparkles className="w-3 h-3" />
                                <span>Real Backend Telemetry</span>
                            </span>
                        )}

                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold flex items-center gap-1 border border-slate-200/60 dark:border-slate-700/60">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                            {activeTrace.spanCount} Spans
                        </span>

                        <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold flex items-center gap-1 border border-slate-200/60 dark:border-slate-700/60">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            {activeTrace.totalDurationMs >= 1000 ? `${(activeTrace.totalDurationMs / 1000).toFixed(2)}s` : `${activeTrace.totalDurationMs}ms`}
                        </span>

                        <span className={cn(
                            "px-3 py-1 rounded-lg font-mono font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 shadow-2xs",
                            isErrorTrace
                                ? "bg-rose-500 text-white shadow-rose-500/20 animate-pulse"
                                : "bg-emerald-500 text-white shadow-emerald-500/20"
                        )}>
                            {isErrorTrace ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            <span>{activeTrace.statusText}</span>
                        </span>

                        {/* Open Drawer Action Button - Enterprise Blue */}
                        <button
                            type="button"
                            onClick={() => setIsDrawerOpen(true)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 hover:scale-102 active:scale-98"
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Buka Detail Transaksi & Call Stack</span>
                        </button>
                    </div>
                </div>

                {/* Layer 3: Client Environment Tags (Browser, OS, Country, IP, Timestamp) */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                            <Laptop className="w-3 h-3 text-slate-400" />
                            {activeTrace.clientInfo.browser} ({activeTrace.clientInfo.os})
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {activeTrace.clientInfo.country} · {activeTrace.clientInfo.ip}
                        </span>
                    </div>

                    <span className="font-mono text-slate-500 dark:text-slate-400">
                        Timestamp: {activeTrace.timestamp}
                    </span>
                </div>
            </div>

            {/* Main Interactive Service Map Canvas (Forward Bezier Curves + Traveling Particles) */}
            <div className="relative">
                <ServiceMapCanvas
                    nodes={nodes}
                    activeTrace={activeTrace}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={handleNodeClick}
                />
            </div>

            {/* Bottom APM Bar (Gambar 2 Datadog: Overview, Errors, Infrastructure, Metrics, Queries) */}
            <div className="bg-[hsl(var(--card))] rounded-2xl p-4 border border-[hsl(var(--border))] shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 md:pb-0">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Span Breakdown:</span>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('overview')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                            activeSubTab === 'overview'
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        Overview
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveSubTab('errors');
                            setIsDrawerOpen(true);
                        }}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                            activeSubTab === 'errors'
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        )}
                    >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Errors ({activeTrace.errorCount})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('infrastructure')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                            activeSubTab === 'infrastructure'
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        Infrastructure ({nodes.filter((n) => n.tier === 'storage').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('queries')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                            activeSubTab === 'queries'
                                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        Queries (TypeORM SELECT / UPDATE)
                    </button>
                </div>

                {/* Total Execution Timeline Breakdown Bar (Gambar 2: 142ms 100% total exec time) */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <div className="text-right">
                        <span className="text-[11px] font-mono text-slate-400">Total Latency: </span>
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                            {activeTrace.totalDurationMs} ms (100%)
                        </span>
                    </div>
                    <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div className="bg-blue-600 h-full" style={{ width: '45%' }} title="Client & Network (45%)" />
                        <div className="bg-sky-500 h-full" style={{ width: '25%' }} title="Core Engine (25%)" />
                        <div className={cn(isErrorTrace ? "bg-rose-500" : "bg-emerald-500", "h-full")} style={{ width: '30%' }} title="Database & External (30%)" />
                    </div>
                </div>
            </div>

            {/* Real-time Incident & Error Diagnostic Logs Panel (Gambar 2) */}
            <IncidentLogTable
                incidents={incidents}
                errorTraces={allTraces.filter((t) => t.statusCode >= 400)}
                onSelectTrace={(traceId) => {
                    setSelectedTraceId(traceId);
                    setSelectedNodeId(null);
                    setIsDrawerOpen(true);
                }}
            />

            {/* Slide-over Exception & Call Stack Inspector Drawer (Gambar 3) */}
            {isDrawerOpen && (
                <TraceExceptionDrawer
                    trace={activeTrace}
                    selectedNodeId={selectedNodeId}
                    onClose={() => {
                        setIsDrawerOpen(false);
                        setSelectedNodeId(null);
                    }}
                />
            )}
        </div>
    );
};
