import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Bell, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/stores/useAuth';
import { useSendBookingReminder } from '../hooks';
import { downloadIcsFile } from '../utils/calendarExport';
import type { ZoomBooking } from '../types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SendReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ZoomBooking | null;
    onSuccess?: () => void;
}

const DEFAULT_MINUTES_BEFORE = 15;

const REMINDER_OPTIONS: { label: string; val: number | undefined }[] = [
    { label: '15 mnt', val: 15 },
    { label: '30 mnt', val: 30 },
    { label: '1 jam', val: 60 },
    { label: 'Tidak', val: undefined },
];

export function SendReminderModal({
    isOpen,
    onClose,
    booking,
    onSuccess,
}: SendReminderModalProps) {
    const { user } = useAuth();
    const sendReminderMutation = useSendBookingReminder();

    const [recipientEmail, setRecipientEmail] = useState('');
    const [sendNow, setSendNow] = useState(true);
    const [minutesBefore, setMinutesBefore] = useState<number | undefined>(DEFAULT_MINUTES_BEFORE);

    useEffect(() => {
        if (booking && isOpen) {
            setRecipientEmail(user?.email || booking.bookedByUser?.email || '');
            setSendNow(true);
            setMinutesBefore(DEFAULT_MINUTES_BEFORE);
        }
    }, [booking, isOpen, user]);

    if (!booking) return null;

    const rawDate = booking.bookingDate;
    const dateStr = typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : new Date(rawDate || Date.now()).toISOString().split('T')[0];
    const formattedDate = format(parseISO(dateStr), 'EEEE, d MMMM yyyy', { locale: idLocale });
    const nothingSelected = !sendNow && !minutesBefore;

    const handleSend = async () => {
        if (!recipientEmail.trim()) {
            toast.error('Email penerima wajib diisi');
            return;
        }

        try {
            await sendReminderMutation.mutateAsync({
                bookingId: booking.id,
                recipientEmail: recipientEmail.trim(),
                sendNow,
                minutesBefore,
            });
            onSuccess?.();
            onClose();
        } catch {
            // error toast handled in mutation
        }
    };

    const handleAddToCalendar = () => {
        downloadIcsFile(booking);
        toast.success('File kalender (.ics) diunduh. Buka file untuk menyimpan ke Outlook.');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm rounded-3xl border-0 bg-card p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:shadow-none">
                <DialogHeader className="items-center space-y-2 text-center sm:text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                        <Bell className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <DialogTitle className="text-lg font-semibold tracking-tight">Pengingat</DialogTitle>
                    <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                        {booking.title}
                        <br />
                        {formattedDate} · {booking.startTime.slice(0, 5)} WIB
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Jadwalkan pengingat sebelum mulai</p>
                        <div role="radiogroup" aria-label="Waktu pengingat" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
                            {REMINDER_OPTIONS.map((opt) => {
                                const isSelected = minutesBefore === opt.val;
                                return (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        role="radio"
                                        aria-checked={isSelected}
                                        onClick={() => setMinutesBefore(opt.val)}
                                        className={cn(
                                            'rounded-lg py-1.5 text-xs font-medium transition-colors',
                                            isSelected
                                                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-slate-100/70 dark:divide-slate-700/60 dark:bg-slate-800/50">
                        <div className="flex items-center gap-3 px-4 py-2">
                            <Label htmlFor="reminder-email" className="shrink-0 text-sm font-normal text-slate-500 dark:text-slate-400">
                                Kirim ke
                            </Label>
                            <Input
                                id="reminder-email"
                                type="email"
                                value={recipientEmail}
                                onChange={(e) => setRecipientEmail(e.target.value)}
                                placeholder="nama@perusahaan.com"
                                className="h-8 border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:ring-0"
                            />
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2.5">
                            <Label htmlFor="reminder-send-now" className="text-sm font-normal text-slate-700 dark:text-slate-200">
                                Kirim email + undangan kalender sekarang
                            </Label>
                            <Switch id="reminder-send-now" className="ml-auto" checked={sendNow} onCheckedChange={setSendNow} />
                        </div>
                    </div>

                    <Button
                        type="button"
                        className="h-11 w-full rounded-full text-sm font-semibold"
                        disabled={sendReminderMutation.isPending || nothingSelected}
                        onClick={handleSend}
                    >
                        {sendReminderMutation.isPending ? 'Menyimpan…' : 'Simpan pengingat'}
                    </Button>

                    <button
                        type="button"
                        onClick={handleAddToCalendar}
                        className="mx-auto flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                        Tambah ke kalender (.ics)
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
