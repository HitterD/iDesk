import { useFormContext } from 'react-hook-form';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { CreateFormValues } from './CreateWizard';
import type { HardwareCatalog } from '../../types';

export function ItemBasket({ catalog }: { catalog: HardwareCatalog[] }) {
    const { watch, setValue } = useFormContext<CreateFormValues>();
    const items = watch('items') ?? [];

    const find = (id: string) => catalog.find(c => c.id === id);
    const setQty = (i: number, q: number) => {
        const copy = [...items]; copy[i] = { ...copy[i], quantity: Math.max(1, q) };
        setValue('items', copy, { shouldValidate: true });
    };
    const remove = (i: number) => setValue('items', items.filter((_, idx) => idx !== i), { shouldValidate: true });

    if (!items.length) return (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-8 text-center transition-all duration-300">
            <div className="text-3xl mb-2 opacity-20">🛒</div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-500">Keranjang masih kosong</p>
            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Pilih item dari katalog untuk memulai</p>
        </div>
    );

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {items.map((it, i) => {
                const cat = find(it.catalogId);
                return (
                    <div key={i} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors duration-200">
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">{cat?.name ?? '—'}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-600 font-mono tracking-tight">{cat?.code}</div>
                            
                            <div className="mt-3 space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Penerima (Opsional)</label>
                                <input
                                    type="text"
                                    placeholder="Nama penerima spesifik untuk item ini..."
                                    value={it.recipientName || ''}
                                    onChange={(e) => {
                                        const copy = [...items];
                                        copy[i] = { ...copy[i], recipientName: e.target.value };
                                        setValue('items', copy);
                                    }}
                                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-1 focus:ring-slate-900 dark:focus:ring-white outline-none"
                                />
                            </div>

                            {cat?.requiredFields && <DynamicFields index={i} schema={cat.requiredFields} />}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-0.5">
                                <button type="button" onClick={() => setQty(i, it.quantity - 1)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><Minus className="size-3" /></button>
                                <input type="number" value={it.quantity} min={1}
                                    onChange={(e) => setQty(i, Number(e.target.value) || 1)}
                                    className="w-8 text-center text-xs font-bold bg-transparent dark:text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                <button type="button" onClick={() => setQty(i, it.quantity + 1)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"><Plus className="size-3" /></button>
                            </div>
                            <button type="button" onClick={() => remove(i)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-all duration-200">
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DynamicFields({ index, schema }: { index: number; schema: Record<string, { type: 'string'|'number'|'select'; label: string; options?: string[] }> }) {
    const { register } = useFormContext<CreateFormValues>();
    return (
        <div className="mt-3 grid grid-cols-1 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50">
            {Object.entries(schema).map(([key, field]) => (
                <div key={key} className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{field.label}</label>
                    {field.type === 'select' ? (
                        <select 
                            {...register(`items.${index}.specs.${key}` as any)} 
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="">Pilih {field.label}...</option>
                            {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : (
                        <input 
                            type={field.type === 'number' ? 'number' : 'text'}
                            {...register(`items.${index}.specs.${key}` as any)}
                            placeholder={`Isi ${field.label}...`}
                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary outline-none" 
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
