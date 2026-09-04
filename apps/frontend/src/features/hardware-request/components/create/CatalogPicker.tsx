import { useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useCatalog } from '../../hooks/useCatalog';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';
import { cn } from '@/lib/utils';

const CATS: ItemCategory[] = ['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER'];

const CAT_ICON: Record<ItemCategory, string> = {
    LAPTOP: '💻',
    DESKTOP: '🖥',
    MONITOR: '🖵',
    ACCESSORY: '🎧',
    NETWORK: '🌐',
    SOFTWARE: '📦',
    OTHER: '📋',
};

export function CatalogPicker({ onAdd }: { onAdd: (c: HardwareCatalog) => void }) {
    const [cat, setCat] = useState<ItemCategory | 'ALL'>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const { data } = useCatalog({ active: true });
    const { watch } = useFormContext<CreateFormValues>();
    const items = watch('items') || [];

    const rows = useMemo(() => {
        return (data ?? []).filter((c) => {
            const matchesCat = cat === 'ALL' || c.category === cat;
            const matchesSearch =
                !searchQuery ||
                `${c.name} ${c.code} ${c.category}`.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [data, cat, searchQuery]);

    const getItemCountInBasket = (catalogId: string) => {
        const item = items.find((it) => it.catalogId === catalogId);
        return item ? item.quantity : 0;
    };

    return (
        <SectionCard
            title="Katalog Perangkat Hardware"
            action={
                <div className="flex flex-wrap gap-1">
                    {['ALL', ...CATS].map((c) => {
                        const isSelected = cat === c;
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCat(c as any)}
                                className={cn(
                                    'text-xs font-semibold px-3 py-1 rounded-full border transition-all duration-150 cursor-pointer shadow-2xs',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                                        : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                )}
                            >
                                {c === 'ALL' ? 'Semua' : `${CAT_ICON[c as ItemCategory] ?? ''} ${c}`}
                            </button>
                        );
                    })}
                </div>
            }
        >
            <div className="space-y-3">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Cari nama barang atau kode katalog (misal: Laptop, Monitor, Keyboard)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-2xs"
                    />
                </div>

                {/* Catalog Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-0.5">
                    {rows.map((c) => {
                        const countInBasket = getItemCountInBasket(c.id);
                        return (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => onAdd(c)}
                                className={cn(
                                    'group relative overflow-hidden text-left rounded-2xl p-3.5 sm:p-4 border transition-all duration-150 hover:shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-col justify-between min-h-[100px]',
                                    countInBasket > 0
                                        ? 'bg-primary/5 border-primary/50 shadow-2xs'
                                        : 'bg-card border-border hover:border-primary/50'
                                )}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                                            <span>{CAT_ICON[c.category] ?? ''}</span>
                                            <span>{c.category}</span>
                                        </span>
                                        {countInBasket > 0 && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black">
                                                <Check className="size-2.5" />
                                                <span>{countInBasket}x</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                        {c.name}
                                    </div>
                                    <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                                        {c.code}
                                    </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-primary">
                                        + Tambah ke Keranjang
                                    </span>
                                    <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-2xs">
                                        <Plus className="size-3.5" />
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {!rows.length && (
                        <div className="text-xs text-muted-foreground col-span-full py-10 text-center bg-muted/20 rounded-2xl border border-dashed border-border p-4">
                            Tidak ada item katalog yang sesuai dengan pencarian atau filter kategori.
                        </div>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}
