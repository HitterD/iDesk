import { useState } from 'react';
import { FlowDialog } from './FlowDialog';

export interface ProcureItem { id: string; name: string; recipient: string; deliveryStatus: string; procurementDecision: string | null }
export interface UnitDecision { id: string; decision: 'APPROVED' | 'REJECTED' | null; vendor: string; unitCost: string; invoiceNumber: string; invoiceDate: string }
interface Line { itemIds: string[]; decision: 'APPROVED' | 'REJECTED'; vendor?: string; unitCost?: number; invoiceNumber?: string; invoiceDate?: string }

const sameLine = (a: UnitDecision, b: UnitDecision): boolean =>
    a.decision === b.decision && a.vendor === b.vendor && a.unitCost === b.unitCost && a.invoiceNumber === b.invoiceNumber && a.invoiceDate === b.invoiceDate;

/** Units decided the same way (same vendor, price, invoice) travel as one line; a cancelled unit carries no vendor data. */
export function procureLines(units: UnitDecision[]): Line[] {
    const lines: Array<{ key: UnitDecision; line: Line }> = [];
    for (const unit of units) {
        if (!unit.decision) continue;
        const rejected = unit.decision === 'REJECTED';
        const key = rejected ? { ...unit, vendor: '', unitCost: '', invoiceNumber: '', invoiceDate: '' } : unit;
        const found = lines.find((entry) => sameLine(entry.key, key));
        if (found) { found.line.itemIds.push(unit.id); continue; }
        const line: Line = { itemIds: [unit.id], decision: unit.decision };
        if (!rejected) {
            line.vendor = unit.vendor.trim();
            line.unitCost = Number(unit.unitCost);
            if (unit.invoiceNumber.trim()) line.invoiceNumber = unit.invoiceNumber.trim();
            if (unit.invoiceDate) line.invoiceDate = unit.invoiceDate;
        }
        lines.push({ key, line });
    }
    return lines.map((entry) => entry.line);
}

const complete = (unit: UnitDecision): boolean =>
    unit.decision === 'REJECTED' || (unit.decision === 'APPROVED' && unit.vendor.trim() !== '' && unit.unitCost !== '' && Number(unit.unitCost) >= 0);

interface ProcurementDialogProps {
    open: boolean;
    onClose: () => void;
    items: ProcureItem[];
    onSubmit: (payload: { lines: Line[] }) => Promise<unknown>;
}

/** Procurement decision per unit: Beli (vendor and price) or Batal. IT can swap an unavailable item before this. */
export function ProcurementDialog({ open, onClose, items, onSubmit }: ProcurementDialogProps) {
    const [units, setUnits] = useState<UnitDecision[]>(() =>
        items.map((item) => ({ id: item.id, decision: null, vendor: '', unitCost: '', invoiceNumber: '', invoiceDate: '' })));
    const patch = (id: string, change: Partial<UnitDecision>) => setUnits((current) => current.map((u) => (u.id === id ? { ...u, ...change } : u)));

    return (
        <FlowDialog
            open={open} onClose={onClose} title="Catat pembelian barang" intro="Tiap unit: dibeli (isi vendor & harga) atau dibatalkan."
            submitLabel="Simpan keputusan" canSubmit={units.length > 0 && units.every(complete)} onSubmit={() => onSubmit({ lines: procureLines(units) })}
        >
            {items.map((item) => {
                const unit = units.find((u) => u.id === item.id)!;
                return (
                    <div key={item.id} role="group" aria-label={`${item.name}${item.recipient ? ` untuk ${item.recipient}` : ''}`} className="req-dialog__unit">
                        <b>{item.name}{item.recipient ? ` · ${item.recipient}` : ''}</b>
                        <div role="radiogroup" className="req-dialog__seg">
                            {(['APPROVED', 'REJECTED'] as const).map((decision) => (
                                <button
                                    key={decision} type="button" role="radio" aria-checked={unit.decision === decision}
                                    aria-label={decision === 'APPROVED' ? 'Beli' : 'Batal'} className={unit.decision === decision ? 'is-on' : ''}
                                    onClick={() => patch(item.id, { decision })}
                                >
                                    {decision === 'APPROVED' ? 'Beli' : 'Batal'}
                                </button>
                            ))}
                        </div>
                        {unit.decision === 'APPROVED' && (
                            <div className="req-dialog__row">
                                <input aria-label="Vendor" placeholder="Vendor" value={unit.vendor} onChange={(e) => patch(item.id, { vendor: e.target.value })} />
                                <input aria-label="Harga satuan" placeholder="Harga satuan" inputMode="decimal" value={unit.unitCost} onChange={(e) => patch(item.id, { unitCost: e.target.value.replace(/[^\d.]/g, '') })} />
                                <input aria-label="No. invoice" placeholder="No. invoice (opsional)" value={unit.invoiceNumber} onChange={(e) => patch(item.id, { invoiceNumber: e.target.value })} />
                                <input aria-label="Tanggal invoice" type="date" value={unit.invoiceDate} onChange={(e) => patch(item.id, { invoiceDate: e.target.value })} />
                            </div>
                        )}
                    </div>
                );
            })}
        </FlowDialog>
    );
}
