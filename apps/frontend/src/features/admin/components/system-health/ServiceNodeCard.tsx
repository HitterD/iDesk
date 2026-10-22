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
    cloud: Cloud,
    desktop: Radio,
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
                    ? "ring-2 ring-brand shadow-md ring-offset-2 ring-offset-surface z-10"
                    : "hover:shadow-md hover:border-line-strong",
                // Card backgrounds based on status
                isError
                    ? "bg-bad/10 border-bad/30"
                    : isWarning
                        ? "bg-warn/10 border-warn/30"
                        : "bg-surface border-line"
            )}
        >
            {/* Top Status Code Pill (Inspired by Datadog APM cards in Gambar 2) */}
            <div className={cn(
                "px-2.5 py-1 text-[10px] font-mono font-bold flex items-center justify-between border-b",
                isError
                    ? "bg-bad text-white border-bad"
                    : isWarning
                        ? "bg-warn text-white border-warn"
                        : "bg-ok/10 text-ok-ink border-ok/20"
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
                    <span className="bg-surface/20 px-1 py-0.2 rounded text-[9px] uppercase tracking-wider">
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
                            ? "bg-bad/15 text-bad-ink"
                            : isWarning
                                ? "bg-warn/15 text-warn-ink"
                                : "bg-brand/10 text-brand"
                    )}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-ink truncate">
                            {node.label}
                        </h4>
                        <p className="text-[10px] font-mono text-ink-3 truncate">
                            {node.name}
                        </p>
                    </div>
                </div>

                {/* Execution Time & Latency Metrics */}
                <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-[11px]">
                    <span className="text-ink-2 text-[10px]">
                        % exec time:
                    </span>
                    <span className={cn(
                        "font-mono font-bold text-[10px]",
                        isError ? "text-bad-ink" : "text-ink"
                    )}>
                        {node.execTimePercent}% ({node.latencyMs < 1 ? '<1 ms' : `${node.latencyMs} ms`})
                    </span>
                </div>

                {/* Progress bar for exec time */}
                <div className="w-full bg-fill h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isError
                                ? "bg-bad"
                                : isWarning
                                    ? "bg-warn"
                                    : "bg-brand"
                        )}
                        style={{ width: `${Math.max(4, Math.min(100, node.execTimePercent))}%` }}
                    />
                </div>
            </div>
        </div>
    );
};
