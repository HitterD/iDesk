import { Globe, Settings, Keyboard } from 'lucide-react';
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
            className={cn('h-9 flex items-center px-4 gap-3', className)}
        >
            {/* Gabungan / active-account indicator */}
            {isGabungan ? (
                <div
                    data-testid="gabungan-indicator"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary"
                >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Gabungan</span>
                    <span className="text-muted-foreground" aria-hidden="true">·</span>
                    <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
                        data-testid="gabungan-active-chip"
                    >
                        <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: activeAccountColor }}
                            aria-hidden="true"
                        />
                        {activeAccountName}
                    </span>
                    {showAutoPickHint && (
                        <span className="text-xs text-muted-foreground font-normal">
                            (auto-pilih)
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: activeAccountColor }}
                        aria-hidden="true"
                    />
                    <span className="truncate max-w-[160px]">{activeAccountName}</span>
                </div>
            )}

            <div className="ml-auto flex items-center gap-3">
                <LegendChip color="hsl(var(--primary))" label="Saya" />
                <LegendChip color="#f59e0b" label="Tim" />
                <LegendChip color="#94a3b8" label="External" />
                <LegendChip color="#ef4444" label="Blokir" />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                <div className="flex items-center gap-1.5 text-xs">
                    <span
                        className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        )}
                        aria-hidden="true"
                    />
                    <span
                        className="text-muted-foreground"
                        title={lastSyncAt?.toLocaleString()}
                    >
                        {isLive && lastSyncAt
                            ? `Live · ${formatDistanceToNow(lastSyncAt, { locale: idLocale, addSuffix: true })}`
                            : 'Offline'}
                    </span>
                </div>

                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={onOpenShortcuts}
                    aria-label="Keyboard shortcuts"
                >
                    <Keyboard className="h-3.5 w-3.5 text-slate-500" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={onOpenSettings}
                    aria-label="Settings"
                >
                    <Settings className="h-3.5 w-3.5 text-slate-500" />
                </Button>
            </div>
        </div>
    );
}

function LegendChip({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
                className="w-2 h-2 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
            />
            {label}
        </span>
    );
}
