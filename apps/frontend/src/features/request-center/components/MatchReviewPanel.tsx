import React, { useState } from 'react';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
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
