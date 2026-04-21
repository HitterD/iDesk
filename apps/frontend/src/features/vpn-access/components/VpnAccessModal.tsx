import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Calendar, User, Mail, MapPin, FileText, ChevronDown, Activity } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { VpnAccess, useCreateVpnAccess, useUpdateVpnAccess } from '../hooks/useVpnAccess';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vpnAccess?: VpnAccess | null;
}

interface FormData {
    area: 'Karawang' | 'Jakarta' | 'Sepanjang' | 'Semarang';
    namaUser: string;
    emailUser?: string;
    tanggalAktif: string;
    tanggalNonAktif: string;
    statusCreateVpn: 'Selesai' | 'Proses' | 'Batal' | 'Non Aktif';
    keteranganNonAktifVpn?: string;
}

export function VpnAccessModal({ isOpen, onClose, vpnAccess }: Props) {
    const createVpn = useCreateVpnAccess();
    const updateVpn = useUpdateVpnAccess();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
        defaultValues: {
            area: 'Karawang',
            statusCreateVpn: 'Proses',
        },
    });

    useEffect(() => {
        if (vpnAccess) {
            reset({
                area: vpnAccess.area,
                namaUser: vpnAccess.namaUser,
                emailUser: vpnAccess.emailUser || '',
                tanggalAktif: vpnAccess.tanggalAktif.split('T')[0],
                tanggalNonAktif: vpnAccess.tanggalNonAktif.split('T')[0],
                statusCreateVpn: vpnAccess.statusCreateVpn,
                keteranganNonAktifVpn: vpnAccess.keteranganNonAktifVpn || '',
            });
        } else {
            reset({
                area: 'Karawang',
                namaUser: '',
                emailUser: '',
                tanggalAktif: new Date().toISOString().split('T')[0],
                tanggalNonAktif: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                statusCreateVpn: 'Proses',
                keteranganNonAktifVpn: '',
            });
        }
    }, [vpnAccess, reset]);

    const onSubmit = async (data: FormData) => {
        try {
            if (vpnAccess) {
                await updateVpn.mutateAsync({ id: vpnAccess.id, data });
                toast.success('VPN access berhasil diupdate');
            } else {
                await createVpn.mutateAsync(data);
                toast.success('VPN access berhasil ditambahkan');
            }
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Terjadi kesalahan');
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
                        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20">
                            <div className="flex items-center gap-3">
                                <Shield className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                                    {vpnAccess ? 'Edit VPN Access' : 'Tambah VPN Access'}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Area & Nama User */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <MapPin className="w-4 h-4 inline mr-1 text-slate-400" />
                                        Area *
                                    </label>
                                    <div className="relative">
                                        <select
                                            {...register('area', { required: 'Area wajib diisi' })}
                                            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                        >
                                            <option value="Karawang">Karawang</option>
                                            <option value="Jakarta">Jakarta</option>
                                            <option value="Sepanjang">Sepanjang</option>
                                            <option value="Semarang">Semarang</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    {errors.area && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.area.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <User className="w-4 h-4 inline mr-1 text-slate-400" />
                                        Nama User *
                                    </label>
                                    <input
                                        {...register('namaUser', { required: 'Nama wajib diisi' })}
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="John Doe"
                                    />
                                    {errors.namaUser && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.namaUser.message}</p>}
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <Mail className="w-4 h-4 inline mr-1 text-slate-400" />
                                    Email User
                                </label>
                                <input
                                    {...register('emailUser')}
                                    type="email"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    placeholder="john@example.com"
                                />
                            </div>

                            {/* Valid From & Until */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1 text-slate-400" />
                                        Tanggal Aktif *
                                    </label>
                                    <input
                                        {...register('tanggalAktif', { required: 'Tanggal aktif wajib diisi' })}
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1 text-slate-400" />
                                        Tanggal Non Aktif *
                                    </label>
                                    <input
                                        {...register('tanggalNonAktif', { required: 'Tanggal non aktif wajib diisi' })}
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Status Create VPN */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <Activity className="w-4 h-4 inline mr-1 text-slate-400" />
                                    Status Create VPN *
                                </label>
                                <div className="relative">
                                    <select
                                        {...register('statusCreateVpn', { required: true })}
                                        className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="Proses">Proses</option>
                                        <option value="Selesai">Selesai</option>
                                        <option value="Batal">Batal</option>
                                        <option value="Non Aktif">Non Aktif</option>
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* Keterangan Non Aktif VPN */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <FileText className="w-4 h-4 inline mr-1 text-slate-400" />
                                    Keterangan Non Aktif VPN
                                </label>
                                <textarea
                                    {...register('keteranganNonAktifVpn')}
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                                    placeholder="Alasan non aktif (opsional)... Jika diisi dan melewati batas waktu, VPN akan otomatis archived."
                                />
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl transition-colors"
                            >
                                Batal
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isSubmitting}
                                onClick={handleSubmit(onSubmit)}
                                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-shadow disabled:opacity-50"
                            >
                                {isSubmitting ? 'Menyimpan...' : vpnAccess ? 'Update' : 'Simpan'}
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
