import React, { useState, useEffect, useMemo } from 'react';
import { ExternalSourceBadge } from '@/components/ui/ExternalSourceBadge';
import { cn } from '@/lib/utils';
import {
    ChevronLeft,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    AlertCircle,
    Pause,
    MessageSquare,
    Copy,
    Check,
    PanelRightOpen,
    PanelRightClose,
    ArrowRight,
    Ellipsis,
    Forward,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { STATUS_CONFIG, isTerminalStatus } from './constants';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { formatSlaDuration } from '@/lib/utils/slaDuration';
import { PriorityPill, StatusPill } from './TicketPropertyRows';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ResolveTicketModal } from './ResolveTicketModal';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface TicketHeaderProps {
    ticket: TicketDetail & {
        slaStartedAt?: string;
        firstResponseAt?: string;
        firstResponseTarget?: string;
        isFirstResponseBreached?: boolean;
        targetResolutionDate?: string;
    };
    onCancel?: () => void;
    isCancelling?: boolean;
    onResolve?: (resolutionNote?: string, files?: File[]) => Promise<void> | void;
    isResolving?: boolean;
    onForward?: () => void;
    onExtendSla?: () => void;
    onSetReminder?: () => void;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    /** Percakapan / Aktivitas switch, rendered as the header's last row (mockup .convo-head .seg). */
    tabs?: React.ReactNode;
}

type SlaState = 'none' | 'normal' | 'paused' | 'overdue' | 'warning';
const SLA_TONES: Record<SlaState, TicketPillTone> = { none: 'neutral', normal: 'blue', paused: 'amber', overdue: 'red', warning: 'amber' };
const SLA_ICONS: Record<SlaState, React.ElementType> = { none: Clock, normal: Clock, paused: Pause, overdue: AlertCircle, warning: Clock };

const formatTimeRemaining = (diffMs: number): string => {
    if (diffMs <= 0) return 'Overdue';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return parts.join(' ');
};

export const TicketHeader: React.FC<TicketHeaderProps> = ({
    ticket,
    onCancel,
    isCancelling = false,
    onResolve,
    isResolving = false,
    onForward,
    onToggleSidebar,
    isSidebarOpen = true,
    tabs,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [copied, setCopied] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // Update current time every minute for live SLA updates
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Determine target back navigation from history state, query params, or queue fallback
    const targetInfo = useMemo(() => {
        // 1. Prioritize location.state?.from (user navigated from list/kanban)
        const stateFrom = (location.state as any)?.from;
        if (typeof stateFrom === 'string' && stateFrom.startsWith('/')) {
            const rawPath = stateFrom.split('?')[0];
            let label = 'Kembali ke Daftar Tiket';
            if (rawPath === '/kanban') {
                label = 'Kembali ke Kanban';
            } else if (rawPath === '/tickets/oracle-k2') {
                label = 'Kembali ke Oracle K2';
            } else if (rawPath === '/tickets/web-developer') {
                label = 'Kembali ke Web Developer';
            } else if (rawPath === '/tickets/mobile-developer') {
                label = 'Kembali ke Mobile Developer';
            } else if (rawPath.startsWith('/manager/tickets')) {
                label = 'Kembali ke Tiket Manager';
            } else if (rawPath.startsWith('/hardware-requests')) {
                label = 'Kembali ke Hardware Request';
            } else if (rawPath === '/client/my-tickets') {
                label = 'Kembali ke Tiket Saya';
            } else if (rawPath.startsWith('/tickets/queue/')) {
                label = 'Kembali ke Antrian';
            } else if (rawPath === '/dashboard' || rawPath === '/manager/dashboard') {
                label = 'Kembali ke Dashboard';
            }
            return { path: stateFrom, label };
        }

        // 2. Query param ?from= (if provided in URL)
        const params = new URLSearchParams(location.search);
        const from = params.get('from');

        if (from === 'my-tickets') {
            return { path: '/client/my-tickets', label: 'Kembali ke Tiket Saya' };
        }
        if (from === 'kanban') {
            return { path: '/kanban', label: 'Kembali ke Kanban' };
        }
        if (from === 'oracle') {
            return { path: '/tickets/oracle-k2', label: 'Kembali ke Oracle K2' };
        }
        if (from === 'web-dev' || from === 'web-developer') {
            return { path: '/tickets/web-developer', label: 'Kembali ke Web Developer' };
        }
        if (from === 'mobile-dev' || from === 'mobile-developer') {
            return { path: '/tickets/mobile-developer', label: 'Kembali ke Mobile Developer' };
        }

        // 3. Fallback based on ticket handling team
        if (ticket.handlingTeam === 'ORACLE_DEV') {
            return { path: '/tickets/oracle-k2', label: 'Kembali ke Oracle K2' };
        }
        if (ticket.handlingTeam === 'WEB_DEV') {
            return { path: '/tickets/web-developer', label: 'Kembali ke Web Developer' };
        }
        if (ticket.handlingTeam === 'MOBILE_DEV') {
            return { path: '/tickets/mobile-developer', label: 'Kembali ke Mobile Developer' };
        }

        // 4. Default fallback: all regular tickets (including Hardware, Software, Network) go to Ticket List
        return { path: '/tickets/list', label: 'Kembali ke Daftar Tiket' };
    }, [location.state, location.search, ticket.handlingTeam]);

    const handleBack = () => {
        if (targetInfo.path) {
            navigate(targetInfo.path);
        } else if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/tickets/list');
        }
    };

    const handleCopyNumber = () => {
        const textToCopy = ticket.ticketNumber || ticket.id;
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success(`Nomor tiket #${textToCopy} disalin`);
        setTimeout(() => setCopied(false), 2000);
    };

    const confirmCancel = () => {
        if (onCancel) {
            onCancel();
            setShowCancelConfirm(false);
        }
    };

    const handleConfirmResolve = async (resolutionNote?: string, files?: File[]) => {
        if (onResolve) {
            await onResolve(resolutionNote, files);
            setShowResolveConfirm(false);
        }
    };

    const isTerminal = isTerminalStatus(ticket.status);
    const canCancel = !isTerminal && Boolean(onCancel);
    const canForward = !isTerminal && Boolean(onForward);
    const canResolve = !isTerminal && Boolean(onResolve);
    const ticketNumber = ticket.ticketNumber || ticket.id.split('-')[0];
    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const slaTargetDate = ticket.slaTarget || ticket.targetResolutionDate;
    const slaClock = useSlaClock();

    // Calculate SLA
    const { resolutionTime, slaStatus, slaTooltip } = useMemo(() => {
        if (!slaTargetDate) {
            return {
                resolutionTime: 'Tanpa SLA',
                slaTooltip: 'Tiket ini tidak memiliki batas waktu target SLA',
                slaStatus: 'none' as const,
            };
        }

        if (isTerminal) {
            return {
                resolutionTime: isResolved ? (STATUS_CONFIG[ticket.status]?.label ?? 'Resolved') : 'Cancelled',
                slaTooltip: isResolved ? 'Tiket telah selesai diselesaikan' : 'Tiket telah dibatalkan',
                slaStatus: 'normal' as const,
            };
        }

        if (ticket.status === 'WAITING_VENDOR' || ticket.status === 'PENDING') {
            const held = ticket.slaRemainingMinutes != null
                ? ` Sisa ${formatTimeRemaining(ticket.slaRemainingMinutes * 60_000)} jam kerja.`
                : '';
            return {
                resolutionTime: ticket.slaRemainingMinutes != null
                    ? `SLA dijeda · sisa ${formatSlaDuration(ticket.slaRemainingMinutes * 60_000)}`
                    : 'SLA dijeda',
                slaTooltip: `Target SLA ditunda sementara.${held}`,
                slaStatus: 'paused' as const,
            };
        }

        const countdown = slaCountdown(slaTargetDate, currentTime, ticket.priority, slaClock);
        const diffMs = countdown.remainingMs;

        if (countdown.offHours) {
            return {
                resolutionTime: `SLA dijeda: ${formatTimeRemaining(diffMs)}`,
                slaTooltip: `${offHoursLabel(countdown, currentTime, slaClock)}. Target: ${formatDateTimeID(slaTargetDate)}`,
                slaStatus: 'paused' as const,
            };
        }

        if (diffMs <= 0) {
            return {
                resolutionTime: 'SLA Overdue',
                slaTooltip: `SLA telah lewat ${formatTimeRemaining(Math.abs(diffMs))} (Target: ${formatDateTimeID(slaTargetDate)})`,
                slaStatus: 'overdue' as const,
            };
        }

        const remainingStr = formatTimeRemaining(diffMs);

        // Warning if less than 4 hours remaining
        if (diffMs < 4 * 60 * 60 * 1000) {
            return {
                resolutionTime: `SLA: ${remainingStr}`,
                slaTooltip: `Sisa waktu target SLA: ${remainingStr} (Target: ${formatDateTimeID(slaTargetDate)})`,
                slaStatus: 'warning' as const,
            };
        }

        return {
            resolutionTime: `SLA: ${remainingStr}`,
            slaTooltip: `Sisa waktu target SLA: ${remainingStr} (Target: ${formatDateTimeID(slaTargetDate)})`,
            slaStatus: 'normal' as const,
        };
    }, [slaTargetDate, ticket.status, ticket.priority, ticket.slaRemainingMinutes, isTerminal, isResolved, currentTime, slaClock]);

    // First Response Metric
    const firstResponse = useMemo(() => {
        if (!ticket.firstResponseTarget && !ticket.firstResponseAt) return null;

        if (ticket.firstResponseAt) {
            return {
                text: 'Responded',
                tooltip: `Respon pertama telah dikirim pada ${formatDateTimeID(ticket.firstResponseAt)}`,
                tone: 'green' as TicketPillTone,
                isBreached: ticket.isFirstResponseBreached || false,
            };
        }

        if (isTerminal) return null;

        if (!ticket.firstResponseTarget) return null;

        const countdown = slaCountdown(ticket.firstResponseTarget, currentTime, ticket.priority, slaClock);
        const diffMs = countdown.remainingMs;

        if (diffMs <= 0) {
            return {
                text: 'Resp Overdue',
                tooltip: `Target respon pertama telah terlewat (Target: ${formatDateTimeID(ticket.firstResponseTarget)})`,
                tone: 'red' as TicketPillTone,
                isBreached: true,
            };
        }

        const remainingStr = formatTimeRemaining(diffMs);
        const offHours = countdown.offHours ? ` — ${offHoursLabel(countdown, currentTime, slaClock)}` : '';
        return {
            text: `Resp: ${remainingStr}`,
            tooltip: `Sisa waktu respon pertama: ${remainingStr} (Target: ${formatDateTimeID(ticket.firstResponseTarget)})${offHours}`,
            tone: 'amber' as TicketPillTone,
            isBreached: false,
        };
    }, [ticket.priority, slaClock, ticket.firstResponseTarget, ticket.firstResponseAt, ticket.isFirstResponseBreached, isTerminal, currentTime]);

    const slaTone: TicketPillTone = isTerminal
        ? (isResolved ? 'green' : 'neutral')
        : SLA_TONES[slaStatus];
    const SlaIcon = isTerminal && isResolved ? CheckCircle2 : SLA_ICONS[slaStatus];

    const mergedParentTicketNumber = useMemo(() => {
        if (!ticket.description) return null;
        const match = ticket.description.match(/\[MERGED INTO #([^\]]+)\]/);
        return match ? match[1] : null;
    }, [ticket.description]);

    return (
        <>
            {mergedParentTicketNumber && (
                <div className="mx-3.5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800/80 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                        <span className="truncate text-xs">
                            <strong>Tiket ini telah digabungkan</strong> ke Tiket Utama <span className="font-mono font-bold text-amber-950 dark:text-amber-100">#{mergedParentTicketNumber}</span>.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(`/tickets/browse?search=${mergedParentTicketNumber}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-all active:scale-[0.98] shrink-0 cursor-pointer"
                    >
                        <span>Buka Tiket Utama</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <header className="ticket-detail-head">
                <div className="td-line">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="ticket-detail-back"
                        title={targetInfo.label}
                        aria-label={targetInfo.label}
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyNumber}
                        className="ticket-id-pill"
                        title="Salin nomor tiket"
                        aria-label={`Salin nomor tiket #${ticketNumber}`}
                    >
                        <span>#{ticketNumber}</span>
                        {copied ? <Check className="text-emerald-600" aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </button>
                    <StatusPill status={ticket.status} />
                    <TicketPill tone={slaTone} title={slaTooltip}>
                        <SlaIcon className={cn('h-3 w-3 shrink-0', slaStatus === 'overdue' && 'animate-pulse')} aria-hidden="true" />
                        <span className="tabular-nums">{resolutionTime}</span>
                    </TicketPill>
                    {firstResponse && (
                        <TicketPill tone={firstResponse.tone} title={firstResponse.tooltip}>
                            <MessageSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span className="tabular-nums">{firstResponse.text}</span>
                        </TicketPill>
                    )}
                    <PriorityPill priority={ticket.priority} short />
                    <ExternalSourceBadge source={ticket.source} className="rounded-full py-1" />
                </div>

                <div className="td-line">
                    <h1 className="ticket-detail-title min-w-0">{ticket.title}</h1>
                    <span className="td-spacer" />
                    <div className="td-acts">
                        {canCancel && (
                            <Button variant="danger" className="td-act-wide" onClick={() => setShowCancelConfirm(true)} disabled={isCancelling}
                                title="Batalkan tiket ini">
                                <XCircle aria-hidden="true" /><span>Batalkan</span>
                            </Button>
                        )}
                        {canForward && (
                            <Button variant="soft" className="td-act-wide ticket-action-forward" onClick={onForward} title="Teruskan ke tim lain">
                                <Forward aria-hidden="true" /><span>Teruskan</span>
                            </Button>
                        )}
                        {(canCancel || canForward) && (
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="subtle" size="icon" className="td-act-more" aria-label="Aksi lainnya" title="Aksi lainnya">
                                        <Ellipsis aria-hidden="true" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" variant="compact" className="ticket-action-menu" aria-label="Aksi lainnya">
                                    {canForward && <DropdownMenuItem className="ticket-action-forward-menu" onSelect={() => onForward?.()}><Forward />Teruskan ke tim lain</DropdownMenuItem>}
                                    <DropdownMenuItem onSelect={handleCopyNumber}><Copy />Salin nomor tiket</DropdownMenuItem>
                                    {onToggleSidebar && <DropdownMenuItem onSelect={onToggleSidebar}><PanelRightOpen />Properti tiket</DropdownMenuItem>}
                                    {canCancel && (
                                        <DropdownMenuItem variant="destructive" onSelect={() => setShowCancelConfirm(true)}>
                                            <XCircle />Batalkan tiket
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                        {(canCancel || canForward) && canResolve && <span className="td-act-sep" aria-hidden="true" />}
                        {canResolve && (
                            <Button variant="primary" className="ticket-action-complete" onClick={() => setShowResolveConfirm(true)} title="Selesaikan dengan catatan solusi">
                                <CheckCircle2 aria-hidden="true" /><span>Selesaikan</span>
                            </Button>
                        )}
                        {onToggleSidebar && (
                            <Button
                                variant="subtle"
                                size="icon"
                                className="td-act-panel"
                                onClick={onToggleSidebar}
                                aria-pressed={isSidebarOpen}
                                title={isSidebarOpen ? 'Sembunyikan properti' : 'Tampilkan properti'}
                                aria-label={isSidebarOpen ? 'Sembunyikan properti' : 'Tampilkan properti'}
                            >
                                {isSidebarOpen ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
                            </Button>
                        )}
                    </div>
                </div>
                {tabs}
            </header>

            <ConfirmationDialog
                appearance="ticket"
                isOpen={showCancelConfirm}
                title="Batalkan tiket ini?"
                description={`Tiket #${ticketNumber} yang dibatalkan tidak dapat diproses kembali.`}
                confirmText="Batalkan tiket"
                cancelText="Kembali"
                variant="destructive"
                onConfirm={confirmCancel}
                onCancel={() => setShowCancelConfirm(false)}
                isLoading={isCancelling}
            />

            {/* Resolve Confirmation Modal with Explanation and Proof Attachments */}
            <ResolveTicketModal
                isOpen={showResolveConfirm}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                }}
                onConfirm={(note, files) => handleConfirmResolve(note, files)}
                onClose={() => setShowResolveConfirm(false)}
                isLoading={isResolving}
            />
        </>
    );
};
