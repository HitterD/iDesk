/**
 * MeetingDetailContent — shared iOS-style (grouped list) body for the meeting
 * detail modal (client) and the detail view inside ZoomBookingModal (admin).
 * Parents own the dialogs (reminder / reschedule / cancel) and pass callbacks.
 */
import { useState, type ElementType, type ReactNode } from 'react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    AlertCircle, Bell, CalendarClock, Check, Copy, FileText, Mail,
    MoreHorizontal, Play, RefreshCw, Trash2, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/stores/useAuth';
import { cn } from '@/lib/utils';
import { useSyncRecording } from '../hooks';
import { formatZoomAccountName, generateInvitationText, copyToClipboard, extractMeetingId } from '../utils';
import type { ZoomBooking } from '../types';

export const STAFF_ROLES = [
    'ADMIN',
    'AGENT_OPERATIONAL_SUPPORT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT',
    'MANAGER',
];

const COPIED_FEEDBACK_MS = 2000;
const MENU_ABOVE_DIALOG_CLASS = 'z-[110]';

const STATUS_PILL: Record<string, { label: string; className: string }> = {
    CONFIRMED: { label: 'Terkonfirmasi', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
    PENDING: { label: 'Diproses', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
    CANCELLED: { label: 'Dibatalkan', className: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
};

function toDateStr(raw: string | Date): string {
    return typeof raw === 'string' ? raw.split('T')[0] : format(new Date(raw), 'yyyy-MM-dd');
}

/** True once the meeting's scheduled end time has passed (recording can exist). */
export function isMeetingOver(booking: Pick<ZoomBooking, 'bookingDate' | 'endTime'>, now: Date = new Date()): boolean {
    const end = new Date(`${toDateStr(booking.bookingDate)}T${(booking.endTime || '23:59').slice(0, 5)}:00`);
    return !Number.isNaN(end.getTime()) && end <= now;
}

export function getBookingAccess(booking: ZoomBooking, user: { id?: string; role?: string; email?: string } | null | undefined) {
    const isOwner = user?.id === booking.bookedByUserId;
    const isStaff = !!(user?.role && STAFF_ROLES.includes(user.role));
    const isParticipant = Boolean(
        user?.email && booking.participants?.some(p => p.email?.toLowerCase() === user.email?.toLowerCase()),
    );
    const isCancelled = booking.status === 'CANCELLED';
    return {
        isOwner,
        isStaff,
        canAccessMeeting: isOwner || isStaff || isParticipant,
        canManage: (isOwner || isStaff) && !isCancelled && !booking.isExternal,
    };
}

interface MeetingDetailContentProps {
    booking: ZoomBooking;
    /** Heading element; the modal passes DialogTitle so Radix gets its label. */
    TitleAs?: ElementType;
    onReminder?: () => void;
    onReschedule?: () => void;
    onCancel?: () => void;
}

export function MeetingDetailContent({ booking, TitleAs = 'h2', onReminder, onReschedule, onCancel }: MeetingDetailContentProps) {
    const { user } = useAuth();
    const { isOwner, isStaff, canAccessMeeting, canManage } = getBookingAccess(booking, user);
    const [copiedInv, setCopiedInv] = useState(false);
    const status = STATUS_PILL[booking.status] ?? { label: booking.status, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
    const meeting = canAccessMeeting ? booking.meeting : undefined;
    const ownerEmail = booking.bookedByUser?.email;
    const contactHref = ownerEmail
        ? `mailto:${ownerEmail}?subject=${encodeURIComponent(`Koordinasi Jadwal Zoom: ${booking.title}`)}`
        : undefined;

    const copyInvitation = async () => {
        if (await copyToClipboard(generateInvitationText(booking), 'Undangan')) {
            setCopiedInv(true);
            setTimeout(() => setCopiedInv(false), COPIED_FEEDBACK_MS);
        }
    };

    return (
        <div className="space-y-5 p-6">
            <header className="space-y-2 pr-8">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Pill className={status.className}>{status.label}</Pill>
                    {booking.zoomAccount && (
                        <Pill className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {formatZoomAccountName(booking.zoomAccount.name)}
                        </Pill>
                    )}
                    {booking.isDoubleBooking && (
                        <Pill className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Dobel booking</Pill>
                    )}
                </div>
                <TitleAs className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {booking.title}
                </TitleAs>
                {booking.description && (
                    <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{booking.description}</p>
                )}
            </header>

            {booking.isDoubleBooking && (
                <Notice tone="amber">Dobel booking darurat: peserta bisa bergabung, tetapi tidak bisa claim host dan tidak bisa merekam.</Notice>
            )}
            {booking.isExternal && (
                <Notice tone="neutral">Meeting dibuat manual di Zoom. Perubahan dilakukan melalui Zoom Web Portal.</Notice>
            )}
            {booking.status === 'CANCELLED' && booking.cancellationReason && (
                <Notice tone="red">Dibatalkan — {booking.cancellationReason}</Notice>
            )}

            <Group>
                <Row label="Tanggal">{format(new Date(booking.bookingDate), 'EEEE, d MMM yyyy', { locale: idLocale })}</Row>
                <Row label="Waktu">{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} WIB</Row>
                <Row label="Durasi">{booking.durationMinutes} menit</Row>
                <Row label="Dibooking oleh">{booking.bookedByUser?.fullName || 'Pengguna iDesk'}</Row>
            </Group>

            {canAccessMeeting ? (
                meeting ? (
                    <Group>
                        <CopyRow label="Link" value={meeting.joinUrl} />
                        <CopyRow label="Meeting ID" value={extractMeetingId(meeting.joinUrl)} mono />
                        {meeting.password && <CopyRow label="Passcode" value={meeting.password} mono />}
                    </Group>
                ) : (
                    <Notice tone="amber">
                        {booking.status === 'PENDING' ? 'Link Zoom sedang dibuat. Harap tunggu sesaat.' : 'Link Zoom belum tersedia.'}
                    </Notice>
                )
            ) : (
                <Notice tone="neutral">
                    Link meeting hanya terlihat oleh pemesan dan peserta. Hubungi pemesan untuk koordinasi jadwal.
                </Notice>
            )}

            {meeting && isMeetingOver(booking) && <RecordingGroup booking={booking} />}

            <footer className="flex items-center gap-2 pt-1">
                {meeting ? (
                    <Button
                        className="h-11 flex-1 rounded-full text-sm font-semibold"
                        onClick={() => window.open(meeting.joinUrl, '_blank', 'noopener,noreferrer')}
                    >
                        <Video className="mr-2 h-4 w-4" aria-hidden="true" />
                        Join Meeting
                    </Button>
                ) : (
                    !isOwner && !isStaff && contactHref && (
                        <Button asChild className="h-11 flex-1 rounded-full text-sm font-semibold">
                            <a href={contactHref}>
                                <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                                Hubungi pemesan
                            </a>
                        </Button>
                    )
                )}
                {meeting && (
                    <IconAction label={copiedInv ? 'Undangan tersalin' : 'Salin undangan'} onClick={copyInvitation}>
                        {copiedInv ? <Check className="h-4 w-4 text-emerald-600" /> : <FileText className="h-4 w-4" />}
                    </IconAction>
                )}
                {meeting && (isOwner || isStaff) && onReminder && (
                    <IconAction label="Pengingat" onClick={onReminder}>
                        <Bell className="h-4 w-4" />
                    </IconAction>
                )}
                {canManage && (onReschedule || onCancel) && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Aksi lainnya" title="Aksi lainnya">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        {/* Above Dialog (z-[100]); the menu is portaled to <body>. */}
                        <DropdownMenuContent align="end" variant="compact" className={MENU_ABOVE_DIALOG_CLASS}>
                            {onReschedule && (
                                <DropdownMenuItem onSelect={onReschedule}>
                                    <CalendarClock /> Reschedule
                                </DropdownMenuItem>
                            )}
                            {onReschedule && onCancel && <DropdownMenuSeparator />}
                            {onCancel && (
                                <DropdownMenuItem variant="destructive" onSelect={onCancel}>
                                    <Trash2 /> Batalkan meeting
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </footer>
        </div>
    );
}

function RecordingGroup({ booking }: { booking: ZoomBooking }) {
    const syncRecording = useSyncRecording();
    const recordingUrl = booking.meeting?.recordingUrl;

    if (!recordingUrl) {
        return (
            <Group>
                <Row
                    label="Rekaman"
                    trailing={(
                        <button
                            type="button"
                            disabled={syncRecording.isPending}
                            onClick={() => syncRecording.mutate(booking.id)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-60 dark:text-blue-400"
                        >
                            <RefreshCw className={cn('h-3.5 w-3.5', syncRecording.isPending && 'animate-spin')} aria-hidden="true" />
                            {syncRecording.isPending ? 'Mengecek…' : 'Cek rekaman'}
                        </button>
                    )}
                >
                    <span className="text-slate-400 dark:text-slate-500">Belum tersedia</span>
                </Row>
            </Group>
        );
    }

    const duration = booking.meeting?.recordingDuration;
    return (
        <Group>
            <Row
                label="Rekaman"
                trailing={(
                    <button
                        type="button"
                        onClick={() => window.open(recordingUrl, '_blank', 'noopener,noreferrer')}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Tonton
                    </button>
                )}
            >
                {duration ? `${duration} menit` : 'Tersedia'}
            </Row>
            <CopyRow label="Link rekaman" value={recordingUrl} />
            {booking.meeting?.recordingPasscode && (
                <CopyRow label="Passcode rekaman" value={booking.meeting.recordingPasscode} mono />
            )}
        </Group>
    );
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
    return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>{children}</span>;
}

function Group({ children }: { children: ReactNode }) {
    return (
        <div className="divide-y divide-slate-200/70 overflow-hidden rounded-2xl bg-slate-100/70 dark:divide-slate-700/60 dark:bg-slate-800/50">
            {children}
        </div>
    );
}

function Row({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
    return (
        <div className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm">
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
            <span className="ml-auto min-w-0 truncate text-right font-medium text-slate-900 dark:text-slate-100">{children}</span>
            {trailing}
        </div>
    );
}

function CopyRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <button
            type="button"
            aria-label={`Salin ${label}`}
            title={`Salin ${label}`}
            onClick={() => copyToClipboard(value, label)}
            className="group flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-200/50 active:bg-slate-200 dark:hover:bg-slate-700/40"
        >
            <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
            <span className={cn('ml-auto min-w-0 truncate text-right font-medium text-slate-900 dark:text-slate-100', mono && 'font-mono tabular-nums')}>
                {value}
            </span>
            <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-600" aria-hidden="true" />
        </button>
    );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <Button variant="secondary" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label={label} title={label} onClick={onClick}>
            {children}
        </Button>
    );
}

function Notice({ tone, children }: { tone: 'neutral' | 'amber' | 'red'; children: ReactNode }) {
    const classes = {
        neutral: 'bg-slate-100/70 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
        amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300',
        red: 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300',
    };
    return (
        <div className={cn('flex gap-2.5 rounded-2xl px-4 py-3 text-sm leading-relaxed', classes[tone])}>
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{children}</p>
        </div>
    );
}
