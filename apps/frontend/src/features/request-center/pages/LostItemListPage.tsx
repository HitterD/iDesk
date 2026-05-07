import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PackageSearch, Search, RefreshCw, Plus, TrendingUp, Inbox, CheckCircle2, UserCheck, Search as SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { useLostItemReports, LostItemStatus } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { LostItemCard } from '../components/LostItemCard';

const STATUS_PILLS: { label: string; value: string }[] = [
    { label: 'Semua', value: 'ALL' },
    { label: 'Dilaporkan', value: 'REPORTED' },
    { label: 'Dicari', value: 'SEARCHING' },
    { label: 'Ada Penemu', value: 'CLAIMED' },
    { label: 'Dikembalikan', value: 'RETURNED' },
    { label: 'Ditutup', value: 'CLOSED_LOST' },
];

const SkeletonCard = () => (
    <div className="bg-white border border-slate-200 rounded-xl p-4 h-48 flex flex-col">
        <div className="flex justify-between mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="w-20 h-6 bg-slate-100 rounded-full animate-pulse" />
        </div>
        <div className="w-3/4 h-5 bg-slate-100 rounded animate-pulse mb-2" />
        <div className="w-1/2 h-4 bg-slate-100 rounded animate-pulse mb-auto" />
        <div className="w-1/3 h-3 bg-slate-100 rounded animate-pulse" />
    </div>
);

export const LostItemListPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const { data: items = [], isLoading, refetch } = useLostItemReports(
        statusFilter !== 'ALL' ? { status: statusFilter as LostItemStatus } : undefined
    );

    const handleRefresh = () => { refetch(); toast.success('Data diperbarui'); };

    const handleNewReport = () => {
        if (location.pathname.startsWith('/client')) {
            navigate('/client/create?type=lost-item');
        } else {
            navigate('/tickets/create?type=lost-item');
        }
    };

    const filteredItems = useMemo(() => items.filter(item => {
        const reporterName = item.reporter?.fullName || item.ticket?.user?.fullName || '';
        const q = searchQuery.toLowerCase();
        return item.id.toLowerCase().includes(q) || item.itemName.toLowerCase().includes(q) || reporterName.toLowerCase().includes(q);
    }), [items, searchQuery]);

    const stats = useMemo(() => ({
        total: items.length,
        reported: items.filter(i => i.status === LostItemStatus.REPORTED).length,
        searching: items.filter(i => i.status === LostItemStatus.SEARCHING).length,
        claimed: items.filter(i => i.status === LostItemStatus.CLAIMED).length,
        returned: items.filter(i => i.status === LostItemStatus.RETURNED).length,
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-slate-500" bgColor="bg-slate-500/10" animationIndex={0} />
                <StatsCard icon={Inbox} label="Reported" value={stats.reported} color="text-amber-500" bgColor="bg-amber-500/10" animationIndex={1} />
                <StatsCard icon={SearchIcon} label="Searching" value={stats.searching} color="text-blue-500" bgColor="bg-blue-500/10" animationIndex={2} />
                <StatsCard icon={UserCheck} label="Claimed" value={stats.claimed} color="text-violet-500" bgColor="bg-violet-500/10" animationIndex={3} />
                <StatsCard icon={CheckCircle2} label="Returned" value={stats.returned} color="text-emerald-500" bgColor="bg-emerald-500/10" animationIndex={4} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative w-full sm:w-80 shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari nama barang atau ID..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap gap-2 flex-1">
                    {STATUS_PILLS.map(pill => (
                        <button
                            key={pill.value}
                            onClick={() => setStatusFilter(pill.value)}
                            className={cn(
                                'px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors duration-150',
                                statusFilter === pill.value
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-slate-400'
                            )}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                    <PackageSearch className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Tidak ada laporan ditemukan</h3>
                    <p className="text-slate-500 text-sm">Coba ubah filter atau kata kunci pencarian</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredItems.map(item => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <LostItemCard 
                                item={item} 
                                onClick={() => navigate(`/lost-items/${item.id}`)} 
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
