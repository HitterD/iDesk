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
