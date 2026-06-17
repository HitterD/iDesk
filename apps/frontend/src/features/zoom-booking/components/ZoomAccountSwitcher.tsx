import { useState, useEffect } from 'react';
import { Globe, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import type { AccountLoad } from '../utils/autoPickAccount';

export interface ZoomAccountSwitcherProps {
    open: boolean;
    accounts: AccountLoad[];
    currentAccountId: string;
    onSelect: (accountId: string) => void;
    onClose: () => void;
}

export const GABUNGAN_ID = 'gabungan';

export function ZoomAccountSwitcher({
    open,
    accounts,
    currentAccountId,
    onSelect,
    onClose,
}: ZoomAccountSwitcherProps) {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const filtered = accounts.filter((a) =>
        a.name.toLowerCase().includes(query.toLowerCase()),
    );

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-[520px] p-0 gap-0">
                <DialogTitle className="sr-only">Pilih akun Zoom</DialogTitle>

                {/* Search */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-md px-3 py-2">
                        <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari akun Zoom…"
                            aria-label="Cari akun Zoom"
                            className="flex-1 bg-transparent outline-none text-sm"
                        />
                        <kbd className="text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-slate-500">
                            ESC
                        </kbd>
                    </div>
                </div>

                {/* Gabungan card */}
                <div className="p-2">
                    <button
                        type="button"
                        onClick={() => onSelect(GABUNGAN_ID)}
                        data-testid="gabungan-card"
                        className={`w-full p-2.5 rounded-lg text-left flex items-center gap-2.5 border-2 transition-colors ${
                            currentAccountId === GABUNGAN_ID
                                ? 'bg-blue-50 border-blue-500 dark:bg-blue-950/30'
                                : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <Globe className="h-4 w-4 text-blue-600" aria-hidden="true" />
                        <div className="flex-1">
                            <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                                Gabungan (Semua Akun)
                            </div>
                            <div className="text-[10px] text-slate-500">
                                Lihat & book di semua akun · auto-pilih paling kosong
                            </div>
                        </div>
                        {currentAccountId === GABUNGAN_ID ? (
                            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                DEFAULT
                            </span>
                        ) : null}
                    </button>
                </div>

                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                    Akun Individual ({accounts.length})
                </div>

                {/* Account grid */}
                <div className="p-2 grid grid-cols-2 gap-1.5 max-h-[340px] overflow-y-auto">
                    {filtered.map((acc) => (
                        <button
                            type="button"
                            key={acc.id}
                            data-testid={`account-card-${acc.id}`}
                            onClick={() => onSelect(acc.id)}
                            className={`p-2 rounded-md text-left flex items-center gap-2 border ${
                                currentAccountId === acc.id
                                    ? 'bg-blue-50 border-blue-500'
                                    : 'bg-white border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700'
                            }`}
                        >
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: acc.colorHex }}
                                aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold truncate text-slate-800 dark:text-slate-200">
                                    {acc.name}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    {acc.meetingsAtTime} mtg · load {Math.min(100, acc.meetingsAtTime * 4)}%
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-[10px] text-slate-500">
                    <span>↑↓ navigasi · ↵ pilih · ESC tutup</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
