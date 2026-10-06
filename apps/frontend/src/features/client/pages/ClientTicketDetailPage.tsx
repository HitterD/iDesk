import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Clock,
    CheckCircle2,
    XCircle,
    Ban,
    AlertTriangle,
    MessageSquare,
    History,
    SlidersHorizontal,
    UserCheck,
    Activity,
    AlertCircle,
    Monitor,
    Building,
    Wrench,
    Copy,
    Check,
    MapPin,
    Tag,
    PanelRightClose,
    PanelRightOpen,
    UserX,
    Sparkles,
    Users,
    ArrowRight,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { TICKET_OFFLINE_POLL_MS, useTicketSocket } from '@/hooks/useTicketSocket';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TicketChat } from '../../ticket-board/components/ticket-detail/TicketChat';
import { TicketHistory } from '../../ticket-board/components/ticket-detail/TicketHistory';
import { TicketParticipantsSection } from '../../ticket-board/components/ticket-detail/TicketParticipantsSection';
import { ImageLightbox } from '../../ticket-board/components/ticket-detail/ImageLightbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { SidebarCard, InfoRow, sidebarPanelClass } from '../../ticket-board/components/ticket-detail/SidebarCard';
import { SlaProgress } from '../../ticket-board/components/ticket-detail/SlaProgress';
import { toDisplayName } from '../../ticket-board/components/ticket-detail/messageThread';
import { KbSuggestionDialog } from '../../ticket-board/components/KbSuggestionDialog';
import {
    STATUS_CONFIG,
    PRIORITY_CONFIG,
    SELF_RESOLVABLE_STATUSES,
    isTerminalStatus,
} from '../../ticket-board/components/ticket-detail/constants';
import { ResolutionConfirmationBanner } from '../components/resolution/ResolutionConfirmationBanner';
import { SelfResolveButton } from '../components/resolution/SelfResolveButton';
import { AgentRatingForm } from '../components/resolution/AgentRatingForm';
import { getApiErrorMessage } from '../components/resolution/resolutionApi';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { cn } from '@/lib/utils';
import { toUploadPercent, validateFiles } from '@/lib/file-validation';
import { useMarkNotificationsRead } from '@/features/notifications/hooks/useMarkNotificationsRead';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';

/** SLA countdown recomputed every minute */
const SLA_TICK_MS = 60_000;
/** Max characters for ticket cancellation reason */
const CANCEL_REASON_MAX = 500;

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

interface ClientTicketHeaderProps {
    ticket: TicketDetail;
    onCancel: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    /** Requester may close their own open ticket ("Tandai Selesai"). */
    canSelfResolve?: boolean;
}

const ClientTicketHeader: React.FC<ClientTicketHeaderProps> = ({
    ticket,
    onCancel,
    isSidebarOpen,
    onToggleSidebar,
    canSelfResolve = false,
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        if (location.state?.from) {
            navigate(location.state.from);
        } else if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/client/my-tickets');
        }
    };

    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;
    const [copied, setCopied] = useState(false);
    const [resolutionTime, setResolutionTime] = useState<string>('');
    const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'overdue' | 'resolved' | 'paused'>('ok');
    const [slaTooltip, setSlaTooltip] = useState<string | undefined>(undefined);
    const slaClock = useSlaClock();

    // CLOSED is the confirmed/final form of RESOLVED; both render as "done".
    const isResolved = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
    const isCancelled = ticket.status === 'CANCELLED';
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const isTerminal = isTerminalStatus(ticket.status);
    const terminalLabel = isResolved ? statusConfig.label : 'Cancelled';

    useEffect(() => {
        const calculateSla = () => {
            if (isResolved || isCancelled) {
                setSlaStatus('resolved');
                setResolutionTime('Done');
                return;
            }
            if (isPaused) {
                setSlaStatus('paused');
                setResolutionTime('Paused');
                return;
            }
            if (!ticket.slaTarget) {
                setResolutionTime('No SLA');
                return;
            }

            const now = new Date();
            const countdown = slaCountdown(ticket.slaTarget, now, ticket.priority, slaClock);
            const diff = countdown.remainingMs;
            setSlaTooltip(countdown.offHours ? offHoursLabel(countdown, now, slaClock) : undefined);

            if (countdown.offHours) {
                setSlaStatus('paused');
                setResolutionTime(`${formatTimeRemaining(diff)} (dijeda)`);
            } else if (diff <= 0) {
                setSlaStatus('overdue');
                setResolutionTime('Overdue');
            } else if (diff < 4 * 60 * 60 * 1000) {
                setSlaStatus('warning');
                setResolutionTime(formatTimeRemaining(diff));
            } else {
                setSlaStatus('ok');
                setResolutionTime(formatTimeRemaining(diff));
            }
        };

        calculateSla();
        const interval = setInterval(calculateSla, SLA_TICK_MS);
        return () => clearInterval(interval);
    }, [ticket.slaTarget, ticket.priority, isResolved, isCancelled, isPaused, slaClock]);

    const handleCopyNumber = () => {
        const num = ticket.ticketNumber || ticket.id;
        navigator.clipboard.writeText(num);
        setCopied(true);
        toast.success(`Copied ticket #${num}`);
        setTimeout(() => setCopied(false), 2000);
    };

    const getSlaColors = () => {
        switch (slaStatus) {
            case 'overdue':
                return {
                    bg: 'bg-rose-50 dark:bg-rose-950/40',
                    text: 'text-rose-700 dark:text-rose-400',
                    border: 'border-rose-200 dark:border-rose-900/60',
                    icon: AlertTriangle,
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50 dark:bg-amber-950/40',
                    text: 'text-amber-700 dark:text-amber-400',
                    border: 'border-amber-200 dark:border-amber-900/60',
                    icon: Clock,
                };
            case 'paused':
                return {
                    bg: 'bg-orange-50 dark:bg-orange-950/40',
                    text: 'text-orange-700 dark:text-orange-400',
                    border: 'border-orange-200 dark:border-orange-900/60',
                    icon: Clock,
                };
            case 'resolved':
                return {
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
                    text: 'text-emerald-700 dark:text-emerald-400',
                    border: 'border-emerald-200 dark:border-emerald-900/60',
                    icon: CheckCircle2,
                };
            default:
                return {
                    bg: 'bg-primary/10 dark:bg-primary/20',
                    text: 'text-primary',
                    border: 'border-primary/20 dark:border-primary/30',
                    icon: Clock,
                };
        }
    };

    const slaColors = getSlaColors();
    const SlaIcon = slaColors.icon;

    const mergedParentTicketNumber = React.useMemo(() => {
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
                            <strong>Tiket ini telah digabungkan</strong> ke Tiket Utama <span className="font-mono font-bold text-amber-950 dark:text-amber-100">#{mergedParentTicketNumber}</span>. Anda kini tergabung dalam diskusi tiket utama.
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

            <header className={cn(
                "px-3.5 py-2.5 sm:px-6 sm:py-4 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 transition-all",
                isTerminal && 'bg-slate-50/90 dark:bg-slate-900/80'
            )}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-4">
                {/* Left: Back button + Badges + Title */}
                <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors shrink-0 cursor-pointer"
                        title="Kembali"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <button
                                type="button"
                                onClick={handleCopyNumber}
                                className="group inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full text-xs font-mono font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                title="Click to copy ticket number"
                            >
                                <span>#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                {copied ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                )}
                            </button>

                            {/* Compact SLA badge for mobile directly inline */}
                            <span title={slaTooltip} className={cn(
                                "sm:hidden px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1",
                                slaColors.bg,
                                slaColors.text
                            )}>
                                <SlaIcon className={cn("w-3 h-3", slaStatus === 'overdue' && "animate-pulse")} />
                                <span>SLA: {resolutionTime}</span>
                            </span>

                        </div>

                        {/* Ticket Title */}
                        <h1 className="text-base sm:text-[22px] font-semibold text-slate-900 dark:text-white tracking-[-0.01em] leading-tight break-words pt-0.5">
                            {ticket.title}
                        </h1>
                    </div>

                    {/* Mobile quick cancel / terminal button */}
                    <div className="sm:hidden shrink-0 mt-0.5 flex items-center gap-1.5">
                        {canSelfResolve && !isTerminal && (
                            <SelfResolveButton ticketId={ticket.id} iconOnly />
                        )}
                        {isTerminal ? (
                            <span className={cn(
                                "p-1.5 rounded-xl text-xs border inline-flex items-center justify-center",
                                isResolved
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                            )} title={terminalLabel}>
                                {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                                title="Cancel Ticket"
                                aria-label="Cancel Ticket"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: SLA Pill + Cancel Action + Toggle Sidebar (Desktop only) */}
                <div className="hidden sm:flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
                    {/* SLA Resolution Pill */}
                    <div title={slaTooltip} className={cn(
                        "h-8 px-3 rounded-full inline-flex items-center gap-2 text-xs font-semibold tabular-nums transition-colors",
                        slaColors.bg,
                        slaColors.text
                    )}>
                        <SlaIcon className={cn("w-3.5 h-3.5", slaStatus === 'overdue' && "animate-pulse")} />
                        <span>SLA: {resolutionTime}</span>
                    </div>

                    {canSelfResolve && !isTerminal && <SelfResolveButton ticketId={ticket.id} />}

                    {/* Cancel or Resolved Indicator */}
                    {isTerminal ? (
                        <div className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full font-semibold text-[13px]",
                            isResolved
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                        )}>
                            {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>{terminalLabel}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[13px] font-medium transition-colors cursor-pointer"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Ticket</span>
                        </button>
                    )}

                    {/* Toggle Properties Sidebar Button (Desktop only) */}
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title={isSidebarOpen ? "Hide Ticket Properties" : "Show Ticket Properties"}
                    >
                        {isSidebarOpen ? (
                            <PanelRightClose className="w-4 h-4" />
                        ) : (
                            <PanelRightOpen className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </header>
        </>
    );
};

const ClientTicketSidebar: React.FC<{ ticket: TicketDetail }> = ({ ticket }) => {
    const { user } = useAuth();
    const [copiedEmail, setCopiedEmail] = useState(false);
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const StatusIcon = statusConfig.icon;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const assignedAgent = ticket.assignedTo;

    const isClosed = isTerminalStatus(ticket.status);
    const isStaff =
        user?.role === 'ADMIN' ||
        user?.role === 'AGENT' ||
        Boolean(user?.role?.startsWith('AGENT_')) ||
        user?.role === 'MANAGER';
    const canManageParticipants = isStaff;
    const isOracleTicket = ticket.handlingTeam === 'ORACLE_DEV' ||
        ticket.handlingTeam === 'MOBILE_DEV' ||
        ticket.handlingTeam === 'WEB_DEV' ||
        (ticket.handlingTeam == null && (ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST' || ticket.ticketType === 'WEB_DEV_REQUEST' || ticket.ticketType === 'MOBILE_DEV_REQUEST'));
    const canAddParticipants = canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id));

    const handleCopyEmail = () => {
        if (assignedAgent?.email) {
            navigator.clipboard.writeText(assignedAgent.email);
            setCopiedEmail(true);
            toast.success('Agent email copied to clipboard');
            setTimeout(() => setCopiedEmail(false), 2000);
        }
    };

    return (
        <div className={cn(sidebarPanelClass, "select-none")}>
            {/* 1. Assigned Agent */}
            <SidebarCard title="Teknisi" icon={UserCheck} bodyClassName="space-y-2">
                {assignedAgent ? (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <UserAvatar user={assignedAgent} size="md" className="w-10 h-10 rounded-full" />
                                <PresenceDot userId={assignedAgent.id} userName={assignedAgent.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {toDisplayName(assignedAgent.fullName)}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    IT Support Specialist
                                </p>
                            </div>
                        </div>

                        {assignedAgent.email && (
                            <div>
                                <InfoRow label="Email">
                                    <span className="inline-flex max-w-full items-center gap-1">
                                        <span className="truncate">{assignedAgent.email}</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyEmail}
                                            className="p-0.5 hover:text-primary transition-colors shrink-0 cursor-pointer"
                                            title="Salin email teknisi"
                                            aria-label="Salin email teknisi"
                                        >
                                            {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                        </button>
                                    </span>
                                </InfoRow>
                                {assignedAgent.site?.name && (
                                    <InfoRow label="Site" icon={MapPin}>{assignedAgent.site.name}</InfoRow>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="py-2 text-center space-y-1">
                        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                            <UserX className="w-4 h-4" />
                        </div>
                        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Menunggu teknisi</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Tiket Anda dalam antrean penugasan tim IT Support</p>
                    </div>
                )}
            </SidebarCard>

            {/* 1.5. Ticket Participants (All Tickets / Multi-user Group) */}
            <TicketParticipantsSection
                ticketId={ticket.id}
                creator={ticket.user}
                participants={ticket.participants}
                canManageUsers={canManageParticipants}
                canAddUsers={canAddParticipants}
                isClosed={isClosed}
            />

            {/* 2. Ticket properties (read-only for requesters) */}
            <SidebarCard title="Properti tiket" icon={SlidersHorizontal} bodyClassName="space-y-2">
                <div>
                    <InfoRow label="Status" icon={Activity}>
                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", statusConfig.color)}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                        </span>
                    </InfoRow>
                    <InfoRow label="Prioritas" icon={AlertCircle}>
                        <span className="inline-flex items-center gap-1.5">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", priorityConfig.dot)} />
                            {priorityConfig.label}
                        </span>
                    </InfoRow>
                    {ticket.category && (
                        <InfoRow label="Kategori" icon={Tag}>{ticket.category.replace(/_/g, ' ')}</InfoRow>
                    )}
                    {ticket.device && (
                        <InfoRow label="Perangkat" icon={Monitor}>{ticket.device}</InfoRow>
                    )}
                </div>

                {ticket.priority === 'CRITICAL' && ticket.criticalReason && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-xs">
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Alasan blocker (critical)
                        </p>
                        <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
                            {ticket.criticalReason}
                        </p>
                    </div>
                )}
            </SidebarCard>

            {/* 3. SLA & Tracking */}
            <SidebarCard title="SLA" icon={Clock} bodyClassName="space-y-3">
                <SlaProgress
                    status={ticket.status}
                    priority={ticket.priority}
                    createdAt={ticket.createdAt}
                    slaStartedAt={ticket.slaStartedAt}
                    slaTarget={ticket.slaTarget}
                />
                <div>
                <InfoRow label="Dibuat">{formatDateTimeID(ticket.createdAt)}</InfoRow>
                <InfoRow label="Aktivitas terakhir">{formatRelativeTime(ticket.updatedAt)}</InfoRow>
                {ticket.slaTarget && (
                    <InfoRow label="Target SLA">
                        <span className="font-semibold text-primary">{formatDateTimeID(ticket.slaTarget)}</span>
                    </InfoRow>
                )}
                </div>
            </SidebarCard>

            {/* 4. Hardware Installation Schedule (if applicable) */}
            {ticket.isHardwareInstallation && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 ring-1 ring-amber-200/70 dark:ring-amber-900/50 space-y-3">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                        <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                            Instalasi hardware
                        </span>
                    </div>

                    <div className="text-xs space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-amber-700/80 dark:text-amber-400/80">Hardware Item:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                                {ticket.hardwareType || 'N/A'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Tanggal</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[11px] font-medium text-slate-400 block mb-0.5">Jam</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledTime || '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ClientTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    useMarkNotificationsRead(id ? { ticketId: id } : null);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [mainTab, setMainTab] = useState<'chat' | 'activity' | 'properties'>('chat');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);

    const { isConnected, typingUsers, sendTypingStart, sendTypingStop } = useTicketSocket({
        ticketId: id,
    });

    // Suggest KB articles once per ticket visit (per browser session).
    useEffect(() => {
        if (!id) return;
        const key = `idesk_kb_suggested_${id}`;
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            setSuggestionsOpen(true);
        }
    }, [id]);

    const { data: ticket, isLoading } = useQuery<TicketDetail>({
        queryKey: ['ticket', id],
        queryFn: async () => {
            const res = await api.get(`/tickets/${id}`);
            return res.data;
        },
        enabled: !!id,
        staleTime: 5000,
        // Socket is the primary channel; poll only while it's down so replies still arrive.
        refetchInterval: isConnected ? false : TICKET_OFFLINE_POLL_MS,
    });

    const replyMutation = useMutation({
        mutationFn: async ({ formData, onUploadProgress }: { formData: FormData; onUploadProgress?: (percent: number) => void }) => {
            const res = await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                skipToast: true,
                onUploadProgress: (e) => onUploadProgress?.(toUploadPercent(e.loaded, e.total)),
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
        // e.g. 400 'Tiket sudah ditutup...' when the ticket was closed meanwhile.
        onError: (error) => toast.error(getApiErrorMessage(error, 'Failed to send reply')),
    });

    const cancelMutation = useMutation({
        mutationFn: async (reason?: string) => {
            const res = await api.patch(`/tickets/${id}/cancel`, { reason });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            toast.success('Ticket cancelled successfully');
            setIsCancelDialogOpen(false);
            setCancelReason('');
        },
        onError: () => {
            toast.error('Failed to cancel ticket');
        },
    });

    const handleSendMessage = async (
        content: string,
        files?: FileList | null,
        isInternal?: boolean,
        onUploadProgress?: (percent: number) => void,
    ) => {
        if (files && files.length > 0) {
            const validation = validateFiles(Array.from(files));
            if (!validation.valid) {
                toast.error(validation.error);
                // Reject so TicketChat keeps the draft for the user to fix.
                throw new Error(validation.error);
            }
        }
        const formData = new FormData();
        formData.append('content', content);
        if (isInternal) {
            formData.append('isInternal', 'true');
        }
        if (files) {
            Array.from(files).forEach(file => {
                formData.append('files', file);
            });
        }

        await replyMutation.mutateAsync({ formData, onUploadProgress });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full" />
                <p className="text-xs text-muted-foreground font-medium">Memuat detail tiket...</p>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <XCircle className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ticket not found</h2>
                    <p className="text-xs text-slate-500 mt-1">Tiket yang Anda cari tidak ditemukan atau telah dihapus.</p>
                </div>
                <button
                    onClick={() => navigate('/client/my-tickets')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all cursor-pointer"
                >
                    Kembali ke My Tickets
                </button>
            </div>
        );
    }

    const isClosed = isTerminalStatus(ticket.status);
    const isRequester = Boolean(user?.id) && ticket.user?.id === user?.id;
    const canSelfResolve = isRequester && SELF_RESOLVABLE_STATUSES.includes(ticket.status);
    const messageCount = ticket.messages?.filter(m => !m.isSystemMessage).length || 0;

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100/50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-t border-slate-200/70 dark:border-slate-800 animate-in fade-in duration-200">
            {/* ── Top Header with SLA + Quick Badges ── */}
            <ClientTicketHeader
                ticket={ticket}
                onCancel={() => setIsCancelDialogOpen(true)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
                canSelfResolve={canSelfResolve}
            />

            {/* ── Main Work Area ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* LEFT & CENTER: Conversation Timeline / Activity / Mobile Details */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80">

                    {/* Requester confirmation of an agent-resolved ticket */}
                    {isRequester && ticket.status === 'RESOLVED' && (
                        <ResolutionConfirmationBanner ticketId={ticket.id} deadlineAt={ticket.resolutionDeadlineAt} />
                    )}

                    {/* Optional per-agent rating once the ticket is closed */}
                    {isRequester && ticket.status === 'CLOSED' && <AgentRatingForm ticketId={ticket.id} />}

                    {/* Navigation Tabs Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 shrink-0 bg-slate-50/50 dark:bg-slate-900/80">
                        {/* Desktop Tabs (>= lg) */}
                        <div className="hidden lg:flex gap-6">
                            <button
                                type="button"
                                onClick={() => setMainTab('chat')}
                                className={cn(
                                    "py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                                    mainTab === 'chat'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Conversation</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-primary/10 dark:bg-primary/20 text-primary"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    {messageCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('activity')}
                                className={cn(
                                    "py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2",
                                    mainTab === 'activity'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Activity Logs</span>
                            </button>
                        </div>

                        {/* Mobile Tabs (< lg) */}
                        <div className="flex lg:hidden items-center justify-around w-full gap-1">
                            <button
                                type="button"
                                onClick={() => setMainTab('chat')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'chat'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat</span>
                                <span className={cn(
                                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-primary/10 dark:bg-primary/20 text-primary"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                )}>
                                    {messageCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('properties')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'properties'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Properties</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setMainTab('activity')}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                    mainTab === 'activity'
                                        ? "border-primary text-primary"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <History className="w-3.5 h-3.5" />
                                <span>Logs</span>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
                        {mainTab === 'chat' ? (
                            <TicketChat
                                ticket={ticket}
                                isConnected={isConnected}
                                onSendMessage={handleSendMessage}
                                onImageClick={setLightboxImage}
                                typingUsers={typingUsers}
                                onTypingStart={() => sendTypingStart({ fullName: user?.fullName || 'User' })}
                                onTypingStop={sendTypingStop}
                                showCannedResponses={false}
                            />
                        ) : mainTab === 'properties' ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-slate-50/70 dark:bg-slate-900/50 space-y-4 pb-20">
                                <ClientTicketSidebar ticket={ticket} />
                                {!isClosed && (
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setIsCancelDialogOpen(true)}
                                            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Cancel Ticket
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/40">
                                <TicketHistory ticket={ticket} />
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Desktop Ticket Inspector & Properties Sidebar (>= lg only) */}
                {isSidebarOpen && (
                    <aside className="hidden lg:flex w-80 xl:w-96 shrink-0 flex-col bg-slate-50 dark:bg-slate-950 border-l border-slate-200/70 dark:border-slate-800 overflow-y-auto custom-scrollbar">
                        <ClientTicketSidebar ticket={ticket} />
                    </aside>
                )}
            </div>

            {/* Lightbox for Images */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    onClose={() => setLightboxImage(null)}
                />
            )}

            {/* Cancel Confirmation Dialog */}
            <ConfirmationDialog
                isOpen={isCancelDialogOpen}
                onCancel={() => { setIsCancelDialogOpen(false); setCancelReason(''); }}
                onConfirm={() => cancelMutation.mutate(cancelReason.trim() || undefined)}
                isLoading={cancelMutation.isPending}
                title="Cancel Ticket"
                description="Are you sure you want to cancel this ticket? This action cannot be undone."
                confirmText="Yes, Cancel Ticket"
                cancelText="No, Keep It"
                variant="destructive"
            >
                <label htmlFor="cancel-reason" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Reason <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    maxLength={CANCEL_REASON_MAX}
                    rows={2}
                    disabled={cancelMutation.isPending}
                    placeholder="Tell the IT team why you no longer need this ticket..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                />
            </ConfirmationDialog>

            {/* KB suggestion popup after visiting a fresh ticket */}
            <KbSuggestionDialog
                isOpen={suggestionsOpen}
                onClose={() => setSuggestionsOpen(false)}
                ticketId={id || ''}
                basePath="/client/kb"
            />
        </div>
    );
};

export default ClientTicketDetailPage;
