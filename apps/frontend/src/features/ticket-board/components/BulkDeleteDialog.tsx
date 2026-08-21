import React, { useEffect, useState } from 'react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface BulkDeleteDialogProps {
    isOpen: boolean;
    ticketNumbers: string[];
    isLoading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const MAX_LISTED = 8;

/**
 * Type-the-count confirmation for bulk ticket deletion.
 *
 * There is no restore UI, so an accidental delete is only recoverable through a
 * production database query. This deliberate friction is the sole safeguard
 * standing between a stray click and that outcome — keep it in one place rather
 * than duplicating it per page.
 */
export const BulkDeleteDialog: React.FC<BulkDeleteDialogProps> = ({
    isOpen,
    ticketNumbers,
    isLoading,
    onConfirm,
    onCancel,
}) => {
    const [typed, setTyped] = useState('');
    const count = ticketNumbers.length;

    // Reset on every open so a previous confirmation can never carry over.
    useEffect(() => {
        if (isOpen) setTyped('');
    }, [isOpen]);

    const matches = typed.trim() === String(count);
    const listed = ticketNumbers.slice(0, MAX_LISTED).join(', ');
    const overflow = count - MAX_LISTED;
    const tail = 'Ticket akan hilang dari semua daftar dan tidak dapat dipulihkan lewat aplikasi.';

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            title={`Hapus ${count} ticket?`}
            description={
                overflow > 0
                    ? `${listed}, dan ${overflow} lainnya. ${tail}`
                    : `${listed}. ${tail}`
            }
            variant="destructive"
            confirmText="Hapus"
            cancelText="Batal"
            isLoading={isLoading}
            confirmDisabled={!matches}
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <label className="block text-sm text-slate-600 dark:text-slate-300">
                Ketik <span className="font-mono font-bold">{count}</span> untuk konfirmasi:
                <input
                    type="text"
                    inputMode="numeric"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                />
            </label>
            {typed.length > 0 && !matches && (
                <p className="mt-2 text-sm text-red-500">Angka belum cocok.</p>
            )}
        </ConfirmationDialog>
    );
};
