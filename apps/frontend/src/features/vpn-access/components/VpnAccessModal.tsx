import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Calendar, User, Mail, Building2, MapPin, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { VpnAccess, useCreateVpnAccess, useUpdateVpnAccess } from '../hooks/useVpnAccess';
import { toast } from 'sonner';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vpnAccess?: VpnAccess | null;
}

interface FormData {
    username: string;
    fullName: string;
    email?: string;
    department?: string;
    site?: string;
    vpnType: 'SITE_TO_SITE' | 'CLIENT' | 'SSL';
    vpnProfile?: string;
    validFrom: string;
    validUntil: string;
    purpose?: string;
    reminderDays?: string;
    notes?: string;
}

export function VpnAccessModal({ isOpen, onClose, vpnAccess }: Props) {
    const createVpn = useCreateVpnAccess();
    const updateVpn = useUpdateVpnAccess();

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
        defaultValues: {
            vpnType: 'CLIENT',
            reminderDays: '60,30,7,1',
        },
    });

    useEffect(() => {
        if (vpnAccess) {
            reset({
                username: vpnAccess.username,
                fullName: vpnAccess.fullName,
                email: vpnAccess.email || '',
                department: vpnAccess.department || '',
                site: vpnAccess.site || '',
                vpnType: vpnAccess.vpnType,
                vpnProfile: vpnAccess.vpnProfile || '',
                validFrom: vpnAccess.validFrom.split('T')[0],
                validUntil: vpnAccess.validUntil.split('T')[0],
                purpose: vpnAccess.purpose || '',
                reminderDays: vpnAccess.reminderDays || '60,30,7,1',
                notes: vpnAccess.notes || '',
            });
        } else {
            reset({
                username: '',
                fullName: '',
                email: '',
                department: '',
                site: '',
                vpnType: 'CLIENT',
                vpnProfile: '',
                validFrom: new Date().toISOString().split('T')[0],
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                purpose: '',
                reminderDays: '60,30,7,1',
                notes: '',
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
                        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                            <div className="flex items-center gap-3">
                                <Shield className="w-6 h-6 text-cyan-400" />
                                <h2 className="text-xl font-semibold text-white">
                                    {vpnAccess ? 'Edit VPN Access' : 'Tambah VPN Access'}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Username & Full Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <User className="w-4 h-4 inline mr-1" />
                                        Username VPN *
                                    </label>
                                    <input
                                        {...register('username', { required: 'Username wajib diisi' })}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="vpn-username"
                                    />
                                    {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Nama Lengkap *
                                    </label>
                                    <input
                                        {...register('fullName', { required: 'Nama wajib diisi' })}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="John Doe"
                                    />
                                    {errors.fullName && <p className="text-red-400 text-sm mt-1">{errors.fullName.message}</p>}
                                </div>
                            </div>

                            {/* Email & Department */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <Mail className="w-4 h-4 inline mr-1" />
                                        Email
                                    </label>
                                    <input
                                        {...register('email')}
                                        type="email"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        Department
                                    </label>
                                    <input
                                        {...register('department')}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="IT Department"
                                    />
                                </div>
                            </div>

                            {/* Site & VPN Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <MapPin className="w-4 h-4 inline mr-1" />
                                        Site
                                    </label>
                                    <input
                                        {...register('site')}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                        placeholder="SPJ, BSD, SMG..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Tipe VPN *
                                    </label>
                                    <select
                                        {...register('vpnType', { required: true })}
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                    >
                                        <option value="CLIENT">Client VPN</option>
                                        <option value="SSL">SSL VPN</option>
                                        <option value="SITE_TO_SITE">Site-to-Site</option>
                                    </select>
                                </div>
                            </div>

                            {/* VPN Profile */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    WatchGuard Profile
                                </label>
                                <input
                                    {...register('vpnProfile')}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    placeholder="Nama profile WatchGuard"
                                />
                            </div>

                            {/* Valid From & Until */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Valid Dari *
                                    </label>
                                    <input
                                        {...register('validFrom', { required: 'Tanggal wajib diisi' })}
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Valid Sampai *
                                    </label>
                                    <input
                                        {...register('validUntil', { required: 'Tanggal wajib diisi' })}
                                        type="date"
                                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    />
                                </div>
                            </div>

                            {/* Reminder Days */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Reminder Days (comma-separated)
                                </label>
                                <input
                                    {...register('reminderDays')}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20"
                                    placeholder="60,30,7,1"
                                />
                                <p className="text-slate-500 text-xs mt-1">Hari sebelum expired untuk kirim reminder (D-60, D-30, dst.)</p>
                            </div>

                            {/* Purpose */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    <FileText className="w-4 h-4 inline mr-1" />
                                    Tujuan/Alasan
                                </label>
                                <textarea
                                    {...register('purpose')}
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                                    placeholder="Alasan akses VPN..."
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Catatan
                                </label>
                                <textarea
                                    {...register('notes')}
                                    rows={2}
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 resize-none"
                                    placeholder="Catatan tambahan..."
                                />
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
