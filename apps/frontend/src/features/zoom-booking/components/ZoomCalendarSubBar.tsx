import { Globe, Settings, Keyboard, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AccountScope } from '../hooks/useCalendarView';

export interface SubBarAccountItem {
    id: string;
    name: string;
    colorHex: string;
    meetingsCount?: number;
}

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

    /** Interactive account filter bar props */
    accounts?: SubBarAccountItem[];
    activeFilterAccountIds?: Set<string>;
    onToggleAccountFilter?: (accountId: string) => void;
    onSelectAccount?: (accountId: string) => void;
    onSelectAllAccounts?: () => void;
    onSoloAccountFilter?: (accountId: string) => void;
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
    accounts = [],
    activeFilterAccountIds,
    onToggleAccountFilter,
    onSelectAccount,
    onSelectAllAccounts,
    onSoloAccountFilter,
}: ZoomCalendarSubBarProps) {
    const isGabungan = accountScope === 'gabungan';
    const isFiltering = Boolean(
        isGabungan &&
        activeFilterAccountIds &&
        accounts.length > 0 &&
        activeFilterAccountIds.size < accounts.length
    );

    return (
        <div
            data-testid="zoom-subbar"
            className={cn(
                'h-10 flex items-center justify-between px-3 sm:px-4 bg-card/80 backdrop-blur-xs border-b border-border/70 select-none text-xs gap-2 overflow-hidden',
                className
            )}
        >
            {/* LEFT: Account / Scope Status & Interactive Filter Chips */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
                {isGabungan ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div
                            data-testid="gabungan-indicator"
                            className="flex items-center gap-1.5 font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20 shrink-0 shadow-2xs"
                        >
                            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">Mode Gabungan</span>
                            <span className="sm:hidden">Gabungan</span>
                            <span className="sr-only" data-testid="gabungan-active-chip">{activeAccountName}</span>
                        </div>

                        {/* Reset Filter Button if any account unselected */}
                        {isFiltering && onSelectAllAccounts && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={onSelectAllAccounts}
                                className="h-7 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg gap-1 shrink-0"
                                title="Reset filter: Tampilkan semua akun"
                            >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reset ({activeFilterAccountIds?.size}/{accounts.length})</span>
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex items-center gap-1.5 font-bold text-foreground bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/25 shadow-2xs">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: activeAccountColor }}
                                aria-hidden="true"
                            />
                            <span className="truncate max-w-[160px] text-primary">{activeAccountName}</span>
                        </div>

                        {/* Quick button to switch back to Gabungan */}
                        {onSelectAccount && (
                            <button
                                type="button"
                                onClick={() => onSelectAccount('gabungan')}
                                className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border/80 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                title="Beralih kembali ke Mode Gabungan (Semua Akun)"
                            >
                                <Globe className="h-3 w-3 text-primary" />
                                <span>Ke Mode Gabungan</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Horizontal Scrollable Account Chips */}
                {accounts.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0 flex-1 border-l border-border/50 pl-2">
                        {accounts.map((acc) => {
                            const isSingleActive = !isGabungan && accountScope === acc.id;
                            const isMultiActive = isGabungan && (activeFilterAccountIds ? activeFilterAccountIds.has(acc.id) : true);
                            const isActive = isGabungan ? isMultiActive : isSingleActive;
                            const count = acc.meetingsCount ?? 0;

                            return (
                                <div
                                    key={acc.id}
                                    className={cn(
                                        "group/chip inline-flex items-center rounded-lg text-[11px] font-semibold transition-all shrink-0 border select-none",
                                        isActive
                                            ? "bg-background text-foreground border-border/90 shadow-2xs hover:border-primary/50"
                                            : "bg-muted/40 text-muted-foreground/60 border-border/40 hover:bg-muted hover:text-foreground opacity-60"
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isGabungan && onToggleAccountFilter) {
                                                onToggleAccountFilter(acc.id);
                                            } else if (!isGabungan && onSelectAccount) {
                                                onSelectAccount(acc.id);
                                            }
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2 py-1 cursor-pointer outline-none"
                                        title={
                                            isGabungan
                                                ? `Klik untuk ${isActive ? 'sembunyikan' : 'tampilkan'} ${acc.name} (${count} meeting)`
                                                : `Pilih akun ${acc.name} (${count} meeting)`
                                        }
                                    >
                                        <span
                                            className={cn(
                                                "w-2 h-2 rounded-full shrink-0 transition-transform",
                                                isActive ? "scale-100 shadow-2xs" : "scale-75 opacity-40"
                                            )}
                                            style={{ backgroundColor: acc.colorHex }}
                                            aria-hidden="true"
                                        />
                                        <span className={cn("truncate max-w-[90px]", isActive ? "font-bold text-foreground" : "line-through opacity-75")}>
                                            {acc.name}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-[10px] font-mono px-1 rounded-full",
                                                isActive
                                                    ? count > 0 ? "bg-muted text-foreground font-bold" : "text-muted-foreground/60"
                                                    : "text-muted-foreground/40"
                                            )}
                                        >
                                            {count}
                                        </span>
                                    </button>

                                    {/* Solo Focus button on hover (Mode Gabungan only) */}
                                    {isGabungan && (onSoloAccountFilter || onSelectAccount) && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onSoloAccountFilter) {
                                                    onSoloAccountFilter(acc.id);
                                                } else if (onSelectAccount) {
                                                    onSelectAccount(acc.id);
                                                }
                                            }}
                                            className="opacity-0 group-hover/chip:opacity-100 px-1 py-1 text-muted-foreground hover:text-primary transition-opacity cursor-pointer mr-1"
                                            title={`Hanya tampilkan ${acc.name} (Solo)`}
                                            aria-label={`Solo ${acc.name}`}
                                        >
                                            <Eye className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* RIGHT: Sync Connection & Action Icons */}
            <div className="flex items-center gap-1.5 shrink-0 pl-1">
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
