/**
 * RescheduleModal - Modal for users to reschedule their own bookings
 */
import { useState, useMemo, useEffect } from 'react';
import { format, addDays, parse } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarIcon, Clock, AlertTriangle, Video } from 'lucide-react';
import { toast } from 'sonner';

import type { ZoomBooking } from '../types';
import { useRescheduleOwnBooking, useZoomCalendar, usePublicZoomSettings } from '../hooks/useZoomBooking';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';

interface RescheduleModalProps {
    booking: ZoomBooking | null;
    isOpen: boolean;
    onClose: () => void;
}

export function RescheduleModal({ booking, isOpen, onClose }: RescheduleModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedDuration, setSelectedDuration] = useState<number | undefined>();

    const reschedule = useRescheduleOwnBooking();
    const { data: settings } = usePublicZoomSettings();

    // Reset state when booking changes
    useEffect(() => {
        if (booking) {
            setSelectedDate(new Date(booking.bookingDate));
            setSelectedTime(booking.startTime.substring(0, 5));
            setSelectedDuration(booking.durationMinutes);
        }
    }, [booking]);

    // Calculate date range for calendar query
    const dateRange = useMemo(() => {
        if (!selectedDate) return { start: '', end: '' };
        const start = format(selectedDate, 'yyyy-MM-dd');
        const end = format(selectedDate, 'yyyy-MM-dd');
        return { start, end };
    }, [selectedDate]);

    // Fetch calendar data for selected date
    const { data: calendarData } = useZoomCalendar(
        booking?.zoomAccountId,
        dateRange.start,
        dateRange.end
    );

    // Generate time options based on settings
    const timeOptions = useMemo(() => {
        if (!settings) return [];

        const options: string[] = [];
        const [startH, startM] = settings.slotStartTime.split(':').map(Number);
        const [endH, endM] = settings.slotEndTime.split(':').map(Number);
        const interval = settings.slotIntervalMinutes || 30;

        let currentH = startH;
        let currentM = startM;

        while (currentH < endH || (currentH === endH && currentM < endM)) {
            const time = `${currentH.toString().padStart(2, '0')}:${currentM.toString().padStart(2, '0')}`;
            options.push(time);

            currentM += interval;
            if (currentM >= 60) {
                currentH += Math.floor(currentM / 60);
                currentM = currentM % 60;
            }
        }

        return options;
    }, [settings]);

    // Check for conflicts with selected time
    const hasConflict = useMemo(() => {
        if (!calendarData || !selectedDate || !selectedTime || !booking) return false;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayData = calendarData.find(d => d.date === dateStr);
        if (!dayData) return false;

        const duration = selectedDuration || booking.durationMinutes;
        const [startH, startM] = selectedTime.split(':').map(Number);
        const endMinutes = startH * 60 + startM + duration;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        // Check if any slot in the range is booked (excluding current booking)
        return dayData.slots.some(slot => {
            if (slot.status !== 'booked' && slot.status !== 'my_booking') return false;
            if (slot.booking?.id === booking.id) return false; // Skip current booking

            const slotTime = slot.time;
            // Check if slot overlaps with new time
            return slotTime >= selectedTime && slotTime < endTime;
        });
    }, [calendarData, selectedDate, selectedTime, selectedDuration, booking]);

    const handleSubmit = async () => {
        if (!booking || !selectedDate || !selectedTime) return;

        try {
            await reschedule.mutateAsync({
                bookingId: booking.id,
                data: {
                    bookingDate: format(selectedDate, 'yyyy-MM-dd'),
                    startTime: selectedTime,
                    durationMinutes: selectedDuration,
                },
            });

            toast.success('Booking berhasil dijadwalkan ulang');
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menjadwalkan ulang booking');
        }
    };

    if (!booking) return null;

    const originalDate = new Date(booking.bookingDate);
    const isChanged = selectedDate && (
        format(selectedDate, 'yyyy-MM-dd') !== booking.bookingDate ||
        selectedTime !== booking.startTime.substring(0, 5) ||
        (selectedDuration && selectedDuration !== booking.durationMinutes)
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] bg-slate-900/95 border-slate-700/50">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg text-white">
                        <CalendarIcon className="h-5 w-5 text-blue-400" />
                        Reschedule Meeting
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Current Booking Info */}
                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="flex items-start gap-3">
                            <Video className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                            <div>
                                <h3 className="font-medium text-white">{booking.title}</h3>
                                <p className="text-sm text-slate-400 mt-1">
                                    Jadwal saat ini: {format(originalDate, 'EEEE, d MMMM yyyy', { locale: idLocale })} • {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* New Date Selection */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Tanggal Baru</Label>
                        <ModernDatePicker
                            value={selectedDate}
                            onChange={setSelectedDate}
                            minDate={new Date()}
                            maxDate={settings ? addDays(new Date(), settings.advanceBookingDays) : undefined}
                        />
                    </div>

                    {/* New Time Selection */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Waktu Baru</Label>
                        <Select value={selectedTime} onValueChange={setSelectedTime}>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                <SelectValue placeholder="Pilih waktu" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                {timeOptions.map(time => (
                                    <SelectItem key={time} value={time} className="text-white">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            {time}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Duration (optional change) */}
                    <div className="space-y-2">
                        <Label className="text-slate-300">Durasi (menit)</Label>
                        <Select
                            value={selectedDuration?.toString() || booking.durationMinutes.toString()}
                            onValueChange={(v) => setSelectedDuration(parseInt(v))}
                        >
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                                {(settings?.allowedDurations || [30, 60, 90, 120]).map(d => (
                                    <SelectItem key={d} value={d.toString()} className="text-white">
                                        {d} menit
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Conflict Warning */}
                    {hasConflict && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                            <p className="text-sm text-amber-200">
                                Waktu yang dipilih bertabrakan dengan booking lain pada tanggal ini.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isChanged || hasConflict || reschedule.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {reschedule.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
