import { Globe, Settings, Keyboard, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AccountScope } from '../hooks/useCalendarView';

export interface ZoomCalendarSubBarProps {
    /** Active account scope; Gabungan means merged/all-accounts view */
    accountScope: AccountScope;
    /** Account name currently displayed (auto-picked when in Gabungan) */
    activeAccountName: string;
    /** Color for the active account chip */
    activeAccountColor?: string;
    /** Whether to show the auto-pick hint next to the indicator */
    showAutoPickHint?: boolean;
    isLive: boolean;
    lastSyncAt: Date | null;
    onOpenShortcuts: () => void;
    onOpenSettings: () => void;
    className?: string;
}

export function ZoomCalendarSubBar({
    accountScope,
    activeAccountName,
    activeAccountColor = '#3b82f6',
    showAutoPickHint = false,
    isLive,
    lastSyncAt,
    onOpenShortcuts,
    onOpenSettings,
    className,
}: ZoomCalendarSubBarProps) {
    const isGabungan = accountScope === 'gabungan';

    return (
        <div
            data-testid="zoom-subbar"
            className={cn(
                'h-9 flex items-center justify-between px-4 bg-card/60 border-b border-border/70 select-none text-xs',
                className
            )}
        >
            {/* LEFT: Account / Scope Status */}
            <div className="flex items-center gap-2">
                {isGabungan ? (
                    <div
                        data-testid="gabungan-indicator"
                        className="flex items-center gap-1.5 font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20"
                    >
                        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Mode Gabungan</span>
                        <span className="text-muted-foreground font-normal">·</span>
                        <span
                            className="inline-flex items-center gap-1.5 font-medium text-foreground"
                            data-testid="gabungan-active-chip"
                        >
                            <span
                                className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: activeAccountColor }}
                                aria-hidden="true"
                            />
                            <span>{activeAccountName}</span>
                        </span>
                        {showAutoPickHint && (
                            <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                (auto-pilih)
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 font-bold text-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/80">
                        <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: activeAccountColor }}
                            aria-hidden="true"
                        />
                        <span className="truncate max-w-[180px]">{activeAccountName}</span>
                    </div>
                )}
            </div>

            {/* RIGHT: Legend Pills, Sync Connection & Action Icons */}
            <div className="flex items-center gap-3">
                {/* Status / Ownership Legends */}
                <div className="hidden sm:flex items-center gap-2.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/60">
                    <LegendChip color="hsl(var(--primary))" label="Saya" />
                    <LegendChip color="#f59e0b" label="Tim" />
                    <LegendChip color="#94a3b8" label="External" />
                    <LegendChip color="#ef4444" label="Blokir" />
                </div>

                <div className="w-px h-4 bg-border" aria-hidden="true" />

                {/* Live Socket Status */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-background border border-border/70 shadow-2xs">
                    <span
                        className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        )}
                        aria-hidden="true"
                    />
                    <span
                        className={isLive ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-muted-foreground'}
                        title={lastSyncAt?.toLocaleString()}
                    >
                        {isLive ? (lastSyncAt ? `Live · ${formatDistanceToNow(lastSyncAt, { locale: idLocale, addSuffix: true })}` : 'Live') : 'Offline'}
                    </span>
                </div>

                {/* Shortcuts & Settings Buttons */}
                <div className="flex items-center gap-0.5">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        onClick={onOpenShortcuts}
                        aria-label="Keyboard shortcuts"
                        title="Keyboard Shortcuts (?)"
                    >
                        <Keyboard className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        onClick={onOpenSettings}
                        aria-label="Settings"
                        title="Pengaturan Zoom"
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <span
                className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                style={{ background: color }}
                aria-hidden="true"
            />
            <span>{label}</span>
        </span>
    );
}
