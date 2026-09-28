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
    /** @deprecated the chips carry each account color; kept for API compatibility */
    activeAccountColor?: string;
    /** @deprecated kept for API compatibility */
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

const PILL_BASE =
    'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-colors cursor-pointer outline-none shrink-0 focus-visible:ring-2 focus-visible:ring-primary/40';
const PILL_SELECTED = 'bg-foreground text-background';
const PILL_IDLE = 'text-muted-foreground hover:bg-muted hover:text-foreground';

export function ZoomCalendarSubBar({
    accountScope,
    activeAccountName,
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
                'h-11 flex items-center justify-between px-3 sm:px-4 bg-background select-none text-xs gap-3 overflow-hidden',
                className
            )}
        >
            {/* LEFT: scope + neutral account pills (no per-account colors) */}
            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                {isGabungan ? (
                    <div
                        data-testid="gabungan-indicator"
                        className={cn(PILL_BASE, PILL_SELECTED, 'cursor-default')}
                        title="Menampilkan meeting dari semua akun Zoom"
                    >
                        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Semua akun</span>
                        <span className="sr-only">Mode Gabungan</span>
                        <span className="sr-only" data-testid="gabungan-active-chip">{activeAccountName}</span>
                    </div>
                ) : (
                    onSelectAccount && (
                        <button
                            type="button"
                            onClick={() => onSelectAccount('gabungan')}
                            className={cn(PILL_BASE, PILL_IDLE)}
                            title="Kembali ke semua akun"
                            aria-label="Ke Mode Gabungan"
                        >
                            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Semua akun</span>
                        </button>
                    )
                )}

                {isFiltering && onSelectAllAccounts && (
                    <button
                        type="button"
                        onClick={onSelectAllAccounts}
                        className={cn(PILL_BASE, 'text-primary hover:bg-primary/10')}
                        title="Tampilkan lagi semua akun"
                    >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset ({activeFilterAccountIds?.size}/{accounts.length})</span>
                    </button>
                )}

                {accounts.length > 0 && (
                    <>
                        <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 flex-1 py-1">
                            {accounts.map((acc) => {
                                const isActive = isGabungan
                                    ? (activeFilterAccountIds ? activeFilterAccountIds.has(acc.id) : true)
                                    : accountScope === acc.id;
                                // In Gabungan every account starts "on"; only highlight once the user narrows the filter.
                                const highlight = isGabungan ? isFiltering && isActive : isActive;
                                const dimmed = isGabungan && !isActive;
                                const count = acc.meetingsCount ?? 0;

                                return (
                                    <div key={acc.id} className="group/chip relative shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isGabungan && onToggleAccountFilter) {
                                                    onToggleAccountFilter(acc.id);
                                                } else if (!isGabungan && onSelectAccount) {
                                                    onSelectAccount(acc.id);
                                                }
                                            }}
                                            aria-pressed={isActive}
                                            className={cn(
                                                PILL_BASE,
                                                highlight ? 'bg-primary/10 text-primary' : PILL_IDLE,
                                                dimmed && 'opacity-45 line-through',
                                            )}
                                            title={
                                                isGabungan
                                                    ? `Klik untuk ${isActive ? 'sembunyikan' : 'tampilkan'} ${acc.name} (${count} meeting)`
                                                    : `Pilih akun ${acc.name} (${count} meeting)`
                                            }
                                        >
                                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: acc.colorHex }} aria-hidden="true" />
                                            <span className="truncate max-w-[110px]">{acc.name}</span>
                                            <span className="tabular-nums opacity-60">{count}</span>
                                        </button>

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
                                                className="absolute -top-1 -right-0.5 hidden group-hover/chip:flex h-4 w-4 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-primary cursor-pointer"
                                                title={`Hanya tampilkan ${acc.name}`}
                                                aria-label={`Solo ${acc.name}`}
                                            >
                                                <Eye className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* RIGHT: sync state + icon buttons */}
            <div className="flex items-center gap-1 shrink-0">
                <span
                    className="flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground"
                    title={lastSyncAt?.toLocaleString()}
                >
                    <span
                        className={cn('h-1.5 w-1.5 rounded-full shrink-0', isLive ? 'bg-emerald-500' : 'bg-muted-foreground/50')}
                        aria-hidden="true"
                    />
                    {isLive ? (lastSyncAt ? `Live · ${formatDistanceToNow(lastSyncAt, { locale: idLocale, addSuffix: true })}` : 'Live') : 'Offline'}
                </span>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={onOpenShortcuts}
                    aria-label="Keyboard shortcuts"
                    title="Keyboard Shortcuts (?)"
                >
                    <Keyboard className="h-3.5 w-3.5" />
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={onOpenSettings}
                    aria-label="Settings"
                    title="Pengaturan Zoom"
                >
                    <Settings className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
