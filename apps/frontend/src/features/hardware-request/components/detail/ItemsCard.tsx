import { SectionCard } from '../common/SectionCard';
import { fmtIDR, fmtDate } from '../../utils/format.util';
import type { HardwareRequest } from '../../types';

export function ItemsCard({ r, children }: { r: HardwareRequest; children?: React.ReactNode }) {
    return (
        <SectionCard title="Item Terpilih">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.items.map(it => {
                    const snap = it.categorySnapshot;
                    const recipientName = typeof snap.customFields === 'object' && snap.customFields !== null
                        && 'recipientName' in snap.customFields
                        ? String(snap.customFields.recipientName)
                        : null;
                    const assets = (r.assets ?? []).filter(a => a.itemId === it.id);
                    return (
                        <li key={it.id} className="py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between group">
                            <div className="space-y-1.5">
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-200">{String(snap.name ?? '—')}</div>
                                <div className="text-xs text-slate-400 dark:text-slate-600 font-mono tracking-tight">{String(snap.code ?? '')}</div>
                                {recipientName && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        👤 <span className="font-medium">{recipientName}</span>
                                    </div>
                                )}
                                {assets.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {assets.map(a => (
                                            <span key={a.id} className="text-xs font-black font-mono rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 shadow-sm">
                                                {a.barcode}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-black text-slate-900 dark:text-white">× {it.quantity}</div>
                                {it.actualCost != null && <div className="text-xs font-bold text-slate-500 dark:text-slate-500 mt-1 uppercase tracking-wider">{fmtIDR(it.actualCost)}/unit</div>}
                                {it.vendor && <div className="text-xs font-bold text-slate-400 dark:text-slate-600 mt-0.5">{it.vendor}</div>}
                                {it.invoiceNumber && <div className="text-xs font-bold text-slate-400 dark:text-slate-600">Inv {it.invoiceNumber} · {fmtDate(it.invoiceDate)}</div>}
                            </div>
                        </li>
                    );
                })}
            </ul>
            {children}
        </SectionCard>
    );
}
