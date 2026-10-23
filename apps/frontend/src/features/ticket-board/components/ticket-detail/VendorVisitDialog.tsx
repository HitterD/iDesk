import React, { useEffect, useMemo, useState } from 'react';
import { Hourglass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModernDateTimePicker } from '@/components/ui/ModernDateTimePicker';
import { TicketActionDialog } from './TicketActionDialog';
import { ActionChips } from './ActionControls';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_AHEAD = 90;
const VISIT_HOUR_WIB = 9;
const THURSDAY = 4;
const WIB_DAY = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' });

/** `daysAhead` days from today (in WIB) at `hour`:00 WIB. */
function wibAt(daysAhead: number, hour: number, now: Date): Date {
    const wib = new Date(now.getTime() + WIB_OFFSET_MS);
    return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + daysAhead, hour) - WIB_OFFSET_MS);
}

type QuickPick = 'tomorrow' | 'thursday' | 'next_week';

/** Same default as the backend: the vendors' usual Thursday visit, 09:00 WIB, never today. */
function quickPicks(now: Date): Record<QuickPick, Date> {
    const wibDay = new Date(now.getTime() + WIB_OFFSET_MS).getUTCDay();
    return {
        tomorrow: wibAt(1, VISIT_HOUR_WIB, now),
        thursday: wibAt(((THURSDAY - wibDay + 7) % 7) || 7, VISIT_HOUR_WIB, now),
        next_week: wibAt(7, VISIT_HOUR_WIB, now),
    };
}

interface VendorVisitDialogProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: { id: string; ticketNumber?: string; title?: string; vendorVisitAt?: string | null };
    /** start: moving the ticket to Waiting Vendor; reschedule: moving an existing appointment. */
    mode: 'start' | 'reschedule';
    onConfirm: (vendorVisitAt: string) => Promise<void> | void;
    isLoading?: boolean;
}

/** Agreed vendor visit time for a Waiting Vendor ticket; the PIC is reminded 30 minutes before. */
export const VendorVisitDialog: React.FC<VendorVisitDialogProps> = ({ isOpen, onClose, ticket, mode, onConfirm, isLoading = false }) => {
    const [now, setNow] = useState(() => new Date());
    const picks = useMemo(() => quickPicks(now), [now]);
    const [visitAt, setVisitAt] = useState<Date>(picks.thursday);
    const [pick, setPick] = useState<QuickPick | null>('thursday');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const opened = new Date();
        const fresh = quickPicks(opened);
        const current = ticket.vendorVisitAt ? new Date(ticket.vendorVisitAt) : null;
        setNow(opened);
        setVisitAt(mode === 'reschedule' && current && current > opened ? current : fresh.thursday);
        setPick(mode === 'reschedule' && current ? null : 'thursday');
        setError(null);
    }, [isOpen, mode, ticket.vendorVisitAt]);

    const options = useMemo(() => [
        { value: 'tomorrow' as const, label: `Besok · ${WIB_DAY.format(picks.tomorrow)}` },
        { value: 'thursday' as const, label: `Kamis · ${WIB_DAY.format(picks.thursday)}` },
        { value: 'next_week' as const, label: `Minggu depan · ${WIB_DAY.format(picks.next_week)}` },
    ], [picks]);

    const maxDate = useMemo(() => new Date(now.getTime() + MAX_DAYS_AHEAD * DAY_MS), [now]);
    const isPast = visitAt.getTime() <= Date.now();
    const isTooFar = visitAt.getTime() > maxDate.getTime();

    const handleConfirm = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (isLoading || isPast || isTooFar) return;
        try {
            setError(null);
            await onConfirm(visitAt.toISOString());
        } catch (cause: any) {
            setError(cause?.response?.data?.message || cause?.message || 'Gagal menyimpan jadwal vendor');
        }
    };

    const title = mode === 'start' ? 'Menunggu vendor' : 'Ubah jadwal vendor';
    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title={title} busy={isLoading}>
            <form className="ticket-action-inner ticket-action-simple" onSubmit={handleConfirm}>
                <header className="ticket-action-header">
                    <div><h2>{title}</h2><p>#{ticket.ticketNumber || ticket.id.slice(0, 8)}{ticket.title ? ` · ${ticket.title}` : ''}</p></div>
                    <Button variant="subtle" size="icon" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={isLoading}><X /></Button>
                </header>
                <div className="ticket-action-body">
                    {mode === 'start' && <p className="ticket-action-current">SLA dijeda selama menunggu vendor dan berjalan lagi saat status diubah.</p>}
                    <div className="ticket-action-field">
                        <label>Janji kunjungan / respon vendor</label>
                        <ModernDateTimePicker value={visitAt} minDate={now} maxDate={maxDate} disabled={isLoading}
                            onChange={(date) => { setVisitAt(date); setPick(null); setError(null); }} placeholder="Pilih tanggal dan jam" />
                        <span id="vendor-visit-pick-label" className="ticket-action-help">Pilihan cepat (09.00 WIB)</span>
                        <ActionChips labelledBy="vendor-visit-pick-label" options={options} value={pick} disabled={isLoading}
                            onSelect={(value) => { setPick(value); setVisitAt(picks[value]); setError(null); }} />
                        {isPast && <p role="alert" className="ticket-action-help">Jadwal harus di masa mendatang.</p>}
                        {isTooFar && <p role="alert" className="ticket-action-help">Jadwal maksimal {MAX_DAYS_AHEAD} hari ke depan.</p>}
                        {error && <p role="alert">{error}</p>}
                        <p className="ticket-action-help">PIC diingatkan lewat email 30 menit sebelum jadwal.</p>
                    </div>
                </div>
                <footer className="ticket-action-footer"><div>
                    <Button variant="soft" type="button" onClick={onClose} disabled={isLoading}>Batal</Button>
                    <Button variant="primary" type="submit" loading={isLoading} disabled={isLoading || isPast || isTooFar}>
                        <Hourglass />{mode === 'start' ? 'Tunggu vendor' : 'Simpan jadwal'}
                    </Button>
                </div></footer>
            </form>
        </TicketActionDialog>
    );
};
