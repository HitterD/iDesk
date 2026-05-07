import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StatusBadge } from '../common/StatusBadge';
import { getStatusMeta, STATUS_META } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { REQUEST_PIPELINE, type HardwareRequest, type RequestStatus } from '../../types';

function MiniPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const idx = REQUEST_PIPELINE.indexOf(current);
    const isAwaitingConfirm = current === 'AWAITING_USER_CONFIRMATION';

    return (
        <div className="flex flex-col gap-1.5 mt-4">
            <div className="flex items-center gap-1 w-full">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && i < idx;
                    const pending = !terminalBad && i === idx && isAwaitingConfirm;
                    const active = !terminalBad && i === idx && !isAwaitingConfirm;
                    const meta = STATUS_META[step];

                    if (pending) {
                        return (
                            <div
                                key={step}
                                className="h-[3px] flex-1 rounded-full animate-pulse"
                                style={{ backgroundColor: meta.hex, opacity: 0.7 }}
                            />
                        );
                    }
                    return (
                        <div
                            key={step}
                            className={`h-[3px] flex-1 rounded-full ${done || active ? '' : 'bg-slate-100 dark:bg-slate-800'}`}
                            style={{
                                backgroundColor: (done || active) ? meta.hex : undefined,
                            }}
                        />
                    );
                })}
            </div>
            <div className="flex justify-end">
                <span className="text-[10px] font-bold" style={{ color: STATUS_META[current]?.hex || '#64748b' }}>
                    {STATUS_META[current]?.label || current}
                </span>
            </div>
        </div>
    );
}

export function RequestCard({ r }: { r: HardwareRequest }) {
    const basePath = useHardwareBasePath();
    const meta = getStatusMeta(r.status);
    const [hovered, setHovered] = useState(false);

    const itemCount = r.items?.length ?? 0;
    const mainItem = r.items?.[0];
    const itemName = mainItem ? (mainItem.categorySnapshot?.name ?? mainItem.name ?? 'Item') : 'No items';
    
    // Calculate total actual cost if any
    let totalCost = 0;
    r.items?.forEach(i => {
        if (i.actualCost) totalCost += i.actualCost * (i.quantity || 1);
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="relative flex flex-col rounded-2xl bg-white dark:bg-[hsl(var(--card))] border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300"
            style={{
                boxShadow: hovered
                    ? `0 12px 32px -8px ${meta.hex}25, 0 4px 8px -2px rgba(0,0,0,0.08)`
                    : '0 1px 3px rgba(0,0,0,0.04)',
            }}
        >
            {/* Left accent stripe */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300"
                style={{
                    background: hovered
                        ? `linear-gradient(to bottom, ${meta.hex}, ${meta.hex}60)`
                        : meta.hex,
                    opacity: hovered ? 1 : 0.7,
                }}
            />

            <Link to={`${basePath}/${r.id}`} className="flex flex-col flex-1 pl-5 pr-4 py-4 hover:opacity-100 transition-opacity group">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                        {r.requestNumber}
                    </span>
                    <StatusBadge status={r.status} />
                </div>

                {/* Title (Item Name or X items) */}
                <div className="mt-3 text-[15px] font-bold text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug">
                    {itemCount > 1 ? `${itemCount} items` : itemName}
                </div>
                
                {/* Cost or alternative info */}
                <div className="mt-2 flex flex-col gap-1.5 min-h-[36px]">
                    {r.items?.slice(0, 2).map(item => (
                        <div key={item.id} className="text-[12px] font-medium text-slate-700 dark:text-slate-300 line-clamp-1 flex items-center justify-between">
                            <span className="truncate">{item.categorySnapshot?.name ?? item.name ?? 'Item'}</span>
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-2 shrink-0">×{item.quantity}</span>
                        </div>
                    ))}
                    {(r.items?.length ?? 0) > 2 && (
                        <div className="text-[10px] text-slate-400 font-medium">
                            + {r.items!.length - 2} item lainnya
                        </div>
                    )}
                </div>

                {/* Subtitle / Requester */}
                <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                            {r.requester?.fullName ?? '—'}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium line-clamp-1">
                            {r.site?.name ?? '—'}
                        </span>
                    </div>
                    {r.justification?.toLowerCase().includes('urgent') && (
                        <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            Urgent
                        </span>
                    )}
                </div>

                {/* Spacer to push pipeline to bottom if card height varies */}
                <div className="flex-1" />

                <MiniPipeline current={r.status} />
            </Link>

            {/* Hover glow overlay */}
            <motion.div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                animate={{ opacity: hovered ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                style={{
                    background: `radial-gradient(ellipse at top left, ${meta.hex}06 0%, transparent 70%)`,
                }}
            />
        </motion.div>
    );
}
