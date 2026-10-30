import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { TicketActionDialog } from './TicketActionDialog';
import { ActionChips } from './ActionControls';
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { X, Loader2, Trash2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toDisplayName } from './messageThread';
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
const PRESET_CHIPS = PRESET_OPTIONS.map(preset => ({ value: preset.id, label: preset.label }));

export const SetTicketReminderModal: React.FC<SetTicketReminderModalProps> = ({
    isOpen,
    onClose,
    ticketId,
    ticketNumber,
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

        if (loading) return;
        if (!isRemindDateValid || selectedDate <= new Date()) {
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
            return format(d, 'EEEE, d MMM yyyy Â· HH:mm', { locale: idLocale }) + ' WIB';
        } catch {
            return isoString;
        }
    };

    return (
        <TicketActionDialog open={isOpen} onClose={onClose} title="Atur pengingat" busy={loading}>
            <form onSubmit={handleCreateReminder} className="ticket-action-inner ticket-action-simple">
                <header className="ticket-action-header">
                    <div><h2>Atur pengingat</h2><p>#{ticketNumber || ticketId.slice(0, 8)}</p></div>
                    <Button variant="subtle" type="button" aria-label="Tutup" onClick={onClose} disabled={loading}><X /></Button>
                </header>
                <div className="ticket-action-body">
                    <p className="ticket-action-current">{assignedAgent?.email
                        ? `Penerima: ${toDisplayName(assignedAgent.fullName || 'Agent')}`
                        : 'Penerima: agent aktif saat jadwal tiba (belum ditugaskan).'}</p>
                    <div className="ticket-action-field">
                        <label>Jadwal pengingat</label>
                        <ModernDateTimePicker value={selectedDate} onChange={handleDateTimeChange} minDate={new Date()} disabled={loading} />
                        <span id="reminder-preset-label" className="ticket-action-help">Pilihan cepat</span>
                        <ActionChips labelledBy="reminder-preset-label" disabled={loading} value={activePreset}
                            options={PRESET_CHIPS} onSelect={handleApplyPreset} />
                    </div>
                    <div className="ticket-action-field">
                        <label htmlFor="ticket-reminder-note">Catatan <span>(opsional)</span></label>
                        <textarea id="ticket-reminder-note" aria-label="Catatan pengingat" value={note} disabled={loading}
                            onChange={event => { setNote(event.target.value.slice(0, 500)); setError(null); }}
                            maxLength={500} rows={3} placeholder="Tambahkan catatan tindak lanjut…" />
                    </div>
                    {error && <p role="alert" className="ticket-action-help">{error}</p>}
                    <section className="ticket-action-field">
                        <h3>Pengingat terjadwal ({reminders.length})</h3>
                        {fetchingReminders ? <p role="status">Memuat pengingat…</p> : reminders.length === 0
                            ? <p className="ticket-action-help">Belum ada pengingat.</p>
                            : <ul className="ticket-action-reminders">{reminders.map(reminder => <li key={reminder.id}>
                                <div><strong>{formatDisplayTime(reminder.remindAt)}</strong>
                                    <small>{reminder.isSent ? 'Terkirim' : 'Terjadwal'} · {toDisplayName(reminder.createdBy?.fullName || 'User')}</small>
                                    {reminder.note && <p>{reminder.note}</p>}
                                </div>
                                {!reminder.isSent && <Button variant="subtle" type="button" aria-label="Batalkan pengingat"
                                    disabled={deletingId !== null || loading} onClick={() => setDeleteTarget(reminder.id)}>
                                    {deletingId === reminder.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                </Button>}
                            </li>)}</ul>}
                    </section>
                </div>
                <footer className="ticket-action-footer"><div>
                    <Button variant="soft" type="button" onClick={onClose} disabled={loading}>Tutup</Button>
                    <Button variant="primary" className="ticket-action-reminder" aria-busy={loading} type="submit" disabled={loading || !isRemindDateValid}>
                        {loading && <Loader2 className="animate-spin" />}Jadwalkan pengingat
                    </Button>
                </div></footer>
            </form>
            <ConfirmationDialog appearance="ticket" isOpen={Boolean(deleteTarget)} title="Batalkan pengingat?"
                description="Pengingat ini tidak akan dikirim. Pengingat lainnya tetap aktif."
                confirmText="Batalkan pengingat" cancelText="Kembali" variant="destructive"
                isLoading={deletingId !== null} onCancel={() => setDeleteTarget(null)}
                onConfirm={() => { if (deleteTarget) void handleDeleteReminder(deleteTarget); }} />
        </TicketActionDialog>
    );
};
