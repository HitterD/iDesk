/**
 * ZoomRescheduleView: move a booking to a free slot on the same Zoom account (so its link stays valid).
 * Availability is shown up front (ZoomSlotPicker), and the old and new times are compared before saving.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ArrowRight, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ZoomBooking } from '../types';
import { useRescheduleOwnBooking, useZoomCalendar, usePublicZoomSettings } from '../hooks/useZoomBooking';
import { ZOOM_DURATION_OPTIONS } from '../constants/duration-constants';
import { clashWith, endsBeforeMidnight, fromMinutes, occupants, toMinutes } from '../utils/slotAvailability';
import { ZoomSlotPicker } from './ZoomSlotPicker';

interface ZoomRescheduleViewProps {
    booking: ZoomBooking;
    onClose: () => void;
    onSuccess?: () => void;
}

type Scope = 'this' | 'following' | 'all';
const SCOPES: { value: Scope; label: string }[] = [
    { value: 'this', label: 'Hanya jadwal ini' },
    { value: 'following', label: 'Ini & berikutnya' },
    { value: 'all', label: 'Semua dalam seri' },
];
const DEFAULT_ADVANCE_DAYS = 30;

const hhmm = (time: string) => time.substring(0, 5);
const dayLabel = (date: string) => format(parseISO(date), 'EEEE, d MMM yyyy', { locale: idLocale });

function slotTimes(start = '08:00', end = '18:00', interval = 30): string[] {
    const times: string[] = [];
    for (let m = toMinutes(start); m < toMinutes(end); m += interval) times.push(fromMinutes(m));
    return times;
}

export function ZoomRescheduleView({ booking, onClose, onSuccess }: ZoomRescheduleViewProps) {
    const [date, setDate] = useState(booking.bookingDate);
    const [startTime, setStartTime] = useState(hhmm(booking.startTime));
    const [duration, setDuration] = useState(booking.durationMinutes);
    const [scope, setScope] = useState<Scope>('this');

    const reschedule = useRescheduleOwnBooking();
    const { data: settings } = usePublicZoomSettings();
    const { data: calendar, isFetching } = useZoomCalendar(booking.zoomAccountId, date, date);

    useEffect(() => {
        setDate(booking.bookingDate);
        setStartTime(hhmm(booking.startTime));
        setDuration(booking.durationMinutes);
    }, [booking]);

    const times = useMemo(
        () => slotTimes(settings?.slotStartTime, settings?.slotEndTime, settings?.slotIntervalMinutes || 30),
        [settings],
    );
    const durations = useMemo(() => {
        const allowed = settings?.allowedDurations?.length ? settings.allowedDurations : ZOOM_DURATION_OPTIONS.slice(0, 6).map((o) => o.value);
        return [...new Set([...allowed, booking.durationMinutes])].sort((a, b) => a - b);
    }, [settings, booking.durationMinutes]);

    const slots = calendar?.find((d) => d.date === date)?.slots;
    const clash = startTime ? clashWith(occupants(slots, booking.id), startTime, duration) : undefined;
    const fitsDay = startTime ? endsBeforeMidnight(startTime, duration) : false;
    const changed = date !== booking.bookingDate || startTime !== hhmm(booking.startTime) || duration !== booking.durationMinutes;
    const canSave = changed && Boolean(startTime) && fitsDay && !clash && !isFetching && !reschedule.isPending;

    // A new day may not offer the old start time; make the user pick one there rather than keep a hidden value.
    const changeDate = (next: string) => {
        setDate(next);
        if (next !== date) setStartTime('');
    };

    const handleSubmit = async () => {
        if (!canSave) return;
        try {
            await reschedule.mutateAsync({
                bookingId: booking.id,
                data: { bookingDate: date, startTime, durationMinutes: duration, scope: booking.seriesId ? scope : undefined },
            });
            toast.success('Jadwal meeting berhasil dipindah');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menjadwalkan ulang');
        }
    };

    const newEnd = startTime ? fromMinutes(toMinutes(startTime) + duration) : '';

    return (
        <div className="zr">
            <div className="zr-current">
                <span className="zr-ico"><Video aria-hidden="true" /></span>
                <div className="min-w-0">
                    <b className="truncate block">{booking.title}</b>
                    <small>
                        Saat ini: <span className="capitalize">{dayLabel(booking.bookingDate)}</span> · {hhmm(booking.startTime).replace(':', '.')}–{hhmm(booking.endTime).replace(':', '.')} WIB
                    </small>
                </div>
            </div>

            <ZoomSlotPicker
                date={date}
                onDateChange={changeDate}
                startTime={startTime}
                onStartTimeChange={setStartTime}
                duration={duration}
                onDurationChange={setDuration}
                slots={slots}
                loading={isFetching}
                times={times}
                durations={durations}
                workingDays={settings?.workingDays}
                maxDaysAhead={settings?.advanceBookingDays ?? DEFAULT_ADVANCE_DAYS}
                excludeBookingId={booking.id}
                current={{ date: booking.bookingDate, startTime: hhmm(booking.startTime) }}
            />

            {booking.seriesId && (
                <div className="zr-scope">
                    <span className="zsp-label" id="zr-scope">Terapkan ke</span>
                    <div className="zsp-durations" role="radiogroup" aria-labelledby="zr-scope">
                        {SCOPES.map((s) => (
                            <button key={s.value} type="button" role="radio" aria-checked={scope === s.value}
                                className={cn('zsp-chip', scope === s.value && 'is-selected')} onClick={() => setScope(s.value)}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {changed && startTime && (
                <div className="zr-compare" aria-label="Perubahan jadwal">
                    <span><small>Lama</small><b className="capitalize">{format(parseISO(booking.bookingDate), 'EEE, d MMM', { locale: idLocale })} · {hhmm(booking.startTime).replace(':', '.')}</b></span>
                    <ArrowRight aria-hidden="true" />
                    <span><small>Baru</small><b className="capitalize">{format(parseISO(date), 'EEE, d MMM', { locale: idLocale })} · {startTime.replace(':', '.')}–{newEnd.replace(':', '.')}</b></span>
                </div>
            )}

            <p className="zr-note">Link Zoom tidak berubah. Hanya jam kosong di akun Zoom yang sama yang bisa dipilih; peserta perlu diberi tahu jadwal barunya.</p>

            <div className="zr-actions">
                <Button variant="soft" onClick={onClose}>Batal</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={!canSave} loading={reschedule.isPending}>
                    Simpan jadwal baru
                </Button>
            </div>
        </div>
    );
}
