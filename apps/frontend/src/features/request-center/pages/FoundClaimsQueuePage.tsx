import React, { useState } from 'react';
import { PackageCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useFoundClaims, useConfirmReturn, FoundClaimStatus, FoundItemClaim } from '../api/found-claim.api';
import { MatchReviewPanel } from '../components/MatchReviewPanel';
import { StatusBadge } from '../components/StatusBadge';

const STATUS_CONFIG: Record<string, { label: string }> = {
    PENDING:  { label: 'Pending' },
    MATCHED:  { label: 'Matched' },
    RETURNED: { label: 'Returned' },
    REJECTED: { label: 'Rejected' },
};

const SkeletonRow = () => (
    <tr className="border-b border-slate-100 dark:border-slate-700/50">
        {[1, 2, 3, 4, 5, 6].map(i => (
            <td key={i} className="px-6 py-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50 + (i * 11) % 40}%` }} />
            </td>
        ))}
    </tr>
);

export const FoundClaimsQueuePage = () => {
    const [statusFilter, setStatusFilter] = useState<FoundClaimStatus | 'ALL'>('ALL');
    const [reviewClaim, setReviewClaim] = useState<FoundItemClaim | null>(null);

    const { data: claims = [], isLoading, refetch } = useFoundClaims(
        statusFilter !== 'ALL' ? { status: statusFilter } : undefined
    );
    const confirmReturn = useConfirmReturn();

    const handleConfirmReturn = (claim: FoundItemClaim) => {
        if (!confirm('Konfirmasi barang sudah diserahkan secara fisik?')) return;
        confirmReturn.mutate(claim.id, {
            onSuccess: () => { toast.success('Return dikonfirmasi ✓'); refetch(); },
            onError: () => toast.error('Gagal konfirmasi return'),
        });
    };

    const pendingCount = claims.filter(c => c.status === FoundClaimStatus.PENDING).length;



    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            Found Claims Queue
                            {pendingCount > 0 && (
                                <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-extrabold rounded-full">
                                    {pendingCount} pending
                                </span>
                            )}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Review dan verifikasi laporan barang temuan</p>
                    </div>
                </div>
                <button onClick={() => refetch()} className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors shadow-sm">
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2 flex-wrap">
                {(['ALL', 'PENDING', 'MATCHED', 'RETURNED', 'REJECTED'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setStatusFilter(s as FoundClaimStatus | 'ALL')}
                        className={cn(
                            'px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors',
                            statusFilter === s
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        )}
                    >
                        {s === 'ALL' ? 'Semua' : STATUS_CONFIG[s]?.label}
                    </button>
                ))}
            </div>

            {!isLoading && claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageCheck className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Tidak ada claims</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4">Finder</th>
                                    <th className="px-6 py-4">Lokasi</th>
                                    <th className="px-6 py-4">Terhubung ke</th>
                                    <th className="px-6 py-4">Waktu</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {isLoading ? (
                                    [1, 2, 3].map(i => <SkeletonRow key={i} />)
                                ) : claims.map(claim => (
                                    <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={{ fullName: claim.finder?.fullName || '?' }} size="sm" />
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{claim.finder?.fullName}</p>
                                                    <p className="text-xs text-slate-400">{claim.finder?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium max-w-[160px] truncate">{claim.locationFound}</td>
                                        <td className="px-6 py-4">
                                            {claim.lostItemReport ? (
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{claim.lostItemReport.itemName}</p>
                                                    <p className="text-xs text-slate-400">{claim.lostItemReport.itemType}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Unlinked
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">{format(new Date(claim.createdAt), 'dd MMM, HH:mm')}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={claim.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {claim.status === FoundClaimStatus.PENDING && (
                                                    <button
                                                        onClick={() => setReviewClaim(claim)}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                                {claim.status === FoundClaimStatus.MATCHED && (
                                                    <button
                                                        onClick={() => handleConfirmReturn(claim)}
                                                        disabled={confirmReturn.isPending}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                    >
                                                        Confirm Return
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {reviewClaim && (
                    <MatchReviewPanel claim={reviewClaim} onClose={() => { setReviewClaim(null); refetch(); }} />
                )}
            </AnimatePresence>
        </div>
    );
};
