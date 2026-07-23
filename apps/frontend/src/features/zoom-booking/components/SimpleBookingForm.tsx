import { useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { CheckCircle2, Loader2, Video, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCheckAvailability, useCreateBooking, useDurationOptions, usePublicZoomSettings } from '../hooks';
import type { CreateBookingDto } from '../types';
import { SimpleRecurringField } from './SimpleRecurringField';
import { ZoomTimeSelect } from './ZoomTimeSelect';

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0');
    const min = i % 2 === 0 ? '00' : '30';
    return { time: `${hour}:${min}` };
});


function calculateEndTime(startTime: string, durationMinutes: number): string {
    if (!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const totalMins = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

export function buildRecurrencePattern(freq: string, interval: number, until: string): string {
    const untilClause = until ? `;UNTIL=${until.replace(/-/g, '')}T235959Z` : '';
    return `FREQ=${freq};INTERVAL=${interval}${untilClause}`;
}

export function SimpleBookingForm() {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [duration, setDuration] = useState(60);
    const [participantEmails, setParticipantEmails] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [freq, setFreq] = useState('WEEKLY');
    const [interval, setInterval] = useState(1);
    const [until, setUntil] = useState('');
    const [bookingSucceeded, setBookingSucceeded] = useState(false);
    const [successJoinUrl, setSuccessJoinUrl] = useState<string | null>(null);

    const { data: settings } = usePublicZoomSettings();
    const { data: durationOptions = [] } = useDurationOptions();
    const createBooking = useCreateBooking();
    const availability = useCheckAvailability(bookingDate || undefined, startTime || undefined, duration);

    useEffect(() => {
        if (durationOptions.length && !durationOptions.includes(duration)) {
            setDuration(durationOptions[0]);
        }
    }, [duration, durationOptions]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setBookingDate('');
        setStartTime('');
        setDuration(durationOptions.includes(60) ? 60 : (durationOptions[0] ?? 60));
        setParticipantEmails('');
        setIsRecurring(false);
        setFreq('WEEKLY');
        setInterval(1);
        setUntil('');
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!title.trim()) {
            toast.error('Judul meeting wajib diisi');
            return;
        }
        if (!bookingDate) {
            toast.error('Tanggal wajib dipilih');
            return;
        }
        if (!startTime) {
            toast.error('Jam mulai wajib diisi');
            return;
        }
        if (availability.data?.available === false) {
            toast.error(availability.data.reason || 'Jam ini tidak tersedia');
            return;
        }

        const computedUntil = isRecurring
            ? (until || format(addDays(parseISO(bookingDate), 30), 'yyyy-MM-dd'))
            : '';

        const dto: CreateBookingDto = {
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: participantEmails
                .split(',')
                .map((email) => email.trim())
                .filter((email) => email.includes('@')),
            recurrencePattern: isRecurring ? buildRecurrencePattern(freq, interval, computedUntil) : undefined,
        };

        try {
            const result = await createBooking.mutateAsync(dto);
            const count = Array.isArray(result) ? result.length : 1;
            const booking = Array.isArray(result) ? result[0] : result;

            toast.success(`Booking berhasil! ${count > 1 ? `${count} jadwal berulang dibuat.` : 'Link Zoom dikirim via email.'}`);
            setSuccessJoinUrl(booking?.meeting?.joinUrl ?? null);
            setBookingSucceeded(true);
            resetForm();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membuat booking. Coba ubah jam dan submit ulang.');
        }
    };

    if (bookingSucceeded) {
        return (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div>
                    <h2 className="text-lg font-bold">Booking Berhasil!</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Link Zoom akan dikirim via email.</p>
                </div>
                {successJoinUrl && (
                    <Button onClick={() => window.open(successJoinUrl, '_blank')}>Join Meeting Sekarang</Button>
                )}
                <Button
                    className="w-full"
                    onClick={() => {
                        setBookingSucceeded(false);
                        setSuccessJoinUrl(null);
                    }}
                    variant="outline"
                >
                    Buat Booking Baru
                </Button>
            </div>
        );
    }

    const availabilityClassName = availability.isLoading
        ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        : availability.data?.available
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';

    return (
        <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="simple-booking-title">
                    Judul meeting <span aria-hidden="true">*</span>
                </Label>
                <Input
                    aria-label="Judul"
                    id="simple-booking-title"
                    maxLength={100}
                    minLength={5}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Contoh: Weekly Sync Meeting"
                    value={title}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tanggal <span aria-hidden="true">*</span></Label>
                    <ModernDatePicker
                        maxDate={addDays(new Date(), settings?.advanceBookingDays || 30)}
                        minDate={new Date()}
                        onChange={(date) => setBookingDate(format(date, 'yyyy-MM-dd'))}
                        placeholder="Pilih tanggal"
                        value={bookingDate ? parseISO(bookingDate) : undefined}
                    />
                </div>
                <div>
                    <ZoomTimeSelect
                        label="Jam Mulai *"
                        value={startTime}
                        onChange={(t) => setStartTime(t)}
                        options={TIME_OPTIONS}
                        placeholder="00:00"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Durasi <span aria-hidden="true">*</span>
                </Label>
                <Select onValueChange={(value) => setDuration(Number(value))} value={String(duration)}>
                    <SelectTrigger className="w-full h-9 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Pilih durasi" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-lg">
                        {durationOptions.map((option) => (
                            <SelectItem
                                key={option}
                                value={String(option)}
                                className="rounded-lg text-xs py-2 px-3 focus:bg-blue-50 dark:focus:bg-blue-950/40 font-medium cursor-pointer"
                            >
                                {`${option} menit (${option >= 60 ? (option / 60) + ' jam' : option + 'm'})`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {startTime && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                    <span className="font-medium">Waktu meeting</span>
                    <span className="font-mono font-semibold tabular-nums">
                        {startTime}–{calculateEndTime(startTime, duration)} WIB
                    </span>
                </div>
            )}

            {bookingDate && startTime && (
                <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm ${availabilityClassName}`}>
                    {availability.isLoading ? (
                        <><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Mengecek ketersediaan...</>
                    ) : availability.data?.available ? (
                        <><CheckCircle2 className="h-4 w-4 shrink-0" />Jam ini tersedia</>
                    ) : (
                        <><XCircle className="h-4 w-4 shrink-0" />{availability.data?.reason || 'Jam ini tidak tersedia'}</>
                    )}
                </div>
            )}

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="simple-booking-description">Deskripsi (Opsional)</Label>
                <Textarea
                    id="simple-booking-description"
                    maxLength={500}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Agenda meeting..."
                    rows={3}
                    value={description}
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="simple-booking-participants">
                    Peserta (Opsional)
                </Label>
                <Input
                    id="simple-booking-participants"
                    onChange={(event) => setParticipantEmails(event.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    value={participantEmails}
                />
            </div>

            <SimpleRecurringField
                freq={freq}
                interval={interval}
                isRecurring={isRecurring}
                setFreq={setFreq}
                setInterval={setInterval}
                setIsRecurring={setIsRecurring}
                setUntil={setUntil}
                until={until}
            />

            <Button
                className="group mt-1 w-full rounded-full font-semibold transition-transform duration-200 [transition-timing-function:var(--ease-out)] hover:-translate-y-0.5 active:translate-y-0"
                disabled={createBooking.isPending || availability.data?.available === false}
                type="submit"
            >
                {createBooking.isPending ? 'Membuat...' : 'Buat meeting'}
                {!createBooking.isPending && (
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-0.5">
                        <Video className="h-3 w-3" aria-hidden="true" />
                    </span>
                )}
            </Button>
        </form>
    );
}
