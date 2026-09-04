import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronRight, Layers, MapPin } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { getStatusMeta, STATUS_META } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { useHardwareRole } from '../../hooks/usePermissions';
import { REQUEST_PIPELINE, type HardwareRequest, type RequestStatus } from '../../types';
import { UserAvatar } from '@/components/ui/UserAvatar';

function MiniPipeline({ current }: { current: RequestStatus }) {
    const terminalBad = current === 'REJECTED' || current === 'CANCELLED';
    const isCompleted = current === 'COMPLETED';
    const idx = REQUEST_PIPELINE.indexOf(current);
    const isAwaitingConfirm = current === 'AWAITING_USER_CONFIRMATION';

    return (
        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center gap-1 w-full">
                {REQUEST_PIPELINE.map((step, i) => {
                    const done = !terminalBad && (isCompleted ? i <= idx : i < idx);
                    const pending = !terminalBad && i === idx && isAwaitingConfirm;
                    const active = !terminalBad && i === idx && !isAwaitingConfirm;
                    const meta = STATUS_META[step];

                    if (pending) {
                        return (
                            <div
                                key={step}
                                className="h-[3px] flex-1 rounded-full animate-pulse"
                                style={{ backgroundColor: meta.hex, opacity: 0.8 }}
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
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Progress</span>
                <span className="text-[11px] font-bold" style={{ color: STATUS_META[current]?.hex || '#64748b' }}>
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
    const { userId } = useHardwareRole();
    const needsConfirmation = r.status === 'AWAITING_USER_CONFIRMATION' && r.requesterId === userId;

    const itemCount = r.items?.length ?? 0;
    const mainItem = r.items?.[0];
    const itemName = mainItem ? (mainItem.categorySnapshot?.name ?? mainItem.name ?? 'Item') : 'No items';

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="relative flex flex-col rounded-2xl bg-card border border-border overflow-hidden transition-all duration-200 hover:border-primary/40 shadow-xs"
            style={{
                boxShadow: hovered
                    ? `0 10px 24px -6px ${meta.hex}20, 0 4px 8px -2px rgba(0,0,0,0.05)`
                    : undefined,
            }}
        >
            {/* Left accent stripe */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200"
                style={{
                    background: hovered
                        ? `linear-gradient(to bottom, ${meta.hex}, ${meta.hex}60)`
                        : meta.hex,
                    opacity: hovered ? 1 : 0.8,
                }}
            />

            <Link to={`${basePath}/${r.id}`} className="flex flex-col flex-1 pl-5 pr-4 py-4 hover:opacity-100 transition-opacity group">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors bg-muted/60 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {r.requestNumber}
                    </span>
                    <StatusBadge status={r.status} />
                </div>

                {/* Title (Item Name or X items) */}
                <div className="mt-3 text-sm sm:text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-snug">
                    {itemCount > 1 ? `${itemCount} items` : itemName}
                </div>

                {/* Items preview */}
                <div className="mt-2 flex flex-col gap-1 min-h-[32px]">
                    {r.items?.slice(0, 2).map((item) => (
                        <div key={item.id} className="text-xs font-medium text-muted-foreground line-clamp-1 flex items-center justify-between">
                            <span className="truncate flex items-center gap-1">
                                <Layers className="size-3 text-slate-400 shrink-0" />
                                {item.categorySnapshot?.name ?? item.name ?? 'Item'}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] ml-2 shrink-0">×{item.quantity}</span>
                        </div>
                    ))}
                    {(r.items?.length ?? 0) > 2 && (
                        <div className="text-[11px] text-muted-foreground font-medium pl-4">
                            + {r.items!.length - 2} item lainnya
                        </div>
                    )}
                </div>

                {/* Requester & Site */}
                <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar user={r.requester} size="xs" />
                        <span className="text-xs font-bold text-foreground truncate">
                            {r.requester?.fullName ?? '—'}
                        </span>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <MapPin className="size-3 text-slate-400" />
                        {r.site?.name ?? '—'}
                    </span>
                </div>

                {/* Spacer to push pipeline to bottom */}
                <div className="flex-1" />

                {needsConfirmation && (
                    <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                        <AlertCircle className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                            Konfirmasi instalasi diperlukan
                        </span>
                    </div>
                )}

                <MiniPipeline current={r.status} />
            </Link>
        </motion.div>
    );
}
