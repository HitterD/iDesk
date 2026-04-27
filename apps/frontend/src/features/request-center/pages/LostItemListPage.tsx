import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PackageSearch, Search, RefreshCw, Plus, TrendingUp, Inbox, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { useLostItemReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { StatusBadge } from '../components/StatusBadge';
import { ItemDetailDrawer } from '../components/ItemDetailDrawer';

const STATUS_PILLS: { label: string; value: string }[] = [
    { label: 'Semua', value: 'ALL' },
    { label: 'Dilaporkan', value: 'REPORTED' },
    { label: 'Dicari', value: 'SEARCHING' },
    { label: 'Ada Penemu', value: 'CLAIMED' },
    { label: 'Terverifikasi', value: 'VERIFIED' },
    { label: 'Dikembalikan', value: 'RETURNED' },
    { label: 'Ditutup', value: 'CLOSED_LOST' },
];

const SkeletonRow = () => (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${60 + (i * 7) % 40}%` }} />
            </td>
        ))}
    </tr>
);

export const LostItemListPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const { data: items = [], isLoading, refetch } = useLostItemReports(
        statusFilter !== 'ALL' ? { status: statusFilter as LostItemStatus } : undefined
    );
    const updateStatus = useUpdateLostItemStatus();

    const handleRefresh = () => { refetch(); toast.success('Data diperbarui'); };

    const handleNewReport = () => {
        if (location.pathname.startsWith('/client')) {
            navigate('/client/create?type=lost-item');
        } else {
            navigate('/tickets/create?type=lost-item');
        }
    };

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

    const filteredItems = useMemo(() => items.filter(item => {
        const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || '';
        const q = searchQuery.toLowerCase();
        return item.id.toLowerCase().includes(q) || item.itemName.toLowerCase().includes(q) || reporterName.toLowerCase().includes(q);
    }), [items, searchQuery]);

    const stats = useMemo(() => ({
        total: items.length,
        reported: items.filter(i => i.status === LostItemStatus.REPORTED).length,
        found: items.filter(i => i.status === LostItemStatus.VERIFIED || i.status === LostItemStatus.RETURNED).length,
        closed: items.filter(i => i.status === LostItemStatus.CLOSED_LOST).length,
    }), [items]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                        <PackageSearch className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Lost Items</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Laporan dan tracking barang hilang</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleRefresh} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-rose-500 transition-colors shadow-sm">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button onClick={handleNewReport} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-sm text-sm">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Laporan Baru</span>
                    </button>
                </div>
            </div>

            <LostItemsNav />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-rose-500" bgColor="bg-rose-500/10" animationIndex={0} />
                <StatsCard icon={Inbox} label="Dilaporkan" value={stats.reported} color="text-amber-500" bgColor="bg-amber-500/10" animationIndex={1} />
                <StatsCard icon={CheckCircle2} label="Ditemukan" value={stats.found} color="text-emerald-500" bgColor="bg-emerald-500/10" animationIndex={2} />
                <StatsCard icon={XCircle} label="Ditutup" value={stats.closed} color="text-slate-500" bgColor="bg-slate-500/10" animationIndex={3} />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama barang, reporter, atau ID..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_PILLS.map(pill => (
                            <button
                                key={pill.value}
                                onClick={() => setStatusFilter(pill.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors duration-150',
                                    statusFilter === pill.value
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-rose-400'
                                )}
                            >
                                {pill.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Barang</th>
                                <th className="px-6 py-4">Lokasi</th>
                                <th className="px-6 py-4">Reporter</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {isLoading ? (
                                [1, 2, 3].map(i => <SkeletonRow key={i} />)
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                        <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-bold">Tidak ada laporan ditemukan</p>
                                        <p className="text-xs mt-1">Coba ubah filter atau kata kunci pencarian</p>
                                    </td>
                                </tr>
                            ) : filteredItems.map(item => {
                                const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || 'Unknown';
                                return (
                                    <motion.tr
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-rose-50/30 dark:hover:bg-rose-900/5 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400 font-mono text-xs">{item.id.slice(0, 8)}…</td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-slate-800 dark:text-slate-200">{item.itemName}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.itemType}</p>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">{item.lastSeenLocation}</td>
                                        <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{reporterName}</td>
                                        <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">{format(new Date(item.createdAt), 'dd MMM yyyy', { locale: localeId })}</td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

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
