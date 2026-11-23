import { useState } from 'react';
import { FlowDialog } from './FlowDialog';

interface DocNumberDialogProps {
    open: boolean;
    onClose: () => void;
    current: string;
    onSubmit: (value: string) => Promise<unknown>;
}

/** IT edits the document number (the number printed on the form). */
export function DocNumberDialog({ open, onClose, current, onSubmit }: DocNumberDialogProps) {
    const [value, setValue] = useState(current);
    const next = value.trim();
    return (
        <FlowDialog
            open={open} onClose={onClose} title="Ubah nomor dokumen"
            intro="Nomor baru membuat versi baru dokumen; kertas yang sudah dicetak dengan versi lama tidak bisa diimpor lagi."
            submitLabel="Simpan nomor" canSubmit={next !== '' && next !== current} onSubmit={() => onSubmit(next)}
        >
            <label className="req-dialog__field">
                <span>Nomor dokumen</span>
                <input aria-label="Nomor dokumen" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" />
            </label>
        </FlowDialog>
    );
}
