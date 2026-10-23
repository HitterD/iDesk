import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
    Bell,
    Calendar,
    Clock,
    X,
    Loader2,
    AlertCircle,
    Trash2,
    CheckCircle2,
    UserCheck,
    AlertTriangle,
    Send,
} from 'lucide-react';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ModernDateTimePicker } from '@/components/ui/ModernDateTimePicker';

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

type PresetKey = 'tomorrow_morning' | 'two_days' | 'today_evening' | 'next_week';

interface PresetOption {
    id: PresetKey;
    label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
    { id: 'tomorrow_morning', label: 'Besok Pagi' },
    { id: 'two_days', label: '2 Hari Lagi' },
    { id: 'today_evening', label: 'Akhir Kerja' },
    { id: 'next_week', label: '1 Minggu' },
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
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const [activePreset, setActivePreset] = useState<PresetKey | null>('tomorrow_morning');
    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(8, 0, 0, 0);
        return d;
    });
    const [note, setNote] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [reminders, setReminders] = useState<TicketReminderItem[]>([]);
    const [fetchingReminders, setFetchingReminders] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchExistingReminders = async () => {
        try {
            setFetchingReminders(true);
            const res = await api.get(`/tickets/${ticketId}/reminders`);
            setReminders(res.data || []);
        } catch (err) {
            setError('Daftar pengingat gagal dimuat. Tutup dan buka kembali untuk mencoba lagi.');
        } finally {
            setFetchingReminders(false);
        }
    };

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const initial = new Date();
            initial.setDate(now.getDate() + 1);
            initial.setHours(8, 0, 0, 0);
            setSelectedDate(initial);
            setActivePreset('tomorrow_morning');
            setNote('');
            setError(null);
            fetchExistingReminders();
        }
    }, [isOpen, ticketId]);

    const isRemindDateValid = useMemo(() => {
        return selectedDate && !isNaN(selectedDate.getTime()) && !isPast(selectedDate);
    }, [selectedDate]);


    const handleApplyPreset = (presetId: PresetKey) => {
        setActivePreset(presetId);
        const now = new Date();
        const target = new Date();

        if (presetId === 'tomorrow_morning') {
            target.setDate(now.getDate() + 1);
            target.setHours(8, 0, 0, 0);
        } else if (presetId === 'two_days') {
            target.setDate(now.getDate() + 2);
            target.setHours(9, 0, 0, 0);
        } else if (presetId === 'today_evening') {
            if (now.getHours() >= 17) {
                target.setDate(now.getDate() + 1);
            }
            target.setHours(17, 0, 0, 0);
        } else if (presetId === 'next_week') {
            target.setDate(now.getDate() + 7);
            target.setHours(9, 0, 0, 0);
        }

        setSelectedDate(target);
        setError(null);
    };

    const handleDateTimeChange = (newDate: Date) => {
        setSelectedDate(newDate);
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
                remindAt: selectedDate.toISOString(),
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
            setDeleteTarget(null);
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

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Atur pengingat" busy={loading}>
            <div className="ticket-action-inner">
                {/* Header (Apple Sheet Style) */}
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 id="ticket-reminder-title" className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
                                    Atur Pengingat Tiket
                                </h2>
                                <span className="font-mono text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                                    #{ticketNumber || ticketId.slice(0, 8)}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {ticketTitle || 'Ticket'}
                            </p>
                        </div>
                    </div>
                    <Button variant="soft"
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        title="Tutup"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Form Wrapping Scrollable Body and Footer */}
                <form onSubmit={handleCreateReminder} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left custom-scrollbar">
                        {/* 1. Subtle Agent Recipient Info */}
                        {assignedAgent && assignedAgent.email ? (
                            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                        <UserCheck className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Penerima:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                            {assignedAgent.fullName || 'Agent'}
                                        </span>
                                    </div>
                                </div>
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                                    {assignedAgent.email}
                                </span>
                            </div>
                        ) : (
                            <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <p className="text-[11px] leading-tight">
                                    Belum ada agent ter-assign. Email pengingat otomatis dikirim ke agent aktif saat jadwal tiba.
                                </p>
                            </div>
                        )}

                        {/* 2. Jadwal Pengingat */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    Jadwal Pengingat
                                </label>
                                <span className="text-[10px] text-slate-400">WIB</span>
                            </div>

                            {/* Apple Segmented Capsule Bar */}
                            <div className="p-1 bg-slate-100/90 dark:bg-white/5 rounded-2xl grid grid-cols-4 gap-1 border border-slate-200/60 dark:border-white/5">
                                {PRESET_OPTIONS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        aria-pressed={activePreset === preset.id}
                                        type="button"
                                        onClick={() => handleApplyPreset(preset.id)}
                                        className={cn(
                                            "py-1.5 px-2 text-center text-xs font-medium rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-[0.97]",
                                            activePreset === preset.id
                                                ? "bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white shadow-xs font-semibold"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/40 dark:hover:bg-white/5"
                                        )}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Modern Date & Time Picker */}
                            <ModernDateTimePicker
                                value={selectedDate}
                                onChange={handleDateTimeChange}
                                minDate={new Date()}
                                placeholder="Pilih Tanggal & Waktu Pengingat"
                            />

                            {/* Target Summary Row */}
                            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Jadwal Kirim:</span>
                                    <span className="font-semibold text-primary truncate">
                                        {format(selectedDate, 'EEEE, d MMM yyyy · HH:mm', { locale: idLocale })} WIB
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                                    {formatDistanceToNow(selectedDate, { addSuffix: true, locale: idLocale })}
                                </span>
                            </div>
                        </div>

                        {/* 3. Catatan / Memo */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    Catatan / Memo <span className="text-slate-400 font-normal normal-case">(opsional)</span>
                                </label>
                                <span className="text-[10px] font-mono text-slate-400">{note.length} / 500</span>
                            </div>
                            <textarea
                                id="ticket-reminder-note"
                                aria-label="Catatan pengingat"
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value.slice(0, 500));
                                    if (error) setError(null);
                                }}
                                maxLength={500}
                                rows={2}
                                placeholder="Tuliskan catatan tindak lanjut yang akan disertakan dalam email..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none leading-relaxed"
                            />
                        </div>

                        {error && (
                            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 animate-in fade-in duration-200">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* 4. Active / Scheduled Reminders List */}
                        <div className="pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    <span>Pengingat Terjadwal ({reminders.length})</span>
                                </label>
                                {fetchingReminders && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                            </div>

                            {reminders.length === 0 && !fetchingReminders ? (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                    Belum ada pengingat lain yang aktif untuk tiket ini.
                                </p>
                            ) : (
                                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-0.5">
                                    {reminders.map((r) => {
                                        const reminderDate = new Date(r.remindAt);
                                        return (
                                            <div
                                                key={r.id}
                                                className="px-3 py-2 rounded-xl border border-slate-200/70 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] flex items-center justify-between gap-2.5 text-xs"
                                            >
                                                <div className="min-w-0 flex-1 space-y-0.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                            {formatDisplayTime(r.remindAt)}
                                                        </span>
                                                        {r.isSent ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                                                <CheckCircle2 className="w-3 h-3" /> Terkirim
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary">
                                                                <Clock className="w-3 h-3" /> Terjadwal
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.note && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                            "{r.note}"
                                                        </p>
                                                    )}
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                        <span>Oleh: {r.createdBy?.fullName || 'User'}</span>
                                                        <span>•</span>
                                                        <span>{formatDistanceToNow(reminderDate, { addSuffix: true, locale: idLocale })}</span>
                                                    </div>
                                                </div>

                                                {!r.isSent && (
                                                    <Button variant="soft"
                                                        type="button"
                                                        onClick={() => setDeleteTarget(r.id)}
                                                        disabled={deletingId === r.id}
                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                                        title="Batalkan pengingat"
                                                    >
                                                        {deletingId === r.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-2.5">
                        <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                            Otomatis dikirim via Email & Notifikasi
                        </p>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button variant="soft"
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Tutup
                            </Button>
                            <Button variant="primary" className="ticket-action-reminder" aria-busy={loading}
                                type="submit"
                                disabled={loading || !isRemindDateValid}
                            >
                                {loading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Send className="w-3.5 h-3.5" />
                                )}
                                <span>Jadwalkan Pengingat</span>
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
            <ConfirmationDialog appearance="ticket" isOpen={Boolean(deleteTarget)} title="Batalkan pengingat?"
                description="Pengingat ini tidak akan dikirim. Pengingat lainnya tetap aktif."
                confirmText="Batalkan pengingat" cancelText="Kembali" variant="destructive"
                isLoading={deletingId !== null} onCancel={() => setDeleteTarget(null)}
                onConfirm={() => { if (deleteTarget) void handleDeleteReminder(deleteTarget); }} />
        </TicketActionDialog>
    );
};
