import { useState } from 'react';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { FlowDialog } from './FlowDialog';

export type ApprovalDecision = 'APPROVE' | 'RETURN' | 'REJECT';
/** Same minimum the backend enforces for a returned or rejected request. */
export const REASON_MIN = 5;

interface ApprovalDialogProps {
    open: boolean;
    onClose: () => void;
    signerName: string;
    requesterName: string;
    title: string;
    /** Short lines of what is being approved (items or access). */
    summary: string[];
    onSubmit: (payload: { decision: ApprovalDecision; signatureData?: string; note?: string }) => Promise<unknown>;
}

const CHOICES: Array<{ value: ApprovalDecision; label: string; hint: string }> = [
    { value: 'APPROVE', label: 'Setujui', hint: 'Tanda tangani, lalu IT memproses.' },
    { value: 'RETURN', label: 'Kembalikan ke IT', hint: 'Ada yang perlu diperbaiki; IT meninjau ulang.' },
    { value: 'REJECT', label: 'Tolak', hint: 'Permintaan dihentikan.' },
];

/** The approver's one dialog: read the summary, choose, sign (approve) or explain (return / reject). */
export function ApprovalDialog({ open, onClose, signerName, requesterName, title, summary, onSubmit }: ApprovalDialogProps) {
    const [decision, setDecision] = useState<ApprovalDecision>('APPROVE');
    const [signature, setSignature] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const approving = decision === 'APPROVE';
    const reasonOk = note.trim().length >= REASON_MIN;
    const canSubmit = approving ? Boolean(signature) : reasonOk;
    const label = approving ? 'Setujui & tanda tangani' : decision === 'RETURN' ? 'Kembalikan ke IT' : 'Tolak';

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Periksa & setujui" danger={decision === 'REJECT'}
            intro={<>{requesterName} meminta persetujuan Anda untuk <b>{title}</b>.</>}
            submitLabel={label} canSubmit={canSubmit}
            onSubmit={() => onSubmit(approving ? { decision, signatureData: signature! } : { decision, note: note.trim() })}
        >
            <ul className="req-dialog__summary">{summary.map((line) => <li key={line}>{line}</li>)}</ul>
            <div role="radiogroup" aria-label="Keputusan" className="req-dialog__choices">
                {CHOICES.map((choice) => (
                    <button
                        key={choice.value} type="button" role="radio" aria-checked={decision === choice.value}
                        aria-label={choice.label} className={decision === choice.value ? 'is-on' : ''} onClick={() => setDecision(choice.value)}
                    >
                        <b>{choice.label}</b><span>{choice.hint}</span>
                    </button>
                ))}
            </div>
            {approving
                ? <SignaturePad signerName={signerName} onSave={setSignature} />
                : (
                    <label className="req-dialog__field">
                        <span>Alasan (minimal {REASON_MIN} karakter)</span>
                        <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Alasan" />
                    </label>
                )}
        </FlowDialog>
    );
}
