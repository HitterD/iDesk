import { useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AlertCircle, CalendarClock, CheckCircle2, Copy, ExternalLink, FileText, Trash2, Mail, Download, Shield, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBookingDetails } from '../hooks';
import { useAuth } from '@/stores/useAuth';
import { CancelBookingModal } from './CancelBookingModal';
import { RescheduleModal } from './RescheduleModal';
import { SendReminderModal } from './SendReminderModal';
import { formatZoomAccountName, generateInvitationText, copyToClipboard } from '../utils';
import { openOutlookWeb, downloadIcsFile } from '../utils/calendarExport';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BookingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: string;
}

const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

function extractMeetingId(joinUrl: string): string {
    const id = joinUrl.match(/\/j\/(\d+)/)?.[1];
    return id ? id.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3') : 'N/A';
}

function statusClass(status: string): string {
    if (status === 'CONFIRMED') return 'text-emerald-700 dark:text-emerald-300';
    if (status === 'CANCELLED') return 'text-red-700 dark:text-red-300';
    return 'text-amber-700 dark:text-amber-300';
}

export function BookingDetailsModal({ isOpen, onClose, bookingId }: BookingDetailsModalProps) {
    const { user } = useAuth();
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [copiedInv, setCopiedInv] = useState(false);

    const copyFullInvitation = async () => {
        if (!booking) return;
        if (await copyToClipboard(generateInvitationText(booking), 'Undangan')) {
            setCopiedInv(true);
            setTimeout(() => setCopiedInv(false), 2000);
        }
    };

    if (isLoading) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-md border-0 bg-card p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:shadow-none">
                    <DialogTitle className="sr-only">Memuat detail meeting</DialogTitle>
                    <div className="flex h-48 items-center justify-center">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary dark:border-slate-700" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!booking) return null;

    const isOwner = user?.id === booking.bookedByUserId;
    const isStaff = !!(user?.role && STAFF_ROLES.includes(user.role));
    const isCancelled = booking.status === 'CANCELLED';
    const isPending = booking.status === 'PENDING';
    const canManage = (isOwner || isStaff) && !isCancelled && !booking.isExternal;
    const meetingId = booking.meeting ? extractMeetingId(booking.meeting.joinUrl) : '';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-0 bg-card p-0 shadow-[0_18px_45px_rgba(15,23,42,0.12)] dark:shadow-none">
                <div className="space-y-5 p-6">
                    <header className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                Detail meeting
                            </p>
                            {booking.zoomAccount && (
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                    {formatZoomAccountName(booking.zoomAccount.name)}
                                </span>
                            )}
                        </div>
                        <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                            {booking.title}
                        </DialogTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn('text-xs font-medium', statusClass(booking.status))}>{booking.status}</p>
                            {booking.isDoubleBooking && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    DOBEL BOOKING (SECONDARY)
                                </span>
                            )}
                        </div>
                        {booking.description && (
                            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{booking.description}</p>
                        )}
                    </header>

                    {booking.isDoubleBooking && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <strong className="font-bold">Ketentuan Dobel Booking:</strong>
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                                    Meeting ini dibuat sebagai dobel booking darurat. Partisipan dapat bergabung dan berbicara normal, namun <strong>TIDAK BISA claim host</strong> dan <strong>TIDAK BISA merekam meeting</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    {booking.isExternal && (
                        <Notice tone="neutral" title="External Zoom Meeting">
                            Meeting ini dibuat secara manual di Zoom. Perubahan atau pembatalan dilakukan melalui Zoom Web Portal.
                        </Notice>
                    )}

                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-y border-slate-100 py-4 text-sm dark:border-slate-800 md:grid-cols-2">
                        <Metadata label="Tanggal">{format(new Date(booking.bookingDate), 'd MMM yyyy', { locale: idLocale })}</Metadata>
                        <Metadata label="Waktu">{booking.startTime}–{booking.endTime} WIB</Metadata>
                        <Metadata label="Durasi">{booking.durationMinutes} menit</Metadata>
                        <Metadata label="Dibooking oleh">{booking.bookedByUser?.fullName || 'Pengguna iDesk'}</Metadata>
                    </dl>

                    {/* PRIVACY ENFORCEMENT: Only show meeting link if user is owner or staff */}
                    {isOwner || isStaff ? (
                        booking.meeting ? (
                            <section className="space-y-4 rounded-2xl bg-blue-50/70 p-4 dark:bg-blue-950/25">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">Akses meeting</p>
                                <div className="flex items-center gap-2">
                                    <Input value={booking.meeting.joinUrl} readOnly className="h-9 min-w-0 bg-white text-xs dark:bg-slate-900" />
                                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 rounded-full" aria-label="Salin link" onClick={() => copyToClipboard(booking.meeting!.joinUrl, 'Link')}>
                                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                    <CopyValue label="Meeting ID" value={meetingId} onCopy={() => copyToClipboard(meetingId, 'Meeting ID')} />
                                    {booking.meeting.password && <CopyValue label="Passcode" value={booking.meeting.password} onCopy={() => copyToClipboard(booking.meeting!.password!, 'Passcode')} />}
                                </div>
                            </section>
                        ) : (
                            <Notice tone="amber" title="Zoom Link Belum Tersedia">
                                {isPending ? 'Sistem sedang memproses pembuatan link Zoom Anda. Harap tunggu sesaat.' : `Slot ruangan ini dibooking oleh ${booking.bookedByUser?.fullName || 'pengguna lain'}.`}
                            </Notice>
                        )
                    ) : (
                        /* Protected Privacy View for other users looking to coordinate / confront */
                        <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-xs">
                                <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                                <span>Informasi Pemilik Jadwal (Untuk Konfrontasi & Koordinasi)</span>
                            </div>

                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/60 pb-2">
                                    <span className="text-slate-500">Nama Pem-booking:</span>
                                    <strong className="text-slate-900 dark:text-slate-100">
                                        {booking.bookedByUser?.fullName || 'Pengguna Lain'}
                                    </strong>
                                </div>
                                {(booking.bookedByUser as any)?.department && (
                                    <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/60 pb-2">
                                        <span className="text-slate-500">Divisi / Departemen:</span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {(booking.bookedByUser as any).department}
                                        </span>
                                    </div>
                                )}
                                {booking.bookedByUser?.email && (
                                    <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/60 pb-2">
                                        <span className="text-slate-500">Kontak Email:</span>
                                        <a
                                            href={`mailto:${booking.bookedByUser.email}?subject=Koordinasi Jadwal Zoom: ${encodeURIComponent(booking.title)}`}
                                            className="text-blue-600 dark:text-blue-400 font-mono hover:underline flex items-center gap-1 font-semibold"
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            <span>{booking.bookedByUser.email}</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-blue-200/80 dark:border-blue-900 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                🔒 <strong>Link Zoom Disembunyikan:</strong> Tautan Zoom dan akses meeting dirahasiakan untuk menjaga privasi meeting internal. Anda dapat menghubungi pem-booking di atas untuk konfrontasi atau negosiasi penyesuaian jadwal.
                            </div>
                        </div>
                    )}

                    {isCancelled && booking.cancellationReason && (
                        <Notice tone="red" title="Dibatalkan">Alasan: {booking.cancellationReason}</Notice>
                    )}

                    <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        {(isOwner || isStaff) && booking.meeting && (
                            <Button variant="outline" className="rounded-full text-xs font-medium" onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}>
                                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Join meeting
                            </Button>
                        )}
                        {(isOwner || isStaff) && booking.meeting && (
                            <Button variant="outline" className={cn('rounded-full text-xs font-medium', copiedInv && 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300')} onClick={copyFullInvitation}>
                                {copiedInv ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                                {copiedInv ? 'Undangan tersalin' : 'Salin undangan'}
                            </Button>
                        )}
                        {(isOwner || isStaff) && booking.meeting && (
                            <Button
                                variant="outline"
                                className="rounded-full text-xs font-semibold gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                onClick={() => setShowReminderModal(true)}
                                title="Kirim pengingat meeting ke email & tambahkan ke Outlook Calendar"
                            >
                                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                Email / Outlook
                            </Button>
                        )}
                        {(isOwner || isStaff) && booking.meeting && (
                            <Button
                                variant="outline"
                                className="rounded-full text-xs font-medium gap-1.5 cursor-pointer"
                                onClick={() => openOutlookWeb(booking)}
                                title="Buka langsung di Outlook Web Office 365"
                            >
                                <ExternalLink className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                                Outlook Web
                            </Button>
                        )}
                        {canManage && (
                            <Button variant="outline" className="rounded-full text-xs font-medium" onClick={() => setShowRescheduleModal(true)}>
                                <CalendarClock className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Reschedule
                            </Button>
                        )}
                        {canManage && (
                            <Button variant="ghost" className="rounded-full text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30" onClick={() => setShowCancelModal(true)}>
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                Batalkan
                            </Button>
                        )}
                        {!isOwner && !isStaff && booking.bookedByUser?.email && (
                            <Button
                                variant="outline"
                                className="rounded-full text-xs font-semibold gap-1.5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                onClick={() => window.open(`mailto:${booking.bookedByUser!.email}?subject=Koordinasi Jadwal Zoom: ${encodeURIComponent(booking.title)}`)}
                            >
                                <Mail className="h-3.5 w-3.5" />
                                <span>Hubungi via Email</span>
                            </Button>
                        )}
                        <Button variant="secondary" className="ml-auto rounded-full text-xs font-medium" onClick={onClose}>Tutup</Button>
                    </footer>
                </div>
            </DialogContent>

            {showReminderModal && (
                <SendReminderModal
                    isOpen={showReminderModal}
                    onClose={() => setShowReminderModal(false)}
                    booking={booking}
                />
            )}
            {showRescheduleModal && <RescheduleModal isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} booking={booking} />}
            {showCancelModal && (
                <CancelBookingModal
                    isOpen={showCancelModal}
                    onClose={() => setShowCancelModal(false)}
                    booking={booking}
                    onSuccess={() => {
                        setShowCancelModal(false);
                        onClose();
                    }}
                    isOwner
                />
            )}
        </Dialog>
    );
}

function Metadata({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{label}</dt>
            <dd className="mt-1 font-medium text-slate-800 dark:text-slate-200">{children}</dd>
        </div>
    );
}

function CopyValue({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 flex items-center justify-between gap-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                {value}
                <button type="button" className="rounded p-1 text-slate-400 transition-colors duration-200 [transition-timing-function:var(--ease-out)] hover:text-blue-700 dark:hover:text-blue-300" aria-label={`Salin ${label}`} onClick={onCopy}>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </dd>
        </div>
    );
}

function Notice({ tone, title, children }: { tone: 'neutral' | 'amber' | 'red'; title: string; children: React.ReactNode }) {
    const classes = {
        neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300',
        amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
        red: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
    };

    return (
        <div className={cn('flex gap-2 rounded-xl p-3 text-xs leading-relaxed', classes[tone])}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div><p className="font-semibold">{title}</p><p className="mt-0.5 opacity-85">{children}</p></div>
        </div>
    );
}
