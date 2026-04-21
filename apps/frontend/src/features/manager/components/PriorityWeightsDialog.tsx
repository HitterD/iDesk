import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { workloadApi } from '@/lib/api/workload.api';
import { toast } from 'sonner';

const DEFAULT_WEIGHTS: Record<string, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 4,
    CRITICAL: 8,
    HARDWARE_INSTALLATION: 3,
};

export const PriorityWeightsDialog = () => {
    const [open, setOpen] = useState(false);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchWeights();
        }
    }, [open]);

    const fetchWeights = async () => {
        setLoading(true);
        try {
            const res = await workloadApi.getPriorityWeights();

            // Backend returns an array of { priority: string, points: number }
            // If empty, use DEFAULT_WEIGHTS
            let mapping: Record<string, number> = {};

            if (Array.isArray(res.data) && res.data.length > 0) {
                res.data.forEach((item: any) => {
                    mapping[item.priority] = item.points;
                });

                // Merge with defaults for any missing keys
                mapping = { ...DEFAULT_WEIGHTS, ...mapping };
            } else {
                mapping = { ...DEFAULT_WEIGHTS };
            }

            setWeights(mapping);
        } catch (err: any) {
            toast.error('Gagal mengambil pengaturan bobot prioritas');
            console.error(err);
            // Fallback to default
            setWeights({ ...DEFAULT_WEIGHTS });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Update weights using concurrent promises
            await Promise.all(
                Object.entries(weights).map(([priority, weight]) =>
                    workloadApi.updatePriorityWeight(priority, { points: Number(weight) })
                )
            );
            toast.success('Pengaturan bobot poin berhasil disimpan');
            setOpen(false);
            window.location.reload(); // Quick refresh to apply globally
        } catch (err: any) {
            toast.error('Gagal menyimpan bobot prioritas');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const getPriorityColor = (key: string) => {
        if (key.includes('CRITICAL')) return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900';
        if (key.includes('HIGH')) return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-900';
        if (key.includes('MEDIUM')) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900';
        if (key.includes('HARDWARE')) return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900';
        return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900';
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 shrink-0 rounded-xl bg-[hsl(var(--card))] hover:bg-slate-50 dark:hover:bg-slate-800/50 border-[hsl(var(--border))] shadow-sm text-slate-700 dark:text-slate-300">
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span className="font-medium">Pengaturan Bobot</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-xl border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl">
                <div className="bg-slate-50/50 dark:bg-slate-900/20 p-5 border-b border-[hsl(var(--border))]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Settings className="w-5 h-5 text-primary" />
                            Bobot Prioritas Tiket
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500 pt-1">
                            Sesuaikan poin beban kalibrasi. Angka yang lebih tinggi berarti tugas tersebut lebih "berat" untuk Agen.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-5 bg-[hsl(var(--card))]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                            <RefreshCw className="animate-spin text-primary w-8 h-8 opacity-50" />
                            <p className="text-sm font-medium">Memuat konfigurasi...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-900/50 mb-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>Sistem akan mengalokasikan tiket baru ke Agen dengan akumulasi total bobot paling rendah.</p>
                            </div>

                            {Object.entries(weights).map(([key, value]) => (
                                <div className="group flex items-center justify-between gap-4 p-3 rounded-lg border border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-900/50 hover:bg-[hsl(var(--card))] transition-colors duration-200" key={key}>
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getPriorityColor(key)} uppercase tracking-wider`}>
                                            {key.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={key}
                                            type="number"
                                            min="0"
                                            step="0.5"
                                            value={value}
                                            onChange={(e) => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                            className="w-20 text-center font-bold text-base bg-[hsl(var(--card))] shadow-none border-[hsl(var(--border))] focus-visible:ring-primary h-9 rounded-md"
                                        />
                                        <span className="text-xs font-medium text-slate-400 w-6">Pts</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-sm">
                        Batal
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving} className="rounded-xl font-medium shadow-sm text-sm">
                        {saving ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Simpan Perubahan
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
