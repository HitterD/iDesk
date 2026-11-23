import { useState } from 'react';
import { FlowDialog } from './FlowDialog';
import { REASON_MIN } from './ApprovalDialog';

interface RejectDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    confirmLabel?: string;
    /** A withdrawal needs no reason; a refusal does. */
    noReason?: boolean;
    onSubmit: (reason: string) => Promise<unknown>;
}

/** Refuse (IT, with a reason the requester reads) or withdraw (just confirm) a request. */
export function RejectDialog({ open, onClose, title, confirmLabel = 'Tolak permintaan', noReason = false, onSubmit }: RejectDialogProps) {
    const [reason, setReason] = useState('');
    return (
        <FlowDialog
            open={open} onClose={onClose} title={title} danger
            intro={noReason ? 'Permintaan dihentikan dan tiket dibatalkan. Ini tidak bisa diurungkan.' : 'Permintaan dihentikan. Alasan Anda dibaca pemohon.'}
            submitLabel={confirmLabel} canSubmit={noReason || reason.trim().length >= REASON_MIN} onSubmit={() => onSubmit(reason.trim())}
        >
            {!noReason && (
                <label className="req-dialog__field">
                    <span>Alasan (minimal {REASON_MIN} karakter)</span>
                    <textarea aria-label="Alasan" value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
            )}
        </FlowDialog>
    );
}
