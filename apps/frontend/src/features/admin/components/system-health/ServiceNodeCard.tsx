import React from 'react';
import {
    Globe,
    Server,
    Shield,
    ClipboardList,
    Video,
    Bell,
    Database,
    Radio,
    Wifi,
    HardDrive,
    Mail,
    Send,
    Cloud,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceNodeData } from './serviceMapTypes';

interface ServiceNodeCardProps {
    node: ServiceNodeData;
    isActiveInTrace: boolean;
    isSelected: boolean;
    onClick: () => void;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    browser: Globe,
    gateway: Server,
    auth: Shield,
    tickets: ClipboardList,
    video: Video,
    bell: Bell,
    database: Database,
    cache: Radio,
    socket: Wifi,
    storage: HardDrive,
    mail: Mail,
    telegram: Send,
    cloud: Cloud,
};

export const ServiceNodeCard: React.FC<ServiceNodeCardProps> = ({
    node,
    isActiveInTrace,
    isSelected,
    onClick,
}) => {
    const Icon = ICONS[node.iconType] || Server;
    const isError = node.status === 'error' || node.statusCode >= 500;
    const isWarning = node.status === 'warning' || (node.statusCode >= 400 && node.statusCode < 500);

    return (
        <div
            onClick={onClick}
            data-testid={`service-node-${node.id}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            }}
            className={cn(
                "relative rounded-xl border text-left transition-all duration-200 cursor-pointer select-none overflow-hidden group shadow-sm",
                "w-48 sm:w-52",
                // Active vs Inactive in trace
                isActiveInTrace ? "opacity-100 scale-100" : "opacity-40 hover:opacity-75 grayscale-[0.5]",
                // Selected border highlight
                isSelected
                    ? "ring-2 ring-blue-500 shadow-md ring-offset-2 dark:ring-offset-slate-900 z-10"
                    : "hover:shadow-md hover:border-slate-400 dark:hover:border-slate-600",
                // Card backgrounds based on status
                isError
                    ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80"
                    : isWarning
                        ? "bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            )}
        >
            {/* Top Status Code Pill (Inspired by Datadog APM cards in Gambar 2) */}
            <div className={cn(
                "px-2.5 py-1 text-[10px] font-mono font-bold flex items-center justify-between border-b",
                isError
                    ? "bg-rose-500 text-white border-rose-600 dark:bg-rose-600"
                    : isWarning
                        ? "bg-amber-500 text-white border-amber-600 dark:bg-amber-600"
                        : "bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
            )}>
                <span className="flex items-center gap-1">
                    {isError ? (
                        <AlertCircle className="w-3 h-3 shrink-0 animate-pulse" />
                    ) : (
                        <CheckCircle className="w-3 h-3 shrink-0" />
                    )}
                    <span>Status Code: {node.statusCode}</span>
                </span>
                {node.errorBadge && (
                    <span className="bg-white/20 px-1 py-0.2 rounded text-[9px] uppercase tracking-wider">
                        {node.errorBadge}
                    </span>
                )}
            </div>

            {/* Card Body */}
            <div className="p-3">
                <div className="flex items-start gap-2">
                    <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        isError
                            ? "bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400"
                            : isWarning
                                ? "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400"
                                : "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                    )}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {node.label}
                        </h4>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                            {node.name}
                        </p>
                    </div>
                </div>

                {/* Execution Time & Latency Metrics */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                        % exec time:
                    </span>
                    <span className={cn(
                        "font-mono font-bold text-[10px]",
                        isError ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300"
                    )}>
                        {node.execTimePercent}% ({node.latencyMs < 1 ? '<1 ms' : `${node.latencyMs} ms`})
                    </span>
                </div>

                {/* Progress bar for exec time */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isError
                                ? "bg-rose-500"
                                : isWarning
                                    ? "bg-amber-500"
                                    : "bg-blue-600"
                        )}
                        style={{ width: `${Math.max(4, Math.min(100, node.execTimePercent))}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
