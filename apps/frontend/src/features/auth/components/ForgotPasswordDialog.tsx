import React, { useState } from 'react';
import { KeyRound, X, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface ForgotPasswordDialogProps {
    onClose: () => void;
}

const inputClass = 'w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white';

/** An identifier with "@" is the registered email (forgotten NIK); anything else is a NIK. */
const isEmailIdentifier = (value: string) => value.includes('@');

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({ onClose }) => {
    const [identifier, setIdentifier] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const byEmail = isEmailIdentifier(identifier);
    const canSubmit = identifier.trim().length > 0 && (byEmail || email.trim().length > 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await api.post(
                '/auth/forgot-password',
                { identifier: identifier.trim(), ...(byEmail ? {} : { email: email.trim() }) },
                { skipToast: true },
            );
            setSentTo((res.data as { sentTo: string }).sentTo);
        } catch (err: any) {
            const raw = err?.response?.data?.message;
            setError((Array.isArray(raw) ? raw[0] : raw) || 'Gagal reset password. Silakan coba lagi.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="fp-title">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <KeyRound className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h2 id="fp-title" className="text-lg font-bold text-slate-800 dark:text-white">Lupa Password</h2>
                        <p className="text-sm text-slate-500">Password sementara akan dikirim ke email.</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Tutup">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {sentTo ? (
                    <div className="p-6 space-y-4">
                        <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-sm text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <span>Password sementara telah dikirim ke <strong>{sentTo}</strong>. Login dengan password tersebut, lalu Anda akan diminta menggantinya.</span>
                        </div>
                        <button type="button" onClick={onClose} className="w-full px-4 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors">
                            Kembali ke Login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div role="alert" className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="fp-identifier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                NIK HRIS
                            </label>
                            <input id="fp-identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className={inputClass} placeholder="NIK HRIS" autoComplete="username" autoFocus />
                            <p className="text-xs text-slate-400 mt-1">Lupa NIK? Masukkan email yang terdaftar di akun Anda.</p>
                        </div>

                        {!byEmail && (
                            <div>
                                <label htmlFor="fp-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Kirim ke Email
                                </label>
                                <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="email@contoh.com" autoComplete="email" />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || !canSubmit}
                            className="w-full px-4 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Mengirim...' : 'Kirim Password Baru'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
