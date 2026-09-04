import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
    Plus,
    Minus,
    Trash2,
    Building2,
    Users,
    FileText,
    Coins,
    ShoppingBag,
    Layers,
    X,
    Check,
} from 'lucide-react';
import { useCatalog } from '../../hooks/useCatalog';
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';
import type { HardwareCatalog } from '../../types';
import { cn } from '@/lib/utils';

export function ReviewStep() {
    const { watch, setValue } = useFormContext<CreateFormValues>();
    const { data: catalog = [] } = useCatalog({ active: true });
    const v = watch();
    const items = v.items || [];

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [modalSearch, setModalSearch] = useState('');

    const find = (id: string) => catalog.find((x) => x.id === id);

    const setQty = (i: number, q: number) => {
        const copy = [...items];
        copy[i] = { ...copy[i], quantity: Math.max(1, Math.min(50, q)) };
        setValue('items', copy, { shouldValidate: true });
    };

    const remove = (i: number) => {
        setValue(
            'items',
            items.filter((_, idx) => idx !== i),
            { shouldValidate: true },
        );
    };

    const addItemFromModal = (cat: HardwareCatalog) => {
        const existingIndex = items.findIndex((it) => it.catalogId === cat.id);
        if (existingIndex >= 0) {
            setQty(existingIndex, items[existingIndex].quantity + 1);
        } else {
            const next = [
                ...items,
                {
                    catalogId: cat.id,
                    quantity: 1,
                    recipientName: v.recipientNames?.[0] || v.recipientName || '',
                },
            ];
            setValue('items', next, { shouldValidate: true });
        }
    };

    const totalUnits = items.reduce((acc, curr) => acc + curr.quantity, 0);

    const filteredCatalog = catalog.filter((c) =>
        `${c.name} ${c.code} ${c.category}`.toLowerCase().includes(modalSearch.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left Column: Request Information Review */}
                <div className="lg:col-span-5 space-y-5">
                    <SectionCard title="Ringkasan Pengajuan">
                        <div className="space-y-4">
                            {/* Tipe Budget */}
                            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-start gap-3">
                                <Coins className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                        Kategori Anggaran
                                    </span>
                                    <span className="text-xs font-bold text-foreground">
                                        {v.requestType === 'NON_BUDGET'
                                            ? 'Pengajuan Budget Tambahan / Non-Tahunan'
                                            : 'Realisasi Budget Tahunan ICT'}
                                    </span>
                                </div>
                            </div>

                            {/* Divisi */}
                            <div className="flex items-start gap-3">
                                <Building2 className="size-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                        Divisi / Departemen
                                    </span>
                                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                                        {typeof v.division === 'object' && v.division !== null
                                            ? (v.division as any).name || (v.division as any).code || '—'
                                            : v.division || '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Penerima */}
                            <div className="flex items-start gap-3">
                                <Users className="size-4 text-primary shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                        Penerima Barang
                                    </span>
                                    {v.recipientNames && v.recipientNames.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {v.recipientNames.map((name) => (
                                                <span
                                                    key={name}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold"
                                                >
                                                    {name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs sm:text-sm font-semibold text-foreground">
                                            {v.recipientName || 'Saya Sendiri'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Justifikasi */}
                            <div className="flex items-start gap-3">
                                <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                                        Justifikasi & Alasan Kebutuhan
                                    </span>
                                    <div className="text-xs text-foreground leading-relaxed bg-muted/20 p-3 rounded-xl border border-border/60 italic whitespace-pre-wrap">
                                        "{v.justification}"
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Interactive Item List */}
                <div className="lg:col-span-7 space-y-4">
                    <SectionCard
                        title="Daftar Item yang Diajukan"
                        action={
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            >
                                <Plus className="size-3.5" />
                                <span>Tambah Barang</span>
                            </button>
                        }
                    >
                        {!items.length ? (
                            <div className="py-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border p-4">
                                <ShoppingBag className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                <p className="text-xs text-muted-foreground">Belum ada item dalam daftar.</p>
                                <button
                                    type="button"
                                    onClick={() => setAddModalOpen(true)}
                                    className="mt-3 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl cursor-pointer"
                                >
                                    + Pilih Item dari Katalog
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="divide-y divide-border/60 border border-border rounded-2xl overflow-hidden bg-card shadow-2xs">
                                    {items.map((it, i) => {
                                        const c = find(it.catalogId);
                                        return (
                                            <div
                                                key={i}
                                                className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                                                        {c?.name ?? 'Item Hardware'}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground font-mono">
                                                        {c?.code}
                                                    </div>
                                                    {it.recipientName && (
                                                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                                            <Users className="size-3 text-primary" />
                                                            <span>Penerima: {it.recipientName}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Stepper + Remove */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <div className="inline-flex items-center rounded-xl border border-border bg-muted/40 p-0.5 shadow-2xs">
                                                        <button
                                                            type="button"
                                                            onClick={() => setQty(i, it.quantity - 1)}
                                                            className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                                                            aria-label="Kurangi"
                                                        >
                                                            <Minus className="size-3" />
                                                        </button>
                                                        <span className="w-7 text-center text-xs font-bold text-foreground tabular-nums">
                                                            {it.quantity}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setQty(i, it.quantity + 1)}
                                                            className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                                                            aria-label="Tambah"
                                                        >
                                                            <Plus className="size-3" />
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => remove(i)}
                                                        className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                                        aria-label="Hapus item"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="p-3 rounded-xl bg-muted/20 border border-border flex items-center justify-between text-xs">
                                    <span className="font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Layers className="size-3.5 text-primary" />
                                        <span>Total Unit Perangkat</span>
                                    </span>
                                    <span className="text-sm font-extrabold text-foreground tabular-nums">
                                        {totalUnits} unit
                                    </span>
                                </div>
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>

            {/* Quick Add Catalog Modal */}
            {addModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
                        onClick={() => setAddModalOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-10 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                                <Plus className="size-4 text-primary" />
                                <span>Tambah Item dari Katalog</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="Cari item katalog..."
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            className="w-full px-3.5 py-2 text-xs rounded-xl border border-border bg-muted/20 text-foreground outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                        />

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                            {filteredCatalog.map((cat) => {
                                const inBasket = items.find((it) => it.catalogId === cat.id);
                                return (
                                    <div
                                        key={cat.id}
                                        onClick={() => addItemFromModal(cat)}
                                        className="p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-between cursor-pointer"
                                    >
                                        <div>
                                            <div className="text-xs font-bold text-foreground">{cat.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono">
                                                {cat.code} · {cat.category}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {inBasket && (
                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Check className="size-2.5" />
                                                    {inBasket.quantity}x
                                                </span>
                                            )}
                                            <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-primary-foreground transition-colors">
                                                + Tambah
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-3 border-t border-border flex justify-end">
                            <button
                                type="button"
                                onClick={() => setAddModalOpen(false)}
                                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl cursor-pointer"
                            >
                                Selesai
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
