import React, { useState } from 'react';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiBaseUrl, type IssuedSecret } from './api';

/** The one and only time a secret is visible: copy it into the partner app's configuration. */
export const SecretDialog: React.FC<{ issued: IssuedSecret | null; onClose: () => void }> = ({ issued, onClose }) => {
    const [copied, setCopied] = useState<string | null>(null);
    const copy = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            toast.error('Tidak bisa menyalin. Pilih teksnya lalu salin manual.');
        }
    };
    const rows = issued ? [
        { label: 'Base URL', value: apiBaseUrl() },
        { label: 'Client ID', value: issued.app.clientId },
        { label: 'Client secret', value: issued.secret },
    ] : [];

    return (
        <Dialog open={Boolean(issued)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="iapp-dialog max-w-[560px] p-0 gap-0">
                <header className="iapp-dhead">
                    <span className="iapp-key"><KeyRound aria-hidden="true" /></span>
                    <DialogTitle className="iapp-dtitle">Kredensial {issued?.app.name}</DialogTitle>
                    <DialogDescription className="iapp-dsub">Berikan ke developer aplikasi. Simpan di konfigurasi server mereka, bukan di kode.</DialogDescription>
                </header>
                <div className="iapp-dbody">
                    <p className="iapp-warn"><TriangleAlert aria-hidden="true" />Secret hanya tampil sekali. Jika hilang, buat secret baru (secret lama langsung tidak berlaku).</p>
                    <dl className="iapp-creds">
                        {rows.map((row) => (
                            <div key={row.label}>
                                <dt>{row.label}</dt>
                                <dd>
                                    <code>{row.value}</code>
                                    <button type="button" onClick={() => copy(row.label, row.value)} aria-label={`Salin ${row.label}`}>
                                        {copied === row.label ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                                    </button>
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
                <footer className="iapp-dfoot">
                    <Button type="button" variant="primary" onClick={onClose}>Sudah saya simpan</Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};
