import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    ExternalLink, Info, MessageSquare, Activity,
    User, MapPin, Calendar, Layers, ChevronRight, AlertCircle,
} from 'lucide-react';
import { StatusPipeline } from '../common/StatusPipeline';
import { CommentThread } from '../detail/CommentThread';
import { ActivityTimeline } from '../detail/ActivityTimeline';
import { fmtDateTime } from '../../utils/format.util';
import { getStatusMeta } from '../../utils/status.util';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import { useHardwareRole } from '../../hooks/usePermissions';
import type { HardwareRequest } from '../../types';

type DrawerTab = 'detail' | 'comments' | 'activity';

const TABS: { id: DrawerTab; label: string; icon: React.ElementType }[] = [
    { id: 'detail',   label: 'Detail',     icon: Info },
    { id: 'comments', label: 'Komentar',   icon: MessageSquare },
    { id: 'activity', label: 'Aktivitas',  icon: Activity },
];

interface Props {
    r: HardwareRequest;
    colSpan: number;
}

export function RequestRowDrawer({ r, colSpan }: Props) {
    const [tab, setTab] = useState<DrawerTab>('detail');
    const basePath = useHardwareBasePath();
    const meta = getStatusMeta(r.status);
    const { userId } = useHardwareRole();
    const needsConfirmation = r.status === 'AWAITING_USER_CONFIRMATION' && r.requesterId === userId;

    return (
        <tr>
            <td colSpan={colSpan} className="p-0 border-b border-slate-200 dark:border-slate-700/80">
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 35, opacity: { duration: 0.15 } }}
                    className="overflow-hidden"
                >
                    {/* Drawer Container */}
                    <div
                        className="mx-4 mb-4 mt-1 rounded-2xl border overflow-hidden"
                        style={{
                            borderColor: `${meta.hex}30`,
                            background: 'hsl(var(--card))',
                            boxShadow: `0 0 0 1px ${meta.hex}18, 0 8px 24px -8px ${meta.hex}20`,
                        }}
                    >
                        {/* Top accent bar */}
                        <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${meta.hex}, ${meta.hex}40)` }} />

                        {needsConfirmation && (
                            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-cyan-50 dark:bg-cyan-900/20 border-b border-cyan-200 dark:border-cyan-800">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" aria-hidden="true" />
                                    <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300">
                                        Konfirmasi instalasi diperlukan
                                    </span>
                                </div>
                                <Link
                                    to={`${basePath}/${r.id}`}
                                    className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:underline underline-offset-2 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Buka detail →
                                </Link>
                            </div>
                        )}

                        {/* Pipeline strip */}
                        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <StatusPipeline current={r.status} />
                        </div>

                        {/* Tab bar */}
                        <div className="flex items-center gap-0 px-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40">
                            {TABS.map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setTab(id)}
                                    className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold transition-colors duration-150
                                        ${tab === id
                                            ? 'text-slate-900 dark:text-white'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                >
                                    <Icon className="size-3.5" />
                                    {label}
                                    {tab === id && (
                                        <motion.div
                                            layoutId={`drawer-tab-${r.id}`}
                                            className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                                            style={{ background: meta.hex }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                                        />
                                    )}
                                </button>
                            ))}

                            {/* Full detail link — pushed right */}
                            <Link
                                to={`${basePath}/${r.id}`}
                                className="ml-auto flex items-center gap-1.5 text-[11px] font-bold bg-primary text-white hover:bg-primary/90 shadow-sm hover:shadow-md transition-all px-3.5 py-1.5 rounded-lg"
                            >
                                Buka Full Detail
                                <ExternalLink className="size-3" />
                            </Link>
                        </div>

                        {/* Tab content */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={tab}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.15 }}
                                className="p-4"
                            >
                                {tab === 'detail' && <DrawerDetail r={r} />}
                                {tab === 'comments' && (
                                    <div className="max-h-72 overflow-y-auto">
                                        <CommentThread requestId={r.id} canComment={true} />
                                    </div>
                                )}
                                {tab === 'activity' && (
                                    <div className="max-h-72 overflow-y-auto">
                                        <ActivityTimeline requestId={r.id} />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </td>
        </tr>
    );
}

function DrawerDetail({ r }: { r: HardwareRequest }) {
    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Requester */}
            <InfoBlock icon={User} label="Requester">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.requester?.fullName ?? '—'}</span>
            </InfoBlock>

            {/* Site */}
            <InfoBlock icon={MapPin} label="Site / Lokasi">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.site?.name ?? '—'}</span>
                {r.recipient?.fullName && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Penerima: {r.recipient.fullName}</span>
                )}
            </InfoBlock>

            {/* Diajukan */}
            <InfoBlock icon={Calendar} label="Diajukan">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                    {r.submittedAt ? fmtDateTime(r.submittedAt) : '—'}
                </span>
            </InfoBlock>

            {/* Items */}
            <InfoBlock icon={Layers} label={`${r.items?.length ?? 0} Item`}>
                <div className="flex flex-col gap-0.5">
                    {(r.items ?? []).slice(0, 3).map((item) => (
                        <span key={item.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <ChevronRight className="size-3 text-slate-400 shrink-0" />
                            {item.categorySnapshot?.name ?? item.name ?? '—'}
                            <span className="text-slate-400">×{item.quantity}</span>
                        </span>
                    ))}
                    {(r.items?.length ?? 0) > 3 && (
                        <span className="text-[11px] text-slate-400 ml-4">+{r.items.length - 3} lagi</span>
                    )}
                </div>
            </InfoBlock>

            {/* Justifikasi — full width */}
            {r.justification && (
                <div className="sm:col-span-2 lg:col-span-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                        Justifikasi
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                        "{r.justification}"
                    </p>
                </div>
            )}
        </div>
    );
}

function InfoBlock({
    icon: Icon,
    label,
    children,
}: {
    icon: React.ElementType;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                <Icon className="size-3" />
                {label}
            </div>
            <div className="flex flex-col gap-0.5">{children}</div>
        </div>
    );
}
