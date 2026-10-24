import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronLeft, Clock, Copy, Ellipsis, PanelRightClose, PanelRightOpen, Pause, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { formatSlaDuration } from '@/lib/utils/slaDuration';
import type { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { isTerminalStatus } from '../../ticket-board/components/ticket-detail/constants';
import { PriorityPill, StatusPill } from '../../ticket-board/components/ticket-detail/TicketPropertyRows';
import { SelfResolveButton } from './resolution/SelfResolveButton';
import { useTicketHold, type TicketHold } from '../../ticket-board/components/ticket-detail/useTicketHold';

/** SLA countdown recomputed every minute */
const SLA_TICK_MS = 60_000;
const WARNING_MS = 4 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60_000;

type SlaState = 'ok' | 'warning' | 'overdue' | 'resolved' | 'paused' | 'none';
const SLA_TONES: Record<SlaState, TicketPillTone> = { ok: 'blue', warning: 'amber', overdue: 'red', resolved: 'green', paused: 'amber', none: 'neutral' };
const SLA_ICONS: Record<SlaState, React.ElementType> = { ok: Clock, warning: Clock, overdue: AlertTriangle, resolved: CheckCircle2, paused: Pause, none: Clock };

const formatTimeRemaining = (diffMs: number): string => {
    if (diffMs <= 0) return 'Overdue';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
};

/** Requester-facing SLA label. WAITING_VENDOR is paused: remaining business time only, never a target date. */
const useRequesterSla = (ticket: TicketDetail, hold: TicketHold | null) => {
    const slaClock = useSlaClock();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), SLA_TICK_MS);
        return () => clearInterval(interval);
    }, []);

    return useMemo((): { state: SlaState; label: string; tooltip?: string } => {
        if (isTerminalStatus(ticket.status)) return { state: 'resolved', label: 'Selesai' };
        if (ticket.status === 'WAITING_VENDOR') {
            // The status pill already says what the ticket waits on; this pill only says the clock is stopped.
            if (hold) return { state: 'paused', label: 'SLA dijeda', tooltip: `${hold.code} · ${hold.detail}` };
            return {
                state: 'paused',
                label: 'SLA dijeda',
                tooltip: ticket.slaRemainingMinutes != null
                    ? `Dijeda · sisa ${formatSlaDuration(ticket.slaRemainingMinutes * MS_PER_MINUTE)}`
                    : 'Dijeda',
            };
        }
        if (!ticket.slaTarget) return { state: 'none', label: 'Tanpa SLA' };
        const countdown = slaCountdown(ticket.slaTarget, now, ticket.priority, slaClock);
        const diff = countdown.remainingMs;
        if (countdown.offHours) {
            return { state: 'paused', label: `SLA: ${formatTimeRemaining(diff)} (dijeda)`, tooltip: offHoursLabel(countdown, now, slaClock) };
        }
        if (diff <= 0) return { state: 'overdue', label: 'Lewat target' };
        return { state: diff < WARNING_MS ? 'warning' : 'ok', label: `SLA: ${formatTimeRemaining(diff)}` };
    }, [ticket.status, ticket.slaTarget, ticket.priority, ticket.slaRemainingMinutes, now, slaClock, hold]);
};

interface ClientTicketHeaderProps {
    ticket: TicketDetail;
    onCancel: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    /** Requester may close their own open ticket ("Tandai Selesai"). */
    canSelfResolve?: boolean;
    /** Only the ticket owner may cancel (backend rejects other USER viewers: ticket-update.service cancelTicket). */
    canCancel?: boolean;
    /** Percakapan / Aktivitas switch rendered as the header's last row. */
    tabs?: React.ReactNode;
}

const MergedNotice: React.FC<{ parentNumber: string }> = ({ parentNumber }) => {
    const navigate = useNavigate();
    return (
        <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-200">
            <span className="min-w-0 truncate">
                <strong>Tiket ini telah digabungkan</strong> ke Tiket Utama <span className="font-mono font-bold text-amber-950 dark:text-amber-100">#{parentNumber}</span>. Anda kini tergabung dalam diskusi tiket utama.
            </span>
            <button
                type="button"
                onClick={() => navigate(`/tickets/browse?search=${parentNumber}`)}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-800"
            >
                <span>Buka Tiket Utama</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
        </div>
    );
};

export const ClientTicketHeader: React.FC<ClientTicketHeaderProps> = ({ ticket, onCancel, isSidebarOpen, onToggleSidebar, canSelfResolve = false, canCancel = false, tabs }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [copied, setCopied] = useState(false);
    const hold = useTicketHold(ticket);
    const sla = useRequesterSla(ticket, hold);
    const SlaIcon = SLA_ICONS[sla.state];

    const isTerminal = isTerminalStatus(ticket.status);
    const showSelfResolve = canSelfResolve && !isTerminal;
    const showCancel = canCancel && !isTerminal;
    const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
    const mergedParent = useMemo(() => ticket.description?.match(/\[MERGED INTO #([^\]]+)\]/)?.[1] ?? null, [ticket.description]);

    const handleBack = () => {
        if (location.state?.from) navigate(location.state.from);
        else if (window.history.length > 1) navigate(-1);
        else navigate('/client/my-tickets');
    };

    const handleCopyNumber = () => {
        const num = ticket.ticketNumber || ticket.id;
        navigator.clipboard.writeText(num);
        setCopied(true);
        toast.success(`Nomor tiket #${num} disalin`);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            {mergedParent && <MergedNotice parentNumber={mergedParent} />}
            <header className="ticket-detail-head">
                <div className="td-line">
                    <button type="button" onClick={handleBack} className="ticket-detail-back" title="Kembali ke daftar" aria-label="Kembali ke daftar">
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={handleCopyNumber} className="ticket-id-pill" title="Salin nomor tiket"
                        aria-label={`Salin nomor tiket #${ticketNumber}`}>
                        <span>#{ticketNumber}</span>
                        {copied ? <Check className="text-emerald-600" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </button>
                    <StatusPill status={ticket.status} hold={hold} />
                    <TicketPill tone={SLA_TONES[sla.state]} title={sla.tooltip}>
                        <SlaIcon className={cn('h-3 w-3 shrink-0', sla.state === 'overdue' && 'animate-pulse')} aria-hidden="true" />
                        <span className="tabular-nums">{sla.label}</span>
                    </TicketPill>
                    <PriorityPill priority={ticket.priority} short />
                </div>

                <div className="td-line">
                    <h1 className="ticket-detail-title min-w-0">{ticket.title}</h1>
                    <span className="td-spacer" />
                    <div className="td-acts">
                        {!isTerminal && (
                            <>
                                {showCancel && (
                                    <Button variant="danger" className="td-act-wide" onClick={onCancel} title="Batalkan tiket ini">
                                        <XCircle aria-hidden="true" /><span>Batalkan</span>
                                    </Button>
                                )}
                                <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="subtle" size="icon" className="td-act-more" aria-label="Aksi lainnya" title="Aksi lainnya">
                                            <Ellipsis aria-hidden="true" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" variant="compact" className="ticket-action-menu" aria-label="Aksi lainnya">
                                        <DropdownMenuItem onSelect={handleCopyNumber}><Copy />Salin nomor tiket</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={onToggleSidebar}><PanelRightOpen />Properti tiket</DropdownMenuItem>
                                        {showCancel && <DropdownMenuItem variant="destructive" onSelect={onCancel}><XCircle />Batalkan tiket</DropdownMenuItem>}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </>
                        )}
                        {!isTerminal && showSelfResolve && <span className="td-act-sep" aria-hidden="true" />}
                        {showSelfResolve && <SelfResolveButton ticketId={ticket.id} ticketNumber={ticketNumber} />}
                        <Button
                            variant="subtle"
                            size="icon"
                            className="td-act-panel hidden lg:inline-flex"
                            onClick={onToggleSidebar}
                            aria-pressed={isSidebarOpen}
                            title={isSidebarOpen ? 'Sembunyikan properti' : 'Tampilkan properti'}
                            aria-label={isSidebarOpen ? 'Sembunyikan properti' : 'Tampilkan properti'}
                        >
                            {isSidebarOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
                        </Button>
                    </div>
                </div>
                {tabs}
            </header>
        </>
    );
};
