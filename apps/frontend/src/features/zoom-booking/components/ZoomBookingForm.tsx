/**
 * ZoomBookingForm — panel-based booking form extracted from BookingModal.
 * No Dialog wrapper; the panel (ZoomBookingPanel) is the container.
 */
import { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { Video, Calendar, Clock, Users, FileText, AlertTriangle, Loader2, Sparkles, ChevronDown } from 'lucide-react';
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
import {
    useCreateBooking,
    usePublicZoomSettings,
    useZoomCalendar,
    useAllAccountsAvailability,
} from '../hooks';
import type { ZoomAccount, CreateBookingDto, CalendarDay } from '../types';
import { ZoomRecurringOptions } from './ZoomRecurringOptions';
import { ZoomTimeSelect, type TimeSlotOption } from './ZoomTimeSelect';
import { ZoomEndTimeSelect, type EndTimeOption } from './ZoomEndTimeSelect';
import { ZoomParticipantPicker } from './ZoomParticipantPicker';
import { calculateDuration, formatDurationLabel, computeEndTimeOptions } from './SimpleBookingForm';
import { autoPickAccount, buildAvailability, type AccountLoad, type AccountAvailability } from '../utils/autoPickAccount';

export const GABUNGAN_ACCOUNT_ID = 'gabungan';

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


interface ZoomBookingFormProps {
    zoomAccountId: string;
    preselectedDate?: string;
    preselectedTime?: string;
    accounts: ZoomAccount[];
    onClose: () => void;
    /** When true, the form is in Gabungan mode: auto-picks the first free
     *  account at the chosen date+time and cascades to the next account
     *  (zoom 1 -> zoom 2 -> ... -> zoom 10) when the current one is booked. */
    isGabungan?: boolean;
}

export function ZoomBookingForm({
    zoomAccountId,
    preselectedDate,
    preselectedTime,
    accounts,
    onClose,
    isGabungan = false,
}: ZoomBookingFormProps) {
    const [selectedAccountId, setSelectedAccountId] = useState(
        isGabungan ? GABUNGAN_ACCOUNT_ID : zoomAccountId,
    );
    const [userPickedAccount, setUserPickedAccount] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState(preselectedDate || '');
    const [startTime, setStartTime] = useState(preselectedTime || '');
    const [endTime, setEndTime] = useState('');
    const [participantEmails, setParticipantEmails] = useState<string[]>([]);
    const [accountPickerOpen, setAccountPickerOpen] = useState(false);

    const duration = useMemo(() => {
        return calculateDuration(startTime, endTime);
    }, [startTime, endTime]);

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
        if (!isGabungan && selectedAccountId && bookingDate) {
            queryClient.refetchQueries({
                queryKey: ['zoom-calendar', selectedAccountId, bookingDate, bookingDate],
                exact: true,
            });
        }
    }, [selectedAccountId, bookingDate, queryClient, isGabungan]);

    const effectiveDate = bookingDate || format(new Date(), 'yyyy-MM-dd');

    // Single-account calendar (non-Gabungan) for conflict + dropdown occupancy
    const { data: calendarData, isFetching: isCalendarFetching } = useZoomCalendar(
        !isGabungan ? selectedAccountId : undefined,
        effectiveDate,
        effectiveDate,
    );

    // All-accounts calendar (Gabungan) for auto-pick + dropdown occupancy
    const allCalResults = useAllAccountsAvailability(
        accounts,
        isGabungan ? effectiveDate : undefined,
        isGabungan,
    );

    // Per-account availability snapshot used by autoPickAccount
    const availabilityForPick: AccountAvailability[] = useMemo(() => {
        if (!isGabungan) return [];
        const calMap = new Map<string, CalendarDay[]>();
        accounts.forEach((a) => {
            const data = allCalResults[a.id];
            if (data) calMap.set(a.id, data);
        });
        return buildAvailability(accounts, calMap, effectiveDate);
    }, [isGabungan, accounts, allCalResults, effectiveDate]);

    // Per-account load count (count of bookings at chosen date)
    const accountLoads: AccountLoad[] = useMemo(() => {
        return accounts.map((a) => {
            const cal = availabilityForPick.find((s) => s.id === a.id);
            const meetings = cal?.bookingsByStartTime.size ?? 0;
            return {
                id: a.id,
                name: a.name,
                colorHex: a.colorHex,
                meetingsAtTime: meetings,
            };
        });
    }, [accounts, availabilityForPick]);

    const timeOptions = useMemo<TimeSlotOption[]>(() => {
        if (!settings) return [];
        let allTimes = generateTimeOptions(
            settings.slotStartTime || '00:00',
            settings.slotEndTime || '23:59',
            settings.slotIntervalMinutes || 30,
        );

        if (bookingDate && isSameDay(parseISO(bookingDate), new Date())) {
            const nowStr = format(new Date(), 'HH:mm');
            allTimes = allTimes.filter((t) => t >= nowStr);
        }

        // Gabungan mode auto-picks; no per-slot filtering needed.
        if (isGabungan) {
            return allTimes.map((time) => ({ time }));
        }

        // Single-account mode: mark booked times as unavailable so the dropdown
        // visually flags them. We still allow the user to attempt selection
        // (the existing ZoomTimeSelect handles that UX with an info card).
        const bookedSet = new Set<string>();
        if (calendarData && calendarData.length > 0) {
            for (const day of calendarData) {
                for (const slot of day.slots) {
                    if (slot.booking) {
                        bookedSet.add(slot.time);
                    }
                }
            }
        }
        return allTimes.map((time) => ({
            time,
            isUnavailable: bookedSet.has(time),
        }));
    }, [settings, isGabungan, calendarData]);

    // Gabungan auto-pick: pick the first account free at (date, startTime, duration)
    useEffect(() => {
        if (!isGabungan) return;
        if (userPickedAccount) return;
        if (!startTime || !bookingDate) return;
        if (accountLoads.length === 0) return;
        const picked = autoPickAccount(
            accountLoads,
            bookingDate,
            startTime,
            duration,
            availabilityForPick,
        );
        if (picked && picked.id !== selectedAccountId) {
            setSelectedAccountId(picked.id);
        }
    }, [
        isGabungan,
        userPickedAccount,
        startTime,
        bookingDate,
        duration,
        accountLoads,
        availabilityForPick,
        selectedAccountId,
    ]);

    // Build time-slot options with joinUrl for Gabungan (per-account busiest)
    // and for single-account (from calendarData).
    const timeSlotOptions: TimeSlotOption[] = useMemo(() => {
        const sourceCalendarData: CalendarDay[] | undefined = isGabungan
            ? buildMergedGabunganCalendar(accounts, allCalResults, effectiveDate)
            : calendarData;

        if (!sourceCalendarData || !bookingDate) {
            return timeOptions;
        }
        const dayData = sourceCalendarData.find((d) => d.date === bookingDate);
        if (!dayData) {
            return timeOptions;
        }

        return timeOptions.map((option) => {
            const slot = dayData.slots.find((s) => s.time === option.time);
            const occupied = slot && (slot.status === 'booked' || slot.status === 'my_booking');
            const blocked = slot?.status === 'blocked';
            return {
                ...option,
                isUnavailable: occupied || blocked,
                bookingTitle: slot?.booking?.title,
                joinUrl: slot?.booking?.joinUrl,
            };
        });
    }, [calendarData, isGabungan, accounts, allCalResults, effectiveDate, bookingDate, timeOptions]);

    // Slot availability mapping for computeEndTimeOptions
    const slotAvailabilityList = useMemo(() => {
        const sourceCalendarData: CalendarDay[] | undefined = isGabungan
            ? buildMergedGabunganCalendar(accounts, allCalResults, effectiveDate)
            : calendarData;

        if (!sourceCalendarData || !bookingDate) return undefined;
        const dayData = sourceCalendarData.find((d) => d.date === bookingDate);
        if (!dayData) return undefined;

        return dayData.slots.map((s) => {
            const occupied = s.status === 'booked' || s.status === 'my_booking';
            const blocked = s.status === 'blocked';
            return {
                time: s.time,
                available: !occupied && !blocked,
                availableAccountsCount: occupied || blocked ? 0 : 1,
                totalAccountsCount: 1,
                reason: blocked ? 'Diblokir' : s.booking?.title ? `Terisi: ${s.booking.title}` : 'Penuh',
            };
        });
    }, [calendarData, isGabungan, accounts, allCalResults, effectiveDate, bookingDate]);

    const durationOptionsList = useMemo(() => {
        return (settings?.allowedDurations && settings.allowedDurations.length > 0)
            ? settings.allowedDurations
            : [30, 60, 90, 120, 150, 180, 240];
    }, [settings]);

    const endTimeOptions = useMemo(() => {
        return computeEndTimeOptions(
            startTime,
            bookingDate,
            settings,
            durationOptionsList,
            slotAvailabilityList,
        );
    }, [startTime, bookingDate, settings, durationOptionsList, slotAvailabilityList]);

    // Auto-select end time when startTime or options change
    useEffect(() => {
        if (!startTime || !endTimeOptions.length) {
            setEndTime('');
            return;
        }

        // If current endTime is available in options, keep it
        const currentValid = endTimeOptions.find((o) => o.value === endTime && !o.isUnavailable);
        if (currentValid) return;

        // Default to +60 minutes if available
        const default60 = endTimeOptions.find((o) => o.durationMinutes === 60 && !o.isUnavailable);
        if (default60) {
            setEndTime(default60.value);
            return;
        }

        // Fallback to first available end time
        const firstAvailable = endTimeOptions.find((o) => !o.isUnavailable);
        if (firstAvailable) {
            setEndTime(firstAvailable.value);
        } else {
            setEndTime('');
        }
    }, [startTime, endTimeOptions]);

    const conflictWarning = useMemo(() => {
        if (isCalendarFetching || !calendarData || !startTime || !duration || !bookingDate || createBooking.isPending) return null;
        if (isGabungan) return null; // Gabungan uses the dropdown occupancy display

        const dayData = calendarData.find((d) => d.date === bookingDate);
        if (!dayData) return null;

        const [startH, startM] = startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = startMinutes + duration;

        if (endMinutes > 24 * 60) {
            return 'Meeting tidak boleh melewati pukul 23:59. Silakan pilih jam mulai yang lebih awal atau kurangi durasi.';
        }

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
    }, [calendarData, bookingDate, startTime, duration, isCalendarFetching, createBooking.isPending, isGabungan]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) { toast.error('Judul meeting wajib diisi'); return; }
        if (!bookingDate) { toast.error('Tanggal wajib dipilih'); return; }
        if (!startTime) { toast.error('Waktu mulai wajib dipilih'); return; }
        const [startH, startM] = startTime.split(':').map(Number);
        if (startH * 60 + startM + duration > 24 * 60) {
            toast.error('Meeting tidak boleh melewati pukul 23:59. Silakan pilih jam mulai yang lebih awal atau kurangi durasi.');
            return;
        }
        if (isGabungan && (!selectedAccountId || selectedAccountId === GABUNGAN_ACCOUNT_ID)) {
            toast.error('Pilih akun Zoom terlebih dahulu');
            return;
        }
        let recurrencePattern: string | undefined;
        if (isRecurring) {
            recurrencePattern = `FREQ=${freq};INTERVAL=${interval}`;
            if (until) {
                // Ensure UNTIL is in UTC format (YYYYMMDDTHHMMSSZ) for the end of that day
                const untilDateStr = until.replace(/-/g, '');
                recurrencePattern += `;UNTIL=${untilDateStr}T235959Z`;
            }
        }

        const validParticipantEmails = participantEmails
            .map((e) => e.trim())
            .filter((e) => e.includes('@'));

        const dto: CreateBookingDto = {
            zoomAccountId: selectedAccountId,
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: validParticipantEmails.length > 0 ? validParticipantEmails : undefined,
            recurrencePattern
        };

        try {
            await createBooking.mutateAsync(dto);
            toast.success('Booking berhasil dibuat! Link Zoom akan dikirim via email.');
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membuat booking');
        }
    };

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

    // Count of accounts free at the selected (date, startTime, duration)
    const accountsFreeAtPick = useMemo(() => {
        if (!isGabungan) return null;
        if (!startTime) return null;
        const free = accountLoads.filter((a) => {
            const snap = availabilityForPick.find((s) => s.id === a.id);
            if (!snap) return true;
            for (const booking of snap.bookingsByStartTime.values()) {
                const [bH, bM] = booking.startTime.split(':').map(Number);
                const [eH, eM] = booking.endTime.split(':').map(Number);
                const [sH, sM] = startTime.split(':').map(Number);
                const sStart = sH * 60 + sM;
                const sEnd = sStart + duration;
                const bStart = bH * 60 + bM;
                const bEnd = eH * 60 + eM;
                if (sStart < bEnd && sEnd > bStart) return false;
            }
            return true;
        });
        return free.length;
    }, [isGabungan, startTime, duration, accountLoads, availabilityForPick]);

    // Estimated end time calculation (Zoom Client style)
    const estimatedTime = useMemo(() => {
        if (!startTime || !duration) return null;
        const [h, m] = startTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;

        const totalMinutes = h * 60 + m + duration;
        const endH = Math.floor(totalMinutes / 60) % 24;
        const endM = totalMinutes % 60;
        const isNextDay = totalMinutes >= 24 * 60;
        const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        return {
            startTime,
            endTime: endStr,
            isNextDay,
            displayText: `${startTime} - ${endStr} WIB`,
        };
    }, [startTime, duration]);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Account (Gabungan mode: auto-pick banner; else: dropdown) */}
                {isGabungan ? (
                    <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Auto-picked
                            </span>
                            {startTime && accountsFreeAtPick !== null && (
                                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                                    · {accountsFreeAtPick}/{accounts.length} akun kosong di {startTime}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setAccountPickerOpen((o) => !o)}
                            data-testid="gabungan-account-picker"
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: selectedAccount?.colorHex ?? '#10b981' }}
                                />
                                <span className="text-sm font-semibold truncate">
                                    {selectedAccount?.name ?? 'Pilih akun…'}
                                </span>
                            </div>
                            <ChevronDown
                                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${accountPickerOpen ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            />
                        </button>
                        {accountPickerOpen && (
                            <ul
                                data-testid="gabungan-account-list"
                                className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            >
                                {[...accountLoads]
                                    .sort((a, b) => {
                                        if (a.meetingsAtTime !== b.meetingsAtTime) {
                                            return a.meetingsAtTime - b.meetingsAtTime;
                                        }
                                        return a.id.localeCompare(b.id);
                                    })
                                    .map((acc) => (
                                        <li key={acc.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedAccountId(acc.id);
                                                    setUserPickedAccount(true);
                                                    setAccountPickerOpen(false);
                                                }}
                                                data-testid={`gabungan-account-${acc.id}`}
                                                className={`w-full text-left px-2 py-1.5 flex items-center gap-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30 ${
                                                    selectedAccountId === acc.id ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                                                }`}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: acc.colorHex }}
                                                />
                                                <span className="flex-1 truncate font-semibold">{acc.name}</span>
                                                <span className="text-xs text-slate-500">{acc.meetingsAtTime} mtg</span>
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        )}
                        <p className="text-xs text-slate-500">
                            Sistem otomatis memilih akun kosong. Klik untuk override.
                        </p>
                    </div>
                ) : (
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
                )}

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
                {/* Date & Time */}
                <div className="space-y-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ZoomTimeSelect
                            label="Waktu Mulai *"
                            value={startTime}
                            onChange={setStartTime}
                            options={timeSlotOptions}
                            placeholder="Pilih jam mulai"
                            align="left"
                            dropdownClassName="w-full sm:w-[calc(200%+0.75rem)] min-w-[260px]"
                        />
                        <ZoomEndTimeSelect
                            label="Jam Selesai *"
                            value={endTime}
                            onChange={setEndTime}
                            options={endTimeOptions}
                            placeholder={startTime ? "Pilih jam selesai" : "Pilih jam mulai dulu"}
                            disabled={!startTime}
                            align="right"
                            dropdownClassName="w-full sm:w-[calc(200%+0.75rem)] min-w-[260px]"
                        />
                    </div>
                </div>

                {/* Estimated End Time Banner (Zoom Client Style) */}
                {estimatedTime && (
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs text-blue-800 dark:text-blue-200">
                        <Clock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="flex flex-wrap items-center gap-1.5 font-medium leading-tight">
                            <span className="text-blue-600/90 dark:text-blue-400/90">Estimasi:</span>
                            <span className="font-semibold text-blue-950 dark:text-blue-50 font-mono">
                                {estimatedTime.displayText}
                            </span>
                            <span className="text-blue-700/80 dark:text-blue-300/80">
                                (Selesai pukul {estimatedTime.endTime}{estimatedTime.isNextDay ? ' besok' : ''}) · {formatDurationLabel(duration)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Conflict check loading */}
                {!isGabungan && isCalendarFetching && bookingDate && startTime && (
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
                    <ZoomParticipantPicker
                        id="participants"
                        value={participantEmails}
                        onChange={setParticipantEmails}
                    />
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

/**
 * Merge all-accounts calendars into one "any account occupied" view.
 * For Gabungan mode the time-slot dropdown needs to know whether the
 * chosen time is occupied on ANY of the 10 accounts.
 */
function buildMergedGabunganCalendar(
    accounts: ZoomAccount[],
    allCalResults: ReturnType<typeof useAllAccountsAvailability>,
    date: string,
): CalendarDay[] | undefined {
    if (accounts.length === 0) return undefined;
    // Use the first account's day structure as a template (slot times match across accounts)
    const firstCal = Object.values(allCalResults).find((cal) => cal && cal.length > 0);
    const template = firstCal?.find((d) => d.date === date);
    if (!template) return undefined;

    const merged: CalendarDay = {
        date: template.date,
        dayOfWeek: template.dayOfWeek,
        isWorkingDay: template.isWorkingDay,
        isBlocked: template.isBlocked,
        slots: template.slots.map((slot) => {
            // Check if any account has a booking at this slot
            for (const cal of Object.values(allCalResults)) {
                if (!cal) continue;
                const day = cal.find((d) => d.date === date);
                if (!day) continue;
                const otherSlot = day.slots.find((s) => s.time === slot.time);
                if (otherSlot?.booking && (otherSlot.status === 'booked' || otherSlot.status === 'my_booking')) {
                    return {
                        ...slot,
                        status: otherSlot.status,
                        booking: otherSlot.booking,
                    };
                }
                if (otherSlot?.status === 'blocked') {
                    return { ...slot, status: 'blocked' };
                }
            }
            return slot;
        }),
    };
    return [merged];
}

