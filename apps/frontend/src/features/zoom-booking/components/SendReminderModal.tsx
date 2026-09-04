import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    Mail, Calendar, Clock, ExternalLink, Download, Bell,
    Send, CheckCircle2, Video, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/stores/useAuth';
import { useSendBookingReminder } from '../hooks';
import { openOutlookWeb, downloadIcsFile } from '../utils/calendarExport';
import type { ZoomBooking } from '../types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SendReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: ZoomBooking | null;
    onSuccess?: () => void;
}

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
    const [minutesBefore, setMinutesBefore] = useState<number | undefined>(15);

    useEffect(() => {
        if (booking && isOpen) {
            const defaultEmail = user?.email || booking.bookedByUser?.email || '';
            setRecipientEmail(defaultEmail);
            setSendNow(true);
            setMinutesBefore(15);
        }
    }, [booking, isOpen, user]);

    if (!booking) return null;

    const rawDate = booking.bookingDate;
    const dateStr = typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : new Date(rawDate || Date.now()).toISOString().split('T')[0];
    const formattedDate = format(parseISO(dateStr), 'EEEE, d MMMM yyyy', { locale: idLocale });

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md rounded-2xl bg-card border-border shadow-2xl p-0 overflow-hidden">
                {/* Header Banner */}
                <div className="bg-linear-to-r from-blue-600 to-indigo-600 p-5 text-white">
                    <DialogHeader className="text-left space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-white/20 backdrop-blur-xs">
                                <Mail className="w-4 h-4 text-white" />
                            </span>
                            <span className="text-[11px] font-mono tracking-wider uppercase font-bold text-blue-100">
                                Pengingat & Kalender
                            </span>
                        </div>
                        <DialogTitle className="text-lg font-bold text-white leading-tight">
                            Kirim ke Email & Outlook
                        </DialogTitle>
                        <DialogDescription className="text-xs text-blue-100/90 font-normal">
                            Kirim ringkasan meeting ke email dan tambahkan jadwal ke Outlook Calendar.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-5 space-y-4">
                    {/* Meeting Summary Card */}
                    <div className="rounded-xl bg-muted/40 border border-border/80 p-3.5 space-y-2">
                        <div className="flex items-center gap-2">
                            <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                            <h4 className="text-xs font-bold text-foreground truncate">
                                {booking.title}
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-muted-foreground/70" />
                                <span className="truncate">{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground/70" />
                                <span>{booking.startTime} - {booking.endTime} WIB</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Outlook Calendar Actions */}
                    <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">
                            Aksi Cepat Outlook Calendar
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openOutlookWeb(booking)}
                                className="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted/70 cursor-pointer"
                                title="Buka tab baru Outlook Web Office 365"
                            >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span>Outlook Web (M365)</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    downloadIcsFile(booking);
                                    toast.success('File kalender (.ics) berhasil diunduh. Buka file untuk menyimpan ke Outlook.');
                                }}
                                className="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted/70 cursor-pointer"
                                title="Unduh file .ics untuk Outlook Desktop"
                            >
                                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Download (.ics)</span>
                            </Button>
                        </div>
                    </div>

                    <div className="w-full h-px bg-border/60" />

                    {/* Email Target Form */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="reminder-email" className="text-xs font-semibold text-foreground">
                                Alamat Email Penerima
                            </Label>
                            <div className="relative">
                                <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="reminder-email"
                                    type="email"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    placeholder="nama@perusahaan.com"
                                    className="h-8 pl-8 text-xs bg-background border-border/80"
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Email akan menerima link meeting, passcode, dan file lampiran undangan kalender (.ics).
                            </p>
                        </div>

                        {/* Reminder Options */}
                        <div className="space-y-2 pt-1">
                            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={sendNow}
                                    onChange={(e) => setSendNow(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                />
                                <span>Kirim email pengingat sekarang</span>
                            </label>

                            <div className="space-y-1.5 pl-5.5">
                                <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                                    <Bell className="w-3 h-3" />
                                    <span>Jadwalkan pengingat otomatis sebelum meeting:</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { label: 'Tidak ada', val: undefined },
                                        { label: '15 Menit', val: 15 },
                                        { label: '30 Menit', val: 30 },
                                        { label: '1 Jam', val: 60 },
                                    ].map((opt) => {
                                        const isSelected = minutesBefore === opt.val;
                                        return (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => setMinutesBefore(opt.val)}
                                                className={cn(
                                                    "px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all cursor-pointer border",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                                        : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/70"
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-5 py-3 bg-muted/20 border-t border-border/60 flex items-center justify-between sm:justify-between">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                        Tutup
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        disabled={sendReminderMutation.isPending || (!sendNow && !minutesBefore)}
                        onClick={handleSend}
                        className="h-8 text-xs font-bold gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                    >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendReminderMutation.isPending ? 'Mengirim...' : 'Kirim Pengingat'}</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
