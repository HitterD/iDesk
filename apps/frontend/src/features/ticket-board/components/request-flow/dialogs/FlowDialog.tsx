import { useState, type ReactNode } from 'react';
import { TicketActionDialog } from '../../ticket-detail/TicketActionDialog';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';

interface FlowDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    /** One line under the title saying what this step does. */
    intro?: ReactNode;
    children: ReactNode;
    /** The one button that sends the form. */
    submitLabel: string;
    /** Why the button is off: it is shown in place of the form errors so nobody has to guess. */
    canSubmit: boolean;
    onSubmit: () => Promise<unknown>;
    /** Close after a successful send (default). */
    closeOnSuccess?: boolean;
    danger?: boolean;
}

/** Shared frame of the request dialogs: title, body, one primary button, the server's message when it refuses. */
export function FlowDialog({ open, onClose, title, intro, children, submitLabel, canSubmit, onSubmit, closeOnSuccess = true, danger = false }: FlowDialogProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = async () => {
        setBusy(true);
        setError(null);
        try {
            await onSubmit();
            if (closeOnSuccess) onClose();
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : getApiErrorMessage(err, 'Gagal menyimpan. Coba lagi.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <TicketActionDialog open={open} onClose={onClose} title={title} busy={busy}>
            <div className="ticket-action-inner req-dialog">
                <div><h2>{title}</h2>{intro && <p className="req-dialog__intro">{intro}</p>}</div>
                <div className="req-dialog__body">
                    {children}
                    {error && <p role="alert" className="req-dialog__error">{error}</p>}
                </div>
                <div className="req-dialog__foot">
                    <button type="button" className="req-btn" onClick={onClose} disabled={busy}>Batal</button>
                    <button
                        type="button"
                        className={`req-btn req-btn--primary ${danger ? 'req-btn--danger' : 'req-btn--navy'}`}
                        disabled={!canSubmit || busy}
                        onClick={() => void send()}
                    >
                        {busy ? 'Menyimpan…' : submitLabel}
                    </button>
                </div>
            </div>
        </TicketActionDialog>
    );
}
