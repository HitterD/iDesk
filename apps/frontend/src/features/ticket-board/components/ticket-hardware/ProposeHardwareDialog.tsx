import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCatalog } from '@/features/hardware-request/hooks/useCatalog';
import { CATEGORY_ICONS } from '@/features/hardware-request/components/create/CatalogPicker';
import type { HardwareCatalog } from '@/features/hardware-request/types';
import { FLOW_LABEL, FLOW_OPTIONS, type HardwareRequestType } from './hardwareFlow';
import { useProposeHardware } from './useTicketHardware';
import './ticket-hardware.css';

const MAX_QUANTITY = 20;
const MAX_LINES = 20;
const MIN_REASON = 5;

interface Line { catalog: HardwareCatalog; quantity: number }

interface ProposeHardwareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ticketId: string;
    ticketNumber?: string;
    requesterName?: string;
    /** Starting text for the reason; the ticket title usually says what is broken. */
    defaultReason?: string;
}

/** ICT picks the request flow and the items; the requester then confirms it from the ticket chat. */
export const ProposeHardwareDialog: React.FC<ProposeHardwareDialogProps> = ({
    open, onOpenChange, ticketId, ticketNumber, requesterName, defaultReason = '',
}) => {
    const [flow, setFlow] = useState<HardwareRequestType>('HARDWARE_INSTALLATION');
    const [query, setQuery] = useState('');
    const [lines, setLines] = useState<Line[]>([]);
    const [reason, setReason] = useState(defaultReason);
    const { data: catalog = [], isLoading } = useCatalog({ active: true });
    const propose = useProposeHardware(ticketId);

    const results = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return catalog
            .filter((item) => !needle || `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(needle))
            .slice(0, 30);
    }, [catalog, query]);

    const quantityOf = (id: string) => lines.find((line) => line.catalog.id === id)?.quantity ?? 0;
    const setQuantity = (item: HardwareCatalog, quantity: number) => setLines((current) => {
        const next = Math.max(0, Math.min(MAX_QUANTITY, quantity));
        if (next === 0) return current.filter((line) => line.catalog.id !== item.id);
        if (current.some((line) => line.catalog.id === item.id)) {
            return current.map((line) => (line.catalog.id === item.id ? { ...line, quantity: next } : line));
        }
        return current.length >= MAX_LINES ? current : [...current, { catalog: item, quantity: next }];
    });

    const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
    const canSend = lines.length > 0 && reason.trim().length >= MIN_REASON && !propose.isPending;

    const close = () => {
        onOpenChange(false);
        setLines([]);
        setQuery('');
        setReason(defaultReason);
    };

    const send = () => {
        if (!canSend) return;
        propose.mutate(
            { requestType: flow, justification: reason.trim(), items: lines.map((line) => ({ catalogId: line.catalog.id, quantity: line.quantity })) },
            { onSuccess: close },
        );
    };

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
            <DialogContent className="thw-dialog flex flex-col max-w-[640px] max-h-[90vh] min-h-0 overflow-hidden p-0 gap-0">
                <header className="thw-head">
                    <DialogTitle className="thw-title">Usulkan hardware request</DialogTitle>
                    <DialogDescription className="thw-sub">
                        {requesterName ? <>Untuk <b>{requesterName}</b></> : 'Untuk pemohon tiket'}
                        {ticketNumber ? ` · tiket #${ticketNumber}` : ''}. Pemohon mengonfirmasi dari chat sebelum diajukan.
                    </DialogDescription>
                </header>

                <div className="thw-body">
                    <section className="thw-sec" aria-labelledby="thw-flow">
                        <h3 id="thw-flow" className="thw-label">Model flow</h3>
                        <div className="thw-flows" role="radiogroup" aria-labelledby="thw-flow">
                            {FLOW_OPTIONS.map((option) => (
                                <button key={option.value} type="button" role="radio" aria-checked={flow === option.value}
                                    className={cn('thw-flow', flow === option.value && 'is-selected')} onClick={() => setFlow(option.value)}>
                                    <b>{option.label}</b>
                                    <small>{option.hint}</small>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="thw-sec" aria-labelledby="thw-items">
                        <h3 id="thw-items" className="thw-label">Barang <span>{totalUnits > 0 ? `${totalUnits} unit` : 'pilih dari katalog'}</span></h3>
                        {lines.length > 0 && (
                            <ul className="thw-basket" aria-label="Barang dipilih">
                                {lines.map((line) => (
                                    <li key={line.catalog.id}>
                                        <span className="thw-basket-name">{line.catalog.name}</span>
                                        <Stepper value={line.quantity} name={line.catalog.name} onChange={(q) => setQuantity(line.catalog, q)} />
                                        <button type="button" className="thw-icon-btn" aria-label={`Hapus ${line.catalog.name}`}
                                            onClick={() => setQuantity(line.catalog, 0)}><X aria-hidden="true" /></button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <label className="thw-search">
                            <Search aria-hidden="true" />
                            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari barang, mis. mouse, monitor"
                                aria-label="Cari barang di katalog" />
                        </label>
                        <ul className="thw-catalog" aria-label="Katalog">
                            {isLoading && <li className="thw-empty">Memuat katalog…</li>}
                            {!isLoading && results.length === 0 && <li className="thw-empty">Tidak ada barang yang cocok.</li>}
                            {results.map((item) => {
                                const Icon = CATEGORY_ICONS[item.category] ?? CATEGORY_ICONS.OTHER;
                                const quantity = quantityOf(item.id);
                                return (
                                    <li key={item.id} className={cn(quantity > 0 && 'is-picked')}>
                                        <span className="thw-cat-ico"><Icon aria-hidden="true" /></span>
                                        <span className="thw-cat-name"><b>{item.name}</b><small>{item.code}</small></span>
                                        {quantity > 0
                                            ? <Stepper value={quantity} name={item.name} onChange={(q) => setQuantity(item, q)} />
                                            : <button type="button" className="thw-add" onClick={() => setQuantity(item, 1)} aria-label={`Tambah ${item.name}`}>
                                                <Plus aria-hidden="true" />Tambah
                                            </button>}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    <section className="thw-sec">
                        <label className="thw-label" htmlFor="thw-reason">Alasan untuk pemohon</label>
                        <textarea id="thw-reason" className="thw-reason" rows={3} maxLength={2000} value={reason}
                            onChange={(e) => setReason(e.target.value)} placeholder="Mis. Mouse lama rusak, diganti unit baru dari stok." />
                    </section>
                </div>

                <footer className="thw-foot">
                    <span className="thw-summary" aria-live="polite">
                        {lines.length > 0 ? `${totalUnits} unit · ${FLOW_LABEL[flow]}` : 'Belum ada barang'}
                    </span>
                    <Button type="button" variant="soft" onClick={close}>Batal</Button>
                    <Button type="button" variant="primary" onClick={send} disabled={!canSend} loading={propose.isPending}>
                        <Send aria-hidden="true" />Kirim ke pemohon
                    </Button>
                </footer>
            </DialogContent>
        </Dialog>
    );
};

function Stepper({ value, name, onChange }: { value: number; name: string; onChange: (value: number) => void }) {
    return (
        <span className="thw-stepper" role="group" aria-label={`Jumlah ${name}`}>
            <button type="button" onClick={() => onChange(value - 1)} aria-label={`Kurangi ${name}`}><Minus aria-hidden="true" /></button>
            <output aria-live="polite">{value}</output>
            <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_QUANTITY} aria-label={`Tambah jumlah ${name}`}>
                <Plus aria-hidden="true" />
            </button>
        </span>
    );
}
