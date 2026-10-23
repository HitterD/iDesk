import { useEffect, useState } from 'react';
import { Copy, Play, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { resolveAudioUrl } from '@/lib/media';
import { SetHead } from './SettingsParts';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    tvToken: string | null;
    ringtoneNewTicket: string | null;
    ringtoneNewTicketSupport?: string | null;
    ringtoneNewTicketOracle?: string | null;
    ringtoneNewTicketWebDev?: string | null;
    ringtoneNewTicketMobileDev?: string | null;
    ringtoneInProgress: string | null;
    ringtoneClosing: string | null;
    closingTime: string | null;
    tvShowsDevTickets?: boolean;
    tvTheme?: 'light' | 'dark';
}

type RingtoneSlot = 
    | 'newTicket' 
    | 'newTicketSupport'
    | 'newTicketOracle'
    | 'newTicketWebDev'
    | 'newTicketMobileDev'
    | 'inProgress' 
    | 'closing';

interface SlotConfig {
    slot: RingtoneSlot;
    field: keyof Site;
    label: string;
    defaultUrl: string;
    defaultLabel: string;
}

const RINGTONE_SLOTS: SlotConfig[] = [
    { 
        slot: 'newTicketSupport', 
        field: 'ringtoneNewTicketSupport', 
        label: 'Tiket IT Support',
        defaultUrl: '/sounds/divisions/new-ticket-it-support.mp3',
        defaultLabel: 'Bawaan: Chime + "New Ticket IT Support"',
    },
    { 
        slot: 'newTicketOracle', 
        field: 'ringtoneNewTicketOracle', 
        label: 'Tiket Oracle / K2',
        defaultUrl: '/sounds/divisions/new-ticket-oracle.mp3',
        defaultLabel: 'Bawaan: Chime + "New Ticket Oracle K2"',
    },
    { 
        slot: 'newTicketWebDev', 
        field: 'ringtoneNewTicketWebDev', 
        label: 'Tiket Web Dev',
        defaultUrl: '/sounds/divisions/new-ticket-web-dev.mp3',
        defaultLabel: 'Bawaan: Chime + "New Ticket Web Developer"',
    },
    { 
        slot: 'newTicketMobileDev', 
        field: 'ringtoneNewTicketMobileDev', 
        label: 'Tiket Mobile Dev',
        defaultUrl: '/sounds/divisions/new-ticket-mobile-dev.mp3',
        defaultLabel: 'Bawaan: Chime + "New Ticket Mobile Developer"',
    },
    { 
        slot: 'inProgress', 
        field: 'ringtoneInProgress', 
        label: 'In Progress',
        defaultUrl: '/sounds/default/assigned.mp3',
        defaultLabel: 'Bawaan: Chime Assigned',
    },
    { 
        slot: 'closing', 
        field: 'ringtoneClosing', 
        label: 'Jam Pulang',
        defaultUrl: '/sounds/default/new-ticket.mp3',
        defaultLabel: 'Bawaan: Chime Pulang',
    },
];

const NEW_TICKET_DIVISION_SLOTS = new Set<RingtoneSlot>([
    'newTicketSupport',
    'newTicketOracle',
    'newTicketWebDev',
    'newTicketMobileDev',
]);

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
            toast.success('Ringtone kustom dihapus, kembali ke default');
        } catch {
            toast.error('Gagal menghapus ringtone');
        } finally {
            setBusyId(null);
        }
    };

    const handlePreview = (url: string) => {
        const resolved = resolveAudioUrl(url);
        new Audio(resolved).play().catch(() => toast.error('Gagal memutar. Cek apakah file masih ada.'));
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

    const handleShowsDevTickets = async (siteId: string, tvShowsDevTickets: boolean) => {
        setBusyId(siteId);
        try {
            const res = await api.patch(`/sites/${siteId}`, { tvShowsDevTickets });
            replaceSite(res.data);
            toast.success(tvShowsDevTickets ? 'Board menampilkan tiket tim Dev semua site' : 'Board hanya menampilkan tiket Support site ini');
        } catch {
            toast.error('Gagal menyimpan pengaturan board');
        } finally {
            setBusyId(null);
        }
    };

    const handleTheme = async (siteId: string, tvTheme: 'light' | 'dark') => {
        setBusyId(siteId);
        try {
            const res = await api.patch(`/sites/${siteId}`, { tvTheme });
            replaceSite(res.data);
            toast.success(tvTheme === 'dark' ? 'Tema board: Gelap' : 'Tema board: Terang');
        } catch {
            toast.error('Gagal menyimpan tema board');
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return <p className="text-ink-3">Memuat...</p>;
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <SetHead title="TV Board" sub="Tampilan antrian kanban per site untuk layar TV. Ringtone berbunyi per divisi saat tiket masuk, mulai dikerjakan, dan jam pulang; tiap slot punya suara default yang bisa diuji atau ditimpa." />
            {sites.map((site) => (
                <div key={site.id} className="p-4 bg-surface rounded-xl border border-line shadow-xs">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-ink">{site.code} — {site.name}</p>
                            {site.tvToken ? (
                                <p className="text-xs text-ink-2 mt-1 truncate max-w-md">{boardUrl(site.tvToken)}</p>
                            ) : (
                                <p className="text-xs text-ink-3 mt-1">Belum ada link</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {site.tvToken && (
                                <button
                                    onClick={() => handleCopy(site.tvToken!)}
                                    className="p-2 rounded-lg hover:bg-fill"
                                    title="Copy link"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => handleGenerate(site.id)}
                                disabled={busyId === site.id}
                                className="p-2 rounded-lg hover:bg-fill"
                                title="Generate/regenerate"
                            >
                                <RefreshCw className={`w-4 h-4 ${busyId === site.id ? 'animate-spin' : ''}`} />
                            </button>
                            {site.tvToken && (
                                <button
                                    onClick={() => handleRevoke(site.id)}
                                    disabled={busyId === site.id}
                                    className="p-2 rounded-lg hover:bg-bad/10 text-bad-ink"
                                    title="Revoke"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <label className="mt-4 flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={Boolean(site.tvShowsDevTickets)}
                            disabled={busyId === site.id}
                            onChange={(e) => handleShowsDevTickets(site.id, e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-brand"
                        />
                        <span>
                            <span className="block text-sm font-medium text-ink">Site ini menampilkan tiket tim Dev semua site</span>
                            <span className="block text-xs text-ink-2">
                                Tiket Oracle/K2, Web Dev, dan Mobile Dev dari semua site muncul di board ini (beserta label site asal). Board site lain hanya menampilkan tiket Support miliknya.
                            </span>
                        </span>
                    </label>

                    <label className="mt-3 flex items-center gap-3">
                        <span className="text-sm font-medium text-ink">Tema tampilan</span>
                        <select
                            data-testid={`tv-theme-${site.id}`}
                            value={site.tvTheme ?? 'light'}
                            disabled={busyId === site.id}
                            onChange={(e) => handleTheme(site.id, e.target.value as 'light' | 'dark')}
                            className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink"
                        >
                            <option value="light">Terang (Light)</option>
                            <option value="dark">Gelap (Dark)</option>
                        </select>
                        <span className="text-xs text-ink-2">Default untuk layar TV; tiap layar bisa mengganti sendiri lewat tombol di board.</span>
                    </label>

                    <div className="mt-4 pt-4 border-t border-line space-y-2.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Pengaturan Suara Notifikasi Per Divisi</span>
                        </div>
                        {RINGTONE_SLOTS.map(({ slot, field, label, defaultUrl, defaultLabel }) => {
                            const ownUrl = site[field] as string | null;
                            // An empty division slot still plays the older site-wide "Tiket Masuk" upload, so show it.
                            const inheritsGeneral = !ownUrl && NEW_TICKET_DIVISION_SLOTS.has(slot) && !!site.ringtoneNewTicket;
                            const url = ownUrl || (inheritsGeneral ? site.ringtoneNewTicket : null);
                            const clearSlot: RingtoneSlot = inheritsGeneral ? 'newTicket' : slot;
                            const activeUrl = url || defaultUrl;

                            return (
                                <div key={slot} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-fill transition-colors">
                                    <span className="text-sm font-medium text-ink w-36 shrink-0">{label}</span>
                                    {url ? (
                                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                            <span className="px-1.5 py-0.5 rounded bg-brand/15 text-brand text-[10px] font-bold shrink-0">
                                                {inheritsGeneral ? 'Kustom umum' : 'Kustom'}
                                            </span>
                                            <span className="text-xs text-ink-2 truncate" title={url}>
                                                {url}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-ink-3 truncate flex-1 italic">
                                            {defaultLabel}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => handlePreview(activeUrl)}
                                            className="p-2 rounded-lg hover:bg-fill-2 text-brand transition-colors"
                                            title={url ? "Uji dengar ringtone kustom" : "Uji dengar suara bawaan (default)"}
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <label
                                            className="p-2 rounded-lg hover:bg-fill-2 cursor-pointer text-ink-2 transition-colors"
                                            title="Unggah ringtone kustom"
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
                                                onClick={() => handleClearRingtone(site.id, clearSlot)}
                                                disabled={busyId === site.id}
                                                className="p-2 rounded-lg hover:bg-bad/10 text-bad-ink transition-colors"
                                                title={inheritsGeneral
                                                    ? 'Hapus kustom umum (berlaku untuk semua divisi yang belum punya suara sendiri)'
                                                    : 'Hapus kustom (kembali ke bawaan)'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <span className="text-sm font-medium text-ink w-36 shrink-0">Jam pulang</span>
                            <input
                                type="time"
                                defaultValue={site.closingTime ?? ''}
                                onBlur={(e) => handleClosingTime(site.id, e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-line bg-transparent text-sm text-ink"
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
