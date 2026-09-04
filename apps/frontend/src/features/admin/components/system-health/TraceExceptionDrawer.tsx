import React, { useState, useEffect, useMemo } from 'react';
import {
    AlertTriangle,
    X,
    Copy,
    Check,
    Maximize2,
    Minimize2,
    Activity,
    Layers,
    FileText,
    ExternalLink,
    Code2,
    Clock,
    Terminal,
    Filter,
    ArrowRight,
    Database,
    Globe,
    Cpu,
    CheckCircle2,
    Wrench,
    Sparkles,
    ShieldCheck,
    Share2,
    HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EndToEndTrace, TraceEventStep } from './serviceMapTypes';
import { toast } from 'sonner';

interface TraceExceptionDrawerProps {
    trace: EndToEndTrace;
    selectedNodeId: string | null;
    onClose: () => void;
}

export const TraceExceptionDrawer: React.FC<TraceExceptionDrawerProps> = ({
    trace,
    selectedNodeId,
    onClose,
}) => {
    const [copied, setCopied] = useState(false);
    const [copiedSql, setCopiedSql] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'errors' | 'dependencies'>('all');
    const [detailTab, setDetailTab] = useState<'waterfall' | 'database' | 'metadata' | 'diagnostics'>('waterfall');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(
        trace.events.find((e) => e.isException)?.id || trace.events[0]?.id || null
    );

    // Auto-select diagnostics tab if trace has an exception
    useEffect(() => {
        if (trace.exception) {
            setDetailTab('diagnostics');
        } else {
            setDetailTab('waterfall');
        }
    }, [trace]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleCopyStack = () => {
        if (!trace.exception) return;
        const text = `EXCEPTION: ${trace.exception.type}\nMessage: ${trace.exception.message}\nTime: ${trace.exception.eventTime}\nFailed Method: ${trace.exception.failedMethod}\n\nCall Stack:\n${trace.exception.callStack}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Stack trace copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopySql = (sql: string) => {
        navigator.clipboard.writeText(sql);
        setCopiedSql(true);
        toast.success('SQL query copied to clipboard');
        setTimeout(() => setCopiedSql(false), 2000);
    };

    const handleCopyCurl = () => {
        const curl = `curl -X ${trace.httpMethod} "${trace.endpoint}" \\\n  -H "User-Agent: ${trace.clientInfo.browser}" \\\n  -H "X-Forwarded-For: ${trace.clientInfo.ip}" \\\n  -H "Accept: application/json"`;
        navigator.clipboard.writeText(curl);
        toast.success('cURL command copied to clipboard');
    };

    const filteredEvents = trace.events.filter((e) => {
        if (activeFilter === 'errors') return e.severity === 'Error' || e.isException;
        if (activeFilter === 'dependencies') return e.type === 'dependency';
        return true;
    });

    const activeEvent = trace.events.find((e) => e.id === selectedEventId) || trace.events[0];
    const isErrorTrace = trace.statusCode >= 400;

    // Synthesize realistic SQL query for the inspector
    const resolvedSql = useMemo(() => {
        if (trace.operationName.includes('create')) {
            return `INSERT INTO "tickets" ("id", "title", "status", "priority", "created_by_id", "created_at")\nVALUES ('TCK-2026-0895', 'Hardware Replacement', 'OPEN', 'HIGH', 'usr_8812', NOW())\nRETURNING *;`;
        }
        if (trace.operationName.includes('login')) {
            return `SELECT "id", "email", "password_hash", "role", "is_active", "site_id"\nFROM "users"\nWHERE "email" = 'bagas.it@santos.co.id' AND "deleted_at" IS NULL\nLIMIT 1;`;
        }
        if (trace.operationName.includes('forward')) {
            return `UPDATE "tickets"\nSET "status" = 'IN_PROGRESS', "assigned_to_id" = 'usr_agent_04', "updated_at" = NOW()\nWHERE "id" = 'TCK-2026-0891' AND "version" = 3;`;
        }
        return `SELECT t.*, u."full_name" as creator_name\nFROM "tickets" t\nLEFT JOIN "users" u ON u."id" = t."created_by_id"\nWHERE t."status" != 'CLOSED'\nORDER BY t."created_at" DESC\nLIMIT 25;`;
    }, [trace]);

    // Waterfall spans breakdown
    const waterfallSpans = useMemo(() => {
        const total = Math.max(1, trace.totalDurationMs);
        return [
            {
                name: 'Client Edge Network & TLS',
                category: 'Network',
                durationMs: Math.max(1, Math.round(total * 0.4)),
                percent: 40,
                color: 'bg-blue-600',
                status: isErrorTrace ? 'warning' : 'healthy',
            },
            {
                name: 'API Gateway & Throttler Guard',
                category: 'Gateway',
                durationMs: Math.max(1, Math.round(total * 0.15)),
                percent: 15,
                color: 'bg-sky-500',
                status: isErrorTrace ? 'warning' : 'healthy',
            },
            {
                name: 'JwtAuthGuard & Role Permissions',
                category: 'Security',
                durationMs: Math.max(1, Math.round(total * 0.1)),
                percent: 10,
                color: 'bg-teal-500',
                status: 'healthy',
            },
            {
                name: 'Core Service Business Controller',
                category: 'Application',
                durationMs: Math.max(1, Math.round(total * 0.2)),
                percent: 20,
                color: isErrorTrace ? 'bg-rose-500' : 'bg-amber-500',
                status: isErrorTrace ? 'error' : 'healthy',
            },
            {
                name: 'PostgreSQL Primary Connection Pool',
                category: 'Database',
                durationMs: Math.max(1, Math.round(total * 0.15)),
                percent: 15,
                color: isErrorTrace && trace.statusCode === 500 ? 'bg-rose-500' : 'bg-emerald-500',
                status: isErrorTrace && trace.statusCode === 500 ? 'error' : 'healthy',
            },
        ];
    }, [trace, isErrorTrace]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop Blur Overlay */}
            <div
                onClick={onClose}
                className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
            />

            {/* Slide-in Drawer Container (Gambar 1 & Gambar 3 Style) */}
            <div className={cn(
                "relative z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-l border-slate-200/90 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 animate-slide-in-right",
                isExpanded ? "w-full lg:w-[88vw]" : "w-full md:w-[740px] lg:w-[840px]"
            )}>
                {/* Top Toolbar */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/90 dark:bg-slate-900/90">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs",
                            isErrorTrace
                                ? "bg-rose-500 text-white dark:bg-rose-600"
                                : "bg-emerald-500 text-white dark:bg-emerald-600"
                        )}>
                            <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                    End-to-End Transaction Details
                                </h3>
                                <span className={cn(
                                    "text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase",
                                    isErrorTrace
                                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                                        : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                )}>
                                    {trace.httpMethod} {trace.statusCode}
                                </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                                Operation ID: <strong className="text-slate-700 dark:text-slate-300">{trace.operationId}</strong> · Trace: {trace.traceId}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={handleCopyCurl}
                            title="Copy cURL command"
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
                        >
                            <Terminal className="w-4 h-4" />
                            <span className="hidden sm:inline">cURL</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            title={isExpanded ? "Collapse width" : "Expand width"}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block cursor-pointer"
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close drawer"
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Subheader: Event Count & Filter Tabs */}
                <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
                        <span>Traces: <strong className="text-slate-900 dark:text-white font-mono">{trace.events.length}</strong></span>
                        <span>·</span>
                        <span className={cn(
                            "font-mono font-bold",
                            trace.errorCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                            {trace.errorCount} Errors
                        </span>
                        <span>·</span>
                        <span className="text-slate-500 font-mono">{trace.totalDurationMs} ms</span>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setActiveFilter('all')}
                            className={cn(
                                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer",
                                activeFilter === 'all'
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                            )}
                        >
                            All ({trace.events.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveFilter('errors')}
                            className={cn(
                                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer",
                                activeFilter === 'errors'
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                            )}
                        >
                            Errors ({trace.errorCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveFilter('dependencies')}
                            className={cn(
                                "px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer",
                                activeFilter === 'dependencies'
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                            )}
                        >
                            Dependencies
                        </button>
                    </div>
                </div>

                {/* Split Content: Left Event Stream & Right Rich APM Inspector (Gambar 1 Upgrade) */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left Pane: Chronological Events Table */}
                    <div className="lg:w-5/12 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar p-3">
                        <div className="relative pl-4 space-y-2.5 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                            {filteredEvents.map((ev) => {
                                const isSelected = ev.id === selectedEventId;
                                const isErr = ev.severity === 'Error' || ev.isException;

                                return (
                                    <div
                                        key={ev.id}
                                        onClick={() => setSelectedEventId(ev.id)}
                                        className={cn(
                                            "relative p-2.5 rounded-xl text-left cursor-pointer transition-all duration-150 border",
                                            isSelected
                                                ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 shadow-xs"
                                                : isErr
                                                    ? "bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 hover:bg-rose-50"
                                                    : "bg-white dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:border-slate-300"
                                        )}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="mt-0.5">
                                                {isErr ? (
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                                                    </span>
                                                ) : ev.type === 'dependency' ? (
                                                    <Layers className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                                ) : (
                                                    <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1 text-xs">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={cn(
                                                        "font-bold truncate",
                                                        isErr ? "text-rose-700 dark:text-rose-400" : "text-slate-800 dark:text-slate-200"
                                                    )}>
                                                        {ev.name}
                                                    </span>
                                                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                                        {ev.timestamp}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                    {ev.message}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Pane: Rich APM Inspector with Subtabs */}
                    <div className="lg:w-7/12 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                        {/* Right Pane Navigation Subtabs (Datadog APM Inspector) */}
                        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
                            <button
                                type="button"
                                onClick={() => setDetailTab('waterfall')}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                    detailTab === 'waterfall'
                                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <Activity className="w-3.5 h-3.5" />
                                <span>Waterfall & Spans</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDetailTab('database')}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                    detailTab === 'database'
                                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <Database className="w-3.5 h-3.5" />
                                <span>SQL Query</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDetailTab('metadata')}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                    detailTab === 'metadata'
                                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                )}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                <span>HTTP Metadata</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDetailTab('diagnostics')}
                                className={cn(
                                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0",
                                    detailTab === 'diagnostics'
                                        ? isErrorTrace
                                            ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-800"
                                            : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                                )}
                            >
                                {isErrorTrace ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                <span>{isErrorTrace ? "Exception & Fix" : "Health Status"}</span>
                            </button>
                        </div>

                        {/* Right Pane Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4">
                            {/* TAB 1: Waterfall Timeline Gantt Chart */}
                            {detailTab === 'waterfall' && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                                <Activity className="w-4 h-4 text-blue-500" />
                                                <span>Execution Waterfall (Gantt Chart)</span>
                                            </h4>
                                            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                                                Total: {trace.totalDurationMs} ms
                                            </span>
                                        </div>

                                        <div className="space-y-3 pt-1">
                                            {waterfallSpans.map((span, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                                {span.category}
                                                            </span>
                                                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                {span.name}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono text-slate-500 text-[11px]">
                                                            {span.durationMs} ms ({span.percent}%)
                                                        </span>
                                                    </div>

                                                    {/* Proportional Waterfall Bar */}
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                                                        <div
                                                            className={cn("h-full transition-all duration-500 rounded-full", span.color)}
                                                            style={{ width: `${span.percent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* System Resources Snapshot */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-medium">Server Uptime</span>
                                            <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">Online</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-medium">DB Connection</span>
                                            <p className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">Pool Ready</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-medium">HTTP Overhead</span>
                                            <p className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">&lt; 0.2 ms</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: SQL Query Inspector */}
                            {detailTab === 'database' && (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-200 shadow-md">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Database className="w-4 h-4 text-emerald-400" />
                                                <h4 className="text-xs font-bold font-mono text-slate-300 uppercase">
                                                    TypeORM Primary Query
                                                </h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopySql(resolvedSql)}
                                                className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-1 rounded cursor-pointer transition-colors"
                                            >
                                                {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                                            </button>
                                        </div>
                                        <pre className="font-mono text-[11px] leading-relaxed text-emerald-300/90 overflow-x-auto p-3 bg-black/60 rounded-lg custom-scrollbar select-all">
                                            {resolvedSql}
                                        </pre>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                                        <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                            <span>Query Execution Metrics</span>
                                        </h5>
                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                                <span className="text-slate-400">Query Engine:</span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">PostgreSQL 16.2</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                                <span className="text-slate-400">Statement Timeout:</span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">5000 ms</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                                <span className="text-slate-400">Pool Idle Connections:</span>
                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">10 / 10</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                                <span className="text-slate-400">Lock Contention:</span>
                                                <span className={cn(
                                                    "font-mono font-bold",
                                                    isErrorTrace ? "text-rose-500" : "text-emerald-500"
                                                )}>
                                                    {isErrorTrace ? "High (Lock Detected)" : "None (0 ms wait)"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: HTTP Metadata */}
                            {detailTab === 'metadata' && (
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                            <span>Request & Response Metadata</span>
                                            <button
                                                type="button"
                                                onClick={handleCopyCurl}
                                                className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold hover:underline cursor-pointer"
                                            >
                                                Copy cURL
                                            </button>
                                        </h4>
                                        <div className="grid grid-cols-1 gap-1.5 text-xs">
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Method & URL</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                                                    {trace.httpMethod} {trace.endpoint}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Status Code</span>
                                                <span className={cn(
                                                    "font-mono font-bold px-1.5 py-0.2 rounded text-[10px]",
                                                    isErrorTrace ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {trace.statusCode} {trace.statusText}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Client IP</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    {trace.clientInfo.ip}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Browser & OS</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                    {trace.clientInfo.browser} on {trace.clientInfo.os}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Origin / Host</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                    idesk.santos.co.id
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                                <span className="font-mono text-slate-400">Content-Type</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                    application/json; charset=utf-8
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between py-1.5 text-[11px]">
                                                <span className="font-mono text-slate-400">Trace ID</span>
                                                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                    {trace.traceId}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: Exception & Fix (or Health Overview) */}
                            {detailTab === 'diagnostics' && (
                                <div className="space-y-4">
                                    {trace.exception ? (
                                        <>
                                            {/* High-Contrast Exception Banner */}
                                            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-transparent border border-rose-300 dark:border-rose-800/90 text-rose-950 dark:text-rose-200 shadow-xs">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 rounded-lg bg-rose-500 text-white shadow-xs shrink-0 mt-0.5">
                                                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                                            EXCEPTION DETECTED
                                                        </span>
                                                        <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                                                            {trace.exception.type}
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="mt-3 text-xs space-y-2 border-t border-rose-200 dark:border-rose-900/60 pt-2.5">
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-slate-400">Error Message</span>
                                                        <p className="font-mono text-rose-800 dark:text-rose-300 mt-0.5 bg-white/80 dark:bg-slate-950/80 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-[11px]">
                                                            {trace.exception.message}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] uppercase font-bold text-slate-400">Failed Method</span>
                                                        <p className="font-mono text-slate-900 dark:text-slate-100 mt-0.5 font-bold">
                                                            {trace.exception.failedMethod}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Root Cause & Remediation Guide */}
                                            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/80 text-xs space-y-2">
                                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                                                    <Wrench className="w-4 h-4" />
                                                    <span>Analisis Penyebab & Langkah Perbaikan (Remediation)</span>
                                                </div>
                                                <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed space-y-1.5">
                                                    <p>
                                                        <strong>Penyebab Utama:</strong> Transaksi konkurensi menahan row share lock melebihi batas waktu (timeout 1000ms).
                                                    </p>
                                                    <p>
                                                        <strong>Langkah Perbaikan:</strong>
                                                    </p>
                                                    <ol className="list-decimal list-inside pl-1 space-y-0.5 text-slate-600 dark:text-slate-400 font-medium">
                                                        <li>Pastikan transaksi update tiket dibungkus dalam query runner dengan retry logic eksponensial.</li>
                                                        <li>Tingkatkan parameter <code className="bg-amber-100 dark:bg-amber-900/60 px-1 rounded">lock_timeout = 3000ms</code> pada TypeORM data source jika terjadi antrean reassign serentak.</li>
                                                    </ol>
                                                </div>
                                            </div>

                                            {/* Call Stack with Copy */}
                                            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-200 shadow-md">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Terminal className="w-4 h-4 text-slate-400" />
                                                        <h4 className="text-xs font-bold font-mono text-slate-300 uppercase">
                                                            Call Stack Trace
                                                        </h4>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleCopyStack}
                                                        className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-950/80 border border-blue-800 px-2 py-1 rounded cursor-pointer transition-colors"
                                                    >
                                                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        <span>{copied ? "Copied" : "Copy Stack"}</span>
                                                    </button>
                                                </div>
                                                <pre className="font-mono text-[10px] leading-relaxed text-rose-300/90 overflow-x-auto p-2.5 bg-black/60 rounded-lg max-h-56 custom-scrollbar select-all">
                                                    {trace.exception.callStack}
                                                </pre>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="p-6 text-center text-slate-400 space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </div>
                                            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                                Semua Komponen Sehat (200 OK)
                                            </h4>
                                            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                                Permintaan ini diproses tanpa error runtime. Query database TypeORM, validasi JWT Guard, dan emisi antrean BullMQ berhasil secara instan.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
