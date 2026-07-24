import { useEffect, useState } from 'react';
import { Copy, RefreshCw, Trash2, Tv } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    tvToken: string | null;
}

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

    const handleCopy = (token: string) => {
        navigator.clipboard.writeText(boardUrl(token));
        toast.success('Link disalin ke clipboard');
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
            </p>
            {sites.map((site) => (
                <div key={site.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
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
            ))}
        </div>
    );
}
