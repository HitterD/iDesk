import React, { useState } from 'react';
import { Play, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LostItemStatus } from '../api/lost-item.api';

interface ContextualActionsProps {
    reportId: string;
    status: LostItemStatus;
    userRole: string;
    isOwnReport?: boolean;
    isPending?: boolean;
    onStatusChange: (newStatus: LostItemStatus, notes?: string) => void;
}

export const ContextualActions = ({
    status,
    userRole,
    isOwnReport = false,
    isPending = false,
    onStatusChange,
}: ContextualActionsProps) => {
    const [confirmClose, setConfirmClose] = useState(false);
    const isICT = ['ADMIN', 'AGENT', 'MANAGER'].includes(userRole);

    const btnBase = 'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 disabled:opacity-50 flex-1 justify-center';

    // ICT View
    if (isICT) {
        if (status === LostItemStatus.RETURNED || status === LostItemStatus.CLOSED_LOST) {
            return <div className="text-center p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-500 font-medium">Laporan ini sudah ditutup.</div>;
        }

        return (
            <div className="flex gap-3">
                {status === LostItemStatus.REPORTED && (
                    <button
                        disabled={isPending}
                        onClick={() => onStatusChange(LostItemStatus.SEARCHING)}
                        className={cn(btnBase, 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20')}
                    >
                        <Play className="w-4 h-4" /> Mulai Pencarian
                    </button>
                )}

                {status === LostItemStatus.CLAIMED && (
                    <button
                        disabled={isPending}
                        onClick={() => onStatusChange(LostItemStatus.RETURNED)}
                        className={cn(btnBase, 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-600/20')}
                    >
                        <CheckCircle2 className="w-4 h-4" /> Konfirmasi Dikembalikan
                    </button>
                )}

                {confirmClose ? (
                    <div className="flex gap-2 items-center flex-1">
                        <button
                            onClick={() => { setConfirmClose(false); onStatusChange(LostItemStatus.CLOSED_LOST); }}
                            disabled={isPending}
                            className={cn(btnBase, 'bg-red-600 text-white hover:bg-red-700')}
                        >
                            Ya, Tutup
                        </button>
                        <button 
                            onClick={() => setConfirmClose(false)} 
                            className={cn(btnBase, 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                        >
                            Batal
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setConfirmClose(true)}
                        className={cn(btnBase, 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                        <X className="w-4 h-4" /> Tutup
                    </button>
                )}
            </div>
        );
    }

    // Employee / Reporter View
    if (isOwnReport) {
        if (status === LostItemStatus.RETURNED) return <p className="text-sm text-slate-500 italic">Barang telah dikembalikan kepada kamu.</p>;
        if (status === LostItemStatus.CLOSED_LOST) return <p className="text-sm text-slate-500 italic">Pencarian dihentikan.</p>;
        if (status === LostItemStatus.REPORTED) return <p className="text-sm text-slate-500 italic">Laporan sedang dalam antrean.</p>;
        if (status === LostItemStatus.SEARCHING) return <p className="text-sm text-slate-500 italic">Tim sedang mencari barang kamu.</p>;
        if (status === LostItemStatus.CLAIMED) return <p className="text-sm text-slate-500 italic">Barang dilaporkan telah ditemukan. Menunggu konfirmasi ICT.</p>;
    }

    return null;
};
