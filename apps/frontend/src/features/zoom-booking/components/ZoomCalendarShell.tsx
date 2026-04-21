import * as React from 'react';
import { cn } from '@/lib/utils';

interface ZoomCalendarShellProps {
    header: React.ReactNode;
    calendarContent: React.ReactNode;
    panel: React.ReactNode;
    topStrip?: React.ReactNode;
    bottomStrip?: React.ReactNode;
    isPanelOpen?: boolean;
    className?: string;
}

export function ZoomCalendarShell({
    header,
    calendarContent,
    panel,
    topStrip,
    bottomStrip,
    isPanelOpen = false,
    className,
}: ZoomCalendarShellProps) {
    return (
        <div className={cn("flex flex-col h-full min-h-0", className)}>
            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-20">
                {header}
            </div>

            {/* Top strip */}
            {topStrip && (
                <div className="shrink-0 border-b border-[hsl(var(--border))] z-10 w-full relative">
                    {topStrip}
                </div>
            )}

            {/* Main content area — calendar + side panel side by side */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Calendar view */}
                <div className="flex-1 min-w-0 overflow-auto custom-scrollbar">
                    {calendarContent}
                </div>

                {/* Desktop side panel — real flex item, pushes calendar */}
                <div
                    className={cn(
                        "hidden md:flex flex-col shrink-0 overflow-hidden",
                        "transition-[width] duration-300 ease-out",
                        "border-l border-[hsl(var(--border))]",
                        isPanelOpen ? "w-[400px]" : "w-0"
                    )}
                >
                    {panel}
                </div>

                {/* Mobile panel — rendered in portal via Sheet, no layout space needed */}
                <div className="md:hidden">
                    {panel}
                </div>
            </div>

            {/* Bottom strip */}
            {bottomStrip && (
                <div className="shrink-0 border-t border-[hsl(var(--border))] relative">
                    <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-t from-transparent to-[hsl(var(--background))] -translate-y-full opacity-50 pointer-events-none" />
                    {bottomStrip}
                </div>
            )}
        </div>
    );
}
