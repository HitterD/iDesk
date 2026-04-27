import React, { useState } from 'react';
import { PackageCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useFoundClaims, useConfirmReturn, FoundClaimStatus, FoundItemClaim } from '../api/found-claim.api';
import { MatchReviewPanel } from '../components/MatchReviewPanel';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING:  { label: 'Pending',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    MATCHED:  { label: 'Matched',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    RETURNED: { label: 'Returned', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

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

    if (isLoading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            Found Claims
                            {pendingCount > 0 && (
                                <span className="ml-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-black">
                                    {pendingCount}
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
                        onClick={() => setStatusFilter(s)}
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

            {claims.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <PackageCheck className="w-16 h-16 mb-4 opacity-30" />
                    <p className="font-bold text-lg">Tidak ada claims</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
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
                                {claims.map(claim => (
                                    <tr key={claim.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <UserAvatar user={{ fullName: claim.finder?.fullName || '?' }} size="sm" />
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{claim.finder?.fullName}</p>
                                                    <p className="text-[10px] text-slate-400">{claim.finder?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium max-w-[160px] truncate">{claim.locationFound}</td>
                                        <td className="px-6 py-4">
                                            {claim.lostItemReport ? (
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{claim.lostItemReport.itemName}</p>
                                                    <p className="text-[10px] text-slate-400">{claim.lostItemReport.itemType}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Unlinked
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">{format(new Date(claim.createdAt), 'dd MMM, HH:mm')}</td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn('px-3 py-1 rounded-full text-[10px] font-extrabold uppercase', STATUS_CONFIG[claim.status]?.color)}>
                                                {STATUS_CONFIG[claim.status]?.label}
                                            </Badge>
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
