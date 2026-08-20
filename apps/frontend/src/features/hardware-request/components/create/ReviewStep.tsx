import { useFormContext } from 'react-hook-form';
import { useCatalog } from '../../hooks/useCatalog';
import { SectionCard } from '../common/SectionCard';
import type { CreateFormValues } from './CreateWizard';

export function ReviewStep() {
    const { watch } = useFormContext<CreateFormValues>();
    const { data: catalog = [] } = useCatalog({ active: true });
    const v = watch();

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <SectionCard title="Ringkasan Permintaan">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-1">
                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Divisi</dt>
                            <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200">{v.division || '—'}</dd>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Penerima</dt>
                            <dd className="text-sm font-semibold text-slate-900 dark:text-slate-200">{v.recipientName || 'Saya Sendiri'}</dd>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <dt className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Justifikasi</dt>
                            <dd className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 italic whitespace-pre-wrap">
                                "{v.justification}"
                            </dd>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div className="space-y-6">
                <SectionCard title="Item Terpilih">
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {v.items.map((it, i) => {
                            const c = catalog.find(x => x.id === it.catalogId);
                            return (
                                <li key={i} className="py-3 flex items-center justify-between group">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">{c?.name ?? '—'}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-600 font-mono tracking-tight">{c?.code}</div>
                                        {it.recipientName && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                👤 <span className="font-medium">{it.recipientName}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4 shrink-0">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                                            ×{it.quantity}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    {v.items.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Item</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                                {v.items.reduce((acc, curr) => acc + curr.quantity, 0)} unit
                            </span>
                        </div>
                    )}
                </SectionCard>
            </div>
        </div>
    );
}
