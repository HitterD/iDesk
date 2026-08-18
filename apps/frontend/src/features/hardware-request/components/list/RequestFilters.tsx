import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ListFilters, RequestStatus, ItemCategory } from '../../types';
import { getStatusMeta } from '../../utils/status.util';

const STATUSES: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
    'INSTALLATION', 'COMPLETED', 'REJECTED', 'CANCELLED',
];
const CATS: ItemCategory[] = ['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER'];

const CAT_ICON: Record<ItemCategory, string> = {
    LAPTOP: '💻', DESKTOP: '🖥', MONITOR: '🖵', ACCESSORY: '🎧',
    NETWORK: '🌐', SOFTWARE: '📦', OTHER: '📋',
};

export function RequestFilters({
    value,
    onChange,
    scopeVisible,
}: {
    value: ListFilters;
    onChange: (v: ListFilters) => void;
    scopeVisible: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState(value.search ?? '');
    const [filtersOpen, setFiltersOpen] = useState(false);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        const timer = setTimeout(() => {
            if (valueRef.current.search !== searchTerm) {
                onChangeRef.current({ ...valueRef.current, search: searchTerm || undefined, page: 1 });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const toggle = useCallback((key: keyof ListFilters, v: any) => {
        const arr = (valueRef.current[key] as any[] | undefined) ?? [];
        const set = new Set(arr);
        set.has(v) ? set.delete(v) : set.add(v);
        onChangeRef.current({ ...valueRef.current, [key]: Array.from(set), page: 1 });
    }, []);

    const clearAll = useCallback(() => {
        onChangeRef.current({ ...valueRef.current, status: [], category: [], page: 1 });
        setSearchTerm('');
    }, []);

    const activeStatusCount = value.status?.length ?? 0;
    const activeCatCount = value.category?.length ?? 0;
    const hasFilters = activeStatusCount > 0 || activeCatCount > 0 || !!value.search;
    const totalActive = activeStatusCount + activeCatCount;

    return (
        <div className="flex flex-col gap-3">
            {/* Command Row */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari nomor, nama, atau justifikasi..."
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-[13px] font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-primary transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Cari request"
                    />
                    <AnimatePresence>
                        {searchTerm && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                <X className="size-3.5" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Scope toggle */}
                {scopeVisible && (
                    <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/60 p-0.5 border border-slate-200 dark:border-slate-700/60 shrink-0">
                        {(['all', 'my'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => onChangeRef.current({ ...valueRef.current, scope: s })}
                                className={`px-3.5 py-1.5 rounded-[9px] text-xs font-bold uppercase tracking-wider transition-all duration-200
                                    ${value.scope === s
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {s === 'all' ? 'Semua' : 'Milik Saya'}
                            </button>
                        ))}
                    </div>
                )}

                {/* Filter toggle */}
                <button
                    onClick={() => setFiltersOpen((o) => !o)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-bold shrink-0 transition-all duration-200
                        ${filtersOpen || totalActive > 0
                            ? 'border-primary bg-primary/10 dark:bg-primary/20 text-primary'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        }`}
                    aria-expanded={filtersOpen}
                >
                    Filter
                    {totalActive > 0 && (
                        <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-white text-xs font-black">
                            {totalActive}
                        </span>
                    )}
                    <ChevronDown className={`size-3.5 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Clear all */}
                <AnimatePresence>
                    {hasFilters && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={clearAll}
                            className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors shrink-0"
                        >
                            <X className="size-3" />
                            Reset
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Active filter chips summary */}
            <AnimatePresence>
                {totalActive > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-wrap gap-1.5 overflow-hidden"
                    >
                        {(value.status ?? []).map((s) => {
                            const m = getStatusMeta(s);
                            return (
                                <button
                                    key={s}
                                    onClick={() => toggle('status', s)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all hover:opacity-80"
                                    style={{ backgroundColor: `${m.hex}15`, borderColor: `${m.hex}40`, color: m.hex }}
                                >
                                    {m.label}
                                    <X className="size-2.5" />
                                </button>
                            );
                        })}
                        {(value.category ?? []).map((c) => (
                            <button
                                key={c}
                                onClick={() => toggle('category', c)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 dark:bg-primary/20 text-primary border border-primary/30 transition-all hover:opacity-80"
                            >
                                {CAT_ICON[c] ?? ''} {c}
                                <X className="size-2.5" />
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expandable filter panel */}
            <AnimatePresence>
                {filtersOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 p-3 flex flex-col gap-3">
                            {/* Status */}
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 pt-1 shrink-0 w-14">
                                    Status
                                </span>
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status">
                                    {STATUSES.map((s) => {
                                        const on = value.status?.includes(s);
                                        const meta = getStatusMeta(s);
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => toggle('status', s)}
                                                className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all duration-150
                                                    ${on ? 'shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'}`}
                                                style={on ? { backgroundColor: meta.hex, color: '#fff', borderColor: meta.hex } : {}}
                                            >
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-slate-200 dark:border-slate-700/60" />

                            {/* Kategori */}
                            <div className="flex items-start gap-3">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 pt-1 shrink-0 w-14">
                                    Kategori
                                </span>
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter kategori">
                                    {CATS.map((c) => {
                                        const on = value.category?.includes(c);
                                        return (
                                            <button
                                                key={c}
                                                onClick={() => toggle('category', c)}
                                                className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition-all duration-150
                                                    ${on
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                                    }`}
                                            >
                                                {CAT_ICON[c]} {c}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
