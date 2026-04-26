import React, { useState, useMemo } from 'react';
import {
    PackageSearch,
    Search,
    RefreshCw,
    Plus,
    TrendingUp,
    Inbox,
    CheckCircle2,
    XCircle,
    X,
    ArrowRight,
    MapPin,
    Calendar,
    Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { useLostItemReports, useUpdateLostItemStatus, LostItemStatus, LostItemReport } from '../api/lost-item.api';

export const LostItemListPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<LostItemReport | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');

    const { data: items = [], isLoading, refetch } = useLostItemReports(
        statusFilter !== 'ALL' ? { status: statusFilter as LostItemStatus } : undefined
    );
    const updateStatus = useUpdateLostItemStatus();

    const handleRefresh = () => { refetch(); toast.success('Reports updated'); };

    const filteredItems = useMemo(() => items.filter(item => {
        const reporterName = item.ticket?.user?.fullName || '';
        return (
            item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            reporterName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }), [items, searchQuery]);

    const stats = useMemo(() => ({
        total: items.length,
        reported: items.filter(i => i.status === LostItemStatus.REPORTED).length,
        found: items.filter(i => i.status === LostItemStatus.VERIFIED || i.status === LostItemStatus.RETURNED).length,
        lost: items.filter(i => i.status === LostItemStatus.CLOSED_LOST).length,
    }), [items]);

    const getStatusBadgeClass = (status: string) => {
        const map: Record<string, string> = {
            REPORTED:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            SEARCHING:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            CLAIMED:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            VERIFIED:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            RETURNED:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            CLOSED_LOST: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
            FOUND:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        };
        return map[status] || map.REPORTED;
    };

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

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
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Report and track lost office property</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-primary transition-colors duration-150 shadow-sm"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors duration-150 shadow-sm">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Report</span>
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard icon={TrendingUp} label="Total Reports" value={stats.total} color="text-rose-500" bgColor="bg-rose-500/10" animationIndex={0} />
                <StatsCard icon={Inbox} label="Reported" value={stats.reported} color="text-amber-500" bgColor="bg-amber-500/10" animationIndex={1} />
                <StatsCard icon={CheckCircle2} label="Found" value={stats.found} color="text-emerald-500" bgColor="bg-emerald-500/10" animationIndex={2} />
                <StatsCard icon={XCircle} label="Lost" value={stats.lost} color="text-slate-500" bgColor="bg-slate-500/10" animationIndex={3} />
            </div>

            {/* Filters & Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by item name, reporter, or ID..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500/20 transition-colors duration-150"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-semibold outline-none"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="REPORTED">Reported</option>
                        <option value="SEARCHING">Searching</option>
                        <option value="CLAIMED">Claimed</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="RETURNED">Returned</option>
                        <option value="CLOSED_LOST">Closed</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-6 py-4">Report ID</th>
                                <th className="px-6 py-4">Item Name</th>
                                <th className="px-6 py-4">Location</th>
                                <th className="px-6 py-4">Reporter</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                                        <PackageSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-bold">No reports found</p>
                                    </td>
                                </tr>
                            ) : filteredItems.map(item => {
                                const reporterName = item.ticket?.user?.fullName || 'Unknown';
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className="hover:bg-rose-50/30 dark:hover:bg-rose-900/5 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400">{item.id.slice(0, 8)}…</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{item.itemName}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.itemType}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                                                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                                {item.lastSeenLocation}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={{ fullName: reporterName }} size="sm" />
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{reporterName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', getStatusBadgeClass(item.status))}>
                                                {item.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 group-hover:bg-rose-500 group-hover:text-white transition-colors duration-150 ml-auto">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detail Drawer */}
            <AnimatePresence>
                {selectedItem && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
                            onClick={() => setSelectedItem(null)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-[101] flex flex-col border-l border-slate-200 dark:border-slate-800"
                        >
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-sm">
                                        <PackageSearch className="w-7 h-7" />
                                    </div>
                                    <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors duration-150">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>
                                <div>
                                    <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-rose-500 mb-2">{selectedItem.id.slice(0, 8)}…</p>
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{selectedItem.itemName}</h2>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Status</p>
                                        <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', getStatusBadgeClass(selectedItem.status))}>
                                            {selectedItem.status}
                                        </Badge>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Item Type</p>
                                        <div className="flex items-center gap-2">
                                            <Tag className="w-3.5 h-3.5 text-rose-400" />
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{selectedItem.itemType}</span>
                                        </div>
                                    </div>
                                </div>

                                <section>
                                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">Reporter</h3>
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <UserAvatar user={{ fullName: selectedItem.ticket?.user?.fullName || 'Unknown' }} size="lg" />
                                        <div>
                                            <p className="font-black text-slate-900 dark:text-white">{selectedItem.ticket?.user?.fullName || 'Unknown'}</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{selectedItem.ticket?.user?.email || ''}</p>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">Item Description</h3>
                                    <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium italic">
                                            "{selectedItem.circumstances}"
                                        </p>
                                    </div>
                                </section>

                                {selectedItem.photoUrls?.length > 0 && (
                                    <section>
                                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">Photos</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            {selectedItem.photoUrls.map((url, idx) => (
                                                <img key={idx} src={url} alt={`photo-${idx}`} className="w-full aspect-square object-cover rounded-xl border border-slate-200 dark:border-slate-700" />
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <section>
                                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">Location & Time</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <MapPin className="w-5 h-5 text-rose-400" />
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Location Lost</span>
                                            </div>
                                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{selectedItem.lastSeenLocation}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center gap-3">
                                                <Calendar className="w-5 h-5 text-rose-400" />
                                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Date Reported</span>
                                            </div>
                                            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{format(new Date(selectedItem.createdAt), 'dd MMMM yyyy')}</span>
                                        </div>
                                    </div>
                                </section>

                                {selectedItem.qrCodeUrl && (
                                    <section>
                                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4">QR Code</h3>
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex flex-col items-center gap-3">
                                            <QRCodeSVG value={selectedItem.qrCodeUrl} size={120} />
                                            <p className="text-xs text-slate-400 text-center">Finder scan untuk lapor temuan</p>
                                        </div>
                                    </section>
                                )}
                            </div>

                            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 flex gap-3">
                                <button
                                    onClick={() => {
                                        updateStatus.mutate(
                                            { id: selectedItem.id, status: LostItemStatus.VERIFIED },
                                            { onSuccess: () => { setSelectedItem(null); toast.success('Marked as found'); refetch(); } }
                                        );
                                    }}
                                    disabled={updateStatus.isPending}
                                    className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-rose-600/20 disabled:opacity-50"
                                >
                                    {updateStatus.isPending ? 'UPDATING...' : 'MARK AS FOUND'}
                                </button>
                                <button
                                    onClick={() => {
                                        updateStatus.mutate(
                                            { id: selectedItem.id, status: LostItemStatus.CLOSED_LOST },
                                            { onSuccess: () => { setSelectedItem(null); toast.success('Report closed'); refetch(); } }
                                        );
                                    }}
                                    disabled={updateStatus.isPending}
                                    className="px-6 py-4 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-100 transition-colors duration-150 disabled:opacity-50"
                                >
                                    CLOSE REPORT
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
