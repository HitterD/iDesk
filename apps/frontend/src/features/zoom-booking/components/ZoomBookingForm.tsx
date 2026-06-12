/**
 * ZoomBookingForm — panel-based booking form extracted from BookingModal.
 * No Dialog wrapper; the panel (ZoomBookingPanel) is the container.
 */
import { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { Video, Calendar, Clock, Users, FileText, AlertTriangle, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { useCreateBooking, usePublicZoomSettings, useZoomCalendar } from '../hooks';
import type { ZoomAccount, CreateBookingDto } from '../types';
import { ZoomRecurringOptions } from './ZoomRecurringOptions';

const generateTimeOptions = (
    startTime = '08:00',
    endTime = '18:00',
    intervalMinutes = 30
): string[] => {
    const options: string[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let current = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (current < end) {
        const h = Math.floor(current / 60);
        const m = current % 60;
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        current += intervalMinutes;
    }
    return options;
};

const DURATION_OPTIONS = [
    { value: 30,  label: '30 menit (0.5 jam)' },
    { value: 60,  label: '60 menit (1 jam)' },
    { value: 90,  label: '90 menit (1.5 jam)' },
    { value: 120, label: '120 menit (2 jam)' },
    { value: 180, label: '180 menit (3 jam)' },
    { value: 240, label: '240 menit (4 jam)' },
];

interface ZoomBookingFormProps {
    zoomAccountId: string;
    preselectedDate?: string;
    preselectedTime?: string;
    accounts: ZoomAccount[];
    onClose: () => void;
}

export function ZoomBookingForm({
    zoomAccountId,
    preselectedDate,
    preselectedTime,
    accounts,
    onClose,
}: ZoomBookingFormProps) {
    const [selectedAccountId, setSelectedAccountId] = useState(zoomAccountId);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState(preselectedDate || '');
    const [startTime, setStartTime] = useState(preselectedTime || '');
    const [duration, setDuration] = useState<number>(60);
    const [participantEmails, setParticipantEmails] = useState('');
    const [successJoinUrl, setSuccessJoinUrl] = useState<string | null>(null);

    // Recurring state
    const [isRecurring, setIsRecurring] = useState(false);
    const [freq, setFreq] = useState('WEEKLY');
    const [interval, setIntervalVal] = useState(1);
    const [until, setUntil] = useState('');

    const { data: settings } = usePublicZoomSettings();
    const createBooking = useCreateBooking();
    const queryClient = useQueryClient();

    // Sync preselected values
    useEffect(() => {
        if (preselectedDate) setBookingDate(preselectedDate);
        if (preselectedTime) setStartTime(preselectedTime);
    }, [preselectedDate, preselectedTime]);

    // Refetch calendar on open to prevent stale conflict warnings
    useEffect(() => {
        if (selectedAccountId && bookingDate) {
            queryClient.refetchQueries({
                queryKey: ['zoom-calendar', selectedAccountId, bookingDate, bookingDate],
                exact: true,
            });
        }
    }, [selectedAccountId, bookingDate, queryClient]);

    const timeOptions = useMemo(() => {
        if (settings) {
            return generateTimeOptions(
                settings.slotStartTime || '08:00',
                settings.slotEndTime || '18:00',
                settings.slotIntervalMinutes || 30
            );
        }
        return generateTimeOptions();
    }, [settings]);

    const { data: calendarData, isFetching: isCalendarFetching } = useZoomCalendar(
        selectedAccountId,
        bookingDate || format(new Date(), 'yyyy-MM-dd'),
        bookingDate || format(new Date(), 'yyyy-MM-dd')
    );

    // Set of start times that are NOT available for the selected date
    const unavailableStartTimes = useMemo(() => {
        const unavailable = new Set<string>();
        if (!calendarData || !bookingDate) return unavailable;

        const dayData = calendarData.find((d) => d.date === bookingDate);
        if (!dayData) return unavailable;

        for (const slot of dayData.slots) {
            if (slot.status === 'booked' || slot.status === 'my_booking' || slot.status === 'blocked') {
                unavailable.add(slot.time);
            }
        }
        return unavailable;
    }, [calendarData, bookingDate]);

    const conflictWarning = useMemo(() => {
        if (isCalendarFetching || !calendarData || !startTime || !duration || !bookingDate || createBooking.isPending) return null;

        const dayData = calendarData.find((d) => d.date === bookingDate);
        if (!dayData) return null;

        const [startH, startM] = startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = startMinutes + duration;

        const checkedIds = new Set<string>();
        for (const slot of dayData.slots) {
            if (slot.status === 'blocked') {
                const [slotH, slotM] = slot.time.split(':').map(Number);
                const slotMinutes = slotH * 60 + slotM;
                if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
                    return 'Waktu yang dipilih termasuk slot yang diblokir';
                }
            }
            if (slot.booking && (slot.status === 'booked' || slot.status === 'my_booking')) {
                if (checkedIds.has(slot.booking.id)) continue;
                checkedIds.add(slot.booking.id);
                const bookingStart = slot.booking.startTime || slot.time;
                const bookingEnd = slot.booking.endTime || slot.endTime;
                const [bStartH, bStartM] = bookingStart.split(':').map(Number);
                const [bEndH, bEndM] = bookingEnd.split(':').map(Number);
                const overlaps = startMinutes < bEndH * 60 + bEndM && endMinutes > bStartH * 60 + bStartM;
                if (overlaps) {
                    return `Konflik dengan booking "${slot.booking.title}" (${bookingStart} - ${bookingEnd})`;
                }
            }
        }
        return null;
    }, [calendarData, bookingDate, startTime, duration, isCalendarFetching, createBooking.isPending]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) { toast.error('Judul meeting wajib diisi'); return; }
        if (!bookingDate) { toast.error('Tanggal wajib dipilih'); return; }
        let recurrencePattern: string | undefined;
        if (isRecurring) {
            recurrencePattern = `FREQ=${freq};INTERVAL=${interval}`;
            if (until) {
                // Ensure UNTIL is in UTC format (YYYYMMDDTHHMMSSZ) for the end of that day
                const untilDateStr = until.replace(/-/g, '');
                recurrencePattern += `;UNTIL=${untilDateStr}T235959Z`;
            }
        }

        const dto: CreateBookingDto = {
            zoomAccountId: selectedAccountId,
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: participantEmails
                .split(',')
                .map((e) => e.trim())
                .filter((e) => e.includes('@')),
            recurrencePattern
        };

        try {
            const result = await createBooking.mutateAsync(dto);
            toast.success('Booking berhasil dibuat! Link Zoom akan dikirim via email.');
            const joinUrl = (result as any)?.meeting?.joinUrl ?? null;
            setSuccessJoinUrl(joinUrl);
            // Auto-close after 5s
            setTimeout(() => onClose(), 5000);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membuat booking');
        }
    };

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

    // Success view
    if (successJoinUrl !== null || (createBooking.isSuccess && !createBooking.isPending)) {
        return (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Booking Berhasil!</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Link Zoom akan dikirim via email. Panel akan tertutup otomatis.
                    </p>
                </div>
                {successJoinUrl && (
                    <Button
                        className="gap-2"
                        onClick={() => window.open(successJoinUrl, '_blank')}
                    >
                        <ExternalLink className="h-4 w-4" />
                        Join Meeting Sekarang
                    </Button>
                )}
                <Button variant="outline" onClick={onClose} className="w-full">
                    Tutup
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Account */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Zoom Account</Label>
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                        <SelectTrigger className="h-9">
                            <SelectValue placeholder="Pilih akun Zoom" />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: account.colorHex }} />
                                        {account.name}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-xs font-semibold">
                        <FileText className="h-3.5 w-3.5 inline mr-1" />
                        Judul Meeting *
                    </Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Contoh: Weekly Sync Meeting"
                        maxLength={100}
                        className="h-9"
                    />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                            <Calendar className="h-3.5 w-3.5 inline mr-1" />
                            Tanggal *
                        </Label>
                        <ModernDatePicker
                            value={bookingDate ? parseISO(bookingDate) : undefined}
                            onChange={(date) => setBookingDate(format(date, 'yyyy-MM-dd'))}
                            placeholder="Pilih tanggal"
                            minDate={new Date()}
                            maxDate={addDays(new Date(), settings?.advanceBookingDays || 30)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">
                            <Clock className="h-3.5 w-3.5 inline mr-1" />
                            Waktu Mulai *
                        </Label>
                        <Select value={startTime} onValueChange={setStartTime}>
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Pilih waktu" />
                            </SelectTrigger>
                            <SelectContent>
                                {timeOptions.map((time) => {
                                    const isUnavailable = unavailableStartTimes.has(time);
                                    return (
                                        <SelectItem
                                            key={time}
                                            value={time}
                                            disabled={isUnavailable}
                                            className={isUnavailable ? 'opacity-50 line-through text-red-400' : ''}
                                        >
                                            <span className="flex items-center gap-2">
                                                {isUnavailable && (
                                                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                                )}
                                                {time}
                                                {isUnavailable && (
                                                    <span className="text-[10px] text-red-400 ml-1">Terpakai</span>
                                                )}
                                            </span>
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                        <Clock className="h-3.5 w-3.5 inline mr-1" />
                        Durasi *
                    </Label>
                    <Select
                        value={String(duration)}
                        onValueChange={(v) => setDuration(Number(v))}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DURATION_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={String(opt.value)}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Conflict check loading */}
                {isCalendarFetching && bookingDate && startTime && (
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span className="text-sm">Memeriksa ketersediaan...</span>
                    </div>
                )}

                {/* Conflict warning */}
                {conflictWarning && (
                    <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm">{conflictWarning}</span>
                    </div>
                )}

                {/* Description */}
                <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold">Deskripsi (Opsional)</Label>
                    <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Agenda meeting..."
                        rows={3}
                        maxLength={500}
                    />
                </div>

                {/* Participants */}
                <div className="space-y-1.5">
                    <Label htmlFor="participants" className="text-xs font-semibold">
                        <Users className="h-3.5 w-3.5 inline mr-1" />
                        Peserta (Opsional)
                    </Label>
                    <Input
                        id="participants"
                        value={participantEmails}
                        onChange={(e) => setParticipantEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">Pisahkan dengan koma untuk multiple email</p>
                </div>

                {/* Recurring Options */}
                <ZoomRecurringOptions
                    isRecurring={isRecurring}
                    setIsRecurring={setIsRecurring}
                    freq={freq}
                    setFreq={setFreq}
                    interval={interval}
                    setInterval={setIntervalVal}
                    until={until}
                    setUntil={setUntil}
                    minDate={new Date()}
                    maxDate={addDays(new Date(), 365)} // allow up to 1 year for recurring
                />
            </div>

            {/* Sticky action bar */}
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur">
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                        Batal
                    </Button>
                    <Button
                        type="submit"
                        disabled={createBooking.isPending || !!conflictWarning}
                        className="flex-1 font-semibold"
                        style={{ backgroundColor: selectedAccount?.colorHex }}
                    >
                        <Video className="h-4 w-4 mr-2" />
                        {createBooking.isPending ? 'Membuat...' : 'Book Meeting'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
