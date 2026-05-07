import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Laptop, Smartphone, CreditCard, Key, Backpack, Box, MapPin, Calendar, Camera, Upload, Loader2, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { getByQrToken } from '../api/lost-item.api';
import { useCreateFoundClaim } from '../api/found-claim.api';

export const QrLandingPage = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    const [showModal, setShowModal] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        locationFound: '',
        description: '',
    });
    const [file, setFile] = useState<File | null>(null);

    const { data: item, isLoading, isError } = useQuery({
        queryKey: ['qr-report', token],
        queryFn: () => getByQrToken(token!),
        enabled: !!token,
    });

    const createClaim = useCreateFoundClaim();

    const getItemIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes('laptop')) return <Laptop className="w-12 h-12 text-slate-400" />;
        if (t.includes('hp') || t.includes('phone') || t.includes('handphone')) return <Smartphone className="w-12 h-12 text-slate-400" />;
        if (t.includes('id') || t.includes('card') || t.includes('badge')) return <CreditCard className="w-12 h-12 text-slate-400" />;
        if (t.includes('kunci') || t.includes('key')) return <Key className="w-12 h-12 text-slate-400" />;
        if (t.includes('tas') || t.includes('bag')) return <Backpack className="w-12 h-12 text-slate-400" />;
        return <Box className="w-12 h-12 text-slate-400" />;
    };

    const handleFoundClick = () => {
        if (!user) {
            navigate(`/login?redirect=/found/${token}`);
            return;
        }
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!item || !formData.locationFound || !formData.description) return;

        const payload = new FormData();
        payload.append('lostItemReportId', item.reportId);
        payload.append('locationFound', formData.locationFound);
        payload.append('description', formData.description);
        if (file) {
            payload.append('photos', file);
        }

        createClaim.mutate(payload as any, {
            onSuccess: () => {
                setIsSuccess(true);
                setShowModal(false);
                toast.success('Laporan penemu berhasil dikirim!');
            },
            onError: () => toast.error('Gagal mengirim laporan'),
        });
    };

    if (isLoading) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div>;
    }

    if (isError || !item) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
                    <Box className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-slate-900 mb-2">QR Tidak Valid</h1>
                    <p className="text-slate-500 text-sm">Kode QR ini tidak valid atau laporan sudah kedaluwarsa.</p>
                </div>
            </div>
        );
    }

    const isResolved = item.status === 'RETURNED' || item.status === 'CLOSED_LOST';

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden">
                <div className="bg-slate-900 h-24 w-full"></div>
                <div className="px-6 pb-6 -mt-12">
                    <div className="bg-white w-24 h-24 rounded-full border-4 border-white shadow-sm flex items-center justify-center mx-auto mb-4">
                        {getItemIcon(item.itemType)}
                    </div>
                    
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{item.itemName}</h1>
                        <p className="text-slate-500 font-medium capitalize text-sm">{item.itemType}</p>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Terakhir Terlihat</p>
                                <p className="text-sm font-semibold text-slate-800">{item.lastSeenLocation}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Waktu Terlihat</p>
                                <p className="text-sm font-semibold text-slate-800">
                                    {format(new Date(item.lastSeenDatetime), 'dd MMMM yyyy, HH:mm', { locale: localeId })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-8 text-center">
                        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hubungi Pemilik</h2>
                        {item.reporter ? (
                            <>
                                <p className="font-bold text-slate-900">{item.reporter.name}</p>
                                <p className="text-sm text-rose-600 font-medium">{item.reporter.email}</p>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500 italic">Informasi pemilik disembunyikan.</p>
                        )}
                    </div>

                    {isSuccess ? (
                        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-center border border-emerald-100">
                            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                            <p className="font-bold text-emerald-800 mb-1">Terima Kasih!</p>
                            <p className="text-xs">Laporan kamu telah kami terima dan akan segera diproses.</p>
                        </div>
                    ) : isResolved ? (
                        <div className="bg-slate-100 text-slate-500 p-4 rounded-xl text-center font-medium text-sm">
                            Barang ini sudah ditemukan. Terima kasih atas perhatiannya!
                        </div>
                    ) : (
                        <button 
                            onClick={handleFoundClick} 
                            className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md flex justify-center items-center gap-2"
                        >
                            Saya Menemukannya →
                        </button>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in-up">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Lapor Penemuan Barang</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi Ditemukan *</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                    placeholder="Contoh: Toilet Lantai 2"
                                    value={formData.locationFound}
                                    onChange={e => setFormData({ ...formData, locationFound: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi Kondisi *</label>
                                <textarea 
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-none h-24"
                                    placeholder="Ceritakan detail saat kamu menemukannya..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1">
                                    <Camera className="w-4 h-4 text-slate-400" /> Foto Barang (Opsional)
                                </label>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={e => setFile(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="submit"
                                    disabled={createClaim.isPending}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {createClaim.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Kirim
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
