import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import { ActionChips, ActionSelect } from './ActionControls';
import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MS_PER_MINUTE } from '@/lib/utils/slaDuration';
import { formatSlaTime, useSlaClock } from '@/lib/slaCountdown';
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

const CATEGORY_OPTIONS: { value: SlaAdjustmentReasonCategory; label: string }[] = [
    { value: 'WAITING_USER', label: 'Menunggu User' },
    { value: 'WAITING_VENDOR', label: 'Menunggu Vendor' },
    { value: 'WAITING_APPROVAL', label: 'Persetujuan Manajerial' },
    { value: 'TECHNICAL_COMPLEXITY', label: 'Kompleksitas Teknis' },
    { value: 'EXTERNAL_DEPENDENCY', label: 'Dependensi Eksternal' },
    { value: 'OTHER', label: 'Alasan Lainnya' },
];
const DEFAULT_ADDED_MINUTES = 60;
const MAX_ADDED_MINUTES = 10080;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TARGET_DAYS = 90;
const PRESETS = [
    { value: '7', label: '1 Minggu', days: 7 },
    { value: '14', label: '2 Minggu', days: 14 },
    { value: '30', label: '1 Bulan', days: 30 },
] as const;
type PresetValue = typeof PRESETS[number]['value'];

export const ExtendSlaModal: React.FC<ExtendSlaModalProps> = ({ isOpen, onClose, ticket, onConfirm, isLoading = false }) => {
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const slaClock = useSlaClock();
    const [addedMinutes, setAddedMinutes] = useState(DEFAULT_ADDED_MINUTES);
    const currentTargetDate = useMemo(() => ticket.slaTarget ? new Date(ticket.slaTarget) : new Date(), [ticket.slaTarget]);
    const minDate = useMemo(() => new Date(Math.max(currentTargetDate.getTime(), Date.now())), [currentTargetDate]);
    const maxDate = useMemo(() => new Date(Date.now() + MAX_TARGET_DAYS * DAY_MS), [isOpen]);
    const [selectedDate, setSelectedDate] = useState(() => new Date(Math.max(currentTargetDate.getTime(), Date.now()) + 7 * DAY_MS));
    const [selectedCategory, setSelectedCategory] = useState<SlaAdjustmentReasonCategory>('WAITING_USER');
    const [reasonText, setReasonText] = useState('');
    const [selectedPreset, setSelectedPreset] = useState<PresetValue | null>(PRESETS[0].value);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedDate(new Date(Math.max(currentTargetDate.getTime(), Date.now()) + 7 * DAY_MS));
        setSelectedPreset(PRESETS[0].value);
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
                    <p className="ticket-action-current">Sisa sebelumnya: {ticket.slaRemainingMinutes != null ? formatSlaTime(ticket.slaRemainingMinutes * MS_PER_MINUTE, slaClock, ticket.priority) : 'Belum tersedia'} (dijeda)</p>
                    <label htmlFor="sla-added-minutes">Tambahan menit</label>
                    <input id="sla-added-minutes" type="number" min={1} max={MAX_ADDED_MINUTES} step={1}
                        value={Number.isNaN(addedMinutes) ? '' : addedMinutes} disabled={isLoading}
                        onChange={event => setAddedMinutes(event.target.valueAsNumber)} className="w-full" />
                    <p className="ticket-action-help">Sisa baru: {ticket.slaRemainingMinutes != null && isValidMinutes ? formatSlaTime((ticket.slaRemainingMinutes + addedMinutes) * MS_PER_MINUTE, slaClock, ticket.priority) : '—'} (dijeda)</p>
                </div> : <div className="ticket-action-field">
                    <p className="ticket-action-current">Deadline saat ini: {ticket.slaTarget ? formatDateTimeID(ticket.slaTarget) : 'Belum ditentukan'}</p>
                    <label>Deadline baru</label>
                    <ModernDateTimePicker value={selectedDate} onChange={date => { setSelectedDate(date); setSelectedPreset(null); }}
                        minDate={minDate} maxDate={maxDate} disabled={isLoading} placeholder="Pilih tanggal dan waktu deadline" />
                    <span id="sla-preset-label" className="ticket-action-help">Pilihan cepat</span>
                    <ActionChips labelledBy="sla-preset-label" options={PRESETS} value={selectedPreset} disabled={isLoading} onSelect={value => {
                        const preset = PRESETS.find(p => p.value === value)!;
                        setSelectedPreset(value);
                        setSelectedDate(new Date(Math.max(currentTargetDate.getTime(), Date.now()) + preset.days * DAY_MS));
                    }} />
                    {isBeyondMaxDate && <p role="alert" className="ticket-action-help">Target deadline baru tidak boleh melebihi 90 hari ke depan</p>}
                </div>}
                <div className="ticket-action-field">
                    <label htmlFor="sla-category">Kategori alasan</label>
                    <ActionSelect id="sla-category" options={CATEGORY_OPTIONS} value={selectedCategory} disabled={isLoading}
                        onValueChange={value => setSelectedCategory(value as SlaAdjustmentReasonCategory)} />
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
