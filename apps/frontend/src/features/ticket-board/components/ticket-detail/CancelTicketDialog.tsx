import React, { useEffect, useRef, useState } from 'react';
import { X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import { ActionChips } from './ActionControls';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';

/** Same codes and limits as the server (ticket-cancel.constants.ts). */
export const CANCEL_REASON_OPTIONS = [
    { value: 'DUPLICATE', label: 'Duplikat tiket lain' },
    { value: 'SELF_RESOLVED', label: 'Masalah sudah teratasi sendiri' },
    { value: 'WRONG_SUBMISSION', label: 'Salah kirim / salah kategori' },
    { value: 'NO_RESPONSE', label: 'Tidak ada respon dari pemohon' },
    { value: 'NOT_NEEDED', label: 'Tidak lagi dibutuhkan' },
    { value: 'OTHER', label: 'Lainnya' },
] as const;
export type CancelReasonCode = typeof CANCEL_REASON_OPTIONS[number]['value'];
export const CANCEL_NOTE_MAX_LENGTH = 500;
export const CANCEL_NOTE_MIN_LENGTH = 5;

export const cancelReasonLabel = (code?: string | null): string | null =>
    CANCEL_REASON_OPTIONS.find((option) => option.value === code)?.label ?? null;

export interface CancelTicketPayload {
    reasonCode: CancelReasonCode;
    reason?: string;
}

interface CancelTicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: { id: string; ticketNumber?: string; title?: string };
    onConfirm: (payload: CancelTicketPayload) => Promise<unknown> | void;
    isLoading?: boolean;
}

/** A reason is required to cancel; "Lainnya" also needs a written note. */
export const CancelTicketDialog: React.FC<CancelTicketDialogProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false }) => {
    const [code, setCode] = useState<CancelReasonCode | null>(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setCode(null);
        setNote('');
        setError(null);
    }, [isOpen]);

    const trimmedNote = note.trim();
    const noteRequired = code === 'OTHER';
    const noteTooShort = noteRequired && trimmedNote.length < CANCEL_NOTE_MIN_LENGTH;
    const canSubmit = Boolean(code) && !noteTooShort && !isLoading;

    const choose = (value: CancelReasonCode) => {
        setCode(value);
        setError(null);
        if (value === 'OTHER') noteRef.current?.focus();
    };

    const handleConfirm = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!canSubmit || !code) return;
        try {
            setError(null);
            await onConfirm({ reasonCode: code, ...(trimmedNote ? { reason: trimmedNote } : {}) });
        } catch (cause) {
            setError(getApiErrorMessage(cause, 'Gagal membatalkan tiket'));
        }
    };

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Batalkan tiket" busy={isLoading}>
            <form className="ticket-action-inner ticket-action-simple" onSubmit={handleConfirm}>
                <header className="ticket-action-header">
                    <div><h2>Batalkan tiket</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)}{ticket.title ? ` · ${ticket.title}` : ''}</p></div>
                    <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={isLoading}><X /></Button>
                </header>
                <div className="ticket-action-body">
                    <p className="ticket-action-current">Tiket yang dibatalkan tidak dapat diproses kembali.</p>
                    <div className="ticket-action-field">
                        <span id="cancel-reason-label">Alasan pembatalan <span aria-hidden="true" className="ticket-action-required">*</span></span>
                        <ActionChips labelledBy="cancel-reason-label" options={CANCEL_REASON_OPTIONS} value={code} disabled={isLoading} onSelect={choose} />
                    </div>
                    <div className="ticket-action-field">
                        <label htmlFor="cancel-note">
                            Catatan {noteRequired
                                ? <span aria-hidden="true" className="ticket-action-required">*</span>
                                : <span className="ticket-action-help">(opsional)</span>}
                        </label>
                        <textarea id="cancel-note" ref={noteRef} value={note} disabled={isLoading} rows={2}
                            required={noteRequired} aria-required={noteRequired}
                            maxLength={CANCEL_NOTE_MAX_LENGTH}
                            placeholder={noteRequired ? 'Tulis alasan pembatalan…' : 'Contoh: sama dengan tiket #051126-FIN-0005'}
                            onChange={(event) => { setNote(event.target.value); setError(null); }} />
                        <span className="ticket-action-help ticket-action-count">{note.length}/{CANCEL_NOTE_MAX_LENGTH}</span>
                        {noteRequired && note.length > 0 && noteTooShort && (
                            <p role="alert" className="ticket-action-help">Catatan minimal {CANCEL_NOTE_MIN_LENGTH} karakter.</p>
                        )}
                        {error && <p role="alert">{error}</p>}
                    </div>
                </div>
                <footer className="ticket-action-footer"><div>
                    <Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Kembali</Button>
                    <Button variant="danger-solid" type="submit" loading={isLoading} disabled={!canSubmit}>
                        <XCircle />Batalkan tiket
                    </Button>
                </div></footer>
            </form>
        </TicketActionDialog>
    );
};

/** "Label" or "Label: note" for a cancelled ticket; null when it has no stored reason (older or merged tickets). */
export const formatCancelReason = (ticket: { cancelReasonCode?: string | null; cancelReason?: string | null }): string | null => {
    const label = cancelReasonLabel(ticket.cancelReasonCode);
    if (!label) return ticket.cancelReason?.trim() || null;
    return ticket.cancelReason?.trim() ? `${label}: ${ticket.cancelReason.trim()}` : label;
};

/** Line under the title of a cancelled ticket saying why; renders nothing without a stored reason. */
export const CancelReasonNote: React.FC<{ ticket: { status: string; cancelReasonCode?: string | null; cancelReason?: string | null } }> = ({ ticket }) => {
    const reason = ticket.status === 'CANCELLED' ? formatCancelReason(ticket) : null;
    if (!reason) return null;
    return (
        <p className="td-line flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
            <XCircle className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
            <span><span className="font-medium">Dibatalkan:</span> {reason}</span>
        </p>
    );
};
