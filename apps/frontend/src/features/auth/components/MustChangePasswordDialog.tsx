import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface MustChangePasswordDialogProps {
    currentPassword: string;
    onSuccess: () => void;
}

export const MustChangePasswordDialog: React.FC<MustChangePasswordDialogProps> = ({ currentPassword, onSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const validate = (): string | null => {
        if (newPassword.length < 8) return 'Password minimal 8 karakter.';
        if (newPassword === '123456') return 'Password baru tidak boleh 123456.';
        if (newPassword !== confirm) return 'Konfirmasi password tidak cocok.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const v = validate();
        if (v) { setError(v); return; }
        setError(null);
        setSubmitting(true);
        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            toast.success('Password berhasil diganti');
            onSuccess();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Gagal mengganti password.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Wajib Ganti Password</h2>
                        <p className="text-sm text-slate-500">Demi keamanan, ganti password Anda sebelum lanjut.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="mcp-new" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Password Baru
                        </label>
                        <div className="relative">
                            <input
                                id="mcp-new"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Panjang minimum 8 karakter, tidak boleh 123456.</p>
                    </div>

                    <div>
                        <label htmlFor="mcp-confirm" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Konfirmasi Password
                        </label>
                        <input
                            id="mcp-confirm"
                            type={showPassword ? 'text' : 'password'}
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !newPassword || !confirm}
                        className="w-full px-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                    </button>
                </form>
            </div>
        </div>
    );
};
