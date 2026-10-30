import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, X, CheckCircle2, IdCard, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import '../auth.css';

interface ForgotPasswordDialogProps {
    onClose: () => void;
}

const FALLBACK_ERROR = 'Gagal reset password. Silakan coba lagi.';
const VISIBLE_LOCAL_CHARS = 2;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** "budi.santoso@kapalapi.co.id" → "bu***@kapalapi.co.id": confirms the inbox without echoing it in full. */
export const maskEmail = (email: string): string => {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.slice(0, VISIBLE_LOCAL_CHARS)}***@${domain}`;
};

const FieldIcon: React.FC<{ icon: React.ElementType }> = ({ icon: Icon }) => (
    <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--idesk-text-secondary))]" aria-hidden="true" />
);

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({ onClose }) => {
    const [nik, setNik] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const dismiss = () => { if (!submitting) onClose(); };
    useFocusTrap(dialogRef, { onEscape: dismiss });

    const canSubmit = nik.trim().length > 0 && email.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setSubmitting(true);
        try {
            const res = await api.post(
                '/auth/forgot-password',
                { identifier: nik.trim(), email: email.trim() },
                { skipToast: true },
            );
            setSentTo((res.data as { sentTo: string }).sentTo);
        } catch (err: any) {
            const raw = err?.response?.data?.message;
            setError((Array.isArray(raw) ? raw[0] : raw) || FALLBACK_ERROR);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={dismiss}
        >
            <motion.div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="fp-title"
                aria-describedby="fp-desc"
                className="w-full max-w-md overflow-hidden rounded-[20px] border border-[hsl(var(--idesk-border))] bg-[hsl(var(--idesk-surface))] text-[hsl(var(--idesk-text))] shadow-2xl"
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 border-b border-[hsl(var(--idesk-border))] px-6 py-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--idesk-sapphire)/0.12)]">
                        <KeyRound className="h-5 w-5 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 id="fp-title" className="text-base font-semibold">Lupa Password</h2>
                        <p id="fp-desc" className="mt-0.5 text-[13px] text-[hsl(var(--idesk-text-secondary))]">
                            {sentTo ? 'Password sementara sudah dikirim.' : 'Verifikasi akun Anda dengan NIK dan email yang terdaftar.'}
                        </p>
                    </div>
                    <Button variant="subtle" size="icon" type="button" onClick={dismiss} disabled={submitting} aria-label="Tutup">
                        <X aria-hidden="true" />
                    </Button>
                </div>

                {sentTo ? (
                    <motion.div className="space-y-4 p-6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: EASE_OUT }}>
                        <div className="flex items-start gap-3 rounded-xl bg-[hsl(var(--ticket-green)/0.12)] p-3.5 text-[13px] leading-relaxed text-[hsl(var(--ticket-green-ink))]">
                            <CheckCircle2 className="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>
                                Password sementara dikirim ke <strong>{maskEmail(sentTo)}</strong>. Login dengan password tersebut,
                                lalu Anda akan diminta membuat password baru.
                            </span>
                        </div>
                        <Button variant="primary" size="lg" type="button" onClick={onClose} className="w-full">
                            Kembali ke Login
                        </Button>
                    </motion.div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4 p-6" noValidate>
                        <div className="flex items-start gap-2.5 rounded-xl bg-[hsl(var(--idesk-selection))] p-3 text-[12.5px] leading-relaxed">
                            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />
                            <span>
                                Kami mencocokkan <strong>NIK</strong> dan <strong>email</strong> Anda dengan data HRIS Anda.
                                Jika cocok, password sementara dikirim ke email terdaftar tersebut.
                            </span>
                        </div>

                        {error && (
                            <div role="alert" className="flex items-start gap-2.5 rounded-xl bg-[hsl(var(--ticket-red)/0.1)] p-3 text-[13px] text-[hsl(var(--ticket-red-ink))]">
                                <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="fp-nik" className="auth-label">NIK HRIS</label>
                            <div className="relative">
                                <FieldIcon icon={IdCard} />
                                <input id="fp-nik" type="text" inputMode="numeric" value={nik} onChange={(e) => setNik(e.target.value)}
                                    className="auth-input has-icon" placeholder="Contoh: 12345" autoComplete="username" autoFocus
                                    aria-invalid={!!error || undefined} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="fp-email" className="auth-label">Email terdaftar</label>
                            <div className="relative">
                                <FieldIcon icon={Mail} />
                                <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="auth-input has-icon" placeholder="nama@kapalapi.co.id" autoComplete="email"
                                    aria-invalid={!!error || undefined} />
                            </div>
                        </div>

                        <Button variant="primary" size="lg" type="submit" className="w-full" loading={submitting} disabled={!canSubmit}>
                            {submitting ? 'Mencocokkan data…' : 'Kirim Password Sementara'}
                        </Button>
                        <p className="text-center text-[12px] text-[hsl(var(--idesk-text-secondary))]">
                            Lupa email yang terdaftar? Hubungi tim IT.
                        </p>
                    </form>
                )}
            </motion.div>
        </motion.div>
    );
};
