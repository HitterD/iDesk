import { Link } from 'react-router-dom';
import { Fragment } from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtDate } from '../../utils/format.util';
import { isTerminal } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { ExpandableItemRow } from './ExpandableItemRow';
import type { HardwareRequest } from '../../types';

export function RequestTable({ rows }: { rows: HardwareRequest[] }) {
    const basePath = useHardwareBasePath();
    return (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
                <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        {['Nomor','Requester','Items','Site','Status','Updated',''].map(h => (
                            <th key={h} className="text-left font-semibold px-5 py-3.5">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map(r => (
                        <Fragment key={r.id}>
                            <tr className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
                                <td className="px-5 py-3.5 font-mono text-[12px] text-slate-900 dark:text-slate-200">{r.requestNumber}</td>
                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar name={r.requester?.fullName ?? '—'} src={r.requester?.avatarUrl} />
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{r.requester?.fullName}</span>
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{r.items?.length ?? 0} item</td>
                                <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{r.site?.name ?? '—'}</td>
                                <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                                <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col gap-1 items-start">
                                        <span>{fmtDate(r.updatedAt)}</span>
                                        <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
                                    </div>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                    <Link to={`${basePath}/${r.id}`} className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary transition-all duration-200">
                                        Buka →
                                    </Link>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={7} className="px-5 pb-4">
                                    <ExpandableItemRow items={(r.items ?? []).map(i => ({
                                        id: i.id,
                                        name: i.categorySnapshot?.name ?? i.name ?? '—',
                                        qty: i.quantity,
                                    }))} />
                                </td>
                            </tr>
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
    if (src) return <img src={src} alt="" className="size-7 rounded-full object-cover ring-2 ring-white dark:ring-slate-800" />;
    const initials = name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
    return <span className="size-7 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold grid place-items-center text-slate-600 dark:text-slate-400 ring-2 ring-white dark:ring-[hsl(var(--card))]">{initials}</span>;
}
