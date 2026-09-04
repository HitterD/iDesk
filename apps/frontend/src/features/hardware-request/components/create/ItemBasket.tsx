import { useFormContext } from 'react-hook-form';
import { Trash2, Minus, Plus, ShoppingBag, User, Layers } from 'lucide-react';
import type { CreateFormValues } from './CreateWizard';
import type { HardwareCatalog } from '../../types';
import { cn } from '@/lib/utils';

export function ItemBasket({ catalog }: { catalog: HardwareCatalog[] }) {
    const { watch, setValue } = useFormContext<CreateFormValues>();
    const items = watch('items') || [];
    const recipientNames = watch('recipientNames') || [];

    const find = (id: string) => catalog.find((c) => c.id === id);

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

    const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

    if (!items.length) {
        return (
            <div className="rounded-2xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-all duration-200">
                <div className="size-12 rounded-2xl bg-muted/50 text-muted-foreground flex items-center justify-center mx-auto mb-3">
                    <ShoppingBag className="size-6 opacity-60" />
                </div>
                <p className="text-sm font-bold text-foreground">Keranjang Masih Kosong</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Klik item dari daftar katalog di sebelah kiri untuk memasukkannya ke dalam keranjang.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden flex flex-col">
            {/* Basket Header */}
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Item Terpilih
                    </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                    <Layers className="size-3" />
                    <span>{totalUnits} unit total</span>
                </span>
            </div>

            {/* Basket Items List */}
            <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
                {items.map((it, i) => {
                    const cat = find(it.catalogId);
                    return (
                        <div
                            key={i}
                            className="p-4 flex items-start gap-3.5 hover:bg-muted/20 transition-colors duration-150"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-foreground truncate">
                                    {cat?.name ?? 'Item Hardware'}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                    {cat?.code || cat?.category}
                                </div>

                                {/* Assign to specific recipient if multi-recipient selected in Step 1 */}
                                {recipientNames.length > 1 && (
                                    <div className="mt-2.5 space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                            <User className="size-3 text-primary" />
                                            <span>Penerima Item Ini</span>
                                        </label>
                                        <select
                                            value={it.recipientName || ''}
                                            onChange={(e) => {
                                                const copy = [...items];
                                                copy[i] = { ...copy[i], recipientName: e.target.value };
                                                setValue('items', copy);
                                            }}
                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
                                        >
                                            <option value="">Semua / Bersama</option>
                                            {recipientNames.map((name) => (
                                                <option key={name} value={name}>
                                                    {name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <DynamicFields index={i} schema={cat?.requiredFields} />
                            </div>

                            {/* Quantity Controls & Delete */}
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <div className="inline-flex items-center rounded-xl border border-border bg-muted/40 p-0.5 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setQty(i, it.quantity - 1)}
                                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                        aria-label="Kurangi jumlah"
                                    >
                                        <Minus className="size-3" />
                                    </button>
                                    <span className="w-8 text-center text-xs font-bold text-foreground tabular-nums">
                                        {it.quantity}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQty(i, it.quantity + 1)}
                                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                        aria-label="Tambah jumlah"
                                    >
                                        <Plus className="size-3" />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => remove(i)}
                                    className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus dari keranjang"
                                    aria-label="Hapus item"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

type NormalizedField = {
    key: string;
    label: string;
    type: 'string' | 'text' | 'number' | 'select';
    options?: string[];
    required?: boolean;
};

function DynamicFields({
    index,
    schema,
}: {
    index: number;
    schema?: any;
}) {
    const { register } = useFormContext<CreateFormValues>();

    if (!schema) return null;

    const fields: NormalizedField[] = Array.isArray(schema)
        ? schema
              .filter((f) => f && f.key && f.key !== 'preferredBrand' && f.label)
              .map((f) => ({ ...f, type: f.type || 'text' }))
        : Object.entries(schema)
              .filter(([k, v]) => k && k !== 'preferredBrand' && v && (v as any).label)
              .map(([k, v]) => ({ key: k, ...(v as any), type: (v as any).type || 'text' }));

    if (fields.length === 0) return null;

    return (
        <div className="mt-2.5 grid grid-cols-1 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60">
            {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {field.label}
                    </label>
                    {field.type === 'select' ? (
                        <select
                            {...register(`items.${index}.specs.${field.key}` as any)}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                            <option value="">Pilih {field.label}...</option>
                            {field.options?.map((o) => (
                                <option key={o} value={o}>
                                    {o}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            {...register(`items.${index}.specs.${field.key}` as any)}
                            placeholder={`Isi ${field.label}...`}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground outline-none focus:ring-1 focus:ring-primary"
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
