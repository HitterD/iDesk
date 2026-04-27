import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { FoundItemClaim, useMatchFoundClaim, useRejectFoundClaim } from '../api/found-claim.api';

interface MatchReviewPanelProps {
    claim: FoundItemClaim;
    onClose: () => void;
}

export const MatchReviewPanel = ({ claim, onClose }: MatchReviewPanelProps) => {
    const [notes, setNotes] = useState('');
    const matchClaim = useMatchFoundClaim();
    const rejectClaim = useRejectFoundClaim();

    const report = claim.lostItemReport;

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
                className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col border-l border-slate-200 dark:border-slate-800"
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">Match Review</h2>
                        <p className="text-sm text-slate-500">Claim ID: {claim.id.slice(0, 8)}…</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-widest text-rose-500 flex items-center gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5" /> Laporan Hilang
                            </div>
                            {report ? (
                                <div className="bg-rose-50/50 dark:bg-rose-900/10 rounded-xl p-4 border border-rose-100 dark:border-rose-900/30 space-y-2">
                                    <p className="font-black text-slate-900 dark:text-white">{report.itemName}</p>
                                    <p className="text-sm text-slate-500">{report.itemType}</p>
                                    {report.photoUrls?.length > 0 && (
                                        <div className="grid grid-cols-2 gap-1.5 mt-2">
                                            {report.photoUrls.slice(0, 4).map((url, i) => (
                                                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm text-slate-400 italic">
                                    Claim belum terhubung ke laporan — pilih laporan manual di bawah
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Laporan Temuan
                            </div>
                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                                <p className="font-black text-slate-900 dark:text-white">{claim.finder?.fullName}</p>
                                <p className="text-sm text-slate-500">{claim.locationFound}</p>
                                <p className="text-sm text-slate-500">{format(new Date(claim.foundAt), 'dd MMM yyyy HH:mm')}</p>
                                <p className="text-xs text-slate-400 italic">"{claim.description}"</p>
                                {claim.photoUrls?.length > 0 && (
                                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                                        {claim.photoUrls.slice(0, 4).map((url, i) => (
                                            <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 block">
                            Notes Manager <span className="text-red-400">(wajib jika REJECT)</span>
                        </label>
                        <Textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Tuliskan alasan atau catatan verifikasi…"
                            className="resize-none min-h-[80px]"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button
                        onClick={handleMatch}
                        disabled={matchClaim.isPending}
                        className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {matchClaim.isPending ? 'MATCHING…' : 'MATCH ✓'}
                    </button>
                    <button
                        onClick={handleReject}
                        disabled={rejectClaim.isPending}
                        className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                    >
                        <XCircle className="w-4 h-4" />
                        {rejectClaim.isPending ? 'REJECTING…' : 'REJECT ✗'}
                    </button>
                </div>
            </motion.div>
        </>
    );
};
