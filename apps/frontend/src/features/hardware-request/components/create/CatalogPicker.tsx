import { useMemo, useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { SectionCard } from '../common/SectionCard';

const CATS: ItemCategory[] = ['LAPTOP','DESKTOP','MONITOR','ACCESSORY','NETWORK','SOFTWARE','OTHER'];

export function CatalogPicker({ onAdd }: { onAdd: (c: HardwareCatalog) => void }) {
    const [cat, setCat] = useState<ItemCategory | 'ALL'>('ALL');
    const { data } = useCatalog({ active: true });
    const rows = useMemo(() => (data ?? []).filter(c => cat === 'ALL' || c.category === cat), [data, cat]);

    return (
        <SectionCard title="Catalog" action={
            <div className="flex flex-wrap gap-1">
                {['ALL', ...CATS].map(c => (
                    <button 
                        key={c} 
                        type="button"
                        onClick={() => setCat(c as any)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all duration-200
                            ${cat === c 
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                        {c}
                    </button>
                ))}
            </div>
        }>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rows.map(c => (
                    <button 
                        key={c.id} 
                        type="button" 
                        onClick={() => onAdd(c)}
                        className="group relative overflow-hidden text-left rounded-xl p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition-all duration-300"
                    >
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">{c.category}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-200 group-hover:translate-x-0.5 transition-transform">{c.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-600 font-mono italic">{c.code}</div>
                        <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-lg text-primary">+</span>
                        </div>
                    </button>
                ))}
                {!rows.length && <div className="text-xs text-slate-500 dark:text-slate-400 col-span-full py-8 text-center bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">Kategori kosong.</div>}
            </div>
        </SectionCard>
    );
}
