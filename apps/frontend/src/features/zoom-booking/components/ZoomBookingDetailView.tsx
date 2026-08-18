import { useState } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { AlertCircle, CalendarClock, CheckCircle2, Copy, ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBookingDetails } from '../hooks';
import { useAuth } from '@/stores/useAuth';
import { CancelBookingModal } from './CancelBookingModal';
import { formatZoomAccountName, generateInvitationText, copyToClipboard } from '../utils';
import { cn } from '@/lib/utils';
import type { ZoomBooking } from '../types';

const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

interface ZoomBookingDetailViewProps {
    bookingId: string;
    onClose: () => void;
    onReschedule?: (booking: ZoomBooking) => void;
}

function extractMeetingId(joinUrl: string): string {
    const id = joinUrl.match(/\/j\/(\d+)/)?.[1];
    return id ? id.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3') : 'N/A';
}

function statusClass(status: string): string {
    if (status === 'CONFIRMED') return 'text-emerald-700 dark:text-emerald-300';
    if (status === 'CANCELLED') return 'text-red-700 dark:text-red-300';
    return 'text-amber-700 dark:text-amber-300';
}

export function ZoomBookingDetailView({ bookingId, onClose, onReschedule }: ZoomBookingDetailViewProps) {
    const { user } = useAuth();
    const { data: booking, isLoading } = useBookingDetails(bookingId);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [copiedInv, setCopiedInv] = useState(false);

    if (isLoading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat detail meeting" />
            </div>
        );
    }

    if (!booking) return null;

    const isOwner = user?.id === booking.bookedByUserId;
    const isStaff = !!(user?.role && STAFF_ROLES.includes(user.role));
    const isCancelled = booking.status === 'CANCELLED';
    const isPending = booking.status === 'PENDING';
    const canManage = (isOwner || isStaff) && !isCancelled && !booking.isExternal;
    const meetingId = booking.meeting ? extractMeetingId(booking.meeting.joinUrl) : '';

    const copyFullInvitation = async () => {
        if (await copyToClipboard(generateInvitationText(booking), 'Full Invitation')) {
            setCopiedInv(true);
            setTimeout(() => setCopiedInv(false), 2000);
        }
    };

    return (
        <div className="space-y-5 p-5">
            <header className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Detail meeting</p>
                    {booking.zoomAccount && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {formatZoomAccountName(booking.zoomAccount.name)}
                        </span>
                    )}
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{booking.title}</h2>
                <p className={cn('text-xs font-medium', statusClass(booking.status))}>{booking.status}</p>
                {booking.description && <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{booking.description}</p>}
            </header>

            {booking.isExternal && (
                <Notice tone="neutral" title="External Zoom Meeting">
                    Meeting ini dibuat secara manual di Zoom. Perubahan harus dilakukan melalui Zoom Web Portal.
                </Notice>
            )}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 border-y border-slate-100 py-4 text-sm dark:border-slate-800 md:grid-cols-2">
                <Metadata label="Tanggal">{format(new Date(booking.bookingDate), 'd MMM yyyy', { locale: idLocale })}</Metadata>
                <Metadata label="Waktu">{booking.startTime}–{booking.endTime} WIB</Metadata>
                <Metadata label="Durasi">{booking.durationMinutes} menit</Metadata>
                <Metadata label="Dibooking oleh">{booking.bookedByUser?.fullName}</Metadata>
            </dl>

            {booking.meeting ? (
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
                    {isPending ? 'Sistem sedang memproses pembuatan link.' : `Dibooking oleh ${booking.bookedByUser?.fullName || 'pengguna lain'}.`}
                </Notice>
            )}

            {isCancelled && booking.cancellationReason && <Notice tone="red" title="Dibatalkan">Alasan: {booking.cancellationReason}</Notice>}

            <footer className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {booking.meeting && (
                    <Button variant="outline" className="rounded-full text-xs font-medium" onClick={() => window.open(booking.meeting!.joinUrl, '_blank')}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Join meeting
                    </Button>
                )}
                {booking.meeting && (
                    <Button variant="outline" className={cn('rounded-full text-xs font-medium', copiedInv && 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300')} onClick={copyFullInvitation}>
                        {copiedInv ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
                        {copiedInv ? 'Undangan tersalin' : 'Salin undangan'}
                    </Button>
                )}
                {canManage && onReschedule && (
                    <Button variant="outline" className="rounded-full text-xs font-medium" onClick={() => onReschedule(booking)}>
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
                <Button variant="secondary" className="ml-auto rounded-full text-xs font-medium" onClick={onClose}>Tutup</Button>
            </footer>

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
        </div>
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
