import { useState } from 'react';
import { CatalogBasket } from '../picker/CatalogBasket';
import { basketErrors, toItemLines, type BasketLine, type CatalogEntry } from '../picker/basket';
import { FlowDialog } from './FlowDialog';

const REASON_MIN = 5;

interface EditItemsDialogProps {
    open: boolean;
    onClose: () => void;
    catalog: CatalogEntry[];
    /** The request's items as they are now (units kept per line). */
    initial: BasketLine[];
    onSubmit: (payload: { items: Array<Record<string, unknown>>; reason: string }) => Promise<unknown>;
}

/** IT changes or swaps the items of a request that is not installed yet; the reason goes to the requester. */
export function EditItemsDialog({ open, onClose, catalog, initial, onSubmit }: EditItemsDialogProps) {
    const [lines, setLines] = useState<BasketLine[]>(initial);
    const [reason, setReason] = useState('');
    const canSubmit = basketErrors(lines).length === 0 && reason.trim().length >= REASON_MIN;

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Ubah / ganti barang" intro="Barang yang tidak tersedia bisa diganti. Pemohon diberi tahu beserta alasannya."
            submitLabel="Simpan perubahan" canSubmit={canSubmit} onSubmit={() => onSubmit({ items: toItemLines(lines), reason: reason.trim() })}
        >
            <CatalogBasket catalog={catalog} lines={lines} onChange={setLines} />
            <label className="req-dialog__field">
                <span>Alasan (minimal {REASON_MIN} karakter)</span>
                <textarea aria-label="Alasan perubahan" value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
        </FlowDialog>
    );
}
