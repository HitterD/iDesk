/**
 * RescheduleModal - Modal for users to reschedule their own bookings
 */
import { useState, useMemo, useEffect } from 'react';
import { format, addDays, parse, isSameDay } from 'date-fns';
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
import { ZOOM_DURATION_OPTIONS } from '../constants/duration-constants';

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

        if (selectedDate && isSameDay(selectedDate, new Date())) {
            const nowStr = format(new Date(), 'HH:mm');
            return options.filter((t) => t >= nowStr);
        }

        return options;
    }, [settings, selectedDate]);

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

    const isPastMidnight = useMemo(() => {
        if (!selectedTime || !booking) return false;
        const duration = selectedDuration || booking.durationMinutes;
        const [startH, startM] = selectedTime.split(':').map(Number);
        return (startH * 60 + startM + duration) > 24 * 60;
    }, [selectedTime, selectedDuration, booking]);

    const handleSubmit = async () => {
        if (!booking || !selectedDate || !selectedTime) return;

        if (isPastMidnight) {
            toast.error('Meeting tidak boleh melewati pukul 23:59. Silakan pilih jam mulai yang lebih awal atau kurangi durasi.');
            return;
        }

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
            <DialogContent className="sm:max-w-[500px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 text-slate-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center ring-1 ring-blue-500/20 shrink-0">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <span>Reschedule Meeting</span>
                            <p className="text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                                Atur ulang tanggal dan waktu booking Zoom Anda
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Current Booking Info Card */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                                <Video className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight truncate">{booking.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">Jadwal saat ini:</span>{' '}
                                    {format(originalDate, 'EEEE, d MMMM yyyy', { locale: idLocale })} • {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* New Date Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Tanggal Baru
                        </Label>
                        <ModernDatePicker
                            value={selectedDate}
                            onChange={setSelectedDate}
                            minDate={new Date()}
                            maxDate={settings ? addDays(new Date(), settings.advanceBookingDays) : undefined}
                            triggerClassName="h-11 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm hover:border-blue-500/50 focus:ring-2 focus:ring-blue-500/30 transition-all shadow-none"
                        />
                    </div>

                    {/* New Time Selection */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Waktu Baru
                        </Label>
                        <Select value={selectedTime} onValueChange={setSelectedTime}>
                            <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 hover:border-blue-500/50 shadow-none transition-all">
                                <SelectValue placeholder="Pilih waktu" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-60 shadow-xl">
                                {timeOptions.map(time => (
                                    <SelectItem key={time} value={time} className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                                        <div className="flex items-center gap-2 font-medium">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            {time}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Durasi (menit)
                        </Label>
                        <Select
                            value={selectedDuration?.toString() || booking.durationMinutes.toString()}
                            onValueChange={(v) => setSelectedDuration(parseInt(v))}
                        >
                            <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500/30 hover:border-blue-500/50 shadow-none transition-all">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-60 shadow-xl">
                                {ZOOM_DURATION_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                                        <span className="font-medium">{opt.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Midnight Warning */}
                    {isPastMidnight && (
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs shadow-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <p className="font-medium leading-relaxed">
                                Meeting tidak boleh melewati pukul 23:59. Silakan pilih jam mulai yang lebih awal atau kurangi durasi.
                            </p>
                        </div>
                    )}

                    {/* Conflict Warning */}
                    {hasConflict && (
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs shadow-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <p className="font-medium leading-relaxed">
                                Waktu yang dipilih bertabrakan dengan jadwal booking lain pada tanggal ini.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-all"
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!isChanged || hasConflict || isPastMidnight || reschedule.isPending}
                        className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {reschedule.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
