import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Copy, PanelRightClose, PanelRightOpen, Pause, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { formatSlaDuration } from '@/lib/utils/slaDuration';
import type { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { STATUS_CONFIG, isTerminalStatus } from '../../ticket-board/components/ticket-detail/constants';
import { PriorityPill, StatusPill } from '../../ticket-board/components/ticket-detail/TicketPropertyRows';
import { SelfResolveButton } from './resolution/SelfResolveButton';

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
const useRequesterSla = (ticket: TicketDetail) => {
    const slaClock = useSlaClock();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), SLA_TICK_MS);
        return () => clearInterval(interval);
    }, []);

    return useMemo((): { state: SlaState; label: string; tooltip?: string } => {
        if (isTerminalStatus(ticket.status)) return { state: 'resolved', label: 'Done' };
        if (ticket.status === 'WAITING_VENDOR') {
            return {
                state: 'paused',
                label: ticket.slaRemainingMinutes != null
                    ? `Dijeda · sisa ${formatSlaDuration(ticket.slaRemainingMinutes * MS_PER_MINUTE)}`
                    : 'Dijeda',
            };
        }
        if (!ticket.slaTarget) return { state: 'none', label: 'No SLA' };
        const countdown = slaCountdown(ticket.slaTarget, now, ticket.priority, slaClock);
        const diff = countdown.remainingMs;
        if (countdown.offHours) {
            return { state: 'paused', label: `${formatTimeRemaining(diff)} (dijeda)`, tooltip: offHoursLabel(countdown, now, slaClock) };
        }
        if (diff <= 0) return { state: 'overdue', label: 'Overdue' };
        return { state: diff < WARNING_MS ? 'warning' : 'ok', label: formatTimeRemaining(diff) };
    }, [ticket.status, ticket.slaTarget, ticket.priority, ticket.slaRemainingMinutes, now, slaClock]);
};

interface ClientTicketHeaderProps {
    ticket: TicketDetail;
    onCancel: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    /** Requester may close their own open ticket ("Tandai Selesai"). */
    canSelfResolve?: boolean;
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

export const ClientTicketHeader: React.FC<ClientTicketHeaderProps> = ({ ticket, onCancel, isSidebarOpen, onToggleSidebar, canSelfResolve = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [copied, setCopied] = useState(false);
    const sla = useRequesterSla(ticket);
    const SlaIcon = SLA_ICONS[sla.state];

    // CLOSED is the confirmed/final form of RESOLVED; both render as "done".
    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const isTerminal = isTerminalStatus(ticket.status);
    const terminalLabel = isResolved ? (STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO).label : 'Cancelled';
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
        toast.success(`Copied ticket #${num}`);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            {mergedParent && <MergedNotice parentNumber={mergedParent} />}
            <header className="ticket-detail-head">
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleBack} className="ticket-detail-back -ml-1.5" title="Kembali" aria-label="Kembali">
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={handleCopyNumber} className="ticket-id-pill" title="Klik untuk salin nomor tiket"
                        aria-label={`Salin nomor tiket #${ticketNumber}`}>
                        <span>#{ticketNumber}</span>
                        {copied ? <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                    </button>
                    <StatusPill status={ticket.status} />
                    <TicketPill tone={SLA_TONES[sla.state]} title={sla.tooltip}>
                        <SlaIcon className={cn('h-3 w-3 shrink-0', sla.state === 'overdue' && 'animate-pulse')} aria-hidden="true" />
                        <span className="tabular-nums">SLA: {sla.label}</span>
                    </TicketPill>
                    <PriorityPill priority={ticket.priority} short />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <h1 className="ticket-detail-title min-w-0">{ticket.title}</h1>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {canSelfResolve && !isTerminal && <SelfResolveButton ticketId={ticket.id} className="h-8 rounded-full" />}
                        {isTerminal ? (
                            <TicketPill tone={isResolved ? 'green' : 'red'}>
                                {isResolved ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <XCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                                {terminalLabel}
                            </TicketPill>
                        ) : (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            >
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Cancel Ticket</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onToggleSidebar}
                            className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted lg:inline-flex"
                            title={isSidebarOpen ? 'Hide Ticket Properties' : 'Show Ticket Properties'}
                            aria-label={isSidebarOpen ? 'Hide Ticket Properties' : 'Show Ticket Properties'}
                        >
                            {isSidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </header>
        </>
    );
};
