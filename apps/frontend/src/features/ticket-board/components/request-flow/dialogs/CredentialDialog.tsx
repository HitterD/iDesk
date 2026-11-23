import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { TicketActionDialog } from '../../ticket-detail/TicketActionDialog';

export interface Credentials { username: string; password: string; server?: string; note?: string }

interface CredentialDialogProps {
    open: boolean;
    onClose: () => void;
    credentials: Credentials;
}

/** The access details: the password stays hidden until the eye is pressed, and can be copied. */
export function CredentialDialog({ open, onClose, credentials }: CredentialDialogProps) {
    const [shown, setShown] = useState(false);
    const copy = (text: string) => void navigator.clipboard?.writeText(text);
    return (
        <TicketActionDialog open={open} onClose={onClose} title="Kredensial akses">
            <div className="ticket-action-inner req-dialog">
                <div><h2>Kredensial akses</h2><p className="req-dialog__intro">Simpan dengan aman dan jangan dibagikan. Setiap pembukaan tercatat.</p></div>
                <div className="req-dialog__body">
                    <div className="req-dialog__cred"><span>Username</span><b>{credentials.username}</b><button type="button" className="req-btn req-btn--ghost" aria-label="Salin username" onClick={() => copy(credentials.username)}><Copy aria-hidden="true" /></button></div>
                    <div className="req-dialog__cred">
                        <span>Password</span>
                        <b>{shown ? credentials.password : '••••••••••'}</b>
                        <button type="button" className="req-btn req-btn--ghost" aria-label={shown ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShown((v) => !v)}>
                            {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                        </button>
                        <button type="button" className="req-btn req-btn--ghost" aria-label="Salin password" onClick={() => copy(credentials.password)}><Copy aria-hidden="true" /></button>
                    </div>
                    {credentials.server && <div className="req-dialog__cred"><span>Server</span><b>{credentials.server}</b></div>}
                    {credentials.note && <p className="req-dialog__hint">{credentials.note}</p>}
                </div>
                <div className="req-dialog__foot"><button type="button" className="req-btn req-btn--primary req-btn--navy" onClick={onClose}>Tutup</button></div>
            </div>
        </TicketActionDialog>
    );
}
