import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { BarcodeScannerModal } from '@/features/hardware-request/components/barcode/BarcodeScannerModal';
import { FlowDialog } from './FlowDialog';

export interface InstallItem { id: string; name: string; quantity: number; recipient: string }

const CODE_MIN = 4;
const PHOTO_BYTES_MAX = 5 * 1024 * 1024;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** What is wrong with each asset code (null = fine). Same rules as the backend: 4+ characters, letters, digits, - and _, no repeats. */
export function assetCodeErrors(codes: string[]): Array<string | null> {
    const seen = new Map<string, number>();
    codes.forEach((raw) => { const key = raw.trim().toLowerCase(); if (key) seen.set(key, (seen.get(key) ?? 0) + 1); });
    return codes.map((raw) => {
        const code = raw.trim();
        if (!code) return 'Isi kode aset';
        if ((seen.get(code.toLowerCase()) ?? 0) > 1) return 'Kode ganda';
        if (code.length < CODE_MIN) return `Minimal ${CODE_MIN} karakter`;
        return CODE_PATTERN.test(code) ? null : 'Hanya huruf, angka, - dan _';
    });
}

interface InstallDoneDialogProps {
    open: boolean;
    onClose: () => void;
    signerName: string;
    items: InstallItem[];
    onSubmit: (payload: { assets: Array<{ itemId: string; code: string }>; signatureData: string; photoUrl?: string }) => Promise<unknown>;
}

/** The technician's report: one asset code per installed unit, then the signature. */
export function InstallDoneDialog({ open, onClose, signerName, items, onSubmit }: InstallDoneDialogProps) {
    const units = useMemo(
        () => items.flatMap((item) => Array.from({ length: item.quantity }, (_, index) => ({ item, index }))),
        [items],
    );
    const [codes, setCodes] = useState<string[]>(() => units.map(() => ''));
    const [signature, setSignature] = useState<string | null>(null);
    const [scanning, setScanning] = useState<number | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const uploadPhoto = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('image/') || file.size > PHOTO_BYTES_MAX) { toast.error('Foto harus gambar dan maksimal 5MB.'); return; }
        setUploading(true);
        try {
            const body = new FormData();
            body.append('files', file);
            const res = await api.post('/uploads', body, { headers: { 'Content-Type': 'multipart/form-data' } });
            const url = res.data?.urls?.[0];
            if (res.data?.success && typeof url === 'string') setPhotoUrl(url); else toast.error('Gagal mengunggah foto.');
        } catch { toast.error('Gagal mengunggah foto.'); } finally { setUploading(false); }
    };
    const errors = assetCodeErrors(codes);
    const touched = codes.map((code) => code !== '');
    const canSubmit = errors.every((error) => error === null) && Boolean(signature) && !uploading;

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Selesaikan pemasangan" intro="Isi kode aset (barcode / serial) tiap unit, lalu tanda tangan."
            submitLabel="Selesaikan pemasangan" canSubmit={canSubmit}
            onSubmit={() => onSubmit({
                assets: units.map(({ item }, index) => ({ itemId: item.id, code: codes[index].trim() })),
                signatureData: signature!,
                ...(photoUrl ? { photoUrl } : {}),
            })}
        >
            <div className="req-dialog__units">
                {units.map(({ item, index }, position) => (
                    <label key={`${item.id}-${index}`} className="req-dialog__field">
                        <span>{item.name}{item.quantity > 1 ? ` · unit ${index + 1}` : ''}{item.recipient ? ` · ${item.recipient}` : ''}</span>
                        <input
                            aria-label={`Kode aset ${item.name}${item.quantity > 1 ? ` unit ${index + 1}` : ''}`}
                            value={codes[position]} autoComplete="off"
                            onChange={(event) => setCodes((current) => current.map((code, i) => (i === position ? event.target.value : code)))}
                        />
                        <button type="button" className="req-btn" aria-label={`Scan kode aset ${item.name}${item.quantity > 1 ? ` unit ${index + 1}` : ''}`} onClick={() => setScanning(position)}>Scan</button>
                        {touched[position] && errors[position] && <small className="req-dialog__hint">{errors[position]}</small>}
                    </label>
                ))}
            </div>
            <label className="req-dialog__field">
                <span>Foto serah terima (opsional)</span>
                <input type="file" accept="image/*" aria-label="Foto serah terima" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
                {photoUrl && <small>Foto terlampir</small>}
            </label>
            <SignaturePad signerName={signerName} onSave={setSignature} />
            <BarcodeScannerModal open={scanning !== null} onClose={() => setScanning(null)}
                onCapture={(code) => setCodes((current) => current.map((value, i) => (i === scanning ? code : value)))} />
        </FlowDialog>
    );
}
