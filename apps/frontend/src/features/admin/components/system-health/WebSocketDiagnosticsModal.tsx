import React, { useState } from 'react';
import {
    X,
    Wifi,
    Zap,
    RefreshCw,
    Activity,
    Layers,
    Clock,
    ShieldCheck,
    ArrowDownLeft,
    ArrowUpRight,
    Play,
    Pause,
    Trash2,
    Copy,
    Check,
    Radio,
    Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WebSocketFrame, GatewayTelemetry } from '../../hooks/useHealthSocket';

interface WebSocketDiagnosticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isConnected: boolean;
    pingLatency: number | null;
    transportType: string;
    gatewayTelemetry: GatewayTelemetry | null;
    recentFrames: WebSocketFrame[];
    reconnectCount: number;
    triggerPingTest: () => Promise<number>;
    clearFrames: () => void;
}

export const WebSocketDiagnosticsModal: React.FC<WebSocketDiagnosticsModalProps> = ({
    isOpen,
    onClose,
    isConnected,
    pingLatency,
    transportType,
    gatewayTelemetry,
    recentFrames,
    reconnectCount,
    triggerPingTest,
    clearFrames,
}) => {
    const [isPinging, setIsPinging] = useState(false);
    const [lastTestLatency, setLastTestLatency] = useState<number | null>(null);
    const [isStreamPaused, setIsStreamPaused] = useState(false);
    const [selectedFrame, setSelectedFrame] = useState<WebSocketFrame | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'stream' | 'spec'>('stream');

    if (!isOpen) return null;

    const handleRunPing = async () => {
        setIsPinging(true);
        try {
            const lat = await triggerPingTest();
            setLastTestLatency(lat);
        } finally {
            setIsPinging(false);
        }
    };

    const handleCopyPayload = (payload: any) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const displayedFrames = isStreamPaused ? recentFrames : recentFrames;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                            <Wifi className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                    WebSocket Gateway Diagnostics
                                </h3>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border",
                                    isConnected
                                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                        : "bg-rose-500/15 text-rose-600 border-rose-500/30"
                                )}>
                                    {isConnected ? 'ONLINE / CONNECTED' : 'DISCONNECTED'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                Namespace: <strong className="text-slate-700 dark:text-slate-300">/health</strong> · Transport: <strong className="text-primary uppercase">{transportType}</strong>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 4 Stat Cards */}
                <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/30 dark:bg-slate-900/20 border-b border-slate-100 dark:border-slate-800">
                    {/* Card 1: RTT Latency */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Ping Latency (RTT)</span>
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                                {lastTestLatency !== null ? lastTestLatency : pingLatency ?? 0}
                            </span>
                            <span className="text-xs font-mono text-slate-400">ms</span>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleRunPing}
                            disabled={isPinging || !isConnected}
                            className="w-full text-xs h-7 gap-1.5 font-bold cursor-pointer"
                        >
                            <RefreshCw className={cn("w-3 h-3", isPinging && "animate-spin text-primary")} />
                            <span>{isPinging ? 'Menguji...' : 'Test Ping'}</span>
                        </Button>
                    </div>

                    {/* Card 2: Connected Clients */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Active Clients</span>
                            <Radio className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-extrabold text-blue-600 dark:text-blue-400">
                                {gatewayTelemetry?.subscribers || 1}
                            </span>
                            <span className="text-xs text-slate-400">subscribers</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 truncate">
                            Room: <strong>health-updates</strong>
                        </p>
                    </div>

                    {/* Card 3: Throughput */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Throughput</span>
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                                {gatewayTelemetry?.throughputPerSec || 0.5}
                            </span>
                            <span className="text-xs text-slate-400">msg / sec</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                            Fast Rate: <strong>2s heartbeat</strong>
                        </p>
                    </div>

                    {/* Card 4: Protocol & Resilience */}
                    <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold uppercase tracking-wider text-[10px]">Resilience</span>
                            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                                {reconnectCount}
                            </span>
                            <span className="text-xs text-slate-400">reconnects</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                            Transport: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{transportType}</strong>
                        </p>
                    </div>
                </div>

                {/* Sub-Tabs: Live Stream vs Spec */}
                <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('stream')}
                            className={cn(
                                "pb-2 px-1 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                                activeTab === 'stream'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            )}
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Live Frame Stream ({displayedFrames.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('spec')}
                            className={cn(
                                "pb-2 px-1 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                                activeTab === 'spec'
                                    ? "border-primary text-primary"
                                    : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Network & CORS Policy</span>
                        </button>
                    </div>

                    {activeTab === 'stream' && (
                        <div className="flex items-center gap-2 pb-2">
                            <button
                                type="button"
                                onClick={() => setIsStreamPaused(p => !p)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                            >
                                {isStreamPaused ? <Play className="w-3 h-3 text-emerald-500" /> : <Pause className="w-3 h-3 text-amber-500" />}
                                <span>{isStreamPaused ? 'Resume Stream' : 'Pause'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={clearFrames}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                                <Trash2 className="w-3 h-3" />
                                <span>Clear</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[280px]">
                    {activeTab === 'stream' ? (
                        <div className="space-y-2">
                            {displayedFrames.length === 0 ? (
                                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                    <Terminal className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                                    <span>Menunggu paket WebSocket masuk...</span>
                                </div>
                            ) : (
                                displayedFrames.map((frame) => (
                                    <div
                                        key={frame.id}
                                        onClick={() => setSelectedFrame(selectedFrame?.id === frame.id ? null : frame)}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-xs font-mono transition-all cursor-pointer flex items-center justify-between gap-3",
                                            selectedFrame?.id === frame.id
                                                ? "bg-primary/10 border-primary/40 shadow-xs"
                                                : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-850"
                                        )}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {frame.direction === 'in' ? (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0">
                                                    <ArrowDownLeft className="w-3 h-3" />
                                                    IN
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1 shrink-0">
                                                    <ArrowUpRight className="w-3 h-3" />
                                                    OUT
                                                </span>
                                            )}

                                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                                {frame.event}
                                            </span>

                                            <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                                                {frame.payloadPreview}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0 text-[10px] text-slate-400">
                                            <span>~{frame.bytes} B</span>
                                            <span>{new Date(frame.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Selected Frame JSON Inspector */}
                            {selectedFrame && (
                                <div className="mt-4 p-4 rounded-xl bg-slate-950 text-slate-100 text-xs font-mono space-y-2 border border-slate-800 shadow-xl animate-fade-in">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                        <div className="flex items-center gap-2 text-primary font-bold">
                                            <Terminal className="w-4 h-4" />
                                            <span>Payload Inspector: {selectedFrame.event}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleCopyPayload(selectedFrame.rawPayload)}
                                            className="h-6 text-[11px] gap-1 text-slate-400 hover:text-white"
                                        >
                                            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                            <span>{copied ? 'Tersalin' : 'Salin JSON'}</span>
                                        </Button>
                                    </div>
                                    <pre className="max-h-56 overflow-auto custom-scrollbar p-2 bg-slate-900/80 rounded-lg text-[11px] text-emerald-400">
                                        {JSON.stringify(selectedFrame.rawPayload, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Spec & CORS Info */
                        <div className="space-y-4 text-xs">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-primary" />
                                    <span>Konfigurasi CORS Gateway WebSocket (/health)</span>
                                </h4>
                                <p className="text-slate-500 leading-relaxed text-[11px]">
                                    Gateway ini menggunakan dynamic origin matching untuk memastikan koneksi lancar di domain produksi maupun development:
                                </p>
                                <div className="p-2.5 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] space-y-1">
                                    <div>✓ https://idesk.santos.co.id</div>
                                    <div>✓ http://idesk.santos.co.id</div>
                                    <div>✓ *.santos.co.id (Internal company origins)</div>
                                    <div>✓ http://localhost:4050, :3000, :5173, :5050</div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span>Engine Timing & Resilience Specs</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-[11px] pt-1 font-mono">
                                    <div>Heartbeat Fast Rate: <strong>2,000 ms</strong></div>
                                    <div>Heartbeat Slow Rate: <strong>30,000 ms</strong></div>
                                    <div>Ping Timeout Limit: <strong>10,000 ms</strong></div>
                                    <div>Auto-Reconnect Tries: <strong>5 attempts</strong></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono text-[11px]">
                        Socket.IO Engine: v4.x (Namespace: /health)
                    </span>
                    <Button onClick={onClose} size="sm" variant="default">
                        Tutup
                    </Button>
                </div>
            </div>
        </div>
    );
};
