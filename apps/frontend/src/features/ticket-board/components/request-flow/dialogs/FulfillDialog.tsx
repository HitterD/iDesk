import { useState } from 'react';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { FlowDialog } from './FlowDialog';

export type FulfillMode = 'CREDENTIALS' | 'NO_CREDENTIALS';
export interface FulfillForm { mode: FulfillMode; username: string; password: string; note: string }

const NOTE_MIN = 3;
/** Access IT activates in place, with no username and password to hand over. */
const NO_CREDENTIAL_KINDS = ['SYNOLOGY_NAS', 'WEBSITE'];

export function fulfillReady(form: FulfillForm): boolean {
    return form.mode === 'CREDENTIALS' ? form.username.trim() !== '' && form.password !== '' : form.note.trim().length >= NOTE_MIN;
}

interface FulfillDialogProps {
    open: boolean;
    onClose: () => void;
    signerName: string;
    formType: string;
    onSubmit: (payload: Record<string, string>) => Promise<unknown>;
}

/** IT gives the access: with credentials (stored encrypted) or without (a note says what was done), and signs. */
export function FulfillDialog({ open, onClose, signerName, formType, onSubmit }: FulfillDialogProps) {
    const [form, setForm] = useState<FulfillForm>({ mode: NO_CREDENTIAL_KINDS.includes(formType) ? 'NO_CREDENTIALS' : 'CREDENTIALS', username: '', password: '', note: '' });
    const [server, setServer] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const withCredentials = form.mode === 'CREDENTIALS';
    const set = (change: Partial<FulfillForm>) => setForm((current) => ({ ...current, ...change }));

    const send = () => {
        const payload: Record<string, string> = { mode: form.mode, signatureData: signature! };
        if (withCredentials) {
            payload.username = form.username.trim();
            payload.password = form.password;
            if (server.trim()) payload.server = server.trim();
        }
        if (form.note.trim()) payload.note = form.note.trim();
        return onSubmit(payload);
    };

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Berikan akses" intro="Aktifkan akses di sistem terlebih dahulu, lalu catat di sini."
            submitLabel="Berikan akses" canSubmit={fulfillReady(form) && Boolean(signature)} onSubmit={send}
        >
            <div role="radiogroup" aria-label="Cara memberi akses" className="req-dialog__seg">
                {([['CREDENTIALS', 'Dengan kredensial'], ['NO_CREDENTIALS', 'Tanpa kredensial']] as const).map(([mode, text]) => (
                    <button key={mode} type="button" role="radio" aria-checked={form.mode === mode} className={form.mode === mode ? 'is-on' : ''} onClick={() => set({ mode })}>{text}</button>
                ))}
            </div>
            {withCredentials && (
                <>
                    <label className="req-dialog__field"><span>Username</span><input aria-label="Username" autoComplete="off" value={form.username} onChange={(e) => set({ username: e.target.value })} /></label>
                    <label className="req-dialog__field"><span>Password</span><input aria-label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} /></label>
                    {formType !== 'EMAIL' && (
                        <label className="req-dialog__field"><span>Server (opsional)</span><input aria-label="Server" value={server} onChange={(e) => setServer(e.target.value)} /></label>
                    )}
                </>
            )}
            <label className="req-dialog__field">
                <span>{withCredentials ? 'Catatan untuk pemohon (opsional)' : `Catatan: apa yang sudah dilakukan (minimal ${NOTE_MIN} karakter)`}</span>
                <textarea aria-label="Catatan" value={form.note} onChange={(e) => set({ note: e.target.value })} />
            </label>
            <SignaturePad signerName={signerName} onSave={setSignature} />
        </FlowDialog>
    );
}
