import React, { useEffect, useState } from 'react';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { WIPE_DOMAIN_LABELS, WipeDomain } from '../../hooks/useDataWipe';

/** Must match WIPE_CONFIRM_PHRASE on the server; the server re-checks it. */
export const WIPE_CONFIRM_PHRASE = 'HAPUS SEMUA DATA';

interface WipeConfirmDialogProps {
    isOpen: boolean;
    domains: WipeDomain[];
    totalRows: number;
    isExecuting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Type-to-confirm gate, following the BulkDeleteDialog precedent.
 *
 * The typed phrase is deliberately not the row count: the count is on screen
 * and can be copied without reading, and it shifts if anything changes between
 * preview and confirmation.
 */
export const WipeConfirmDialog: React.FC<WipeConfirmDialogProps> = ({
    isOpen,
    domains,
    totalRows,
    isExecuting,
    onConfirm,
    onCancel,
}) => {
    const [typed, setTyped] = useState('');

    // Never carry a satisfied phrase across openings.
    useEffect(() => {
        if (!isOpen) setTyped('');
    }, [isOpen]);

    const matches = typed === WIPE_CONFIRM_PHRASE;
    const domainLabels = domains.map((d) => WIPE_DOMAIN_LABELS[d]).join(', ');

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            variant="destructive"
            title="Hapus permanen seluruh data terpilih?"
            description={
                `${totalRows.toLocaleString('id-ID')} baris data pada domain ${domainLabels} akan dihapus permanen ` +
                'dan tidak dapat dikembalikan melalui aplikasi. Backup pengaman dibuat otomatis sebelum penghapusan dimulai.'
            }
            confirmText={isExecuting ? 'Menghapus...' : 'Hapus Permanen'}
            cancelText="Batal"
            isLoading={isExecuting}
            confirmDisabled={!matches}
            onConfirm={onConfirm}
            onCancel={onCancel}
        >
            <div className="space-y-2">
                <label
                    htmlFor="wipe-confirm-input"
                    className="block text-sm text-slate-600 dark:text-slate-300"
                >
                    Ketik <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                        {WIPE_CONFIRM_PHRASE}
                    </span> untuk melanjutkan:
                </label>
                <input
                    id="wipe-confirm-input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isExecuting}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={WIPE_CONFIRM_PHRASE}
                    aria-label="Frasa konfirmasi penghapusan data"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                {typed.length > 0 && !matches && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                        Frasa belum sesuai. Perhatikan huruf besar dan spasi.
                    </p>
                )}
            </div>
        </ConfirmationDialog>
    );
};
