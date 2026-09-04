import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, MapPin, Layers } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { AgingBadge } from '../common/AgingBadge';
import { fmtDate } from '../../utils/format.util';
import { isTerminal, getStatusMeta } from '../../utils/status.util';
import { RequestRowDrawer } from './RequestRowDrawer';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { HardwareRequest } from '../../types';
import { cn } from '@/lib/utils';

const COL_SPAN = 7;

export function RequestTable({ rows }: { rows: HardwareRequest[] }) {
    const [openId, setOpenId] = useState<string | null>(null);

    return (
        <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-border">
                        <th className="pl-5 pr-4 py-3">Nomor</th>
                        <th className="px-4 py-3">Requester</th>
                        <th className="px-4 py-3">Items</th>
                        <th className="px-4 py-3">Site</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Updated</th>
                        <th className="pr-5 pl-4 py-3 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                    {rows.map((r, idx) => {
                        const isOpen = openId === r.id;
                        const meta = getStatusMeta(r.status);
                        const firstItemName = r.items?.[0]?.categorySnapshot?.name ?? r.items?.[0]?.name;

                        return (
                            <Fragment key={r.id}>
                                <motion.tr
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2, delay: idx * 0.02, ease: [0.23, 1, 0.32, 1] }}
                                    onClick={() => setOpenId(isOpen ? null : r.id)}
                                    className={cn(
                                        'group cursor-pointer transition-colors duration-150',
                                        isOpen
                                            ? 'bg-primary/5 dark:bg-slate-800/60'
                                            : idx % 2 === 0
                                            ? 'bg-white dark:bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                            : 'bg-slate-50/40 dark:bg-slate-900/30 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                    )}
                                    style={{
                                        borderLeft: isOpen ? `3px solid ${meta.hex}` : '3px solid transparent',
                                    }}
                                >
                                    {/* Nomor */}
                                    <td className="pl-5 pr-4 py-3.5 whitespace-nowrap">
                                        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-muted/60 dark:bg-slate-800 px-2 py-1 rounded-md group-hover:text-primary transition-colors">
                                            {r.requestNumber}
                                        </span>
                                    </td>

                                    {/* Requester */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5 min-w-[140px]">
                                            <UserAvatar user={r.requester} size="xs" />
                                            <span className="font-semibold text-foreground text-xs sm:text-[13px] truncate">
                                                {r.requester?.fullName ?? '—'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Items */}
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                                                <Layers className="size-3 text-slate-400" />
                                                {r.items?.length ?? 0} item
                                            </span>
                                            {firstItemName && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:inline" title={firstItemName}>
                                                    {firstItemName}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Site */}
                                    <td className="px-4 py-3.5 text-xs sm:text-[13px] text-muted-foreground whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1">
                                            <MapPin className="size-3 text-slate-400 shrink-0" />
                                            {r.site?.name ?? '—'}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <StatusBadge status={r.status} />
                                    </td>

                                    {/* Updated */}
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-xs text-muted-foreground">{fmtDate(r.updatedAt)}</span>
                                            <AgingBadge updatedAt={r.updatedAt} terminal={isTerminal(r.status)} />
                                        </div>
                                    </td>

                                    {/* Expand toggle */}
                                    <td className="pr-5 pl-4 py-3.5 text-right whitespace-nowrap">
                                        <motion.span
                                            animate={{ rotate: isOpen ? 90 : 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="inline-flex items-center justify-center size-7 rounded-lg text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors"
                                        >
                                            <ChevronRight className="size-4" />
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
