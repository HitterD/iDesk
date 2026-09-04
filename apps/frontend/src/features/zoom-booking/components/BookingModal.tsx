import { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { Video, Calendar, Clock, Users, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { useCreateBooking, useDurationOptions, usePublicZoomSettings, useZoomCalendar } from '../hooks';
import { ZoomEndTimeSelect, type EndTimeOption } from './ZoomEndTimeSelect';
import { ZoomParticipantPicker } from './ZoomParticipantPicker';
import { calculateDuration, formatDurationLabel, computeEndTimeOptions } from './SimpleBookingForm';
import type { ZoomAccount, CreateBookingDto } from '../types';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    zoomAccountId: string;
    preselectedDate?: string;
    preselectedTime?: string;
    accounts: ZoomAccount[];
}

// Generate time options dynamically based on settings
const generateTimeOptions = (
    startTime: string = '08:00',
    endTime: string = '18:00',
    intervalMinutes: number = 30
) => {
    const options: string[] = [];
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes < endMinutes) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        currentMinutes += intervalMinutes;
    }
    return options;
};

export function BookingModal({
    isOpen,
    onClose,
    zoomAccountId,
    preselectedDate,
    preselectedTime,
    accounts,
}: BookingModalProps) {
    const [selectedAccountId, setSelectedAccountId] = useState(zoomAccountId);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [bookingDate, setBookingDate] = useState(preselectedDate || '');
    const [startTime, setStartTime] = useState(preselectedTime || '');
    const [endTime, setEndTime] = useState<string>('');
    const [participantEmails, setParticipantEmails] = useState<string[]>([]);

    const { data: durations } = useDurationOptions();
    const { data: settings } = usePublicZoomSettings();
    const createBooking = useCreateBooking();
    const queryClient = useQueryClient();

    // Calculate duration in minutes derived from startTime and endTime
    const duration = useMemo(() => calculateDuration(startTime, endTime), [startTime, endTime]);

    // Force refetch whenever the modal opens or key inputs change to prevent stale conflict warnings
    useEffect(() => {
        if (isOpen && selectedAccountId && bookingDate) {
            queryClient.refetchQueries({
                queryKey: ['zoom-calendar', selectedAccountId, bookingDate, bookingDate],
                exact: true,
            });
        }
    }, [isOpen, selectedAccountId, bookingDate, queryClient]);

    // Generate time options dynamically based on settings
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

    // Update state when preselected values change
    useEffect(() => {
        if (preselectedDate) setBookingDate(preselectedDate);
        if (preselectedTime) setStartTime(preselectedTime);
    }, [preselectedDate, preselectedTime]);

    // Fetch calendar data for conflict detection and end-time availability
    const { data: calendarData, isFetching: isCalendarFetching } = useZoomCalendar(
        selectedAccountId,
        bookingDate || format(new Date(), 'yyyy-MM-dd'),
        bookingDate || format(new Date(), 'yyyy-MM-dd')
    );

    const slotAvailabilityList = useMemo(() => {
        if (!calendarData || !bookingDate) return undefined;
        const dayData = calendarData.find((d) => d.date === bookingDate);
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
    }, [calendarData, bookingDate]);

    const durationOptionsList = useMemo(() => {
        return (settings?.allowedDurations && settings.allowedDurations.length > 0)
            ? settings.allowedDurations
            : (durations && durations.length > 0)
                ? durations
                : [30, 60, 90, 120, 150, 180, 240];
    }, [settings, durations]);

    const endTimeOptions = useMemo(() => {
        return computeEndTimeOptions(
            startTime,
            bookingDate,
            settings,
            durationOptionsList,
            slotAvailabilityList,
        );
    }, [startTime, bookingDate, settings, durationOptionsList, slotAvailabilityList]);

    // Auto-select first available end time when startTime changes or options refresh
    useEffect(() => {
        if (!startTime || !endTimeOptions.length) {
            setEndTime('');
            return;
        }

        const currentValid = endTimeOptions.find((o) => o.value === endTime && !o.isUnavailable);
        if (currentValid) return;

        const default60 = endTimeOptions.find((o) => o.durationMinutes === 60 && !o.isUnavailable);
        if (default60) {
            setEndTime(default60.value);
            return;
        }

        const firstAvailable = endTimeOptions.find((o) => !o.isUnavailable);
        if (firstAvailable) {
            setEndTime(firstAvailable.value);
        } else {
            setEndTime('');
        }
    }, [startTime, endTimeOptions]);

    // Detect conflicts with existing bookings
    const conflictWarning = useMemo(() => {
        if (isCalendarFetching || !calendarData || !startTime || !duration || !bookingDate || createBooking.isPending) return null;

        const dayData = calendarData.find(d => d.date === bookingDate);
        if (!dayData) return null;

        // Calculate end time for the proposed booking
        const [startH, startM] = startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = startMinutes + duration;

        // Deduplicate: track checked booking IDs
        const checkedBookingIds = new Set<string>();

        // Check each slot for conflicts
        for (const slot of dayData.slots) {
            if (slot.status === 'blocked') {
                const [slotH, slotM] = slot.time.split(':').map(Number);
                const slotMinutes = slotH * 60 + slotM;
                if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
                    return 'Waktu yang dipilih termasuk slot yang diblokir';
                }
            }
            if (slot.booking && (slot.status === 'booked' || slot.status === 'my_booking')) {
                // Skip already-checked bookings
                if (checkedBookingIds.has(slot.booking.id)) continue;
                checkedBookingIds.add(slot.booking.id);

                // Use BOOKING time range (actual start/end), not slot time
                const bookingStart = slot.booking.startTime || slot.time;
                const bookingEnd = slot.booking.endTime || slot.endTime;
                const [bStartH, bStartM] = bookingStart.split(':').map(Number);
                const [bEndH, bEndM] = bookingEnd.split(':').map(Number);
                const bookingStartMin = bStartH * 60 + bStartM;
                const bookingEndMin = bEndH * 60 + bEndM;

                // Check if proposed booking overlaps with this booking
                const overlaps = startMinutes < bookingEndMin && endMinutes > bookingStartMin;
                if (overlaps) {
                    return `Konflik dengan booking "${slot.booking.title}" (${bookingStart} - ${bookingEnd})`;
                }
            }
        }
        return null;
    }, [calendarData, bookingDate, startTime, duration, isCalendarFetching, createBooking.isPending]);

    // Estimated end time calculation (Zoom Client style)
    const estimatedTime = useMemo(() => {
        if (!startTime || !duration || !endTime) return null;
        return {
            startTime,
            endTime,
            isNextDay: false,
            displayText: `${startTime} - ${endTime} WIB (${formatDurationLabel(duration)})`,
        };
    }, [startTime, duration, endTime]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error('Judul meeting wajib diisi');
            return;
        }

        if (!bookingDate) {
            toast.error('Tanggal wajib dipilih');
            return;
        }

        if (!startTime) {
            toast.error('Waktu mulai wajib dipilih');
            return;
        }

        if (!endTime) {
            toast.error('Jam selesai wajib dipilih');
            return;
        }

        if (duration <= 0) {
            toast.error('Jam selesai harus setelah jam mulai');
            return;
        }

        const dto: CreateBookingDto = {
            zoomAccountId: selectedAccountId,
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: participantEmails.filter(e => e.includes('@')),
        };

        try {
            await createBooking.mutateAsync(dto);
            toast.success('Booking berhasil dibuat! Link Zoom akan dikirim via email.');
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal membuat booking');
        }
    };

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-blue-500" />
                        Book Zoom Meeting
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Account Selection */}
                    <div className="space-y-2">
                        <Label>Zoom Account</Label>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih akun Zoom" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: account.colorHex }}
                                            />
                                            {account.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">
                            <FileText className="h-4 w-4 inline mr-1" />
                            Judul Meeting *
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Weekly Sync Meeting"
                            maxLength={100}
                        />
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label>
                            <Calendar className="h-4 w-4 inline mr-1" />
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

                    {/* Time (Start & End) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>
                                <Clock className="h-4 w-4 inline mr-1" />
                                Jam Mulai *
                            </Label>
                            <Select value={startTime} onValueChange={setStartTime}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih waktu" />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeOptions.map((time: string) => (
                                        <SelectItem key={time} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <ZoomEndTimeSelect
                                value={endTime}
                                onChange={setEndTime}
                                options={endTimeOptions}
                                disabled={!startTime}
                                align="left"
                            />
                        </div>
                    </div>

                    {/* Estimated End Time Banner (Zoom Client Style) */}
                    {estimatedTime && (
                        <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-lg text-xs text-blue-800 dark:text-blue-200">
                            <Clock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div className="flex flex-wrap items-center gap-1.5 font-medium leading-tight">
                                <span className="text-blue-600/90 dark:text-blue-400/90">Estimasi:</span>
                                <span className="font-semibold text-blue-950 dark:text-blue-50">
                                    {estimatedTime.displayText}
                                </span>
                                <span className="text-blue-700/80 dark:text-blue-300/80">
                                    (Selesai pukul {estimatedTime.endTime}{estimatedTime.isNextDay ? ' besok' : ''})
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Conflict Warning Loading State */}
                    {isCalendarFetching && bookingDate && startTime && (
                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                            <span className="text-sm">Memeriksa ketersediaan...</span>
                        </div>
                    )}

                    {/* Conflict Warning */}
                    {conflictWarning && (
                        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{conflictWarning}</span>
                        </div>
                    )}

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi (Opsional)</Label>
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
                    <div className="space-y-2">
                        <Label htmlFor="participants">
                            <Users className="h-4 w-4 inline mr-1" />
                            Peserta (Opsional)
                        </Label>
                        <ZoomParticipantPicker
                            value={participantEmails}
                            onChange={setParticipantEmails}
                            placeholder="Cari nama / email user iDesk atau ketik email luar..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Pilih user iDesk dari daftar atau ketik email eksternal lalu tekan Enter
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={createBooking.isPending}
                            style={{ backgroundColor: selectedAccount?.colorHex }}
                        >
                            {createBooking.isPending ? 'Membuat...' : 'Book Meeting'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
