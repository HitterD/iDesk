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
import { useTicketSocket } from '@/hooks/useTicketSocket';
import { TicketChat } from '../../ticket-board/components/ticket-detail/TicketChat';
import { TicketHistory } from '../../ticket-board/components/ticket-detail/TicketHistory';
import { TicketParticipantsSection } from '../../ticket-board/components/ticket-detail/TicketParticipantsSection';
import { ImageLightbox } from '../../ticket-board/components/ticket-detail/ImageLightbox';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { TicketDetail } from '../../ticket-board/components/ticket-detail/types';
import { KbSuggestionDialog } from '../../ticket-board/components/KbSuggestionDialog';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../../ticket-board/components/ticket-detail/constants';
import { formatDateTimeID, formatRelativeTime } from '@/lib/utils/dateFormat';
import { cn } from '@/lib/utils';

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
}

const ClientTicketHeader: React.FC<ClientTicketHeaderProps> = ({
    ticket,
    onCancel,
    isSidebarOpen,
    onToggleSidebar,
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

    const isResolved = ticket.status === 'RESOLVED';
    const isCancelled = ticket.status === 'CANCELLED';
    const isPaused = ticket.status === 'WAITING_VENDOR';
    const isTerminal = isResolved || isCancelled;

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
            const target = new Date(ticket.slaTarget);
            const diff = target.getTime() - now.getTime();

            if (diff <= 0) {
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
    }, [ticket.slaTarget, isResolved, isCancelled, isPaused]);

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
                    bg: 'bg-blue-50 dark:bg-blue-950/40',
                    text: 'text-blue-700 dark:text-blue-400',
                    border: 'border-blue-200 dark:border-blue-900/60',
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
                "px-3.5 py-3 sm:px-6 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 transition-all",
                isTerminal && 'bg-slate-50/50 dark:bg-slate-900/50'
            )}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                {/* Left: Back button + Badges + Title */}
                <div className="flex items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="mt-0.5 sm:mt-1 p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
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
                                className="group inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="Click to copy ticket number"
                            >
                                <span>#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                {copied ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                )}
                            </button>

                            <span className={cn(
                                "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 border shadow-2xs",
                                statusConfig.color
                            )}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                            </span>

                            <span className={cn(
                                "px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                                priorityConfig.color
                            )}>
                                <span className={cn("w-2 h-2 rounded-full", priorityConfig.dot)} />
                                {priorityConfig.label}
                            </span>

                            {ticket.category && (
                                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
                                    {ticket.category.replace(/_/g, ' ')}
                                </span>
                            )}

                            {ticket.device && (
                                <span className="hidden sm:inline-flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
                                    {ticket.device}
                                </span>
                            )}

                            {ticket.participants && ticket.participants.length > 0 && (
                                <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 inline-flex items-center gap-1.5 shadow-2xs">
                                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    <span>{1 + ticket.participants.length} Anggota</span>
                                </span>
                            )}
                        </div>

                        {/* Ticket Title */}
                        <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug break-words">
                            {ticket.title}
                        </h1>
                    </div>
                </div>

                {/* Right: SLA Pill + Cancel Action + Toggle Sidebar */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
                    {/* SLA Resolution Pill */}
                    <div className={cn(
                        "px-3 py-1.5 rounded-xl border inline-flex items-center gap-2 text-xs font-bold shadow-2xs transition-all",
                        slaColors.bg,
                        slaColors.text,
                        slaColors.border
                    )}>
                        <SlaIcon className={cn("w-3.5 h-3.5", slaStatus === 'overdue' && "animate-pulse")} />
                        <span>SLA: {resolutionTime}</span>
                    </div>

                    {/* Cancel or Resolved Indicator */}
                    {isTerminal ? (
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs border",
                            isResolved
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                        )}>
                            {isResolved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>{isResolved ? 'Resolved' : 'Cancelled'}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold transition-colors cursor-pointer"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Cancel Ticket</span>
                        </button>
                    )}

                    {/* Toggle Properties Sidebar Button (Desktop only) */}
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="hidden lg:flex p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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

    const isClosed = ticket.status === 'CANCELLED' || ticket.status === 'RESOLVED';
    const isAgentOracle = user?.role === 'AGENT_ORACLE';
    const isAdmin = user?.role === 'ADMIN';
    const canManageParticipants = isAgentOracle || isAdmin;
    const isOracleTicket = ticket.handlingTeam === 'ORACLE_DEV' ||
        ticket.handlingTeam === 'MOBILE_DEV' ||
        ticket.handlingTeam === 'WEB_DEV' ||
        (ticket.handlingTeam == null && (ticket.category === 'ORACLE_REQUEST' || ticket.ticketType === 'ORACLE_REQUEST' || ticket.ticketType === 'WEB_DEV_REQUEST' || ticket.ticketType === 'MOBILE_DEV_REQUEST'));
    const canAddParticipants = isOracleTicket && (canManageParticipants || ticket.user?.id === user?.id || Boolean(ticket.participants?.some(p => p.userId === user?.id)));

    const handleCopyEmail = () => {
        if (assignedAgent?.email) {
            navigator.clipboard.writeText(assignedAgent.email);
            setCopiedEmail(true);
            toast.success('Agent email copied to clipboard');
            setTimeout(() => setCopiedEmail(false), 2000);
        }
    };

    return (
        <div className="p-4 space-y-4 select-none">
            {/* 1. Assigned Agent Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Assigned Agent
                    </span>
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {assignedAgent ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <div className="w-11 h-11 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-sm shadow-xs">
                                    {assignedAgent.fullName.charAt(0).toUpperCase()}
                                </div>
                                <PresenceDot userId={assignedAgent.id} userName={assignedAgent.fullName} ringed className="absolute -bottom-0.5 -right-0.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {assignedAgent.fullName}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    IT Support Specialist
                                </p>
                            </div>
                        </div>

                        {assignedAgent.email && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Email</span>
                                    <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[170px]">
                                        <span className="truncate">{assignedAgent.email}</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyEmail}
                                            className="p-0.5 hover:text-blue-600 transition-colors shrink-0 cursor-pointer"
                                            title="Copy Agent Email"
                                        >
                                            {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                                        </button>
                                    </div>
                                </div>

                                {assignedAgent.site?.name && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5" /> Branch / Site
                                        </span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                                            {assignedAgent.site.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
                        <div className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 mx-auto flex items-center justify-center">
                            <UserX className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Menunggu Teknisi</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Tiket Anda dalam antrean penugasan tim IT Support</p>
                    </div>
                )}
            </div>

            {/* 1.5. Ticket Participants (Oracle Tickets / Multi-user Group) */}
            {(isOracleTicket || (ticket.participants && ticket.participants.length > 0)) && (
                <TicketParticipantsSection
                    ticketId={ticket.id}
                    creator={ticket.user}
                    participants={ticket.participants}
                    canManageUsers={canManageParticipants}
                    canAddUsers={canAddParticipants}
                    isClosed={isClosed}
                />
            )}

            {/* 2. Ticket Properties Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Ticket Properties
                    </span>
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                </div>

                <div className="space-y-3 text-xs">
                    {/* Status */}
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-slate-400" /> Status
                        </span>
                        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 flex items-center justify-between">
                            <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold", statusConfig.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">#{ticket.status}</span>
                        </div>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-slate-400" /> Priority
                        </span>
                        <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", priorityConfig.dot)} />
                                <span className="font-bold text-slate-900 dark:text-white">{priorityConfig.label}</span>
                            </div>
                        </div>

                        {ticket.priority === 'CRITICAL' && ticket.criticalReason && (
                            <div className="mt-2.5 p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-rose-500" />
                                    Catatan Alasan Kritis:
                                </p>
                                <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                                    {ticket.criticalReason}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    {ticket.category && (
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-slate-400" /> Category
                            </span>
                            <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                                <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{ticket.category.replace(/_/g, ' ')}</span>
                            </div>
                        </div>
                    )}

                    {/* Device / Hardware */}
                    {ticket.device && (
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Monitor className="w-3.5 h-3.5 text-slate-400" /> Device / Asset
                            </span>
                            <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                                <Monitor className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{ticket.device}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. SLA & Tracking Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        SLA & Tracking
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                </div>

                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400">Created At</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDateTimeID(ticket.createdAt)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                        <span className="text-slate-400">Last Activity</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(ticket.updatedAt)}
                        </span>
                    </div>

                    {ticket.slaTarget && (
                        <div className="flex items-center justify-between py-1">
                            <span className="text-slate-400">SLA Target</span>
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {formatDateTimeID(ticket.slaTarget)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Hardware Installation Schedule (if applicable) */}
            {ticket.isHardwareInstallation && (
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 shadow-2xs space-y-3">
                    <div className="flex items-center gap-1.5 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                        <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            Hardware Installation
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Date</span>
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {ticket.scheduledDate ? new Date(ticket.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </span>
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-2.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Time</span>
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
    });

    const replyMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            const res = await api.post(`/tickets/${id}/reply`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ticket', id] });
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
        },
        onError: () => toast.error('Failed to send reply'),
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

    const handleSendMessage = async (content: string, files?: FileList | null, isInternal?: boolean) => {
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

        await replyMutation.mutateAsync(formData);
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

    const isClosed = ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED';
    const messageCount = ticket.messages?.filter(m => !m.isSystemMessage).length || 0;

    const handleToggleSidebar = () => {
        setIsSidebarOpen(prev => !prev);
    };

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100/50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-sm animate-in fade-in duration-200">
            {/* ── Top Header with SLA + Quick Badges ── */}
            <ClientTicketHeader
                ticket={ticket}
                onCancel={() => setIsCancelDialogOpen(true)}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={handleToggleSidebar}
            />

            {/* ── Main Work Area ── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* LEFT & CENTER: Conversation Timeline / Activity / Mobile Details */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80">

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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Conversation</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
                                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                )}
                            >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat</span>
                                <span className={cn(
                                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                                    mainTab === 'chat'
                                        ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
                                        ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
                    <aside className="hidden lg:flex w-80 lg:w-88 shrink-0 flex-col bg-slate-50/70 dark:bg-slate-900/50 overflow-y-auto custom-scrollbar">
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
