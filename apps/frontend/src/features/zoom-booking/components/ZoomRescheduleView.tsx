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
    const [scope, setScope] = useState<'this' | 'following' | 'all'>('this');

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
                    scope: booking.seriesId ? scope : undefined,
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
        <div className="p-6 space-y-5">
            {/* Current booking info */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                        <Video className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight truncate">{booking.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Jadwal saat ini:</span>{' '}
                            {format(originalDate, 'EEEE, d MMMM yyyy', { locale: idLocale })} • {booking.startTime.substring(0, 5)} - {booking.endTime.substring(0, 5)}
                        </p>
                    </div>
                </div>
            </div>

            {/* New date */}
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                    Tanggal Baru
                </Label>
                <ModernDatePicker
                    value={selectedDate}
                    onChange={(date) => setSelectedDate(date)}
                    minDate={new Date()}
                    maxDate={settings ? addDays(new Date(), settings.advanceBookingDays) : undefined}
                    triggerClassName="h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm hover:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 shadow-none transition-colors"
                />
            </div>

            {/* New time */}
            <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    Waktu Baru
                </Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 hover:border-blue-500/50 shadow-none transition-colors">
                        <SelectValue placeholder="Pilih waktu" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-60">
                        {timeOptions.map((time) => (
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
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    Durasi (menit)
                </Label>
                <Select
                    value={selectedDuration.toString()}
                    onValueChange={(v) => setSelectedDuration(parseInt(v))}
                >
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 hover:border-blue-500/50 shadow-none transition-colors">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {(settings?.allowedDurations || [30, 60, 90, 120]).map((d) => (
                            <SelectItem key={d} value={d.toString()} className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-700 cursor-pointer">
                                <span className="font-medium">{d} menit</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Warning block */}
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs mt-4">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    Waktu yang tersedia disesuaikan dengan ketersediaan akun Zoom saat ini untuk memastikan <b>Link Zoom tidak berubah</b>.
                </p>
            </div>

            {/* Scope Selection for Recurring */}
            {booking.seriesId && (
                <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Terapkan Perubahan Untuk:</Label>
                    <Select value={scope} onValueChange={(val: any) => setScope(val)}>
                        <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white rounded-xl text-sm">
                            <SelectValue placeholder="Pilih jadwal yang diubah" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <SelectItem value="this">Hanya jadwal ini</SelectItem>
                            <SelectItem value="following">Jadwal ini dan selanjutnya</SelectItem>
                            <SelectItem value="all">Semua jadwal dalam seri</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Conflict warning */}
            {hasConflict && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="font-medium leading-relaxed">
                        Waktu yang dipilih bertabrakan dengan booking lain.
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" onClick={onClose} className="h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm">
                    Batal
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={!isChanged || hasConflict || reschedule.isPending}
                    className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                >
                    {reschedule.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
            </div>
        </div>
    );
}
