import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown, Filter, LayoutGrid, List as ListIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ListFilters, RequestStatus, ItemCategory } from '../../types';
import { getStatusMeta } from '../../utils/status.util';
import { cn } from '@/lib/utils';

const STATUSES: RequestStatus[] = [
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PROCUREMENT',
    'AWAITING_DELIVERY', 'INSTALLATION', 'AWAITING_USER_CONFIRMATION',
    'COMPLETED', 'REJECTED', 'CANCELLED',
];

const CATS: ItemCategory[] = ['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER'];

const CAT_ICON: Record<ItemCategory, string> = {
    LAPTOP: '💻', DESKTOP: '🖥', MONITOR: '🖵', ACCESSORY: '🎧',
    NETWORK: '🌐', SOFTWARE: '📦', OTHER: '📋',
};

interface RequestFiltersProps {
    value: ListFilters;
    onChange: (v: ListFilters) => void;
    scopeVisible: boolean;
    view?: 'table' | 'card';
    onViewChange?: (view: 'table' | 'card') => void;
}

export function RequestFilters({
    value,
    onChange,
    scopeVisible,
    view = 'table',
    onViewChange,
}: RequestFiltersProps) {
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
        }, 300);
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
            {/* Bento Command Toolbar */}
            <div
                className="flex flex-col lg:flex-row lg:items-center gap-2.5 p-2 bg-card rounded-2xl border border-border relative z-20 shadow-xs"
                role="search"
                aria-label="Cari dan filter hardware request"
            >
                {/* Search Bar */}
                <div className="relative flex-1 bg-muted/40 rounded-xl transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-background border border-transparent focus-within:border-primary/50">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <input
                        type="search"
                        placeholder="Cari nomor request, pemohon, atau justifikasi..."
                        className="w-full pl-10 pr-10 py-2.5 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Cari hardware request"
                    />
                    <AnimatePresence>
                        {searchTerm && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.15 }}
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                                aria-label="Hapus teks pencarian"
                            >
                                <X className="size-3.5" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                <div className="w-px h-8 bg-border hidden lg:block mx-1" />

                {/* Right controls: Scope + Filter toggle + Clear + View switcher */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                    {/* Scope toggle (Admin/Manager/Staff only) */}
                    {scopeVisible && (
                        <div className="inline-flex rounded-xl bg-muted/50 p-1 border border-border shrink-0">
                            {(['all', 'my'] as const).map((s) => {
                                const isSelected = (value.scope ?? 'all') === s;
                                return (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => onChangeRef.current({ ...valueRef.current, scope: s, page: 1 })}
                                        className={cn(
                                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer',
                                            isSelected
                                                ? 'bg-card text-foreground shadow-xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {s === 'all' ? 'Semua' : 'Milik Saya'}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Filter Dropdown Toggle */}
                    <button
                        type="button"
                        onClick={() => setFiltersOpen((o) => !o)}
                        className={cn(
                            'flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.98]',
                            filtersOpen || totalActive > 0
                                ? 'border-primary bg-primary/10 text-primary font-bold'
                                : 'border-border bg-card hover:bg-muted/50 text-foreground'
                        )}
                        aria-expanded={filtersOpen}
                    >
                        <Filter className="size-3.5" />
                        <span>Filter</span>
                        {totalActive > 0 && (
                            <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                                {totalActive}
                            </span>
                        )}
                        <ChevronDown className={cn('size-3.5 transition-transform duration-200', filtersOpen && 'rotate-180')} />
                    </button>

                    {/* Clear all */}
                    <AnimatePresence>
                        {hasFilters && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={clearAll}
                                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                                title="Reset semua filter"
                            >
                                <X className="size-3.5" />
                                <span>Reset</span>
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* View Switcher (Desktop) */}
                    {onViewChange && (
                        <div className="hidden md:inline-flex rounded-xl bg-muted/50 p-1 border border-border shrink-0 ml-auto sm:ml-0">
                            <button
                                type="button"
                                onClick={() => onViewChange('table')}
                                aria-label="Tampilan tabel"
                                title="Tampilan Tabel"
                                className={cn(
                                    'p-1.5 rounded-lg transition-all cursor-pointer',
                                    view === 'table'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <ListIcon className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => onViewChange('card')}
                                aria-label="Tampilan grid card"
                                title="Tampilan Grid Card"
                                className={cn(
                                    'p-1.5 rounded-lg transition-all cursor-pointer',
                                    view === 'card'
                                        ? 'bg-card text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <LayoutGrid className="size-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Active filter chips summary */}
            <AnimatePresence>
                {totalActive > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-wrap items-center gap-1.5 overflow-hidden px-1"
                    >
                        <span className="text-xs font-semibold text-muted-foreground mr-1">Filter aktif:</span>
                        {(value.status ?? []).map((s) => {
                            const m = getStatusMeta(s);
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => toggle('status', s)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:opacity-80 cursor-pointer shadow-xs"
                                    style={{ backgroundColor: `${m.hex}15`, borderColor: `${m.hex}40`, color: m.hex }}
                                >
                                    <span>{m.label}</span>
                                    <X className="size-3" />
                                </button>
                            );
                        })}
                        {(value.category ?? []).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => toggle('category', c)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30 transition-all hover:opacity-80 cursor-pointer shadow-xs"
                            >
                                <span>{CAT_ICON[c] ?? ''} {c}</span>
                                <X className="size-3" />
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
                        <div className="border border-border rounded-2xl bg-card p-4 flex flex-col gap-4 shadow-xs">
                            {/* Status Section */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:w-20 pt-1 shrink-0">
                                    Status
                                </span>
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status hardware request">
                                    {STATUSES.map((s) => {
                                        const on = value.status?.includes(s);
                                        const meta = getStatusMeta(s);
                                        return (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => toggle('status', s)}
                                                className={cn(
                                                    'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer',
                                                    on
                                                        ? 'shadow-xs font-bold text-white'
                                                        : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                                                )}
                                                style={on ? { backgroundColor: meta.hex, borderColor: meta.hex } : {}}
                                            >
                                                {meta.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-border" />

                            {/* Kategori Section */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground sm:w-20 pt-1 shrink-0">
                                    Kategori
                                </span>
                                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter kategori item">
                                    {CATS.map((c) => {
                                        const on = value.category?.includes(c);
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => toggle('category', c)}
                                                className={cn(
                                                    'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer',
                                                    on
                                                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-bold'
                                                        : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                                                )}
                                            >
                                                <span>{CAT_ICON[c]}</span>
                                                <span>{c}</span>
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
