import { useMemo, useState } from 'react';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { FlowDialog } from './FlowDialog';

export interface InstallItem { id: string; name: string; quantity: number; recipient: string }

const CODE_MIN = 4;
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
    onSubmit: (payload: { assets: Array<{ itemId: string; code: string }>; signatureData: string }) => Promise<unknown>;
}

/** The technician's report: one asset code per installed unit, then the signature. */
export function InstallDoneDialog({ open, onClose, signerName, items, onSubmit }: InstallDoneDialogProps) {
    const units = useMemo(
        () => items.flatMap((item) => Array.from({ length: item.quantity }, (_, index) => ({ item, index }))),
        [items],
    );
    const [codes, setCodes] = useState<string[]>(() => units.map(() => ''));
    const [signature, setSignature] = useState<string | null>(null);
    const errors = assetCodeErrors(codes);
    const touched = codes.map((code) => code !== '');
    const canSubmit = errors.every((error) => error === null) && Boolean(signature);

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Selesaikan pemasangan" intro="Isi kode aset (barcode / serial) tiap unit, lalu tanda tangan."
            submitLabel="Selesaikan pemasangan" canSubmit={canSubmit}
            onSubmit={() => onSubmit({
                assets: units.map(({ item }, index) => ({ itemId: item.id, code: codes[index].trim() })),
                signatureData: signature!,
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
                        {touched[position] && errors[position] && <small className="req-dialog__hint">{errors[position]}</small>}
                    </label>
                ))}
            </div>
            <SignaturePad signerName={signerName} onSave={setSignature} />
        </FlowDialog>
    );
}
