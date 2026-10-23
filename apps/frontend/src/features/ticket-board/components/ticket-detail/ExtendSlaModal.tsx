import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { formatSlaDuration, MS_PER_MINUTE } from '@/lib/utils/slaDuration';
import { SlaAdjustmentReasonCategory } from './types';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { ModernDateTimePicker } from '@/components/ui/ModernDateTimePicker';

export interface ExtendSlaModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: {
        id: string;
        ticketNumber?: string;
        title: string;
        slaTarget?: string | null;
        priority?: string;
        status?: string;
        slaRemainingMinutes?: number | null;
    };
    onConfirm: (data: {
        reasonCategory: SlaAdjustmentReasonCategory;
        reasonText: string;
        newTargetDate?: string;
        minutes?: number;
    }) => Promise<void>;
    isLoading?: boolean;
}

const CATEGORY_OPTIONS: { id: SlaAdjustmentReasonCategory; title: string }[] = [
    { id: 'WAITING_USER', title: 'Menunggu User' },
    { id: 'WAITING_VENDOR', title: 'Menunggu Vendor' },
    { id: 'WAITING_APPROVAL', title: 'Persetujuan Manajerial' },
    { id: 'TECHNICAL_COMPLEXITY', title: 'Kompleksitas Teknis' },
    { id: 'EXTERNAL_DEPENDENCY', title: 'Dependensi Eksternal' },
    { id: 'OTHER', title: 'Alasan Lainnya' },
];
const DEFAULT_ADDED_MINUTES = 60;
const MAX_ADDED_MINUTES = 10080;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TARGET_DAYS = 90;
const PRESETS = [
    { label: '1 Minggu', days: 7 },
    { label: '2 Minggu', days: 14 },
    { label: '1 Bulan', days: 30 },
];

export const ExtendSlaModal: React.FC<ExtendSlaModalProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false }) => {
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const [addedMinutes, setAddedMinutes] = useState(DEFAULT_ADDED_MINUTES);
    const currentTargetDate = useMemo(() => ticket.slaTarget ? new Date(ticket.slaTarget) : new Date(), [ticket.slaTarget]);
    const minDate = useMemo(() => new Date(Math.max(currentTargetDate.getTime(), Date.now())), [currentTargetDate]);
    const maxDate = useMemo(() => new Date(Date.now() + MAX_TARGET_DAYS * DAY_MS), [isOpen]);
    const [selectedDate, setSelectedDate] = useState(() => new Date(Math.max(currentTargetDate.getTime(), Date.now()) + 7 * DAY_MS));
    const [selectedCategory, setSelectedCategory] = useState<SlaAdjustmentReasonCategory>('WAITING_USER');
    const [reasonText, setReasonText] = useState('');
    const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(0);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedDate(new Date(Math.max(currentTargetDate.getTime(), Date.now()) + 7 * DAY_MS));
        setSelectedPresetIndex(0);
        setSelectedCategory('WAITING_USER');
        setReasonText('');
        setAddedMinutes(DEFAULT_ADDED_MINUTES);
    }, [isOpen, currentTargetDate]);

    const isBeyondMaxDate = selectedDate > maxDate;
    const isValidDate = Number.isFinite(selectedDate.getTime()) && selectedDate > new Date() && !isBeyondMaxDate;
    const isReasonValid = reasonText.trim().length >= 5 && reasonText.trim().length <= 1000;
    const isValidMinutes = Number.isSafeInteger(addedMinutes) && addedMinutes > 0 && addedMinutes <= MAX_ADDED_MINUTES;
    const canSubmit = (isPaused ? isValidMinutes : isValidDate) && isReasonValid && !isLoading;
    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        await onConfirm({
            reasonCategory: selectedCategory,
            reasonText: reasonText.trim(),
            ...(isPaused ? { minutes: addedMinutes } : { newTargetDate: selectedDate.toISOString() }),
        });
    };

    return <TicketActionDialog open={isOpen} onClose={onClose} title="Perpanjang SLA" busy={isLoading}>
        <form onSubmit={handleSubmit} className="ticket-action-inner ticket-action-simple">
            <header className="ticket-action-header">
                <div><h2>Perpanjang SLA</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)}</p></div>
                <Button variant="subtle" type="button" aria-label="Tutup" onClick={onClose} disabled={isLoading}><X /></Button>
            </header>
            <div className="ticket-action-body">
                {isPaused ? <div className="ticket-action-field">
                    <p className="ticket-action-current">Sisa sebelumnya: {ticket.slaRemainingMinutes != null ? formatSlaDuration(ticket.slaRemainingMinutes * MS_PER_MINUTE) : 'Belum tersedia'} (dijeda)</p>
                    <label htmlFor="sla-added-minutes">Tambahan menit</label>
                    <input id="sla-added-minutes" type="number" min={1} max={MAX_ADDED_MINUTES} step={1}
                        value={Number.isNaN(addedMinutes) ? '' : addedMinutes} disabled={isLoading}
                        onChange={event => setAddedMinutes(event.target.valueAsNumber)} className="w-full" />
                    <p className="ticket-action-help">Sisa baru: {ticket.slaRemainingMinutes != null && isValidMinutes ? formatSlaDuration((ticket.slaRemainingMinutes + addedMinutes) * MS_PER_MINUTE) : '—'} (dijeda)</p>
                </div> : <div className="ticket-action-field">
                    <p className="ticket-action-current">Deadline saat ini: {ticket.slaTarget ? formatDateTimeID(ticket.slaTarget) : 'Belum ditentukan'}</p>
                    <label>Deadline baru</label>
                    <ModernDateTimePicker value={selectedDate} onChange={date => { setSelectedDate(date); setSelectedPresetIndex(null); }}
                        minDate={minDate} maxDate={maxDate} disabled={isLoading} placeholder="Pilih tanggal dan waktu deadline" />
                    <label htmlFor="sla-preset" className="ticket-action-help">Pilihan cepat</label>
                    <select id="sla-preset" value={selectedPresetIndex ?? ''} disabled={isLoading} onChange={event => {
                        if (event.target.value === '') return;
                        const index = Number(event.target.value);
                        setSelectedPresetIndex(index);
                        setSelectedDate(new Date(Math.max(currentTargetDate.getTime(), Date.now()) + PRESETS[index].days * DAY_MS));
                    }}>
                        <option value="">Tanggal khusus</option>
                        {PRESETS.map((preset, index) => <option key={preset.days} value={index}>{preset.label}</option>)}
                    </select>
                    {isBeyondMaxDate && <p role="alert" className="ticket-action-help">Target deadline baru tidak boleh melebihi 90 hari ke depan</p>}
                </div>}
                <div className="ticket-action-field">
                    <label htmlFor="sla-category">Kategori alasan</label>
                    <select id="sla-category" value={selectedCategory} disabled={isLoading}
                        onChange={event => setSelectedCategory(event.target.value as SlaAdjustmentReasonCategory)}>
                        {CATEGORY_OPTIONS.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}
                    </select>
                </div>
                <div className="ticket-action-field">
                    <label htmlFor="ticket-sla-reason">Rincian hambatan <span>(wajib)</span></label>
                    <textarea id="ticket-sla-reason" aria-label="Rincian hambatan" value={reasonText} disabled={isLoading}
                        onChange={event => setReasonText(event.target.value)} minLength={5} maxLength={1000} rows={3}
                        placeholder="Jelaskan alasan perpanjangan SLA…" required />
                    <p className="ticket-action-help">Minimal 5 karakter · {reasonText.trim().length}/1000</p>
                </div>
            </div>
            <footer className="ticket-action-footer"><div>
                <Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Batal</Button>
                <Button variant="primary" className="ticket-action-sla" aria-busy={isLoading} type="submit" disabled={!canSubmit}>
                    {isLoading && <Loader2 className="animate-spin" />}{isLoading ? 'Menyimpan...' : 'Perpanjang SLA'}
                </Button>
            </div></footer>
        </form>
    </TicketActionDialog>;
};

export default ExtendSlaModal;
