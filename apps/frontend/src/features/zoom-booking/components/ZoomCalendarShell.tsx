import * as React from 'react';
import { cn } from '@/lib/utils';

interface ZoomCalendarShellProps {
    header: React.ReactNode;
    subBar?: React.ReactNode;
    sidebar?: React.ReactNode;
    calendarContent: React.ReactNode;
    /** @deprecated kept for backward compat with old slide-in panel API */
    panel?: React.ReactNode;
    topStrip?: React.ReactNode;
    bottomStrip?: React.ReactNode;
    isPanelOpen?: boolean;
    className?: string;
}

export function ZoomCalendarShell({
    header,
    subBar,
    sidebar,
    calendarContent,
    panel,
    topStrip,
    bottomStrip,
    isPanelOpen = false,
    className,
}: ZoomCalendarShellProps) {
    const useThreeZone = Boolean(sidebar);

    return (
        <div className={cn('flex flex-col h-full min-h-0', className)}>
            {/* Header (48px) */}
            <div className="shrink-0 px-4 py-3 border-b border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-20">
                {header}
            </div>

            {/* Sub-bar (36px) — new in 3-zone layout */}
            {subBar && useThreeZone && (
                <div className="shrink-0 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 z-10">
                    {subBar}
                </div>
            )}

            {/* Top strip — legacy mode only */}
            {topStrip && !useThreeZone && (
                <div className="shrink-0 border-b border-[hsl(var(--border))] z-10 w-full relative">
                    {topStrip}
                </div>
            )}

            {/* Main content area */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Calendar view */}
                <div className="flex-1 min-w-0 overflow-hidden">
                    {calendarContent}
                </div>

                {useThreeZone ? (
                    // New 3-zone: persistent right sidebar
                    sidebar
                ) : (
                    // Legacy: slide-in side panel
                    <>
                        <div
                            className={cn(
                                'hidden md:flex flex-col shrink-0 overflow-hidden',
                                'transition-[width] duration-300 ease-out',
                                'border-l border-[hsl(var(--border))]',
                                isPanelOpen ? 'w-[400px]' : 'w-0'
                            )}
                        >
                            {panel}
                        </div>
                        <div className="md:hidden">{panel}</div>
                    </>
                )}
            </div>

            {/* Bottom strip — legacy mode only */}
            {!useThreeZone && bottomStrip && (
                <div className="shrink-0 border-t border-[hsl(var(--border))] relative">
                    <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-t from-transparent to-[hsl(var(--background))] -translate-y-full opacity-50 pointer-events-none" />
                    {bottomStrip}
                </div>
            )}
        </div>
    );
}
