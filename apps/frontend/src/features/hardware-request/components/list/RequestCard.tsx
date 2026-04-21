import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtRelative } from '../../utils/format.util';
import { isTerminal } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { ExpandableItemRow } from './ExpandableItemRow';
import type { HardwareRequest } from '../../types';

export function RequestCard({ r }: { r: HardwareRequest }) {
    const basePath = useHardwareBasePath();
    return (
        <div className="flex flex-col rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-300 group">
            <Link to={`${basePath}/${r.id}`} className="block flex-1 hover:opacity-90 transition-opacity">
                <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[13px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{r.requestNumber}</span>
                    <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{r.requester?.fullName}</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">{r.items?.length ?? 0} item</span>
                    <span className="mx-2">•</span>
                    {r.site?.name ?? '—'}
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        {fmtRelative(r.updatedAt)}
                    </span>
                    <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
                </div>
            </Link>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/80">
                <ExpandableItemRow items={(r.items ?? []).map(i => ({
                    id: i.id,
                    name: i.categorySnapshot?.name ?? i.name ?? '—',
                    qty: i.quantity,
                }))} />
            </div>
        </div>
    );
}
