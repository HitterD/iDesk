import { Globe, Settings, Keyboard, CircleDot } from 'lucide-react';
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
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300"
                >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Gabungan</span>
                    <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">·</span>
                    <span
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 pl-1 pr-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                        data-testid="gabungan-active-chip"
                    >
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: activeAccountColor }}
                            aria-hidden="true"
                        />
                        {activeAccountName}
                    </span>
                    {showAutoPickHint && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            (auto-pilih)
                        </span>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: activeAccountColor }}
                        aria-hidden="true"
                    />
                    <span className="truncate max-w-[160px]">{activeAccountName}</span>
                </div>
            )}

            <div className="ml-auto flex items-center gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Legend:
                </span>
                <LegendChip color="linear-gradient(135deg, #3b82f6, #2563eb)" label="Saya" />
                <LegendChip color="linear-gradient(135deg, #fbbf24, #f59e0b)" label="Tim" />
                <LegendChip color="#cbd5e1" label="External" />
                <LegendChip color="linear-gradient(135deg, #ef4444, #dc2626)" label="Blokir" />

                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

                <div className="flex items-center gap-1 text-[11px]">
                    <CircleDot
                        className={cn(
                            'h-3 w-3',
                            isLive ? 'text-emerald-500 fill-emerald-500' : 'text-slate-400'
                        )}
                        aria-hidden="true"
                    />
                    <span
                        className="text-slate-600 dark:text-slate-400"
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
        <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
            <span
                className="w-2.5 h-2.5 rounded-sm border-l-2"
                style={{ background: color, borderLeftColor: 'rgba(255,255,255,0.4)' }}
                aria-hidden="true"
            />
            {label}
        </span>
    );
}
