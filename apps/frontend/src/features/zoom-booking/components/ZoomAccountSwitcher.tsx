import { useState, useEffect, useMemo } from 'react';
import { Globe, Search, Check, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomAccountSwitcherProps {
    open: boolean;
    accounts: AccountLoad[];
    currentAccountId: string;
    onSelect: (accountId: string) => void;
    onClose: () => void;
}

export const GABUNGAN_ID = 'gabungan';

interface ZoomAccountSwitcherContentProps {
    accounts: AccountLoad[];
    currentAccountId: string;
    onSelect: (accountId: string) => void;
    onClose?: () => void;
}

export function ZoomAccountSwitcherContent({
    accounts,
    currentAccountId,
    onSelect,
    onClose,
}: ZoomAccountSwitcherContentProps) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return accounts;
        return accounts.filter((a) => a.name.toLowerCase().includes(q));
    }, [accounts, query]);

    const maxMeetings = useMemo(() => {
        return Math.max(1, ...accounts.map((a) => a.meetingsAtTime));
    }, [accounts]);

    const totalMeetings = useMemo(() => {
        return accounts.reduce((sum, a) => sum + a.meetingsAtTime, 0);
    }, [accounts]);

    return (
        <div className="flex flex-col select-none text-xs w-full">
            {/* Search */}
            <div className="p-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-1.5 border border-border/80 shadow-2xs">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cari akun Zoom…"
                        aria-label="Cari akun Zoom"
                        className="flex-1 bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground"
                    />
                    <kbd className="text-[10px] font-mono bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                        ESC
                    </kbd>
                </div>
            </div>

            {/* Gabungan card */}
            <div className="p-2.5 border-b border-border/50">
                <button
                    type="button"
                    onClick={() => onSelect(GABUNGAN_ID)}
                    data-testid="gabungan-card"
                    className={cn(
                        "w-full p-2.5 rounded-xl text-left flex items-center gap-3 border transition-all cursor-pointer shadow-2xs group",
                        currentAccountId === GABUNGAN_ID
                            ? "bg-primary/10 border-primary/40 text-primary font-semibold"
                            : "bg-background border-border/80 hover:bg-muted/50 text-foreground"
                    )}
                >
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                        <Globe className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground group-hover:text-primary flex items-center gap-1.5">
                            <span>Gabungan (Semua Akun)</span>
                            {currentAccountId === GABUNGAN_ID && (
                                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                    DEFAULT
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                            {totalMeetings} meeting aktif · Lihat & filter semua jadwal
                        </div>
                    </div>
                    {currentAccountId === GABUNGAN_ID && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                </button>
            </div>

            {/* Account list header */}
            <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/20 flex items-center justify-between">
                <span>Akun Individual ({accounts.length})</span>
                <span className="font-mono text-[10px] font-normal lowercase text-muted-foreground">klik untuk pilih</span>
            </div>

            {/* Account grid */}
            <div className="p-2.5 grid grid-cols-2 gap-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                {filtered.map((acc) => {
                    const isSelected = currentAccountId === acc.id;
                    const loadPct = Math.min(100, Math.round((acc.meetingsAtTime / maxMeetings) * 100));

                    return (
                        <button
                            type="button"
                            key={acc.id}
                            data-testid={`account-card-${acc.id}`}
                            onClick={() => onSelect(acc.id)}
                            className={cn(
                                "p-2 rounded-xl text-left flex flex-col gap-1 border transition-all cursor-pointer shadow-2xs",
                                isSelected
                                    ? "bg-primary/10 border-primary text-primary font-semibold ring-1 ring-primary/30"
                                    : "bg-background border-border/80 hover:bg-muted/50 text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                                    style={{ backgroundColor: acc.colorHex }}
                                    aria-hidden="true"
                                />
                                <span className="text-xs font-bold truncate flex-1 text-foreground">
                                    {acc.name}
                                </span>
                                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span className="font-mono">{acc.meetingsAtTime} mtg</span>
                                <span className="font-mono">{loadPct}% load</span>
                            </div>
                            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${loadPct}%`, backgroundColor: acc.colorHex }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="p-2.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>↑↓ navigasi · ↵ pilih · ESC tutup</span>
                <span className="font-mono text-[10px]">{accounts.length} akun aktif</span>
            </div>
        </div>
    );
}

export function ZoomAccountSwitcher({
    open,
    accounts,
    currentAccountId,
    onSelect,
    onClose,
}: ZoomAccountSwitcherProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-[480px] p-0 gap-0 overflow-hidden rounded-2xl border-border bg-card">
                <DialogTitle className="sr-only">Pilih akun Zoom</DialogTitle>
                <ZoomAccountSwitcherContent
                    accounts={accounts}
                    currentAccountId={currentAccountId}
                    onSelect={onSelect}
                    onClose={onClose}
                />
            </DialogContent>
        </Dialog>
    );
}
