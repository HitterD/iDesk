import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
    Bell,
    Calendar,
    Clock,
    X,
    Loader2,
    AlertCircle,
    Info,
    Trash2,
    Plus,
    CheckCircle2,
    UserCheck,
    AlertTriangle,
    Zap,
    Sunrise,
    CalendarDays,
    ArrowRight,
    Send,
} from 'lucide-react';
import { format, addDays, isPast, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';

export interface TicketReminderItem {
    id: string;
    ticketId: string;
    remindAt: string;
    note?: string | null;
    isSent: boolean;
    sentAt?: string | null;
    createdById: string;
    createdBy?: {
        id: string;
        fullName?: string;
        username?: string;
    };
    createdAt: string;
}

interface SetTicketReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: string;
    ticketNumber?: string;
    ticketTitle?: string;
    assignedAgent?: {
        id: string;
        fullName?: string;
        email?: string;
    } | null;
    onReminderCreated?: () => void;
}

type PresetKey = 'tomorrow_morning' | 'two_days' | 'next_week' | 'today_evening';

interface PresetOption {
    id: PresetKey;
    title: string;
    timeLabel: string;
    description: string;
    icon: React.ElementType;
}

const PRESET_OPTIONS: PresetOption[] = [
    {
        id: 'tomorrow_morning',
        title: 'Besok Pagi',
        timeLabel: '08:00 WIB',
        description: 'H+1 kerja',
        icon: Sunrise,
    },
    {
        id: 'two_days',
        title: '2 Hari Lagi',
        timeLabel: '09:00 WIB',
        description: 'H+2 kerja',
        icon: CalendarDays,
    },
    {
        id: 'today_evening',
        title: 'Akhir Kerja',
        timeLabel: '17:00 WIB',
        description: 'Sore ini / besok',
        icon: Clock,
    },
    {
        id: 'next_week',
        title: '1 Minggu Lagi',
        timeLabel: '09:00 WIB',
        description: 'H+7 jadwal',
        icon: Calendar,
    },
];

const COMMON_HOURS = [
    { label: '08:00 Pagi', h: 8, m: 0 },
    { label: '09:00 Pagi', h: 9, m: 0 },
    { label: '10:00 Pagi', h: 10, m: 0 },
    { label: '13:00 Siang', h: 13, m: 0 },
    { label: '15:00 Sore', h: 15, m: 0 },
    { label: '17:00 Sore', h: 17, m: 0 },
];

export const SetTicketReminderModal: React.FC<SetTicketReminderModalProps> = ({
    isOpen,
    onClose,
    ticketId,
    ticketNumber,
    ticketTitle,
    assignedAgent,
    onReminderCreated,
}) => {
    const queryClient = useQueryClient();

    const [activePreset, setActivePreset] = useState<PresetKey | null>('tomorrow_morning');
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d;
    });
    const [selectedHour, setSelectedHour] = useState<number>(8);
    const [selectedMinute, setSelectedMinute] = useState<number>(0);
    const [note, setNote] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [reminders, setReminders] = useState<TicketReminderItem[]>([]);
    const [fetchingReminders, setFetchingReminders] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [entered, setEntered] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEntered(true);
            fetchExistingReminders();
        } else {
            setEntered(false);
        }
    }, [isOpen, ticketId]);

    const fetchExistingReminders = async () => {
        try {
            setFetchingReminders(true);
            const res = await api.get(`/tickets/${ticketId}/reminders`);
            setReminders(res.data || []);
        } catch (err) {
            // Non-blocking error for reminder list fetch
        } finally {
            setFetchingReminders(false);
        }
    };

    const finalRemindDate = useMemo(() => {
        const d = new Date(selectedDate);
        d.setHours(selectedHour, selectedMinute, 0, 0);
        return d;
    }, [selectedDate, selectedHour, selectedMinute]);

    const isRemindDateValid = useMemo(() => {
        return !isPast(finalRemindDate);
    }, [finalRemindDate]);

    if (!isOpen) return null;

    const handleApplyPreset = (presetId: PresetKey) => {
        setActivePreset(presetId);
        const now = new Date();

        if (presetId === 'tomorrow_morning') {
            const next = addDays(now, 1);
            setSelectedDate(next);
            setSelectedHour(8);
            setSelectedMinute(0);
        } else if (presetId === 'two_days') {
            const next = addDays(now, 2);
            setSelectedDate(next);
            setSelectedHour(9);
            setSelectedMinute(0);
        } else if (presetId === 'today_evening') {
            const target = new Date();
            if (now.getHours() >= 17) {
                const next = addDays(now, 1);
                setSelectedDate(next);
            } else {
                setSelectedDate(target);
            }
            setSelectedHour(17);
            setSelectedMinute(0);
        } else if (presetId === 'next_week') {
            const next = addDays(now, 7);
            setSelectedDate(next);
            setSelectedHour(9);
            setSelectedMinute(0);
        }
        setError(null);
    };

    const handleCustomDateChange = (date: Date) => {
        setSelectedDate(date);
        setActivePreset(null);
        setError(null);
    };

    const handleCustomHourChange = (hour: number) => {
        setSelectedHour(hour);
        setActivePreset(null);
        setError(null);
    };

    const handleCustomMinuteChange = (minute: number) => {
        setSelectedMinute(minute);
        setActivePreset(null);
        setError(null);
    };

    const handleCreateReminder = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isRemindDateValid) {
            setError('Waktu pengingat harus berada di masa mendatang.');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await api.post(`/tickets/${ticketId}/reminders`, {
                remindAt: finalRemindDate.toISOString(),
                note: note.trim() || undefined,
            });

            toast.success('Pengingat email tiket berhasil dijadwalkan');
            setNote('');
            fetchExistingReminders();
            queryClient.invalidateQueries({ queryKey: ['ticket-reminders', ticketId] });
            if (onReminderCreated) {
                onReminderCreated();
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Gagal menjadwalkan pengingat');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteReminder = async (reminderId: string) => {
        try {
            setDeletingId(reminderId);
            await api.delete(`/tickets/${ticketId}/reminders/${reminderId}`);
            toast.success('Pengingat berhasil dibatalkan');
            setReminders((prev) => prev.filter((r) => r.id !== reminderId));
            queryClient.invalidateQueries({ queryKey: ['ticket-reminders', ticketId] });
            if (onReminderCreated) {
                onReminderCreated();
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Gagal membatalkan pengingat');
        } finally {
            setDeletingId(null);
        }
    };

    const formatDisplayTime = (isoString: string) => {
        try {
            const d = new Date(isoString);
            return format(d, 'EEEE, d MMM yyyy · HH:mm', { locale: idLocale }) + ' WIB';
        } catch {
            return isoString;
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget && !loading) {
                    onClose();
                }
            }}
        >
            <div
                className="relative w-full max-w-xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-[1.75rem] animate-in zoom-in-95 duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Double-Bezel Inner Wrap */}
                <div className="p-1 sm:p-1.5 bg-slate-100/60 dark:bg-slate-950/40 ring-1 ring-black/[0.04] dark:ring-white/[0.06] rounded-[calc(1.75rem-0.25rem)]">
                    <div className="bg-white dark:bg-slate-900 rounded-[calc(1.75rem-0.5rem)] border border-slate-200/80 dark:border-slate-800/90 shadow-sm overflow-hidden flex flex-col max-h-[88vh]">
                        
                        {/* Modal Header */}
                        <div
                            className={cn(
                                'flex items-start justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
                                    <Bell className="w-5 h-5" strokeWidth={1.75} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                            Atur Pengingat Tiket
                                        </h3>
                                        <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70 shrink-0">
                                            Email Reminder
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        #{ticketNumber || ticketId.slice(0, 8)} — {ticketTitle || 'Ticket'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all duration-200 active:scale-95 disabled:opacity-50 cursor-pointer"
                                title="Tutup"
                            >
                                <X className="w-4 h-4" strokeWidth={2} />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div
                            className={cn(
                                'p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                            )}
                        >
                            {/* Assigned Agent Notification Banner */}
                            {assignedAgent && assignedAgent.email ? (
                                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 text-xs flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <UserCheck className="w-4 h-4" strokeWidth={2} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                                Target Penerima Email
                                            </div>
                                            <div className="font-bold text-slate-900 dark:text-white truncate">
                                                {assignedAgent.fullName || 'Agent'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                            {assignedAgent.email}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" strokeWidth={2} />
                                    <div className="space-y-0.5 leading-relaxed">
                                        <p className="font-bold">Belum Ada Agent Ter-assign</p>
                                        <p className="text-[11px] opacity-90">
                                            Pengingat tetap dapat dibuat. Sistem akan mendistribusikan email secara dinamis ke agent yang sedang aktif ter-assign saat jadwal reminder tiba.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Main Form */}
                            <form onSubmit={handleCreateReminder} className="space-y-4">
                                
                                {/* 1. Quick Presets (Pilihan Cepat) */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                            <span>Pilihan Cepat (Quick Presets)</span>
                                        </span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {PRESET_OPTIONS.map((opt) => {
                                            const isSelected = activePreset === opt.id;
                                            const IconComp = opt.icon;
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => handleApplyPreset(opt.id)}
                                                    className={cn(
                                                        'p-2.5 rounded-2xl border text-left transition-all duration-200 active:scale-[0.98] cursor-pointer relative overflow-hidden group',
                                                        isSelected
                                                            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500/80 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-500/30'
                                                            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                            {opt.title}
                                                        </span>
                                                        <IconComp className={cn("w-3.5 h-3.5", isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
                                                    </div>
                                                    <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                                                        {opt.timeLabel}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                        {opt.description}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. Custom Date & Time Configuration */}
                                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                            <span>Kustomisasi Tanggal & Jam Pengingat</span>
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        {/* Date Picker using ModernDatePicker */}
                                        <div className="sm:col-span-7 space-y-1">
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                                Pilih Tanggal
                                            </span>
                                            <ModernDatePicker
                                                value={selectedDate}
                                                onChange={handleCustomDateChange}
                                                minDate={new Date()}
                                                placeholder="Pilih Tanggal Pengingat"
                                                className="z-[10000]"
                                                triggerClassName="h-10 text-xs font-medium rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs"
                                            />
                                        </div>

                                        {/* Time Selectors (Hour & Minute) */}
                                        <div className="sm:col-span-5 space-y-1">
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                                                Waktu (Jam : Menit WIB)
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                {/* Hour Select */}
                                                <select
                                                    value={selectedHour}
                                                    onChange={(e) => handleCustomHourChange(parseInt(e.target.value, 10))}
                                                    className="h-10 flex-1 px-2.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>
                                                            {i.toString().padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>

                                                <span className="font-bold text-slate-400">:</span>

                                                {/* Minute Select */}
                                                <select
                                                    value={selectedMinute}
                                                    onChange={(e) => handleCustomMinuteChange(parseInt(e.target.value, 10))}
                                                    className="h-10 flex-1 px-2.5 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-2xs"
                                                >
                                                    {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                                                        <option key={m} value={m}>
                                                            {m.toString().padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>

                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                                                    WIB
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Time Shortcuts */}
                                    <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[10px] text-slate-400 font-medium mr-1">Jam Umum:</span>
                                        {COMMON_HOURS.map((ch) => (
                                            <button
                                                key={ch.label}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedHour(ch.h);
                                                    setSelectedMinute(ch.m);
                                                    setActivePreset(null);
                                                    setError(null);
                                                }}
                                                className={cn(
                                                    'px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer border',
                                                    selectedHour === ch.h && selectedMinute === ch.m
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                )}
                                            >
                                                {ch.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Dynamic Preview Schedule Banner */}
                                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 text-xs flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                        <div className="truncate">
                                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Jadwal Kirim: </span>
                                            <span className="font-bold text-blue-700 dark:text-blue-300">
                                                {format(finalRemindDate, 'EEEE, d MMMM yyyy · HH:mm', { locale: idLocale })} WIB
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-900/50 px-2 py-0.5 rounded-full shrink-0">
                                        {formatDistanceToNow(finalRemindDate, { addSuffix: true, locale: idLocale })}
                                    </span>
                                </div>

                                {/* 3. Note / Memo */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                        <span>
                                            Catatan / Memo Pengingat{' '}
                                            <span className="text-slate-400 font-normal">(Disertakan dalam email)</span>
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">{note.length}/500</span>
                                    </label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => {
                                            setNote(e.target.value.slice(0, 500));
                                            if (error) setError(null);
                                        }}
                                        placeholder="Tuliskan catatan tindak lanjut (contoh: Follow-up user mengenai log error / pastikan deployment sudah selesai)..."
                                        rows={2}
                                        className="w-full px-3.5 py-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none transition-all resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 shadow-2xs"
                                    />
                                </div>

                                {error && (
                                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 animate-in fade-in duration-200">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-[11px] text-slate-400">
                                        * Email otomatis dikirimkan tepat pada jadwal di atas.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={loading || !isRemindDateValid}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-xs hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Send className="w-3.5 h-3.5" />
                                        )}
                                        <span>Jadwalkan Pengingat</span>
                                    </button>
                                </div>
                            </form>

                            {/* 4. Active & Scheduled Reminders List */}
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Daftar Pengingat Tiket Ini ({reminders.length})</span>
                                    </span>
                                    {fetchingReminders && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                </div>

                                {reminders.length === 0 && !fetchingReminders ? (
                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60 text-center text-xs text-slate-400">
                                        Belum ada pengingat yang dijadwalkan untuk tiket ini.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-0.5">
                                        {reminders.map((r) => {
                                            const reminderDate = new Date(r.remindAt);
                                            const isOverdue = isPast(reminderDate);

                                            return (
                                                <div
                                                    key={r.id}
                                                    className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start justify-between gap-3 text-xs shadow-2xs hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
                                                >
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-slate-900 dark:text-white">
                                                                {formatDisplayTime(r.remindAt)}
                                                            </span>
                                                            {r.isSent ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                                                    <CheckCircle2 className="w-3 h-3" /> Terkirim
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                                                    <Clock className="w-3 h-3" /> Terjadwal
                                                                </span>
                                                            )}
                                                        </div>

                                                        {r.note && (
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                                                                "{r.note}"
                                                            </p>
                                                        )}

                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                            <span>Dibuat oleh: <strong className="text-slate-600 dark:text-slate-300">{r.createdBy?.fullName || 'User'}</strong></span>
                                                            <span>•</span>
                                                            <span>{formatDistanceToNow(reminderDate, { addSuffix: true, locale: idLocale })}</span>
                                                        </div>
                                                    </div>

                                                    {!r.isSent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteReminder(r.id)}
                                                            disabled={deletingId === r.id}
                                                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                                                            title="Batalkan pengingat ini"
                                                        >
                                                            {deletingId === r.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                            ) : (
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div
                            className={cn(
                                'flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                                entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                            )}
                        >
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-slate-400" />
                                <span>iDesk Automated Dispatcher</span>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                            >
                                Tutup
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
