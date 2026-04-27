# Lost Items System — Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild lost-items frontend dengan component-first approach: 5 shared components baru + update 6 file existing untuk fix semua workflow bugs, routing bugs, dan UI/UX gaps.

**Architecture:** 5 shared components (`StatusBadge`, `StatusTimeline`, `PhotoGrid`, `ContextualActions`, `ItemDetailDrawer`) dibangun dulu, lalu 6 file pages/components di-update menggunakannya. Semua page share auth role detection via `useAuth()` dari `@/stores/useAuth`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, framer-motion, @tanstack/react-query, lucide-react, sonner

---

## File Map

### Create
- `apps/frontend/src/features/request-center/components/StatusBadge.tsx`
- `apps/frontend/src/features/request-center/components/StatusTimeline.tsx`
- `apps/frontend/src/features/request-center/components/PhotoGrid.tsx`
- `apps/frontend/src/features/request-center/components/ContextualActions.tsx`
- `apps/frontend/src/features/request-center/components/ItemDetailDrawer.tsx`

### Modify
- `apps/frontend/src/features/request-center/components/LostItemsNav.tsx`
- `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`
- `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`
- `apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx`
- `apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx`
- `apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx`

---

## Task 1: StatusBadge Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/StatusBadge.tsx`

- [ ] **Step 1: Create StatusBadge.tsx**

```tsx
import React from 'react';
import { Clock, Search, UserCheck, CheckCircle2, PackageCheck, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LostItemStatus } from '../api/lost-item.api';
import { FoundClaimStatus } from '../api/found-claim.api';

type AnyStatus = LostItemStatus | FoundClaimStatus | string;

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    REPORTED:    { label: 'Dilaporkan',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       icon: Clock },
    SEARCHING:   { label: 'Dicari',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',           icon: Search },
    CLAIMED:     { label: 'Ada Penemu',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',   icon: UserCheck },
    VERIFIED:    { label: 'Terverifikasi',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    RETURNED:    { label: 'Dikembalikan',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',       icon: PackageCheck },
    CLOSED_LOST: { label: 'Tidak Ditemukan', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',          icon: XCircle },
    PENDING:     { label: 'Pending',         color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       icon: Clock },
    MATCHED:     { label: 'Matched',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    REJECTED:    { label: 'Rejected',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',               icon: XCircle },
};

interface StatusBadgeProps {
    status: AnyStatus;
    showIcon?: boolean;
    className?: string;
}

export const StatusBadge = ({ status, showIcon = true, className }: StatusBadgeProps) => {
    const cfg = STATUS_MAP[status] || STATUS_MAP.REPORTED;
    const Icon = cfg.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider', cfg.color, className)}>
            {showIcon && <Icon className="w-3 h-3" />}
            {cfg.label}
        </span>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/StatusBadge.tsx
git commit -m "feat(lost-item): add StatusBadge shared component"
```

---

## Task 2: StatusTimeline Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/StatusTimeline.tsx`

- [ ] **Step 1: Create StatusTimeline.tsx**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { StatusLog } from '../api/lost-item.api';
import { StatusBadge } from './StatusBadge';

const STATUS_DOT_COLOR: Record<string, string> = {
    REPORTED:    'bg-amber-400',
    SEARCHING:   'bg-blue-400',
    CLAIMED:     'bg-purple-400',
    VERIFIED:    'bg-emerald-400',
    RETURNED:    'bg-green-400',
    CLOSED_LOST: 'bg-slate-400',
};

interface StatusTimelineProps {
    logs: StatusLog[];
    className?: string;
}

export const StatusTimeline = ({ logs, className }: StatusTimelineProps) => {
    if (!logs || logs.length === 0) {
        return (
            <div className={cn('flex flex-col items-center justify-center py-8 text-slate-400', className)}>
                <p className="text-xs font-bold">Belum ada riwayat status</p>
            </div>
        );
    }

    return (
        <div className={cn('space-y-0', className)}>
            {logs.map((log, idx) => (
                <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3"
                >
                    <div className="flex flex-col items-center">
                        <div className={cn('w-2.5 h-2.5 rounded-full mt-1 shrink-0', STATUS_DOT_COLOR[log.toStatus] || 'bg-slate-400')} />
                        {idx < logs.length - 1 && <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700 my-1" />}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                        <StatusBadge status={log.toStatus} showIcon={false} className="mb-1" />
                        <p className="text-[10px] text-slate-400 font-medium">
                            {format(new Date(log.timestamp), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                            {log.changedBy ? ` · ${log.changedBy.fullName}` : ' · System'}
                        </p>
                        {log.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1">
                                "{log.notes}"
                            </p>
                        )}
                    </div>
                </motion.div>
            ))}
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/StatusTimeline.tsx
git commit -m "feat(lost-item): add StatusTimeline shared component"
```

---

## Task 3: PhotoGrid Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/PhotoGrid.tsx`

- [ ] **Step 1: Create PhotoGrid.tsx**

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Plus, X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoGridProps {
    urls: string[];
    editable?: boolean;
    maxDisplay?: number;
    onUpload?: (files: File[]) => void;
    onRemove?: (index: number) => void;
    className?: string;
}

export const PhotoGrid = ({ urls, editable = false, maxDisplay = 5, onUpload, onRemove, className }: PhotoGridProps) => {
    const [lightbox, setLightbox] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length && onUpload) onUpload(files);
        e.target.value = '';
    };

    return (
        <>
            <div className={cn('flex flex-wrap gap-2', className)}>
                {urls.slice(0, maxDisplay).map((url, i) => (
                    <div key={i} className="relative group">
                        <img
                            src={url}
                            alt={`foto-${i + 1}`}
                            onClick={() => setLightbox(url)}
                            className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                        </div>
                        {editable && onRemove && (
                            <button
                                onClick={() => onRemove(i)}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                ))}

                {urls.length === 0 && !editable && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                        <Image className="w-4 h-4" />
                        <span>Tidak ada foto</span>
                    </div>
                )}

                {editable && urls.length < maxDisplay && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors">
                        <Plus className="w-4 h-4 text-slate-400" />
                        <span className="text-[9px] text-slate-400 mt-0.5">Foto</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                    </label>
                )}
            </div>

            <AnimatePresence>
                {lightbox && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center"
                            onClick={() => setLightbox(null)}
                        >
                            <motion.img
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                src={lightbox}
                                alt="preview"
                                className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain"
                                onClick={e => e.stopPropagation()}
                            />
                            <button
                                onClick={() => setLightbox(null)}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/PhotoGrid.tsx
git commit -m "feat(lost-item): add PhotoGrid shared component with lightbox"
```

---

## Task 4: ContextualActions Component

**Files:**
- Create: `apps/frontend/src/features/request-center/components/ContextualActions.tsx`

- [ ] **Step 1: Create ContextualActions.tsx**

```tsx
import React, { useState } from 'react';
import { Play, X, Search, RotateCcw, CheckCircle2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LostItemStatus } from '../api/lost-item.api';

interface ContextualActionsProps {
    reportId: string;
    status: LostItemStatus;
    userRole: string;
    isOwnReport?: boolean;
    isPending?: boolean;
    onStatusChange: (newStatus: LostItemStatus, notes?: string) => void;
    onReviewMatch?: (reportId: string) => void;
}

export const ContextualActions = ({
    reportId,
    status,
    userRole,
    isOwnReport = false,
    isPending = false,
    onStatusChange,
    onReviewMatch,
}: ContextualActionsProps) => {
    const [confirmClose, setConfirmClose] = useState(false);
    const isAdminOrAgent = userRole === 'ADMIN' || userRole === 'AGENT';

    const btnBase = 'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-50';

    if (status === LostItemStatus.RETURNED || (status === LostItemStatus.CLOSED_LOST && !isAdminOrAgent)) {
        return <p className="text-xs text-slate-400 italic">Laporan ini sudah selesai.</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            {/* REPORTED */}
            {status === LostItemStatus.REPORTED && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.SEARCHING)}
                    className={cn(btnBase, 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20')}
                >
                    <Play className="w-4 h-4" /> Start Searching
                </button>
            )}

            {/* CLAIMED → Review Match */}
            {status === LostItemStatus.CLAIMED && isAdminOrAgent && onReviewMatch && (
                <button
                    disabled={isPending}
                    onClick={() => onReviewMatch(reportId)}
                    className={cn(btnBase, 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-600/20')}
                >
                    <Search className="w-4 h-4" /> Review Match
                </button>
            )}

            {/* VERIFIED → Confirm Return */}
            {status === LostItemStatus.VERIFIED && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.RETURNED)}
                    className={cn(btnBase, 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-600/20')}
                >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Return
                </button>
            )}

            {/* CLOSED_LOST → Reopen (admin/agent only) */}
            {status === LostItemStatus.CLOSED_LOST && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.REPORTED)}
                    className={cn(btnBase, 'bg-slate-600 text-white hover:bg-slate-700')}
                >
                    <RotateCcw className="w-4 h-4" /> Reopen
                </button>
            )}

            {/* Close / Tutup — admin/agent on REPORTED or SEARCHING, client on REPORTED */}
            {(status === LostItemStatus.REPORTED || status === LostItemStatus.SEARCHING) && (isAdminOrAgent || (isOwnReport && status === LostItemStatus.REPORTED)) && (
                confirmClose ? (
                    <div className="flex gap-2 items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 flex-1">Yakin tutup laporan ini?</p>
                        <button
                            onClick={() => { setConfirmClose(false); onStatusChange(LostItemStatus.CLOSED_LOST); }}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                        >
                            Ya, Tutup
                        </button>
                        <button onClick={() => setConfirmClose(false)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">
                            Batal
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmClose(true)}
                        className={cn(btnBase, 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10')}
                    >
                        <X className="w-4 h-4" /> {isOwnReport && !isAdminOrAgent ? 'Tutup Laporan' : 'Close Report'}
                    </button>
                )
            )}

            {/* Read-only message for client when no actions available */}
            {!isAdminOrAgent && !isOwnReport && (
                <p className="text-xs text-slate-400 italic">Hanya pemilik laporan yang dapat mengambil tindakan.</p>
            )}
            {!isAdminOrAgent && isOwnReport && status === LostItemStatus.SEARCHING && (
                <p className="text-xs text-slate-400 italic">Tim sedang mencari barang kamu.</p>
            )}
            {!isAdminOrAgent && isOwnReport && (status === LostItemStatus.CLAIMED || status === LostItemStatus.VERIFIED) && (
                <p className="text-xs text-slate-400 italic">
                    {status === LostItemStatus.CLAIMED ? 'Menunggu verifikasi admin/agent.' : 'Barang siap diambil di pos keamanan.'}
                </p>
            )}
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/ContextualActions.tsx
git commit -m "feat(lost-item): add ContextualActions component with role-aware status buttons"
```

---

## Task 5: ItemDetailDrawer Component (Split Panel)

**Files:**
- Create: `apps/frontend/src/features/request-center/components/ItemDetailDrawer.tsx`

- [ ] **Step 1: Create ItemDetailDrawer.tsx**

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Calendar, Tag, User } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { LostItemReport, LostItemStatus } from '../api/lost-item.api';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';
import { PhotoGrid } from './PhotoGrid';
import { ContextualActions } from './ContextualActions';

interface ItemDetailDrawerProps {
    item: LostItemReport | null;
    userRole: string;
    currentUserId?: string;
    isPending?: boolean;
    onClose: () => void;
    onStatusChange: (id: string, status: LostItemStatus, notes?: string) => void;
    onReviewMatch?: (reportId: string) => void;
}

export const ItemDetailDrawer = ({
    item,
    userRole,
    currentUserId,
    isPending = false,
    onClose,
    onStatusChange,
    onReviewMatch,
}: ItemDetailDrawerProps) => {
    const reporterName = item?.reporter?.fullName || item?.ticket?.user?.fullName || 'Unknown';
    const reporterEmail = item?.reporter?.email || item?.ticket?.user?.email || '';
    const isOwnReport = !!(item && currentUserId && (
        item.reporter?.id === currentUserId
    ));

    return (
        <AnimatePresence>
            {item && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col border-l border-slate-200 dark:border-slate-800"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/30 dark:bg-slate-900/50 shrink-0">
                            <div>
                                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500 mb-1">{item.id.slice(0, 8)}…</p>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white">{item.itemName}</h2>
                                <div className="mt-2">
                                    <StatusBadge status={item.status} />
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body: Split Panel */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Info + Photo + Actions */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-100 dark:border-slate-800">
                                {/* Reporter */}
                                <section>
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Reporter</h3>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <div className="w-9 h-9 rounded-full bg-rose-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                                            {reporterName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 dark:text-white text-sm">{reporterName}</p>
                                            {reporterEmail && <p className="text-xs text-slate-400">{reporterEmail}</p>}
                                        </div>
                                    </div>
                                </section>

                                {/* Info Grid */}
                                <section>
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Detail</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-2 text-slate-500"><Tag className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Tipe</span></div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{item.itemType}</span>
                                        </div>
                                        {item.serialNumber && (
                                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                                <div className="flex items-center gap-2 text-slate-500"><Tag className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Serial</span></div>
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">{item.serialNumber}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-2 text-slate-500"><MapPin className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Lokasi</span></div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{item.lastSeenLocation}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-2 text-slate-500"><Calendar className="w-3.5 h-3.5" /> <span className="text-xs font-bold">Dilaporkan</span></div>
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: localeId })}</span>
                                        </div>
                                    </div>
                                </section>

                                {/* Description */}
                                {item.circumstances && (
                                    <section>
                                        <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Deskripsi</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                            "{item.circumstances}"
                                        </p>
                                    </section>
                                )}

                                {/* Photos */}
                                <section>
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Foto</h3>
                                    <PhotoGrid urls={item.photoUrls || []} />
                                </section>

                                {/* Actions */}
                                <section>
                                    <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Tindakan</h3>
                                    <ContextualActions
                                        reportId={item.id}
                                        status={item.status}
                                        userRole={userRole}
                                        isOwnReport={isOwnReport}
                                        isPending={isPending}
                                        onStatusChange={(newStatus, notes) => onStatusChange(item.id, newStatus, notes)}
                                        onReviewMatch={onReviewMatch}
                                    />
                                </section>
                            </div>

                            {/* Right: Timeline */}
                            <div className="w-56 shrink-0 overflow-y-auto p-4">
                                <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4">Riwayat Status</h3>
                                <StatusTimeline logs={item.statusLogs || []} />
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/ItemDetailDrawer.tsx
git commit -m "feat(lost-item): add ItemDetailDrawer split-panel component"
```

---

## Task 6: Update LostItemsNav (Role-Aware)

**Files:**
- Modify: `apps/frontend/src/features/request-center/components/LostItemsNav.tsx`

- [ ] **Step 1: Replace LostItemsNav.tsx**

```tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PackageSearch, ClipboardList, PackageCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/stores/useAuth';
import { useFoundClaims, FoundClaimStatus } from '../api/found-claim.api';

export const LostItemsNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const isAdminOrAgent = user?.role === 'ADMIN' || user?.role === 'AGENT';

    const isClient = location.pathname.startsWith('/client');
    const isManager = location.pathname.startsWith('/manager');
    const basePath = isClient ? '/client/lost-items' : isManager ? '/manager/lost-items' : '/lost-items';
    const foundPath = isClient ? '/client/found' : isManager ? '/manager/found' : '/found';
    const claimsPath = isClient ? '/client/lost-items/claims' : isManager ? '/manager/lost-items/claims' : '/lost-items/claims';

    const { data: pendingClaims } = useFoundClaims(
        isAdminOrAgent ? { status: FoundClaimStatus.PENDING } : undefined
    );
    const pendingCount = pendingClaims?.length || 0;

    const tabs = [
        { id: 'all', label: 'Semua Laporan', path: basePath, icon: PackageSearch, exact: true, show: true },
        { id: 'my', label: 'Laporan Saya', path: `${basePath}/my`, icon: ClipboardList, exact: false, show: true },
        { id: 'found', label: 'Saya Temukan', path: foundPath, icon: PackageCheck, exact: false, show: true },
        { id: 'claims', label: 'Claims Queue', path: claimsPath, icon: AlertCircle, exact: false, show: isAdminOrAgent, badge: pendingCount },
    ].filter(t => t.show);

    const isActive = (path: string, exact: boolean) => exact ? location.pathname === path : location.pathname.startsWith(path);

    return (
        <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl w-fit">
            {tabs.map(tab => {
                const active = isActive(tab.path, tab.exact);
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => navigate(tab.path)}
                        className={cn(
                            'relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200',
                            active
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.badge && tab.badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                                {tab.badge > 9 ? '9+' : tab.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/LostItemsNav.tsx
git commit -m "feat(lost-item): make LostItemsNav role-aware, add Claims Queue tab for admin/agent"
```

---

## Task 7: Update LostItemListPage

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/LostItemListPage.tsx`

- [ ] **Step 1: Replace LostItemListPage.tsx**

```tsx
import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PackageSearch, Search, RefreshCw, Plus, TrendingUp, Inbox, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { useLostItemReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { StatusBadge } from '../components/StatusBadge';
import { ItemDetailDrawer } from '../components/ItemDetailDrawer';

const STATUS_PILLS: { label: string; value: string }[] = [
    { label: 'Semua', value: 'ALL' },
    { label: 'Dilaporkan', value: 'REPORTED' },
    { label: 'Dicari', value: 'SEARCHING' },
    { label: 'Ada Penemu', value: 'CLAIMED' },
    { label: 'Terverifikasi', value: 'VERIFIED' },
    { label: 'Dikembalikan', value: 'RETURNED' },
    { label: 'Ditutup', value: 'CLOSED_LOST' },
];

const SkeletonRow = () => (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + (i * 7) % 40}%` }} />
            </td>
        ))}
    </tr>
);

export const LostItemListPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const { data: items = [], isLoading, refetch } = useLostItemReports(
        statusFilter !== 'ALL' ? { status: statusFilter as LostItemStatus } : undefined
    );
    const updateStatus = useUpdateLostItemStatus();

    const handleRefresh = () => { refetch(); toast.success('Data diperbarui'); };

    const handleNewReport = () => {
        if (location.pathname.startsWith('/client')) {
            navigate('/client/create?type=lost-item');
        } else {
            navigate('/tickets/create?type=lost-item');
        }
    };

    const handleStatusChange = (id: string, status: LostItemStatus, notes?: string) => {
        updateStatus.mutate(
            { id, status, notes },
            {
                onSuccess: () => {
                    toast.success('Status diperbarui');
                    setSelectedItem(null);
                    refetch();
                },
                onError: () => toast.error('Gagal memperbarui status'),
            }
        );
    };

    const filteredItems = useMemo(() => items.filter(item => {
        const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || '';
        const q = searchQuery.toLowerCase();
        return item.id.toLowerCase().includes(q) || item.itemName.toLowerCase().includes(q) || reporterName.toLowerCase().includes(q);
    }), [items, searchQuery]);

    const stats = useMemo(() => ({
        total: items.length,
        reported: items.filter(i => i.status === LostItemStatus.REPORTED).length,
        found: items.filter(i => i.status === LostItemStatus.VERIFIED || i.status === LostItemStatus.RETURNED).length,
        closed: items.filter(i => i.status === LostItemStatus.CLOSED_LOST).length,
    }), [items]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Lost Items</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Laporan dan tracking barang hilang</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleRefresh} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button onClick={handleNewReport} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-sm text-sm">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Laporan Baru</span>
                    </button>
                </div>
            </div>

            <LostItemsNav />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-rose-500" bgColor="bg-rose-500/10" animationIndex={0} />
                <StatsCard icon={Inbox} label="Dilaporkan" value={stats.reported} color="text-amber-500" bgColor="bg-amber-500/10" animationIndex={1} />
                <StatsCard icon={CheckCircle2} label="Ditemukan" value={stats.found} color="text-emerald-500" bgColor="bg-emerald-500/10" animationIndex={2} />
                <StatsCard icon={XCircle} label="Ditutup" value={stats.closed} color="text-slate-500" bgColor="bg-slate-500/10" animationIndex={3} />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama barang, reporter, atau ID..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_PILLS.map(pill => (
                            <button
                                key={pill.value}
                                onClick={() => setStatusFilter(pill.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors duration-150',
                                    statusFilter === pill.value
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-rose-400'
                                )}
                            >
                                {pill.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Barang</th>
                                <th className="px-6 py-4">Lokasi</th>
                                <th className="px-6 py-4">Reporter</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                [1, 2, 3].map(i => <SkeletonRow key={i} />)
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                        <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-bold">Tidak ada laporan ditemukan</p>
                                        <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
                                    </td>
                                </tr>
                            ) : filteredItems.map(item => {
                                const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || 'Unknown';
                                return (
                                    <motion.tr
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-rose-50/30 dark:hover:bg-rose-900/5 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">{item.id.slice(0, 8)}…</td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.itemName}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.itemType}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{item.lastSeenLocation}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{reporterName}</td>
                                        <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: localeId })}</td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <ItemDetailDrawer
                item={selectedItem}
                userRole={user?.role || 'USER'}
                currentUserId={user?.id}
                isPending={updateStatus.isPending}
                onClose={() => setSelectedItem(null)}
                onStatusChange={handleStatusChange}
            />
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/LostItemListPage.tsx
git commit -m "feat(lost-item): rebuild LostItemListPage with ItemDetailDrawer, status pills, skeleton loading"
```

---

## Task 8: Update MyLostReportsPage

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx`

- [ ] **Step 1: Replace MyLostReportsPage.tsx**

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useMyLostReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { StatusBadge } from '../components/StatusBadge';
import { PhotoGrid } from '../components/PhotoGrid';
import { ItemDetailDrawer } from '../components/ItemDetailDrawer';

const SkeletonCard = () => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 animate-pulse">
        <div className="flex gap-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
);

export const MyLostReportsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: reports = [], isLoading, refetch } = useMyLostReports();
    const updateStatus = useUpdateLostItemStatus();
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);

    const handleStatusChange = (id: string, status: LostItemStatus, notes?: string) => {
        updateStatus.mutate(
            { id, status, notes },
            {
                onSuccess: () => {
                    toast.success('Status diperbarui');
                    setSelectedItem(null);
                    refetch();
                },
                onError: () => toast.error('Gagal memperbarui status'),
            }
        );
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Laporan Saya</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Lacak status barang yang kamu laporkan hilang</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/client/create?type=lost-item')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" /> Laporan Baru
                </button>
            </div>

            <LostItemsNav />

            {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageSearch className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Belum ada laporan</p>
                    <p className="text-sm mt-1">Klik "Laporan Baru" untuk melaporkan barang hilang</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report, idx) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => setSelectedItem(report)}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-extrabold text-rose-500 uppercase tracking-widest font-mono">{report.id.slice(0, 8)}…</span>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg">{report.itemName}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{report.itemType} · {report.lastSeenLocation}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Dilaporkan {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                                    </p>
                                </div>
                            </div>
                            {report.photoUrls?.length > 0 && (
                                <div className="mt-3" onClick={e => e.stopPropagation()}>
                                    <PhotoGrid urls={report.photoUrls.slice(0, 4)} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            <ItemDetailDrawer
                item={selectedItem}
                userRole={user?.role || 'USER'}
                currentUserId={user?.id}
                isPending={updateStatus.isPending}
                onClose={() => setSelectedItem(null)}
                onStatusChange={handleStatusChange}
            />
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/MyLostReportsPage.tsx
git commit -m "fix(lost-item): replace window.location.href with navigate, add ItemDetailDrawer, skeleton loading"
```

---

## Task 9: Update ReportFoundItemPage (Manual Search State)

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx`

- [ ] **Step 1: Replace ReportFoundItemPage.tsx**

```tsx
import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PackageCheck, MapPin, Clock, FileText, CheckCircle2, Search, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PhotoUploader } from '../components/PhotoUploader';
import { useCreateFoundClaim } from '../api/found-claim.api';
import { useQrTokenReport, useLostItemReports, LostItemStatus } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';

const schema = z.object({
    locationFound: z.string().min(3, 'Minimal 3 karakter'),
    foundAt: z.string().min(1, 'Wajib diisi'),
    description: z.string().min(10, 'Minimal 10 karakter'),
});

type FormData = z.infer<typeof schema>;

export const ReportFoundItemPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('r');
    const [photos, setPhotos] = useState<File[]>([]);
    const [submitted, setSubmitted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [manualReportId, setManualReportId] = useState<string | null>(null);
    const [manualItemName, setManualItemName] = useState('');

    const { data: qrInfo, isLoading: qrLoading } = useQrTokenReport(token);
    const { data: searchableItems = [] } = useLostItemReports(
        !token ? { status: LostItemStatus.SEARCHING } : undefined
    );
    const createClaim = useCreateFoundClaim();

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return searchableItems;
        const q = searchQuery.toLowerCase();
        return searchableItems.filter(i =>
            i.itemName.toLowerCase().includes(q) || i.itemType.toLowerCase().includes(q)
        );
    }, [searchableItems, searchQuery]);

    const resolvedReportId = token ? qrInfo?.reportId : manualReportId;
    const resolvedItemName = token ? qrInfo?.itemName : manualItemName;
    const isFormReady = !!resolvedReportId;

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { foundAt: new Date().toISOString().slice(0, 16) },
    });

    const onSubmit = async (data: FormData) => {
        if (!resolvedReportId) { toast.error('Pilih laporan hilang terlebih dahulu'); return; }
        const formData = new window.FormData();
        formData.append('lostItemReportId', resolvedReportId);
        formData.append('locationFound', data.locationFound);
        formData.append('foundAt', data.foundAt);
        formData.append('description', data.description);
        photos.forEach(f => formData.append('photos', f));

        createClaim.mutate(formData, {
            onSuccess: () => setSubmitted(true),
            onError: () => toast.error('Gagal mengirim laporan. Coba lagi.'),
        });
    };

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Laporan Terkirim!</h2>
                <p className="text-slate-500 max-w-xs">Admin/agent akan memverifikasi laporan temuan kamu. Terima kasih!</p>
                <button onClick={() => navigate(-1)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                    Kembali
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up max-w-lg">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Lapor Barang Temuan</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Bantu kembalikan barang ke pemiliknya</p>
                </div>
            </div>

            <LostItemsNav />

            {/* QR Banner or Manual Search */}
            {token ? (
                qrLoading ? (
                    <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : qrInfo ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                            <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">Barang teridentifikasi dari QR</p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-500">{qrInfo.itemName} · {qrInfo.itemType}</p>
                        </div>
                        <Lock className="w-4 h-4 text-emerald-400 ml-auto" />
                    </div>
                ) : (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl text-sm text-red-700 dark:text-red-400 font-bold">
                        QR tidak valid atau laporan sudah ditutup.
                    </div>
                )
            ) : (
                <div className="space-y-3">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                        <p className="font-bold text-blue-700 dark:text-blue-400 text-sm mb-3">Cari laporan hilang yang sesuai</p>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari nama atau tipe barang..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    {searchQuery && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {filteredItems.length === 0 ? (
                                <p className="text-xs text-slate-400 text-center py-4">Tidak ada laporan ditemukan</p>
                            ) : filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setManualReportId(item.id); setManualItemName(item.itemName); setSearchQuery(''); }}
                                    className="w-full text-left p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 transition-colors"
                                >
                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{item.itemName}</p>
                                    <p className="text-xs text-slate-400">{item.itemType} · {item.lastSeenLocation}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    {manualReportId && (
                        <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded-xl">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{manualItemName} dipilih</p>
                            <button onClick={() => { setManualReportId(null); setManualItemName(''); }} className="ml-auto text-xs text-slate-400 hover:text-red-500">Ganti</button>
                        </div>
                    )}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className={`space-y-4 ${!isFormReady ? 'opacity-50 pointer-events-none' : ''}`}>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Lokasi Ditemukan *</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input {...register('locationFound')} placeholder="Contoh: Lobby lantai 2" className="pl-10" />
                    </div>
                    {errors.locationFound && <p className="text-xs text-red-500 mt-1">{errors.locationFound.message}</p>}
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Waktu Ditemukan *</label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input type="datetime-local" {...register('foundAt')} className="pl-10" />
                    </div>
                    {errors.foundAt && <p className="text-xs text-red-500 mt-1">{errors.foundAt.message}</p>}
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Deskripsi Kondisi Barang *</label>
                    <div className="relative">
                        <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                        <Textarea {...register('description')} placeholder="Ceritakan kondisi barang saat ditemukan..." className="pl-10 min-h-[80px]" />
                    </div>
                    {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5">Foto Bukti (maks. 5)</label>
                    <PhotoUploader files={photos} onChange={setPhotos} maxFiles={5} />
                </div>

                <button
                    type="submit"
                    disabled={createClaim.isPending || !isFormReady}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                    {createClaim.isPending ? 'Mengirim...' : 'Kirim Laporan Temuan'}
                </button>
            </form>
        </div>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/ReportFoundItemPage.tsx
git commit -m "feat(lost-item): add manual search state to ReportFoundItemPage when no QR token"
```

---

## Task 10: Update MatchReviewPanel (Side-by-Side Layout)

**Files:**
- Modify: `apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx`

- [ ] **Step 1: Replace MatchReviewPanel.tsx**

```tsx
import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, MapPin, Calendar, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { FoundItemClaim, useMatchFoundClaim, useRejectFoundClaim } from '../api/found-claim.api';
import { PhotoGrid } from './PhotoGrid';
import { StatusBadge } from './StatusBadge';

interface MatchReviewPanelProps {
    claim: FoundItemClaim;
    onClose: () => void;
}

export const MatchReviewPanel = ({ claim, onClose }: MatchReviewPanelProps) => {
    const [notes, setNotes] = useState('');
    const matchClaim = useMatchFoundClaim();
    const rejectClaim = useRejectFoundClaim();
    const report = claim.lostItemReport;

    const serialMatch = !!(
        report?.serialNumber &&
        claim.description?.toLowerCase().includes(report.serialNumber.toLowerCase())
    );

    const handleMatch = () => {
        matchClaim.mutate(
            { id: claim.id, lostItemReportId: claim.lostItemReportId ?? undefined, notes },
            {
                onSuccess: () => { toast.success('Claim matched ✓'); onClose(); },
                onError: () => toast.error('Gagal match claim'),
            }
        );
    };

    const handleReject = () => {
        if (!notes.trim()) { toast.error('Notes wajib diisi saat reject'); return; }
        rejectClaim.mutate(
            { id: claim.id, notes },
            {
                onSuccess: () => { toast.success('Claim rejected'); onClose(); },
                onError: () => toast.error('Gagal reject claim'),
            }
        );
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]"
                onClick={onClose}
            />
            <motion.div
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full max-w-3xl bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Match Review</h2>
                        <p className="text-sm text-slate-500">Claim #{claim.id.slice(0, 8)}… · <StatusBadge status={claim.status} /></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body: Side-by-Side */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-6">
                        {/* Left: Lost Item */}
                        <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider mb-3">
                                Barang Hilang
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white text-base mb-1">{report?.itemName || '—'}</h3>
                            <p className="text-xs text-slate-500 mb-4">Reporter: {report?.reporter?.fullName || '—'}</p>

                            <div className="space-y-2 mb-4">
                                {report?.serialNumber && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 font-bold">Serial</span>
                                        <span className="font-black text-slate-800 dark:text-slate-200 font-mono">{report.serialNumber}</span>
                                    </div>
                                )}
                                {report?.lastSeenLocation && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 font-bold">Lokasi</span>
                                        <span className="font-black text-slate-800 dark:text-slate-200">{report.lastSeenLocation}</span>
                                    </div>
                                )}
                                {report?.itemType && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 font-bold">Tipe</span>
                                        <span className="font-black text-slate-800 dark:text-slate-200">{report.itemType}</span>
                                    </div>
                                )}
                            </div>

                            <PhotoGrid urls={report?.photoUrls || []} />
                        </div>

                        {/* VS Divider */}
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600 font-black text-sm py-4">
                            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                            VS
                            <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
                        </div>

                        {/* Right: Found Claim */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-extrabold uppercase tracking-wider mb-3">
                                Barang Temuan
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white text-base mb-1">
                                {claim.finder?.fullName || '—'}
                                <span className="text-xs font-normal text-slate-500 ml-2">menemukan</span>
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">
                                {format(new Date(claim.foundAt || claim.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                            </p>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-bold">Lokasi Temukan</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{claim.locationFound}</span>
                                </div>
                                {serialMatch && (
                                    <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                                        <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-400">Serial number cocok ✓</span>
                                    </div>
                                )}
                            </div>

                            {claim.description && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 italic mb-4 bg-white dark:bg-slate-800/50 p-3 rounded-xl">
                                    "{claim.description}"
                                </p>
                            )}

                            <PhotoGrid urls={claim.photoUrls || []} />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mb-4">
                        <label className="block text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                            Catatan Admin/Agent <span className="text-red-500">(wajib jika reject)</span>
                        </label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Tulis catatan verifikasi..."
                            className="resize-none"
                            rows={3}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleMatch}
                            disabled={matchClaim.isPending || rejectClaim.isPending}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                        >
                            <CheckCircle2 className="w-4 h-4" /> MATCH — Konfirmasi Cocok
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={matchClaim.isPending || rejectClaim.isPending}
                            className="flex items-center justify-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl font-black hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                            <XCircle className="w-4 h-4" /> Reject
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    );
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/frontend/src/features/request-center/components/MatchReviewPanel.tsx
git commit -m "feat(lost-item): rebuild MatchReviewPanel with side-by-side layout and serial auto-hint"
```

---

## Task 11: Update FoundClaimsQueuePage (Skeleton + Pending Badge)

**Files:**
- Modify: `apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx`

- [ ] **Step 1: Replace spinner with skeleton and add pending badge to header**

Find the `isLoading` return block in `FoundClaimsQueuePage.tsx`:

```tsx
// BEFORE (lines ~52-57):
if (isLoading) return (
    <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
);
```

Replace with:

```tsx
const SkeletonRow = () => (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
        {[1, 2, 3, 4, 5].map(i => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50 + (i * 11) % 40}%` }} />
            </td>
        ))}
    </tr>
);
```

Then in the table body, replace the `isLoading` spinner guard with:

```tsx
{isLoading ? (
    [1, 2, 3].map(i => <SkeletonRow key={i} />)
) : /* existing claims.length === 0 check and map */}
```

Also add pending count to the page header — find the `<h1>` tag and update to:

```tsx
<h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
    Found Claims Queue
    {pendingCount > 0 && (
        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-extrabold rounded-full">
            {pendingCount} pending
        </span>
    )}
</h1>
```

- [ ] **Step 2: Import StatusBadge and replace inline Badge usage**

At top of file, add import:
```tsx
import { StatusBadge } from '../components/StatusBadge';
```

Find all `<Badge className={cn(...STATUS_CONFIG[claim.status]?.color...)}>{STATUS_CONFIG[claim.status]?.label}</Badge>` and replace with:
```tsx
<StatusBadge status={claim.status} />
```

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/src/features/request-center/pages/FoundClaimsQueuePage.tsx
git commit -m "feat(lost-item): add skeleton loading and pending badge to FoundClaimsQueuePage"
```

---

## Self-Review

**Spec coverage:**
- ✓ StatusBadge replaces inline badges in all pages → Task 1, used in Tasks 7, 8, 10, 11
- ✓ StatusTimeline shows audit log → Task 2, used in Task 5
- ✓ PhotoGrid with lightbox → Task 3, used in Tasks 5, 8, 9, 10
- ✓ ContextualActions per status + role → Task 4, used in Task 5
- ✓ ItemDetailDrawer split-panel → Task 5, used in Tasks 7, 8
- ✓ LostItemsNav role-aware with Claims Queue tab + badge → Task 6
- ✓ LostItemListPage: status pills, skeleton, ItemDetailDrawer, fix handleNewReport → Task 7
- ✓ MyLostReportsPage: fix window.location.href → navigate(), ItemDetailDrawer, skeleton → Task 8
- ✓ ReportFoundItemPage: manual search state + QR state → Task 9
- ✓ MatchReviewPanel: side-by-side layout, serial auto-hint → Task 10
- ✓ FoundClaimsQueuePage: skeleton, pending badge → Task 11
- ✓ ContextualActions: Start Searching, Close Report, Confirm Return, Reopen → Task 4
- ✓ SEARCHING status: read-only for client → Task 4
- ✓ Claims Queue tab only for ADMIN/AGENT → Task 6

**Placeholder scan:** Tidak ada TBD/TODO ✓

**Type consistency:**
- `LostItemStatus` dari `lost-item.api.ts` — konsisten di Tasks 4, 5, 7, 8, 9
- `FoundClaimStatus` dari `found-claim.api.ts` — konsisten di Tasks 6, 11
- `useAuth()` → `user.role` string: 'ADMIN' | 'AGENT' | 'USER' — konsisten di Tasks 4, 5, 6, 7, 8
- `onStatusChange(id, status, notes?)` interface konsisten antara Tasks 5, 7, 8
- `useFoundClaims({ status: FoundClaimStatus.PENDING })` di Task 6 — sesuai hook signature
- `PhotoUploader` di Task 9 digunakan sebagaimana existing import pattern ✓
