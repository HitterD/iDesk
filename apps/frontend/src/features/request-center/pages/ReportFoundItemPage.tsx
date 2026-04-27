import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PackageCheck, MapPin, Clock, FileText, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { PhotoUploader } from '../components/PhotoUploader';
import { useCreateFoundClaim } from '../api/found-claim.api';
import { useQrTokenReport } from '../api/lost-item.api';

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

    const { data: qrInfo, isLoading: qrLoading } = useQrTokenReport(token);
    const createClaim = useCreateFoundClaim();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { foundAt: new Date().toISOString().slice(0, 16) },
    });

    const onSubmit = async (data: FormData) => {
        const formData = new FormData();
        formData.append('locationFound', data.locationFound);
        formData.append('foundAt', new Date(data.foundAt).toISOString());
        formData.append('description', data.description);
        if (qrInfo?.reportId) formData.append('lostItemReportId', qrInfo.reportId);
        photos.forEach(f => formData.append('photos', f));

        createClaim.mutate(formData, {
            onSuccess: () => setSubmitted(true),
            onError: () => toast.error('Gagal mengirim laporan temuan'),
        });
    };

    if (submitted) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Laporan Terkirim!</h2>
            <p className="text-slate-500 text-center max-w-sm">Manager akan memverifikasi temuanmu. Kamu akan mendapat notifikasi hasilnya.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                Kembali ke Home
            </button>
        </div>
    );

    return (
        <div className="max-w-lg mx-auto space-y-6 animate-fade-in-up">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Saya Menemukan Barang</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Bantu kembalikan barang ke pemiliknya</p>
                </div>
            </div>

            {qrInfo && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Terhubung ke Laporan</p>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{qrInfo.itemName}</p>
                    <p className="text-sm text-slate-500">{qrInfo.itemType}</p>
                    {qrInfo.photoUrls?.length > 0 && (
                        <div className="flex gap-2 mt-2">
                            {qrInfo.photoUrls.slice(0, 3).map((url, i) => (
                                <img key={i} src={url} alt="" className="w-12 h-12 object-cover rounded-lg border border-emerald-200" />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {qrLoading && token && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Memuat info laporan dari QR…</span>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Lokasi Ditemukan *
                    </label>
                    <Input {...register('locationFound')} placeholder="e.g., Lobby lantai 1, dekat lift" />
                    {errors.locationFound && <p className="text-[10px] text-red-500 mt-0.5">{errors.locationFound.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Waktu Ditemukan *
                    </label>
                    <Input type="datetime-local" {...register('foundAt')} />
                    {errors.foundAt && <p className="text-[10px] text-red-500 mt-0.5">{errors.foundAt.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1 block">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Deskripsi Barang *
                    </label>
                    <Textarea {...register('description')} placeholder="Jelaskan kondisi barang, ciri khas, warna, dll…" className="min-h-[80px] resize-none" />
                    {errors.description && <p className="text-[10px] text-red-500 mt-0.5">{errors.description.message}</p>}
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 block">
                        Foto Barang (opsional, max 5)
                    </label>
                    <PhotoUploader files={photos} onChange={setPhotos} maxFiles={5} />
                </div>

                <button
                    type="submit"
                    disabled={createClaim.isPending}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20"
                >
                    {createClaim.isPending ? 'Mengirim…' : 'KIRIM LAPORAN TEMUAN'}
                </button>
            </form>
        </div>
    );
};
