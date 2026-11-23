import { useState } from 'react';
import { Download } from 'lucide-react';
import { FlowDialog } from './FlowDialog';

export type QrVerdict = { ok: true } | { ok: false; reason: string };

const QR_PATTERN = /^(.+)\/v(\d+)$/;

/** Does the QR read from the scan belong to this ticket and to its latest version? An older paper is refused. */
export function qrVerdict(text: string | null, ticketNumber: string, latestVersion: number): QrVerdict {
    if (!text) return { ok: false, reason: 'QR tidak terbaca. Pastikan halaman yang memuat QR terlihat jelas.' };
    const match = QR_PATTERN.exec(text.trim());
    if (!match) return { ok: false, reason: 'QR ini bukan dari dokumen iDesk.' };
    if (match[1] !== ticketNumber) return { ok: false, reason: `QR ini milik tiket ${match[1]}, bukan ${ticketNumber}.` };
    const version = Number(match[2]);
    if (version !== latestVersion) return { ok: false, reason: `Ini dokumen v${version}, sedangkan versi terbaru v${latestVersion}. Unduh ulang dokumen terbaru lalu minta tanda tangan lagi.` };
    return { ok: true };
}

interface PaperSignDialogProps {
    open: boolean;
    onClose: () => void;
    ticketNumber: string;
    /** The latest document version: the only one whose signature can be imported. */
    version: number;
    onDownload: () => void;
    /** Reads the QR text from the scan (image, or the first page of a PDF); null when there is none. */
    readQr: (file: File) => Promise<string | null>;
    onSubmit: (file: File, qr: string) => Promise<unknown>;
}

/** IT imports the paper signature in three steps: download the latest document, have it signed, upload the scan. */
export function PaperSignDialog({ open, onClose, ticketNumber, version, onDownload, readQr, onSubmit }: PaperSignDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [verdict, setVerdict] = useState<QrVerdict | null>(null);
    const [reading, setReading] = useState(false);

    const choose = async (chosen: File | undefined) => {
        setFile(chosen ?? null);
        setQr(null);
        setVerdict(null);
        if (!chosen) return;
        setReading(true);
        try {
            const text = await readQr(chosen);
            setQr(text);
            setVerdict(qrVerdict(text, ticketNumber, version));
        } catch {
            setVerdict({ ok: false, reason: 'QR tidak terbaca. Pastikan halaman yang memuat QR terlihat jelas.' });
        } finally {
            setReading(false);
        }
    };

    return (
        <FlowDialog
            open={open} onClose={onClose} title="TTD kertas" intro="Untuk atasan atau GM yang menandatangani di atas kertas."
            submitLabel="Impor tanda tangan" canSubmit={Boolean(file && qr && verdict?.ok) && !reading}
            onSubmit={() => onSubmit(file!, qr!)}
        >
            <ol className="req-dialog__steps">
                <li>
                    <b>1. Unduh dokumen terbaru (v{version})</b>
                    <button type="button" className="req-btn" onClick={onDownload}><Download aria-hidden="true" />Unduh PDF</button>
                </li>
                <li><b>2. Cetak, minta tanda tangan, lalu pindai</b></li>
                <li>
                    <b>3. Unggah hasil scan</b>
                    <label className="req-dialog__field">
                        <span className="sr-only">Berkas hasil scan</span>
                        <input type="file" accept="application/pdf,image/png,image/jpeg" aria-label="Berkas hasil scan" onChange={(event) => void choose(event.target.files?.[0])} />
                    </label>
                </li>
            </ol>
            {reading && <p className="req-dialog__hint">Membaca QR…</p>}
            {verdict?.ok && <p className="req-dialog__ok">Cocok: dokumen v{version} dari tiket {ticketNumber}.</p>}
            {verdict && !verdict.ok && <p role="alert" className="req-dialog__error">{verdict.reason}</p>}
        </FlowDialog>
    );
}
