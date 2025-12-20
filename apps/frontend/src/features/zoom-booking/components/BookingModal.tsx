import { useState, useEffect, useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { Video, Calendar, Clock, Users, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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

// Generate date options (today + 30 days)
const generateDateOptions = () => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = addDays(today, i);
        const dayOfWeek = date.getDay();
        // Only weekdays
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            options.push({
                value: format(date, 'yyyy-MM-dd'),
                label: format(date, 'EEEE, d MMMM yyyy'),
            });
        }
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
    const [duration, setDuration] = useState<number>(60);
    const [participantEmails, setParticipantEmails] = useState('');

    const { data: durations } = useDurationOptions();
    const { data: settings } = usePublicZoomSettings();
    const createBooking = useCreateBooking();

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

    // Generate date options based on settings
    const dateOptions = useMemo(() => {
        const options: { value: string; label: string }[] = [];
        const today = new Date();
        const advanceDays = settings?.advanceBookingDays || 30;
        const workingDays = settings?.workingDays || [1, 2, 3, 4, 5];

        for (let i = 0; i < advanceDays; i++) {
            const date = addDays(today, i);
            const dayOfWeek = date.getDay();
            // Only working days from settings
            if (workingDays.includes(dayOfWeek)) {
                options.push({
                    value: format(date, 'yyyy-MM-dd'),
                    label: format(date, 'EEEE, d MMMM yyyy'),
                });
            }
        }
        return options;
    }, [settings]);

    // Fetch calendar data for conflict detection
    const { data: calendarData } = useZoomCalendar(
        selectedAccountId,
        bookingDate || format(new Date(), 'yyyy-MM-dd'),
        bookingDate || format(new Date(), 'yyyy-MM-dd')
    );

    // Detect conflicts with existing bookings
    const conflictWarning = useMemo(() => {
        if (!calendarData || !startTime || !duration || !bookingDate) return null;

        const dayData = calendarData.find(d => d.date === bookingDate);
        if (!dayData) return null;

        // Calculate end time for the proposed booking
        const [startH, startM] = startTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = startMinutes + duration;

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
                const [slotH, slotM] = slot.time.split(':').map(Number);
                const slotMinutes = slotH * 60 + slotM;
                const [endH, endM] = slot.endTime.split(':').map(Number);
                const slotEndMinutes = endH * 60 + endM;

                // Check if proposed booking overlaps with this slot
                const overlaps = startMinutes < slotEndMinutes && endMinutes > slotMinutes;
                if (overlaps) {
                    return `Konflik dengan booking "${slot.booking.title}" (${slot.time} - ${slot.endTime})`;
                }
            }
        }
        return null;
    }, [calendarData, bookingDate, startTime, duration]);

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

        const dto: CreateBookingDto = {
            zoomAccountId: selectedAccountId,
            title: title.trim(),
            description: description.trim() || undefined,
            bookingDate,
            startTime,
            durationMinutes: duration,
            participantEmails: participantEmails
                .split(',')
                .map(e => e.trim())
                .filter(e => e.includes('@')),
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

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
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

                        <div className="space-y-2">
                            <Label>
                                <Clock className="h-4 w-4 inline mr-1" />
                                Waktu Mulai *
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
                    </div>

                    {/* Duration - Flexible Manual Input */}
                    <div className="space-y-2">
                        <Label htmlFor="duration">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Durasi (menit) *
                        </Label>
                        <div className="flex items-center gap-3">
                            <Input
                                id="duration"
                                type="number"
                                min={15}
                                max={480}
                                step={5}
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value) || 30)}
                                className="w-28"
                            />
                            <span className="text-sm text-muted-foreground">
                                = {Math.floor(duration / 60)}h {duration % 60}m
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Masukkan durasi bebas (15-480 menit), akan disinkronkan dengan Zoom
                        </p>
                    </div>

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
                        <Input
                            id="participants"
                            value={participantEmails}
                            onChange={(e) => setParticipantEmails(e.target.value)}
                            placeholder="email1@example.com, email2@example.com"
                        />
                        <p className="text-xs text-muted-foreground">
                            Pisahkan dengan koma untuk multiple email
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
