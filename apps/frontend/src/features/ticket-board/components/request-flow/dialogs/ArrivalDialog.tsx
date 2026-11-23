import { useState } from 'react';
import { FlowDialog } from './FlowDialog';
import type { ProcureItem } from './ProcurementDialog';

interface ArrivalDialogProps {
    open: boolean;
    onClose: () => void;
    items: ProcureItem[];
    onSubmit: (payload: { itemIds: string[] }) => Promise<unknown>;
}

const ARRIVED = 'ARRIVED';

/** Which of the bought units reached IT's warehouse. Only units still on the way are listed, all ticked at first. */
export function ArrivalDialog({ open, onClose, items, onSubmit }: ArrivalDialogProps) {
    const waiting = items.filter((item) => item.procurementDecision === 'APPROVED' && item.deliveryStatus !== ARRIVED);
    const [ticked, setTicked] = useState<string[]>(() => waiting.map((item) => item.id));
    const toggle = (id: string) => setTicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Barang sudah sampai?" intro="Centang barang yang sudah diterima gudang IT."
            submitLabel="Barang sudah tiba" canSubmit={ticked.length > 0} onSubmit={() => onSubmit({ itemIds: ticked })}
        >
            {waiting.map((item) => (
                <label key={item.id} className="req-dialog__check">
                    <input type="checkbox" checked={ticked.includes(item.id)} onChange={() => toggle(item.id)} />
                    <span>{item.name}{item.recipient ? ` · ${item.recipient}` : ''}</span>
                </label>
            ))}
            {waiting.length === 0 && <p className="req-dialog__hint">Tidak ada barang yang masih ditunggu.</p>}
        </FlowDialog>
    );
}
