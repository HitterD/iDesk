import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { useMyLostReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { StatusBadge } from '../components/StatusBadge';
import { PhotoGrid } from '../components/PhotoGrid';
import { ItemDetailDrawer } from '../components/ItemDetailDrawer';

const SkeletonCard = () => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-3 animate-pulse">
        <div className="flex gap-3">
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
);

export const MyLostReportsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: reports = [], isLoading, refetch } = useMyLostReports();
    const updateStatus = useUpdateLostItemStatus();
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);

    const handleStatusChange = (id: string, status: LostItemStatus, notes?: string) => {
        updateStatus.mutate(
            { id, status, notes },
            {
                onSuccess: () => {
                    toast.success('Status diperbarui');
                    setSelectedItem(null);
                    refetch();
                },
                onError: () => toast.error('Gagal memperbarui status'),
            }
        );
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Laporan Saya</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Lacak status barang yang kamu laporkan hilang</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/client/create?type=lost-item')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm"
                >
                    <Plus className="w-4 h-4" /> Laporan Baru
                </button>
            </div>

            <LostItemsNav />

            {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageSearch className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Belum ada laporan</p>
                    <p className="text-sm mt-1">Klik "Laporan Baru" untuk melaporkan barang hilang</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reports.map((report, idx) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => setSelectedItem(report)}
                            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs font-extrabold text-rose-500 uppercase tracking-widest font-mono">{report.id.slice(0, 8)}…</span>
                                        <StatusBadge status={report.status} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg">{report.itemName}</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{report.itemType} · {report.lastSeenLocation}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Dilaporkan {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                                    </p>
                                </div>
                            </div>
                            {report.photoUrls?.length > 0 && (
                                <div className="mt-3" onClick={e => e.stopPropagation()}>
                                    <PhotoGrid urls={report.photoUrls.slice(0, 4)} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            <ItemDetailDrawer
                item={selectedItem}
                userRole={user?.role || 'USER'}
                currentUserId={user?.id}
                isPending={updateStatus.isPending}
                onClose={() => setSelectedItem(null)}
                onStatusChange={handleStatusChange}
            />
        </div>
    );
};
