import { useEffect, useState, useMemo } from 'react';
import { addDays, format, parseISO, isSameDay } from 'date-fns';
import { CheckCircle2, Loader2, Video, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { Textarea } from '@/components/ui/textarea';
import {
    useCheckAvailability,
    useCreateBooking,
    useDurationOptions,
    usePublicZoomSettings,
    useDaySlotsAvailability,
} from '../hooks';
import type { CreateBookingDto } from '../types';
import { SimpleRecurringField } from './SimpleRecurringField';
import { ZoomTimeSelect, type TimeSlotOption } from './ZoomTimeSelect';
import { ZoomEndTimeSelect, type EndTimeOption } from './ZoomEndTimeSelect';
import { ZoomParticipantPicker } from './ZoomParticipantPicker';


function calculateEndTime(startTime: string, durationMinutes: number): string {
    if (!startTime) return '';
    const [h, m] = startTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    const totalMins = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMins / 60) % 24;
    const endM = totalMins % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

export function calculateDuration(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 60;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 60;
    const totalStart = sh * 60 + sm;
    const totalEnd = eh * 60 + em;
    const diff = totalEnd - totalStart;
    return diff > 0 ? diff : 60;
}

export function formatDurationLabel(minutes: number): string {
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} jam`;
    return `${hours} jam ${remainingMins} mnt`;
}

export function buildRecurrencePattern(freq: string, interval: number, until: string): string {
    const untilClause = until ? `;UNTIL=${until.replace(/-/g, '')}T235959Z` : '';
    return `FREQ=${freq};INTERVAL=${interval}${untilClause}`;
}

export function computeEndTimeOptions(
    startTime: string,
    bookingDate: string,
    settings: any,
    durationOptions: number[],
    slots?: Array<{
        time: string;
        available: boolean;
        availableAccountsCount: number;
        totalAccountsCount?: number;
        reason?: string;
        exceedsOperatingHours?: boolean;
    }>,
): EndTimeOption[] {
    if (!startTime) return [];
    const [sh, sm] = startTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm)) return [];

    const startMins = sh * 60 + sm;
    const endH = Number(settings?.slotEndTime?.split(':')[0] || '18');
    const endM = Number(settings?.slotEndTime?.split(':')[1] || '00');
    const closingMins = (endH === 0 && endM === 0) ? 24 * 60 : (endH * 60 + endM);

    const intervals = (durationOptions && durationOptions.length > 0)
        ? [...durationOptions].sort((a, b) => a - b)
        : [30, 60, 90, 120, 150, 180, 210, 240];

    const isTodayBooking = bookingDate ? isSameDay(parseISO(bookingDate), new Date()) : false;
    const nowStr = format(new Date(), 'HH:mm');
    const intervalStep = settings?.slotIntervalMinutes || 30;

    const options: EndTimeOption[] = [];
    let encounterBlocker = false;
    let blockerReason = '';

    for (const dur of intervals) {
        const endTotal = startMins + dur;
        const h = Math.floor(endTotal / 60) % 24;
        const m = endTotal % 60;
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        // 1. If an earlier sub-slot was already full/blocked, all subsequent end times are also blocked
        if (encounterBlocker) {
            options.push({
                value: timeStr,
                time: timeStr,
                durationMinutes: dur,
                isUnavailable: true,
                reason: blockerReason || 'Penuh',
            });
            continue;
        }

        // 2. Check if exceeds closing hours or past midnight
        if (endTotal > closingMins || endTotal > 24 * 60) {
            encounterBlocker = true;
            blockerReason = 'Melebihi jam operasional';
            options.push({
                value: timeStr,
                time: timeStr,
                durationMinutes: dur,
                isUnavailable: true,
                reason: blockerReason,
                exceedsOperatingHours: true,
            });
            continue;
        }

        // 3. Verify all sub-slots from startMins to endTotal
        let intervalBlocked = false;
        let intervalReason = '';

        let curSlotMins = startMins;
        while (curSlotMins < endTotal) {
            const curH = Math.floor(curSlotMins / 60);
            const curM = curSlotMins % 60;
            const curSlotTime = `${curH.toString().padStart(2, '0')}:${curM.toString().padStart(2, '0')}`;

            const isPast = isTodayBooking && curSlotTime < nowStr;
            if (isPast) {
                intervalBlocked = true;
                intervalReason = 'Waktu sudah terlewat';
                break;
            }

            if (slots && slots.length > 0) {
                const slotData = slots.find((s) => s.time === curSlotTime);
                if (slotData) {
                    if (slotData.exceedsOperatingHours) {
                        intervalBlocked = true;
                        intervalReason = 'Melebihi jam operasional';
                        break;
                    }
                    if (!slotData.available || slotData.availableAccountsCount === 0) {
                        intervalBlocked = true;
                        intervalReason = slotData.reason || (slotData.totalAccountsCount ? `Penuh (${slotData.totalAccountsCount} akun)` : 'Penuh');
                        break;
                    }
                }
            }

            curSlotMins += intervalStep;
        }

        if (intervalBlocked) {
            encounterBlocker = true;
            blockerReason = intervalReason;
            options.push({
                value: timeStr,
                time: timeStr,
                durationMinutes: dur,
                isUnavailable: true,
                reason: blockerReason,
            });
        } else {
            options.push({
                value: timeStr,
                time: timeStr,
                durationMinutes: dur,
                isUnavailable: false,
            });
        }
    }

    return options;
}


interface SimpleBookingFormProps {
    onSuccessViewBookings?: () => void;
    selectedDate?: string;
    onDateChange?: (date: string) => void;
}

export function SimpleBookingForm({
    onSuccessViewBookings,
    selectedDate,
    onDateChange,
}: SimpleBookingFormProps = {}) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState(selectedDate || '');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [participantEmails, setParticipantEmails] = useState<string[]>([]);
    const [isRecurring, setIsRecurring] = useState(false);
    const [freq, setFreq] = useState('WEEKLY');
    const [interval, setInterval] = useState(1);
    const [until, setUntil] = useState('');
    const [allowDoubleBooking, setAllowDoubleBooking] = useState(false);
    const [bookingSucceeded, setBookingSucceeded] = useState(false);
    const [successJoinUrl, setSuccessJoinUrl] = useState<string | null>(null);

    // Duration is dynamically derived from startTime and endTime
    const duration = useMemo(() => {
        return calculateDuration(startTime, endTime);
    }, [startTime, endTime]);


    useEffect(() => {
        if (selectedDate && selectedDate !== bookingDate) {
            setBookingDate(selectedDate);
        }
    }, [selectedDate]);

    // Reset double booking option when time or date changes
    useEffect(() => {
        setAllowDoubleBooking(false);
    }, [bookingDate, startTime, endTime]);

    const { data: settings } = usePublicZoomSettings();
    const { data: durationOptions = [] } = useDurationOptions();
    const createBooking = useCreateBooking();
    const availability = useCheckAvailability(bookingDate || undefined, startTime || undefined, duration);
    const daySlotsQuery = useDaySlotsAvailability(bookingDate || undefined, duration);

    // Current slot details
    const currentSlot = useMemo(() => {
        return daySlotsQuery.data?.slots?.find((s) => s.time === startTime);
    }, [daySlotsQuery.data, startTime]);

    // True when slot is unavailable because all accounts are booked (not because it's past or exceeds closing hours)
    const isAllAccountsFull = useMemo(() => {
        if (!bookingDate || !startTime) return false;
        if (currentSlot?.exceedsOperatingHours) return false;
        if (availability.data && !availability.data.available) return true;
        if (currentSlot && !currentSlot.available) return true;
        return false;
    }, [bookingDate, startTime, currentSlot, availability.data]);

    const totalAccountsCount = currentSlot?.totalAccountsCount || daySlotsQuery.data?.totalAccounts || 10;

    // Build time options based on real-time availability from settings & daySlotsQuery
    const timeOptions: TimeSlotOption[] = useMemo(() => {
        const startH = Number(settings?.slotStartTime?.split(':')[0] || '08');
        const endH = Number(settings?.slotEndTime?.split(':')[0] || '18');
        const interval = settings?.slotIntervalMinutes || 30;

        if (!bookingDate) {
            const opts: TimeSlotOption[] = [];
            let cur = startH * 60;
            const end = endH * 60;
            while (cur < end) {
                const h = Math.floor(cur / 60).toString().padStart(2, '0');
                const m = (cur % 60).toString().padStart(2, '0');
                opts.push({ time: `${h}:${m}` });
                cur += interval;
            }
            return opts;
        }

        const isTodayBooking = isSameDay(parseISO(bookingDate), new Date());
        const nowStr = format(new Date(), 'HH:mm');

        if (daySlotsQuery.data?.slots?.length) {
            return daySlotsQuery.data.slots.map((slot) => {
                const isPastSlot = isTodayBooking && slot.time < nowStr;
                return {
                    time: slot.time,
                    isUnavailable: !slot.available || isPastSlot,
                    availableAccountsCount: isPastSlot ? 0 : slot.availableAccountsCount,
                    totalAccountsCount: slot.totalAccountsCount,
                    reason: isPastSlot ? 'Waktu sudah terlewat' : slot.reason,
                    exceedsOperatingHours: slot.exceedsOperatingHours,
                };
            });
        }

        // Fallback while loading
        const opts: TimeSlotOption[] = [];
        let cur = startH * 60;
        const end = endH * 60;
        while (cur < end) {
            const h = Math.floor(cur / 60).toString().padStart(2, '0');
            const m = (cur % 60).toString().padStart(2, '0');
            opts.push({ time: `${h}:${m}` });
            cur += interval;
        }
        return opts;
    }, [bookingDate, settings, daySlotsQuery.data]);

    // Build dynamic end time options based on startTime & daySlotsQuery
    const endTimeOptions = useMemo(() => {
        return computeEndTimeOptions(
            startTime,
            bookingDate,
            settings,
            durationOptions,
            daySlotsQuery.data?.slots
        );
    }, [startTime, bookingDate, settings, durationOptions, daySlotsQuery.data]);

    const handleStartTimeChange = (newStart: string) => {
        setStartTime(newStart);
        if (!newStart) {
            setEndTime('');
            return;
        }

        const opts = computeEndTimeOptions(
            newStart,
            bookingDate,
            settings,
            durationOptions,
            daySlotsQuery.data?.slots
        );

        // Try candidate with active duration or default +60 mins
        const currentDur = (startTime && endTime) ? calculateDuration(startTime, endTime) : 60;
        const candidateEnd = calculateEndTime(newStart, currentDur > 0 ? currentDur : 60);
        const matchCandidate = opts.find((o) => o.value === candidateEnd);

        if (matchCandidate && !matchCandidate.isUnavailable) {
            setEndTime(candidateEnd);
        } else {
            // If default duration is unavailable, pick the first available option per user preference
            const firstAvailable = opts.find((o) => !o.isUnavailable);
            setEndTime(firstAvailable ? firstAvailable.value : '');
        }
    };

    // Auto-adjust selected endTime if it becomes unavailable after slot data updates
    useEffect(() => {
        if (!startTime || !endTime || !endTimeOptions.length) return;
        const selectedOpt = endTimeOptions.find((o) => o.value === endTime);
        if (selectedOpt && selectedOpt.isUnavailable) {
            const firstAvailable = endTimeOptions.find((o) => !o.isUnavailable);
            setEndTime(firstAvailable ? firstAvailable.value : '');
        }
    }, [endTimeOptions, startTime, endTime]);

    // If selected startTime exceeds operating hours when duration or date changes
    useEffect(() => {
        if (!startTime || !daySlotsQuery.data?.slots?.length) return;
        const slot = daySlotsQuery.data.slots.find((s) => s.time === startTime);
        if (slot && slot.exceedsOperatingHours) {
            setStartTime('');
            setEndTime('');
            toast.warning(`Jam ${startTime} melebihi batas operasional untuk durasi ${duration} menit. Silakan pilih jam lain.`);
        }
    }, [daySlotsQuery.data, duration]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setBookingDate('');
        setStartTime('');
        setEndTime('');
        setParticipantEmails([]);
        setIsRecurring(false);
        setFreq('WEEKLY');
        setInterval(1);
        setUntil('');
        setAllowDoubleBooking(false);
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
        if (currentSlot?.exceedsOperatingHours) {
            toast.error(`Jam ${startTime} melebihi batas operasional sistem.`);
            return;
        }
        if ((availability.data?.available === false || isAllAccountsFull) && !allowDoubleBooking) {
            toast.error(availability.data?.reason || 'Jam ini tidak tersedia (seluruh akun penuh). Hubungi admin di 1607 atau gunakan opsi dobel booking.');
            return;
        }

        const computedUntil = isRecurring
            ? (until || format(addDays(parseISO(bookingDate), 30), 'yyyy-MM-dd'))
            : '';

        const validParticipantEmails = participantEmails
            .map((email) => email.trim())
            .filter((email) => email.includes('@'));

        const dto: CreateBookingDto = {
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: validParticipantEmails.length > 0 ? validParticipantEmails : undefined,
            recurrencePattern: isRecurring ? buildRecurrencePattern(freq, interval, computedUntil) : undefined,
            allowDoubleBooking: allowDoubleBooking ? true : undefined,
        };

        try {
            const result = await createBooking.mutateAsync(dto);
            const count = Array.isArray(result) ? result.length : 1;
            const booking = Array.isArray(result) ? result[0] : result;

            if (allowDoubleBooking || (booking as any)?.isDoubleBooking) {
                toast.success('Meeting berhasil dibuat dalam Mode Dobel Booking (Tanpa Claim Host & Tanpa Rekam).');
            } else {
                toast.success(`Booking berhasil! ${count > 1 ? `${count} jadwal berulang dibuat.` : 'Link Zoom dikirim via email.'}`);
            }
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
                    <Button className="w-full" onClick={() => window.open(successJoinUrl, '_blank')}>
                        Join Meeting Sekarang
                    </Button>
                )}
                {onSuccessViewBookings && (
                    <Button
                        className="w-full font-medium"
                        onClick={() => {
                            setBookingSucceeded(false);
                            setSuccessJoinUrl(null);
                            onSuccessViewBookings();
                        }}
                        variant="secondary"
                    >
                        Lihat Daftar Meeting
                    </Button>
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
        <form className="space-y-3.5" onSubmit={handleSubmit}>
            {/* Section 1: Informasi Meeting */}
            <div className="space-y-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 p-3 border border-slate-200/60 dark:border-slate-800/60">
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200" htmlFor="simple-booking-title">
                        Judul meeting <span className="text-rose-500" aria-hidden="true">*</span>
                    </Label>
                    <Input
                        aria-label="Judul"
                        id="simple-booking-title"
                        maxLength={100}
                        minLength={5}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Contoh: Weekly Sync Meeting"
                        value={title}
                        className="h-9 rounded-xl text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-medium"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="simple-booking-description">
                        Deskripsi (Opsional)
                    </Label>
                    <Textarea
                        id="simple-booking-description"
                        maxLength={500}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Agenda meeting..."
                        rows={2}
                        value={description}
                        className="resize-none rounded-xl text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-h-[52px]"
                    />
                </div>
            </div>

            {/* Section 2: Jadwal & Waktu */}
            <div className="space-y-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 p-3 border border-slate-200/60 dark:border-slate-800/60">
                {/* Tanggal (1 baris penuh) */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Tanggal <span className="text-rose-500" aria-hidden="true">*</span>
                    </Label>
                    <ModernDatePicker
                        maxDate={addDays(new Date(), settings?.advanceBookingDays || 30)}
                        minDate={new Date()}
                        onChange={(date) => {
                            const formatted = format(date, 'yyyy-MM-dd');
                            setBookingDate(formatted);
                            onDateChange?.(formatted);
                        }}
                        placeholder="Pilih tanggal"
                        value={bookingDate ? parseISO(bookingDate) : undefined}
                        triggerClassName="h-9 rounded-xl text-xs font-medium w-full"
                    />
                </div>

                {/* Jam Mulai & Jam Selesai Berdampingan */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <ZoomTimeSelect
                            label="Jam Mulai *"
                            value={startTime}
                            onChange={(t) => handleStartTimeChange(t)}
                            options={timeOptions}
                            isLoading={daySlotsQuery.isLoading}
                            placeholder="08:00"
                            align="left"
                            dropdownClassName="w-full sm:w-[calc(200%+0.75rem)] min-w-[260px]"
                        />
                    </div>
                    <div>
                        <ZoomEndTimeSelect
                            label="Jam Selesai *"
                            value={endTime}
                            onChange={(val) => setEndTime(val)}
                            options={endTimeOptions}
                            disabled={!startTime}
                            placeholder={startTime ? "Pilih jam selesai" : "Pilih jam mulai dahulu"}
                            align="right"
                            dropdownClassName="w-full sm:w-[calc(200%+0.75rem)] min-w-[260px]"
                        />
                    </div>
                </div>

                {/* Date Availability Summary Badge */}
                {bookingDate && (
                    <div className="text-xs" data-testid="date-availability-summary">
                        {daySlotsQuery.isLoading ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse text-[11px]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Memeriksa ketersediaan jam...</span>
                            </div>
                        ) : daySlotsQuery.data?.isBlocked ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold text-[11px]">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Hari Libur / Tanggal Diblokir</span>
                            </div>
                        ) : !daySlotsQuery.data?.isWorkingDay ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold text-[11px]">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Akhir Pekan (Di luar hari kerja operasional Zoom)</span>
                            </div>
                        ) : daySlotsQuery.data?.isFullyBooked ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-[11px]">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Semua jam pada tanggal ini penuh terpakai ({daySlotsQuery.data.totalAccounts}/{daySlotsQuery.data.totalAccounts} akun)</span>
                            </div>
                        ) : daySlotsQuery.data ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <span>
                                    <strong className="font-bold">{daySlotsQuery.data.availableSlotsCount}</strong> dari {daySlotsQuery.data.totalSlotsCount} slot waktu tersedia · {daySlotsQuery.data.totalAccounts} akun Zoom aktif
                                </span>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Unified Meeting Time & Availability Feedback */}
                {startTime && (
                    <div className={cn(
                        "rounded-xl border p-2.5 text-xs transition-all space-y-1.5 shadow-2xs",
                        bookingDate && !isAllAccountsFull && availability.data?.available
                            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/40 text-emerald-950 dark:text-emerald-100"
                            : bookingDate && !isAllAccountsFull && availability.data?.available === false
                                ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/40 text-rose-950 dark:text-rose-100"
                                : "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-800/40 text-blue-950 dark:text-blue-100"
                    )}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-600 dark:text-slate-400">Waktu meeting:</span>
                            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                                {startTime}–{endTime || calculateEndTime(startTime, duration)} WIB <span className="text-[11px] font-normal text-muted-foreground">({formatDurationLabel(duration)})</span>
                            </span>
                        </div>
                        {bookingDate && !isAllAccountsFull && (
                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 font-medium">
                                {availability.isLoading ? (
                                    <><Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Mengecek ketersediaan...</span></>
                                ) : availability.data?.available ? (
                                    <><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /><span className="font-semibold text-emerald-700 dark:text-emerald-300">Jam ini tersedia</span></>
                                ) : (
                                    <><XCircle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" /><span className="font-semibold text-rose-700 dark:text-rose-300">{availability.data?.reason || 'Jam ini tidak tersedia'}</span></>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 1607 Admin Alert & Emergency Double Booking when all accounts are full */}
                {isAllAccountsFull && (
                    <div className="space-y-2.5 pt-0.5">
                        {/* Admin 1607 Alert Banner */}
                        <div
                            data-testid="admin-1607-alert"
                            className="rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-200 space-y-2 shadow-2xs"
                        >
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                                <div className="space-y-1 flex-1">
                                    <p className="font-bold text-xs leading-tight text-rose-950 dark:text-rose-100">
                                        Slot Zoom Penuh di Seluruh Akun
                                    </p>
                                    <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                                        Zoom pada tanggal <strong>{bookingDate}</strong> jam <strong>{startTime}</strong> sudah penuh di seluruh {totalAccountsCount} akun.
                                    </p>
                                    <div className="pt-0.5">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-bold text-[11px] shadow-2xs">
                                            📞 Mohon menghubungi admin di 1607
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Emergency Double Booking Option */}
                        <div
                            data-testid="emergency-double-booking-card"
                            className={cn(
                                "rounded-xl border transition-all p-3 text-xs space-y-2",
                                allowDoubleBooking
                                    ? "border-amber-400 bg-amber-50/90 dark:border-amber-700 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20"
                                    : "border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300"
                            )}
                        >
                            <label className="flex items-start gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    data-testid="allow-double-booking-checkbox"
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                    checked={allowDoubleBooking}
                                    onChange={(e) => setAllowDoubleBooking(e.target.checked)}
                                />
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                                        Gunakan Opsi Dobel Booking Darurat
                                    </span>
                                    <span className="text-[11px] text-muted-foreground block">
                                        Pilihan akhir untuk tetap mengadakan meeting saat seluruh akun penuh.
                                    </span>
                                </div>
                            </label>
                            <div className="pl-5.5 space-y-1 text-[11px] leading-relaxed border-t border-amber-200/60 dark:border-amber-900/40 pt-2 text-slate-600 dark:text-slate-400">
                                <p className="font-semibold text-rose-600 dark:text-rose-400">
                                    ⛔ Tidak bisa claim host & tidak bisa merekam meeting.
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    Peserta tetap dapat bergabung dan berbicara normal.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Section 3: Opsi Tambahan */}
            <div className="space-y-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 p-3 border border-slate-200/60 dark:border-slate-800/60">
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor="simple-booking-participants">
                        Peserta (Opsional)
                    </Label>
                    <ZoomParticipantPicker
                        id="simple-booking-participants"
                        value={participantEmails}
                        onChange={setParticipantEmails}
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
            </div>

            <Button
                className={cn(
                    "group mt-2 w-full rounded-xl h-10 font-semibold shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer",
                    allowDoubleBooking && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
                disabled={
                    createBooking.isPending ||
                    ((availability.data?.available === false || isAllAccountsFull) && !allowDoubleBooking) ||
                    (!!currentSlot?.exceedsOperatingHours)
                }
                type="submit"
            >
                {createBooking.isPending
                    ? 'Membuat...'
                    : allowDoubleBooking
                        ? 'Buat meeting (Mode Dobel Booking)'
                        : 'Buat meeting'}
                {!createBooking.isPending && (
                    <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 transition-transform duration-200 group-hover:translate-x-0.5">
                        <Video className="h-3 w-3" aria-hidden="true" />
                    </span>
                )}
            </Button>
        </form>
    );
}
