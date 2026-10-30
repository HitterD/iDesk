import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Send, TestTube, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { SetHead } from '../components/SettingsParts';

interface MailConfig {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    authRequired: boolean;
    username: string;
    passwordSet: boolean;
    fromAddress: string;
    envelopeFrom: string;
    allowSelfSignedCert: boolean;
}

export const MailSettingsPage = () => {
    const qc = useQueryClient();
    const [showPass, setShowPass] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [testTo, setTestTo] = useState('');
    const [form, setForm] = useState<Partial<MailConfig & { password: string }>>({});

    const { data: config, isLoading } = useQuery({
        queryKey: ['mail-settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings/mail');
            return data as MailConfig;
        },
    });

    // Resync setiap kali server mengirim config baru (mis. setelah Simpan
    // meng-invalidate query). Sebelumnya sinkronisasi hanya terjadi sekali,
    // sehingga form direset ke {} dan tampil kosong sampai halaman dimuat ulang.
    useEffect(() => {
        if (config) {
            setForm({ ...config, password: '' });
        }
    }, [config]);

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
            envelopeFrom: effective.envelopeFrom ?? '',
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

    // mail.kapalapi.co.id menolak pengirim apa pun selain mailbox yang login
    // dengan "550 5.7.0 Authentication rejected" walau domainnya sama, dan
    // memeriksanya di dua tahap terpisah: MAIL FROM (envelope) lalu header
    // From saat DATA. Verifikasi koneksi tetap lolos karena AUTH-nya berhasil.
    const addressOf = (value?: string) =>
        ((value || '').match(/<([^>]+)>/)?.[1] ?? value ?? '').trim().toLowerCase();
    const account = addressOf(effective.username);
    const headerFrom = addressOf(effective.fromAddress);
    const envelope = addressOf(effective.envelopeFrom) || headerFrom;
    const envelopeMismatch = !!account && !!envelope && envelope !== account;
    const headerMismatch = !!account && !!headerFrom && headerFrom !== account;

    return (
        <div className="space-y-6 max-w-3xl">
            <SetHead title="Email" sub="Server SMTP untuk notifikasi dan reply-by-email." />

            {verifyError && (
                <div className="flex gap-3 p-4 bg-warn/10 border border-warn/30 rounded-xl text-sm text-warn-ink">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <strong>Verifikasi gagal:</strong> {verifyError}. Konfigurasi tetap tersimpan.
                    </div>
                </div>
            )}

            <div className="bg-surface rounded-2xl border border-line p-6 space-y-5">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!effective.enabled}
                        onChange={(e) => set('enabled', e.target.checked)}
                        className="w-5 h-5 rounded"
                    />
                    <span className="font-medium text-ink">Aktifkan pengiriman email notifikasi</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-ink-2">Host</label>
                        <input
                            value={effective.host || ''}
                            onChange={(e) => set('host', e.target.value)}
                            placeholder="mail.kapalapi.co.id"
                            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-ink-2">Port</label>
                        <input
                            type="number"
                            value={effective.port ?? 465}
                            onChange={(e) => set('port', Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
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
                        <label className="text-sm font-medium text-ink-2">Username</label>
                        <input
                            value={effective.username || ''}
                            onChange={(e) => set('username', e.target.value)}
                            placeholder="noreply@kapalapi.co.id"
                            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-ink-2">Password</label>
                        <div className="mt-1 relative">
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={(effective as { password?: string }).password || ''}
                                onChange={(e) => set('password', e.target.value)}
                                placeholder={effective.passwordSet ? '••••••••' : ''}
                                className="w-full rounded-lg border border-line bg-surface px-3 py-2 pr-10 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2"
                            >
                                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {effective.passwordSet && <p className="text-xs text-ink-3 mt-1">Kosongkan untuk tidak mengubah</p>}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-ink-2">From address</label>
                    <input
                        value={effective.fromAddress || ''}
                        onChange={(e) => set('fromAddress', e.target.value)}
                        placeholder={account ? '"iDesk Support" <' + account + '>' : '"iDesk Support" <akun@domain>'}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    />
                    {headerMismatch && (
                        <div className="mt-2 flex items-start gap-2 text-xs text-warn-ink">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <div>
                                Header From memakai <strong>{headerFrom}</strong>, sedangkan akun SMTP adalah{' '}
                                <strong>{account}</strong>. Relay seperti mail.kapalapi.co.id menolak pesannya dengan{' '}
                                <em>550 Authentication rejected</em> pada tahap DATA meski verifikasi koneksi berhasil.
                                Nama tampilan bebas, alamatnya yang harus sama.
                                <button
                                    type="button"
                                    onClick={() => set('fromAddress', 'iDesk Support <' + account + '>')}
                                    className="ml-1 underline font-medium hover:no-underline"
                                >
                                    Pakai iDesk Support &lt;{account}&gt;
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <label className="text-sm font-medium text-ink-2">
                        Envelope sender <span className="font-normal text-ink-3">(opsional)</span>
                    </label>
                    <input
                        value={effective.envelopeFrom || ''}
                        onChange={(e) => set('envelopeFrom', e.target.value)}
                        placeholder={account || 'kosongkan untuk memakai From address'}
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-ink-3 mt-1">
                        Alamat pada perintah SMTP <code>MAIL FROM</code>. Isi hanya bila relay menolak
                        pengiriman atas nama From address.
                    </p>
                    {envelopeMismatch && (
                        <div className="mt-2 flex items-start gap-2 text-xs text-warn-ink">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                            <div>
                                Pengiriman memakai <strong>{envelope}</strong> sebagai envelope sender, sedangkan akun
                                SMTP adalah <strong>{account}</strong>. Relay seperti mail.kapalapi.co.id menolaknya
                                dengan <em>550 Authentication rejected</em> pada perintah MAIL FROM meski verifikasi
                                koneksi berhasil.
                                <button
                                    type="button"
                                    onClick={() => set('envelopeFrom', account)}
                                    className="ml-1 underline font-medium hover:no-underline"
                                >
                                    Pakai {account}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                    <button
                        onClick={applyPreset}
                        className="idesk-btn is-soft"
                    >
                        Preset mail.kapalapi.co.id
                    </button>
                    <button
                        onClick={() => verifyMut.mutate()}
                        disabled={verifyMut.isPending}
                        className="idesk-btn is-soft"
                    >
                        {verifyMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />} Verifikasi Koneksi
                    </button>
                    <button
                        onClick={() => saveMut.mutate(buildSavePayload())}
                        disabled={saveMut.isPending}
                        className="idesk-btn is-primary ml-auto"
                    >
                        {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                    </button>
                </div>
            </div>

            <div className="bg-surface rounded-2xl border border-line p-6 space-y-3">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Send className="w-4 h-4" /> Kirim Email Tes
                </h3>
                <p className="text-sm text-ink-2">Mengirim email tes via konfigurasi yang tersimpan.</p>
                <div className="flex gap-2">
                    <input
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder="admin@kapalapi.co.id"
                        className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    />
                    <button
                        onClick={() => testMut.mutate()}
                        disabled={!testTo || testMut.isPending}
                        className="idesk-btn is-soft"
                    >
                        {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MailSettingsPage;
