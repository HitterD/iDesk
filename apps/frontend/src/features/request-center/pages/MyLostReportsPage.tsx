import React, { useState } from 'react';
import { PackageSearch, Plus, Clock, CheckCircle2, XCircle, Search, QrCode, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useMyLostReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    REPORTED:    { label: 'Dilaporkan',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',       icon: Clock },
    SEARCHING:   { label: 'Dicari',          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',           icon: Search },
    CLAIMED:     { label: 'Ada Penemu',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',   icon: CheckCircle2 },
    VERIFIED:    { label: 'Terverifikasi',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    RETURNED:    { label: 'Dikembalikan',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',       icon: CheckCircle2 },
    CLOSED_LOST: { label: 'Tidak Ditemukan', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',          icon: XCircle },
};

const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.REPORTED;
    return <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', cfg.color)}>{cfg.label}</Badge>;
};

export const MyLostReportsPage = () => {
    const { data: reports = [], isLoading, refetch } = useMyLostReports();
    const updateStatus = useUpdateLostItemStatus();
    const [showQr, setShowQr] = useState<string | null>(null);

    const handleCancel = (report: LostItemReport) => {
        if (!confirm('Yakin tutup laporan ini sebagai tidak ditemukan?')) return;
        updateStatus.mutate(
            { id: report.id, status: LostItemStatus.CLOSED_LOST, notes: 'Ditutup oleh reporter' },
            { onSuccess: () => { toast.success('Laporan ditutup'); refetch(); } }
        );
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

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
                    onClick={() => window.location.href = '/lost-items'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" /> Laporan Baru
                </button>
            </div>

            {reports.length === 0 ? (
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
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-extrabold text-rose-500 uppercase tracking-widest">{report.id.slice(0, 8)}…</span>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg">{report.itemName}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{report.itemType} · {report.lastSeenLocation}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Dilaporkan {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {report.qrCodeUrl && (
                                        <button
                                            onClick={() => setShowQr(showQr === report.id ? null : report.id)}
                                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-rose-500 transition-colors"
                                        >
                                            <QrCode className="w-5 h-5" />
                                        </button>
                                    )}
                                    {(report.status === LostItemStatus.REPORTED || report.status === LostItemStatus.SEARCHING) && (
                                        <button
                                            onClick={() => handleCancel(report)}
                                            className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
                                        >
                                            Tutup
                                        </button>
                                    )}
                                </div>
                            </div>

                            <AnimatePresence>
                                {showQr === report.id && report.qrCodeUrl && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
                                            <QRCodeSVG value={report.qrCodeUrl} size={140} />
                                            <p className="text-xs text-slate-400 text-center">Bagikan QR ini ke orang yang menemukan barang kamu</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {report.photoUrls?.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                    {report.photoUrls.slice(0, 4).map((url, i) => (
                                        <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
