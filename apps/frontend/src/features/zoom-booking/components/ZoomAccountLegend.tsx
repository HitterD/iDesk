import { Check, Keyboard, Settings, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LegendAccount {
    id: string;
    name: string;
    colorHex: string;
    meetingsCount: number;
}

export interface ZoomAccountLegendProps {
    accounts: LegendAccount[];
    /** Accounts currently shown on the calendar. */
    visibleAccountIds: Set<string>;
    /** Single-account scope id, or 'gabungan' when all accounts are merged. */
    accountScope: string;
    onToggleAccount: (accountId: string) => void;
    onShowOnly: (accountId: string) => void;
    onShowAll: () => void;
    onOpenShortcuts: () => void;
    onOpenSettings: () => void;
}

/**
 * Apple Calendar–style sidebar: every Zoom account with its color, doubling as
 * the legend and the show/hide filter for the calendar.
 */
export function ZoomAccountLegend({
    accounts,
    visibleAccountIds,
    accountScope,
    onToggleAccount,
    onShowOnly,
    onShowAll,
    onOpenShortcuts,
    onOpenSettings,
}: ZoomAccountLegendProps) {
    const isMerged = accountScope === 'gabungan';
    const isVisible = (id: string) => (isMerged ? visibleAccountIds.has(id) : accountScope === id);
    const allVisible = isMerged && accounts.every((a) => visibleAccountIds.has(a.id));
    const totalMeetings = accounts.reduce((sum, a) => sum + (isVisible(a.id) ? a.meetingsCount : 0), 0);

    return (
        <aside
            data-testid="zoom-account-legend"
            className="hidden lg:flex w-[260px] shrink-0 flex-col min-h-0 select-none border-l border-border/60 bg-muted/30"
        >
            <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
                <h3 className="text-[13px] font-semibold text-foreground">Akun Zoom</h3>
                <span className="text-xs tabular-nums text-muted-foreground">{totalMeetings} meeting</span>
            </div>

            <div className="px-2">
                <button
                    type="button"
                    onClick={onShowAll}
                    disabled={allVisible}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                    {allVisible ? 'Semua akun ditampilkan' : 'Tampilkan semua akun'}
                </button>
            </div>

            <ul className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 pb-2">
                {accounts.length === 0 && (
                    <li className="px-2 py-2 text-xs text-muted-foreground">Belum ada akun</li>
                )}
                {accounts.map((acc) => {
                    const visible = isVisible(acc.id);
                    return (
                        <li key={acc.id} className="group relative">
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={visible}
                                onClick={() => onToggleAccount(acc.id)}
                                title={visible ? `Sembunyikan ${acc.name}` : `Tampilkan ${acc.name}`}
                                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted cursor-pointer"
                            >
                                <span
                                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors"
                                    style={{
                                        borderColor: acc.colorHex,
                                        backgroundColor: visible ? acc.colorHex : 'transparent',
                                    }}
                                    aria-hidden="true"
                                >
                                    {visible && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                </span>
                                <span className={cn('min-w-0 flex-1 truncate text-[13px]', visible ? 'text-foreground' : 'text-muted-foreground')}>
                                    {acc.name}
                                </span>
                                <span className="tabular-nums text-xs text-muted-foreground group-hover:opacity-0">
                                    {acc.meetingsCount}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onShowOnly(acc.id)}
                                className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 group-hover:flex cursor-pointer"
                                title={`Hanya tampilkan ${acc.name}`}
                                aria-label={`Hanya ${acc.name}`}
                            >
                                <Eye className="h-3 w-3" />
                                Hanya ini
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="flex items-center justify-end gap-1 border-t border-border/60 px-3 py-2">
                <button
                    type="button"
                    onClick={onOpenShortcuts}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                    aria-label="Keyboard shortcuts"
                    title="Keyboard Shortcuts (?)"
                >
                    <Keyboard className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                    aria-label="Settings"
                    title="Pengaturan Zoom"
                >
                    <Settings className="h-3.5 w-3.5" />
                </button>
            </div>
        </aside>
    );
}
