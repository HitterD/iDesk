import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Calendar, Tag } from 'lucide-react';
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
