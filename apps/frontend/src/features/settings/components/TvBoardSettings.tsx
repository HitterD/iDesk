import { useEffect, useState } from 'react';
import { Copy, Play, RefreshCw, Trash2, Tv, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    tvToken: string | null;
    ringtoneNewTicket: string | null;
    ringtoneInProgress: string | null;
    ringtoneClosing: string | null;
    closingTime: string | null;
}

type RingtoneSlot = 'newTicket' | 'inProgress' | 'closing';

const RINGTONE_SLOTS: Array<{ slot: RingtoneSlot; field: keyof Site; label: string }> = [
    { slot: 'newTicket', field: 'ringtoneNewTicket', label: 'Tiket Masuk' },
    { slot: 'inProgress', field: 'ringtoneInProgress', label: 'In Progress' },
    { slot: 'closing', field: 'ringtoneClosing', label: 'Jam Pulang' },
];

export function TvBoardSettings() {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchSites = async () => {
        setLoading(true);
        try {
            const res = await api.get('/sites');
            setSites(Array.isArray(res.data) ? res.data : []);
        } catch {
            toast.error('Gagal memuat daftar site');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSites();
    }, []);

    const boardUrl = (token: string) => `${window.location.origin}/tv/${token}`;

    const handleGenerate = async (siteId: string) => {
        setBusyId(siteId);
        try {
            const res = await api.post(`/sites/${siteId}/tv-token`);
            setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, tvToken: res.data.tvToken } : s)));
            toast.success('Token TV board berhasil dibuat');
        } catch {
            toast.error('Gagal membuat token');
        } finally {
            setBusyId(null);
        }
    };

    const handleRevoke = async (siteId: string) => {
        setBusyId(siteId);
        try {
            await api.delete(`/sites/${siteId}/tv-token`);
            setSites((prev) => prev.map((s) => (s.id === siteId ? { ...s, tvToken: null } : s)));
            toast.success('Token TV board dicabut');
        } catch {
            toast.error('Gagal mencabut token');
        } finally {
            setBusyId(null);
        }
    };

    const handleCopy = async (token: string) => {
        const url = boardUrl(token);
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const input = document.createElement('textarea');
                input.value = url;
                input.style.position = 'fixed';
                input.style.left = '-999999px';
                document.body.appendChild(input);
                input.select();
                const copied = document.execCommand('copy');
                document.body.removeChild(input);
                if (!copied) throw new Error('Copy command failed');
            }
            toast.success('Link disalin ke clipboard');
        } catch {
            toast.error('Gagal menyalin link. Salin URL secara manual.');
        }
    };

    const replaceSite = (updated: Site) =>
        setSites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

    const handleUploadRingtone = async (siteId: string, slot: RingtoneSlot, file: File) => {
        const form = new FormData();
        form.append('file', file);
        form.append('slot', slot);
        setBusyId(siteId);
        try {
            const res = await api.post(`/sites/${siteId}/tv-ringtone`, form);
            replaceSite(res.data);
            toast.success('Ringtone berhasil diunggah');
        } catch {
            toast.error('Gagal mengunggah ringtone. Pastikan file audio dan maksimal 5MB.');
        } finally {
            setBusyId(null);
        }
    };

    const handleClearRingtone = async (siteId: string, slot: RingtoneSlot) => {
        setBusyId(siteId);
        try {
            const res = await api.delete(`/sites/${siteId}/tv-ringtone/${slot}`);
            replaceSite(res.data);
            toast.success('Ringtone dihapus');
        } catch {
            toast.error('Gagal menghapus ringtone');
        } finally {
            setBusyId(null);
        }
    };

    const handlePreview = (url: string) => {
        new Audio(url).play().catch(() => toast.error('Gagal memutar. Cek apakah file masih ada.'));
    };

    const handleClosingTime = async (siteId: string, closingTime: string) => {
        try {
            const res = await api.patch(`/sites/${siteId}`, { closingTime: closingTime || null });
            replaceSite(res.data);
            toast.success('Jam pulang disimpan');
        } catch {
            toast.error('Gagal menyimpan jam pulang');
        }
    };

    if (loading) {
        return <p className="text-slate-400">Memuat...</p>;
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                <Tv className="w-6 h-6" /> TV Board
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                Generate link kanban tiket per site untuk ditayangkan di layar TV. Generate ulang akan otomatis membatalkan link lama.
                Ringtone diputar di halaman TV saat tiket masuk, saat tiket mulai dikerjakan, dan pada jam pulang.
                Agar suara berbunyi tanpa klik, jalankan browser TV dengan flag <code>--autoplay-policy=no-user-gesture-required</code>.
            </p>
            {sites.map((site) => (
                <div key={site.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white">{site.code} — {site.name}</p>
                            {site.tvToken ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate max-w-md">{boardUrl(site.tvToken)}</p>
                            ) : (
                                <p className="text-xs text-slate-400 mt-1">Belum ada link</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {site.tvToken && (
                                <button
                                    onClick={() => handleCopy(site.tvToken!)}
                                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                    title="Copy link"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => handleGenerate(site.id)}
                                disabled={busyId === site.id}
                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Generate/regenerate"
                            >
                                <RefreshCw className={`w-4 h-4 ${busyId === site.id ? 'animate-spin' : ''}`} />
                            </button>
                            {site.tvToken && (
                                <button
                                    onClick={() => handleRevoke(site.id)}
                                    disabled={busyId === site.id}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                                    title="Revoke"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
                        {RINGTONE_SLOTS.map(({ slot, field, label }) => {
                            const url = site[field] as string | null;
                            return (
                                <div key={slot} className="flex items-center justify-between gap-3">
                                    <span className="text-sm text-slate-600 dark:text-slate-300 w-28 shrink-0">{label}</span>
                                    <span className="text-xs text-slate-400 truncate flex-1">
                                        {url ?? 'Belum ada ringtone'}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {url && (
                                            <button
                                                onClick={() => handlePreview(url)}
                                                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                                                title="Uji dengar"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                        <label
                                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                                            title="Unggah ringtone"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleUploadRingtone(site.id, slot, file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                        {url && (
                                            <button
                                                onClick={() => handleClearRingtone(site.id, slot)}
                                                disabled={busyId === site.id}
                                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                                                title="Hapus ringtone"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <span className="text-sm text-slate-600 dark:text-slate-300 w-28 shrink-0">Jam pulang</span>
                            <input
                                type="time"
                                defaultValue={site.closingTime ?? ''}
                                onBlur={(e) => handleClosingTime(site.id, e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm text-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
