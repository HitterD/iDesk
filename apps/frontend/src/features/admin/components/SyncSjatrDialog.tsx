import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, Clock, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HrisSyncSummary {
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

interface SyncSjatrDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmSync: () => void;
    isLoading: boolean;
    summary: HrisSyncSummary | null;
}

export const SyncSjatrDialog: React.FC<SyncSjatrDialogProps> = ({
    isOpen,
    onClose,
    onConfirmSync,
    isLoading,
    summary,
}) => {
    const handleClose = () => {
        if (isLoading) return;
        onClose();
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in-0 duration-200" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 p-6 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                            </div>
                            <div>
                                <Dialog.Title className="text-lg font-bold text-slate-800 dark:text-white">
                                    {summary ? 'Hasil Sinkronisasi SJATR' : 'Sinkronisasi User dari SJATR'}
                                </Dialog.Title>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    HRIS Gateway 10.10.6.51:27080
                                </p>
                            </div>
                        </div>
                        {!isLoading && (
                            <button
                                type="button"
                                onClick={handleClose}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="py-5 space-y-4">
                        {isLoading ? (
                            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full border-4 border-blue-100 dark:border-blue-900/40 border-t-blue-600 animate-spin" />
                                    <RefreshCw className="w-6 h-6 text-blue-600 absolute inset-0 m-auto" />
                                </div>
                                <div>
                                    <h4 className="text-base font-semibold text-slate-800 dark:text-white">
                                        Sedang Menyinkronkan Data...
                                    </h4>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                        Mengambil data seluruh karyawan dari server SJATR dan mendaftarkan user baru ke iDesk.
                                    </p>
                                </div>
                                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-medium border border-amber-200 dark:border-amber-800/40">
                                    Mohon jangan tutup atau refresh halaman ini (~1-2 menit).
                                </div>
                            </div>
                        ) : summary ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center gap-3">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                            Sinkronisasi Selesai
                                        </h4>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            Proses sinkronisasi dengan SJATR telah berhasil dijalankan.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                            {summary.created}
                                        </div>
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                                            User Baru
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                            {summary.skipped}
                                        </div>
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                                            Dilewati (Tetap)
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
                                        <div className={cn("text-2xl font-bold", summary.errors.length > 0 ? "text-amber-600" : "text-slate-400")}>
                                            {summary.errors.length}
                                        </div>
                                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                                            Error
                                        </div>
                                    </div>
                                </div>

                                {summary.errors.length > 0 && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl space-y-1">
                                        <div className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            Catatan Error ({summary.errors.length}):
                                        </div>
                                        <ul className="text-xs text-red-600 dark:text-red-300 max-h-28 overflow-y-auto space-y-0.5 list-disc pl-4">
                                            {summary.errors.slice(0, 10).map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                            {summary.errors.length > 10 && (
                                                <li>...dan {summary.errors.length - 10} lainnya</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Fitur ini akan mengambil data seluruh karyawan dari server SJATR HRIS (10.10.6.51:27080) dan mendaftarkan user baru yang belum ada di iDesk.
                                </p>

                                <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700">
                                    <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        <span>
                                            <strong className="font-semibold text-slate-800 dark:text-white">Mode Insert-Only:</strong> Data user yang sudah ada di iDesk (nama, role, password, departemen) tidak akan diubah atau dihapus.
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                        <span>
                                            <strong className="font-semibold text-slate-800 dark:text-white">Akun Baru:</strong> User baru akan dibuatkan akun dengan NIK sebagai ID login dan role otomatis sesuai departemen.
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                        <span>
                                            <strong className="font-semibold text-slate-800 dark:text-white">Durasi:</strong> Proses membutuhkan waktu sekitar 1–2 menit untuk memeriksa seluruh halaman karyawan.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {summary ? (
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
                            >
                                Selesai
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isLoading}
                                    className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm disabled:opacity-50"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirmSync}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm shadow-sm disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Menyinkronkan...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            <span>Mulai Sinkronisasi</span>
                                        </>
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
