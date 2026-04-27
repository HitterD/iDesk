import React, { useState } from 'react';
import { Play, X, Search, RotateCcw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LostItemStatus } from '../api/lost-item.api';

interface ContextualActionsProps {
    reportId: string;
    status: LostItemStatus;
    userRole: string;
    isOwnReport?: boolean;
    isPending?: boolean;
    onStatusChange: (newStatus: LostItemStatus, notes?: string) => void;
    onReviewMatch?: (reportId: string) => void;
}

export const ContextualActions = ({
    reportId,
    status,
    userRole,
    isOwnReport = false,
    isPending = false,
    onStatusChange,
    onReviewMatch,
}: ContextualActionsProps) => {
    const [confirmClose, setConfirmClose] = useState(false);
    const isAdminOrAgent = userRole === 'ADMIN' || userRole === 'AGENT';

    const btnBase = 'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-50';

    if (status === LostItemStatus.RETURNED || (status === LostItemStatus.CLOSED_LOST && !isAdminOrAgent)) {
        return <p className="text-xs text-slate-400 italic">Laporan ini sudah selesai.</p>;
    }

    return (
        <div className="flex flex-col gap-2">
            {/* REPORTED */}
            {status === LostItemStatus.REPORTED && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.SEARCHING)}
                    className={cn(btnBase, 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20')}
                >
                    <Play className="w-4 h-4" /> Start Searching
                </button>
            )}

            {/* CLAIMED → Review Match */}
            {status === LostItemStatus.CLAIMED && isAdminOrAgent && onReviewMatch && (
                <button
                    disabled={isPending}
                    onClick={() => onReviewMatch(reportId)}
                    className={cn(btnBase, 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-600/20')}
                >
                    <Search className="w-4 h-4" /> Review Match
                </button>
            )}

            {/* VERIFIED → Confirm Return */}
            {status === LostItemStatus.VERIFIED && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.RETURNED)}
                    className={cn(btnBase, 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-600/20')}
                >
                    <CheckCircle2 className="w-4 h-4" /> Confirm Return
                </button>
            )}

            {/* CLOSED_LOST → Reopen (admin/agent only) */}
            {status === LostItemStatus.CLOSED_LOST && isAdminOrAgent && (
                <button
                    disabled={isPending}
                    onClick={() => onStatusChange(LostItemStatus.REPORTED)}
                    className={cn(btnBase, 'bg-slate-600 text-white hover:bg-slate-700')}
                >
                    <RotateCcw className="w-4 h-4" /> Reopen
                </button>
            )}

            {/* Close / Tutup — admin/agent on REPORTED or SEARCHING, client on REPORTED */}
            {(status === LostItemStatus.REPORTED || status === LostItemStatus.SEARCHING) && (isAdminOrAgent || (isOwnReport && status === LostItemStatus.REPORTED)) && (
                confirmClose ? (
                    <div className="flex gap-2 items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                        <p className="text-xs font-bold text-red-700 dark:text-red-400 flex-1">Yakin tutup laporan ini?</p>
                        <button
                            onClick={() => { setConfirmClose(false); onStatusChange(LostItemStatus.CLOSED_LOST); }}
                            disabled={isPending}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                        >
                            Ya, Tutup
                        </button>
                        <button onClick={() => setConfirmClose(false)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold">
                            Batal
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmClose(true)}
                        className={cn(btnBase, 'border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10')}
                    >
                        <X className="w-4 h-4" /> {isOwnReport && !isAdminOrAgent ? 'Tutup Laporan' : 'Close Report'}
                    </button>
                )
            )}

            {/* Read-only message for client when no actions available */}
            {!isAdminOrAgent && !isOwnReport && (
                <p className="text-xs text-slate-400 italic">Hanya pemilik laporan yang dapat mengambil tindakan.</p>
            )}
            {!isAdminOrAgent && isOwnReport && status === LostItemStatus.SEARCHING && (
                <p className="text-xs text-slate-400 italic">Tim sedang mencari barang kamu.</p>
            )}
            {!isAdminOrAgent && isOwnReport && (status === LostItemStatus.CLAIMED || status === LostItemStatus.VERIFIED) && (
                <p className="text-xs text-slate-400 italic">
                    {status === LostItemStatus.CLAIMED ? 'Menunggu verifikasi admin/agent.' : 'Barang siap diambil di pos keamanan.'}
                </p>
            )}
        </div>
    );
};
