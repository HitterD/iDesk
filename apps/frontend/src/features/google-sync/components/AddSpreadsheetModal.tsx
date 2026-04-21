import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, Link2, FileSpreadsheet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useCreateSpreadsheetConfig, useDiscoverSheets } from '../hooks/useGoogleSync';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface FormData {
    name: string;
    spreadsheetId: string;
    spreadsheetUrl?: string;
}

export function AddSpreadsheetModal({ isOpen, onClose }: Props) {
    const [step, setStep] = useState<'input' | 'verify'>('input');
    const createConfig = useCreateSpreadsheetConfig();

    const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>();

    const spreadsheetId = watch('spreadsheetId');
    const { data: discoveredSheets, isLoading: discovering, error: discoverError } = useDiscoverSheets(spreadsheetId || '');

    // Extract spreadsheet ID from URL
    const handleUrlPaste = (url: string) => {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            setValue('spreadsheetId', match[1]);
            setValue('spreadsheetUrl', url);
        }
    };

    const onSubmit = async (data: FormData) => {
        try {
            await createConfig.mutateAsync(data);
            toast.success('Spreadsheet berhasil ditambahkan');
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menambahkan spreadsheet');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                            <div className="flex items-center gap-3">
                                <Cloud className="w-6 h-6 text-green-400" />
                                <h2 className="text-xl font-semibold text-white">Tambah Spreadsheet</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nama Konfigurasi *
                                </label>
                                <input
                                    {...register('name', { required: 'Nama wajib diisi' })}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20"
                                    placeholder="Contoh: Renewal Contract Data"
                                />
                                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <Link2 className="w-4 h-4 inline mr-1" />
                                    URL atau Spreadsheet ID *
                                </label>
                                <input
                                    {...register('spreadsheetId', { required: 'Spreadsheet ID wajib diisi' })}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value.includes('spreadsheets/d/')) {
                                            handleUrlPaste(value);
                                        }
                                    }}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20"
                                    placeholder="Paste URL atau Spreadsheet ID"
                                />
                                <p className="text-slate-500 text-xs mt-1">
                                    Paste URL lengkap atau ID saja (contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)
                                </p>
                                {errors.spreadsheetId && <p className="text-red-400 text-sm mt-1">{errors.spreadsheetId.message}</p>}
                            </div>

                            {/* Discovery result */}
                            {spreadsheetId && spreadsheetId.length > 10 && (
                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    {discovering ? (
                                        <p className="text-slate-400 text-sm">Memverifikasi spreadsheet...</p>
                                    ) : discoverError ? (
                                        <p className="text-red-400 text-sm">
                                            Tidak dapat mengakses spreadsheet. Pastikan sudah di-share ke service account.
                                        </p>
                                    ) : discoveredSheets ? (
                                        <div>
                                            <p className="text-green-400 text-sm mb-2">✓ Spreadsheet ditemukan!</p>
                                            <p className="text-slate-300 text-sm">
                                                <FileSpreadsheet className="w-4 h-4 inline mr-1" />
                                                {discoveredSheets.title} • {discoveredSheets.sheets?.length || 0} sheets
                                            </p>
                                        </div>
                                    ) : null}
                                </div>
                            )}

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                                <p className="text-yellow-200 text-sm">
                                    <strong>Penting:</strong> Pastikan spreadsheet sudah di-share (Editor) dengan email service account:
                                </p>
                                <p className="text-yellow-400 text-xs mt-1 font-mono break-all">
                                    idesk-sheets-sync@idesk-481813.iam.gserviceaccount.com
                                </p>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-slate-300 hover:bg-white/10 rounded-xl transition-colors"
                            >
                                Batal
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isSubmitting || !spreadsheetId}
                                onClick={handleSubmit(onSubmit)}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-shadow disabled:opacity-50"
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Tambah'}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
