import { useState } from 'react';
import type { RequestKind } from '../requestKind';
import { FlowDialog } from './FlowDialog';
import { REASON_MIN } from './ApprovalDialog';

interface IssueDialogProps {
    open: boolean;
    onClose: () => void;
    kind: RequestKind;
    onSubmit: (note: string) => Promise<unknown>;
}

const NEXT: Record<RequestKind, string> = {
    HARDWARE: 'Tiket kembali ke IT dan pemasangan diperiksa lagi.',
    EFORM: 'IT akan memeriksa akses Anda lagi.',
};

/** "Ada kendala": the requester tells IT what is wrong; the ticket goes back to IT. */
export function IssueDialog({ open, onClose, kind, onSubmit }: IssueDialogProps) {
    const [note, setNote] = useState('');
    return (
        <FlowDialog
            open={open} onClose={onClose} title="Ada kendala" intro={NEXT[kind]}
            submitLabel="Kirim ke IT" canSubmit={note.trim().length >= REASON_MIN} onSubmit={() => onSubmit(note.trim())}
        >
            <label className="req-dialog__field">
                <span>Apa kendalanya? (minimal {REASON_MIN} karakter)</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Apa kendalanya?" />
            </label>
        </FlowDialog>
    );
}
