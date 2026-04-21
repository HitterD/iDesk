import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, XCircle } from 'lucide-react';
import type { ListFilters, RequestStatus, ItemCategory } from '../../types';
import { getStatusMeta } from '../../utils/status.util';

const STATUSES: RequestStatus[] = ['SUBMITTED','UNDER_REVIEW','APPROVED','PROCUREMENT','INSTALLATION','COMPLETED','REJECTED','CANCELLED'];
const CATS: ItemCategory[] = ['LAPTOP','DESKTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER'];

export function RequestFilters({
    value, onChange, scopeVisible,
}: { value: ListFilters; onChange: (v: ListFilters) => void; scopeVisible: boolean }) {
    const [searchTerm, setSearchTerm] = useState(value.search ?? '');

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
        const currentVal = valueRef.current;
        const arr = (currentVal[key] as any[] | undefined) ?? [];
        const set = new Set(arr);
        set.has(v) ? set.delete(v) : set.add(v);
        onChangeRef.current({ ...currentVal, [key]: Array.from(set) });
    }, []);

    const hasFilters = (value.status?.length ?? 0) > 0 || (value.category?.length ?? 0) > 0;

    const clearAll = useCallback(() => {
        onChangeRef.current({ ...valueRef.current, status: [], category: [], page: 1 });
    }, []);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text" placeholder="Cari nomor request, nama hardware, atau justifikasi..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-sm focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Cari request"
                    />
                </div>
                {scopeVisible && (
                    <div className="inline-flex rounded-xl bg-slate-100/80 dark:bg-slate-800/50 p-1 border border-slate-200/60 dark:border-slate-700/50 backdrop-blur-sm self-start md:self-auto">
                        {(['all','my'] as const).map(s => (
                            <button key={s} onClick={() => onChangeRef.current({ ...valueRef.current, scope: s })}
                                className={`px-4 py-1.5 rounded-[10px] text-xs font-bold uppercase tracking-wider transition-all duration-300 ${value.scope===s ? 'bg-white dark:bg-slate-700 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                {s === 'all' ? 'Semua Request' : 'Milik Saya'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {hasFilters && (
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Filter Aktif:</span>
                    <button onClick={clearAll} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors">
                        <XCircle className="size-3.5" />
                        Clear All
                    </button>
                </div>
            )}

            <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0" title="Klik untuk filter berdasarkan status">
                    <Filter className="size-3" />
                    Status
                </div>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter status">
                    {STATUSES.map(s => {
                        const on = value.status?.includes(s);
                        const meta = getStatusMeta(s);
                        return (
                            <button key={s} onClick={() => toggle('status', s)} title={`Filter status ${meta.label}`}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all duration-200 uppercase tracking-wide ${on ? 'shadow-sm ring-1' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'}`}
                                style={on ? { backgroundColor: meta.hex, color: '#fff', borderColor: meta.hex } : {}}
                            >
                                {s.replace('_',' ')}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-start gap-4 flex-col sm:flex-row sm:items-center border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0" title="Klik untuk filter berdasarkan kategori">
                    <Filter className="size-3" />
                    Kategori
                </div>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter kategori">
                    {CATS.map(c => {
                        const on = value.category?.includes(c);
                        return (
                            <button key={c} onClick={() => toggle('category', c)} title={`Filter kategori ${c}`}
                                className={`text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all duration-200 uppercase tracking-wide ${on ? 'bg-primary text-white border-primary dark:bg-primary dark:text-white dark:border-primary shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'}`}>
                                {c}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
