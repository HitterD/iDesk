import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, Plus, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/stores/useAuth';
import { useMyLostReports } from '../api/lost-item.api';
import { LostItemsNav } from '../components/LostItemsNav';
import { LostItemCard } from '../components/LostItemCard';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';

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

export const MyLostReportsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data: reports = [], isLoading } = useMyLostReports();

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

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <StatsCard icon={TrendingUp} label="Total Laporan" value={reports.length} color="text-slate-500" bgColor="bg-slate-500/10" animationIndex={0} />
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                </div>
            ) : reports.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 py-24 text-center">
                    <PackageSearch className="w-16 h-16 mx-auto mb-4 opacity-30 text-slate-400" />
                    <p className="font-bold text-lg text-slate-900 dark:text-white">Belum ada laporan</p>
                    <p className="text-sm mt-1 text-slate-500">Klik "Laporan Baru" untuk melaporkan barang hilang</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {reports.map((report, idx) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: idx * 0.05 }}
                        >
                            <LostItemCard 
                                item={report} 
                                onClick={() => navigate(`/lost-items/${report.id}`)} 
                            />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};
