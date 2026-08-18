import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtDate } from '../../utils/format.util';
import { isTerminal, getStatusMeta } from '../../utils/status.util';
import { RequestRowDrawer } from './RequestRowDrawer';
import type { HardwareRequest } from '../../types';

const COL_SPAN = 7;

export function RequestTable({ rows }: { rows: HardwareRequest[] }) {
    const [openId, setOpenId] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700/80">
                        {['Nomor', 'Requester', 'Items', 'Site', 'Status', 'Updated', ''].map((h) => (
                            <th
                                key={h}
                                className="text-left font-bold text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 px-4 py-3 first:pl-5"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, idx) => {
                        const isOpen = openId === r.id;
                        const meta = getStatusMeta(r.status);
                        return (
                            <Fragment key={r.id}>
                                <motion.tr
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.25, delay: idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
                                    onClick={() => setOpenId(isOpen ? null : r.id)}
                                    className={`group cursor-pointer transition-colors duration-150 border-b
                                        ${isOpen
                                            ? 'bg-slate-50 dark:bg-slate-800/60 border-transparent'
                                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/60'
                                        }`}
                                    style={{
                                        borderLeft: isOpen ? `3px solid ${meta.hex}` : '3px solid transparent',
                                    }}
                                >
                                    {/* Nomor */}
                                    <td className="pl-5 pr-4 py-3.5">
                                        <span className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">
                                            {r.requestNumber}
                                        </span>
                                    </td>

                                    {/* Requester */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={r.requester?.fullName ?? '—'} src={r.requester?.avatarUrl} />
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-[13px]">
                                                    {r.requester?.fullName ?? '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Items */}
                                    <td className="px-4 py-3.5">
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                            {r.items?.length ?? 0} item
                                        </span>
                                    </td>

                                    {/* Site */}
                                    <td className="px-4 py-3.5 text-[13px] text-slate-600 dark:text-slate-400">
                                        {r.site?.name ?? '—'}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3.5">
                                        <StatusBadge status={r.status} />
                                    </td>

                                    {/* Updated */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[12px] text-slate-500 dark:text-slate-400">{fmtDate(r.updatedAt)}</span>
                                            <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
                                        </div>
                                    </td>

                                    {/* Expand toggle */}
                                    <td className="px-4 py-3.5 text-right">
                                        <motion.span
                                            animate={{ rotate: isOpen ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="inline-flex items-center justify-center size-6 rounded-lg text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"
                                        >
                                            <svg viewBox="0 0 16 16" fill="none" className="size-4" stroke="currentColor" strokeWidth={2}>
                                                <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </motion.span>
                                    </td>
                                </motion.tr>

                                {/* Inline Drawer */}
                                <AnimatePresence>
                                    {isOpen && (
                                        <RequestRowDrawer r={r} colSpan={COL_SPAN} />
                                    )}
                                </AnimatePresence>
                            </Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
    if (src) {
        return (
            <img
                src={src}
                alt=""
                className="size-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 shrink-0"
            />
        );
    }
    const initials = name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (
        <span className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold grid place-items-center text-slate-600 dark:text-slate-400 ring-2 ring-white dark:ring-[hsl(var(--card))] shrink-0">
            {initials}
        </span>
    );
}
