/**
 * ZoomRescheduleView — panel-based reschedule form.
 * Extracted from RescheduleModal (no Dialog wrapper).
 */
import { useState, useMemo, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Video, Clock, AlertTriangle, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import type { ZoomBooking } from '../types';
import { useRescheduleOwnBooking, useZoomCalendar, usePublicZoomSettings } from '../hooks/useZoomBooking';

interface ZoomRescheduleViewProps {
    booking: ZoomBooking;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ZoomRescheduleView({ booking, onClose, onSuccess }: ZoomRescheduleViewProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date(booking.bookingDate));
    const [selectedTime, setSelectedTime] = useState<string>(booking.startTime.substring(0, 5));
    const [selectedDuration, setSelectedDuration] = useState<number>(booking.durationMinutes);

    const reschedule = useRescheduleOwnBooking();
    const { data: settings } = usePublicZoomSettings();

    // Reset when booking changes
    useEffect(() => {
        setSelectedDate(new Date(booking.bookingDate));
        setSelectedTime(booking.startTime.substring(0, 5));
        setSelectedDuration(booking.durationMinutes);
    }, [booking]);

    const dateRange = useMemo(() => {
        const start = format(selectedDate, 'yyyy-MM-dd');
        return { start, end: start };
    }, [selectedDate]);

    const { data: calendarData } = useZoomCalendar(
        booking.zoomAccountId,
        dateRange.start,
        dateRange.end
    );

    const timeOptions = useMemo(() => {
        if (!settings) return [];
        const options: string[] = [];
        const [startH, startM] = settings.slotStartTime.split(':').map(Number);
        const [endH, endM] = settings.slotEndTime.split(':').map(Number);
        const interval = settings.slotIntervalMinutes || 30;
        let h = startH;
        let m = startM;
        while (h < endH || (h === endH && m < endM)) {
            options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            m += interval;
            if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
        }
        return options;
    }, [settings]);

    const hasConflict = useMemo(() => {
        if (!calendarData || !selectedTime) return false;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayData = calendarData.find((d) => d.date === dateStr);
        if (!dayData) return false;

        const [startH, startM] = selectedTime.split(':').map(Number);
        const endMinutes = startH * 60 + startM + selectedDuration;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

        return dayData.slots.some((slot) => {
            if (slot.status !== 'booked' && slot.status !== 'my_booking') return false;
            if (slot.booking?.id === booking.id) return false;
            return slot.time >= selectedTime && slot.time < endTime;
        });
    }, [calendarData, selectedDate, selectedTime, selectedDuration, booking.id]);

    const isChanged =
        format(selectedDate, 'yyyy-MM-dd') !== booking.bookingDate ||
        selectedTime !== booking.startTime.substring(0, 5) ||
        selectedDuration !== booking.durationMinutes;

    const handleSubmit = async () => {
        if (!selectedDate || !selectedTime) return;
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
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Gagal menjadwalkan ulang');
        }
    };

    const originalDate = new Date(booking.bookingDate);

    return (
        <div className="p-5 space-y-5">
            {/* Current booking info */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="flex items-start gap-3">
                    <Video className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">{booking.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Jadwal saat ini: {format(originalDate, 'EEEE, d MMMM yyyy', { locale: idLocale })} • {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
                        </p>
                    </div>
                </div>
            </div>

            {/* New date */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Tanggal Baru
                </Label>
                <ModernDatePicker
                    value={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    minDate={new Date()}
                    maxDate={settings ? addDays(new Date(), settings.advanceBookingDays) : undefined}
                />
            </div>

            {/* New time */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Waktu Baru
                </Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pilih waktu" />
                    </SelectTrigger>
                    <SelectContent>
                        {timeOptions.map((time) => (
                            <SelectItem key={time} value={time}>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5" />
                                    {time}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Durasi (menit)</Label>
                <Select
                    value={selectedDuration.toString()}
                    onValueChange={(v) => setSelectedDuration(parseInt(v))}
                >
                    <SelectTrigger className="h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {(settings?.allowedDurations || [30, 60, 90, 120]).map((d) => (
                            <SelectItem key={d} value={d.toString()}>
                                {d} menit
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Conflict warning */}
            {hasConflict && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        Waktu yang dipilih bertabrakan dengan booking lain.
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} className="flex-1">
                    Batal
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={!isChanged || hasConflict || reschedule.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {reschedule.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
            </div>
        </div>
    );
}
