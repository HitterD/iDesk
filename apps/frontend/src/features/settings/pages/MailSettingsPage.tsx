import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Save, Send, TestTube, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface MailConfig {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    authRequired: boolean;
    username: string;
    passwordSet: boolean;
    fromAddress: string;
    allowSelfSignedCert: boolean;
}

export const MailSettingsPage = () => {
    const qc = useQueryClient();
    const [showPass, setShowPass] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [testTo, setTestTo] = useState('');
    const [form, setForm] = useState<Partial<MailConfig & { password: string }>>({});
    const [initialized, setInitialized] = useState(false);

    const { data: config, isLoading } = useQuery({
        queryKey: ['mail-settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings/mail');
            return data as MailConfig;
        },
    });

    useEffect(() => {
        if (config && !initialized) {
            setForm({ ...config, password: '' });
            setInitialized(true);
        }
    }, [config, initialized]);

    const effective: Partial<MailConfig & { password: string }> =
        Object.keys(form).length ? form : config ? { ...config, password: '' } : {};

    // Backend memakai ValidationPipe forbidNonWhitelisted, jadi payload harus
    // dibatasi tepat pada field yang dideklarasikan DTO-nya.
    const buildSavePayload = (): Record<string, unknown> => {
        const payload: Record<string, unknown> = {
            enabled: !!effective.enabled,
            host: effective.host ?? '',
            port: Number(effective.port ?? 465),
            secure: !!effective.secure,
            authRequired: !!effective.authRequired,
            username: effective.username ?? '',
            fromAddress: effective.fromAddress ?? '',
            allowSelfSignedCert: !!effective.allowSelfSignedCert,
        };
        if (effective.password) payload.password = effective.password;
        return payload;
    };

    const buildVerifyPayload = (): Record<string, unknown> => {
        const { enabled: _enabled, fromAddress: _fromAddress, ...rest } = buildSavePayload();
        return rest;
    };

    const saveMut = useMutation({
        mutationFn: async (payload: Record<string, unknown>) => {
            const { data } = await api.patch('/settings/mail', payload);
            return data;
        },
        onSuccess: (res) => {
            qc.invalidateQueries({ queryKey: ['mail-settings'] });
            setForm({});
            setInitialized(false);
            if (res.verifyFailed) {
                setVerifyError(res.verifyError || 'Koneksi SMTP gagal diverifikasi');
                toast.warning('Tersimpan, tapi verifikasi SMTP gagal: ' + (res.verifyError || 'unknown'));
            } else {
                setVerifyError(null);
                toast.success('Konfigurasi email tersimpan');
            }
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal menyimpan';
            toast.error(msg);
        },
    });

    const verifyMut = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/settings/mail/verify', buildVerifyPayload());
            return data as { success: boolean; error?: string };
        },
        onSuccess: (res) => {
            if (res.success) toast.success('Koneksi SMTP berhasil');
            else toast.error('Verifikasi gagal: ' + (res.error || 'unknown'));
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Verifikasi gagal';
            toast.error(msg);
        },
    });

    const testMut = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/settings/mail/test', { to: testTo });
            return data as { success: boolean; error?: string; skipped?: boolean };
        },
        onSuccess: (res) => {
            if (res.success) toast.success('Email tes terkirim ke ' + testTo);
            else toast.error(res.error || 'Gagal mengirim email tes');
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal mengirim email tes';
            toast.error(msg);
        },
    });

    const applyPreset = () => {
        setForm((p) => ({ ...p, host: 'mail.kapalapi.co.id', port: 465, secure: true, authRequired: true }));
        toast.info('Preset mail.kapalapi.co.id diterapkan');
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Email (SMTP)</h1>
                    <p className="text-sm text-slate-500">Konfigurasi pengiriman email notifikasi</p>
                </div>
            </div>

            {verifyError && (
                <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <strong>Verifikasi gagal:</strong> {verifyError}. Konfigurasi tetap tersimpan.
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!effective.enabled}
                        onChange={(e) => set('enabled', e.target.checked)}
                        className="w-5 h-5 rounded"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200">Aktifkan pengiriman email notifikasi</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Host</label>
                        <input
                            value={effective.host || ''}
                            onChange={(e) => set('host', e.target.value)}
                            placeholder="mail.kapalapi.co.id"
                            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Port</label>
                        <input
                            type="number"
                            value={effective.port ?? 465}
                            onChange={(e) => set('port', Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!effective.secure} onChange={(e) => set('secure', e.target.checked)} />
                        Implicit TLS (465)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!effective.authRequired} onChange={(e) => set('authRequired', e.target.checked)} />
                        Butuh autentikasi
                    </label>
                    <label className="flex items-center gap-2 text-sm" title="Hanya untuk relay self-signed cert">
                        <input
                            type="checkbox"
                            checked={!!effective.allowSelfSignedCert}
                            onChange={(e) => set('allowSelfSignedCert', e.target.checked)}
                        />
                        Allow self-signed cert
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Username</label>
                        <input
                            value={effective.username || ''}
                            onChange={(e) => set('username', e.target.value)}
                            placeholder="noreply@kapalapi.co.id"
                            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Password</label>
                        <div className="mt-1 relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={(effective as { password?: string }).password || ''}
                                onChange={(e) => set('password', e.target.value)}
                                placeholder={effective.passwordSet ? '••••••••' : ''}
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 pr-10 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {effective.passwordSet && <p className="text-xs text-slate-400 mt-1">Kosongkan untuk tidak mengubah</p>}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">From address</label>
                    <input
                        value={effective.fromAddress || ''}
                        onChange={(e) => set('fromAddress', e.target.value)}
                        placeholder={'"iDesk" <noreply@kapalapi.co.id>'}
                        className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    <button
                        onClick={applyPreset}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        Preset mail.kapalapi.co.id
                    </button>
                    <button
                        onClick={() => verifyMut.mutate()}
                        disabled={verifyMut.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                        {verifyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />} Verifikasi Koneksi
                    </button>
                    <button
                        onClick={() => saveMut.mutate(buildSavePayload())}
                        disabled={saveMut.isPending}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 ml-auto"
                    >
                        {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <Send className="w-4 h-4" /> Kirim Email Tes
                </h3>
                <p className="text-sm text-slate-500">Mengirim email tes via konfigurasi yang tersimpan.</p>
                <div className="flex gap-2">
                    <input
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder="admin@kapalapi.co.id"
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                    <button
                        onClick={() => testMut.mutate()}
                        disabled={!testTo || testMut.isPending}
                        className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium disabled:opacity-50"
                    >
                        {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MailSettingsPage;
