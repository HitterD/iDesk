import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    ArrowLeft,
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
    Users,
    ArrowLeftRight,
    ArrowRight,
    Tag,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { TicketDetail } from './types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './constants';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ResolveTicketModal } from './ResolveTicketModal';
import { useAuth } from '@/stores/useAuth';

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
}

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
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [copied, setCopied] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showResolveConfirm, setShowResolveConfirm] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const { user } = useAuth();

    // Update current time every minute for live SLA updates
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Determine target back navigation from query params or fallback
    const targetInfo = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const from = params.get('from');

        if (from === 'my-tickets') {
            return { path: '/tickets/my-tickets', label: 'Kembali ke Tiket Saya' };
        }
        if (from === 'oracle') {
            return { path: '/tickets/oracle-k2', label: 'Kembali ke Oracle K2' };
        }
        if (from === 'web-dev') {
            return { path: '/tickets/web-dev', label: 'Kembali ke Web Dev' };
        }
        if (from === 'mobile-dev') {
            return { path: '/tickets/mobile-dev', label: 'Kembali ke Mobile Dev' };
        }
        if (from === 'hardware') {
            return { path: '/tickets/hardware', label: 'Kembali ke Hardware' };
        }

        // Auto-detect based on ticket properties if no query param
        if (ticket.handlingTeam === 'ORACLE_DEV') {
            return { path: '/tickets/oracle-k2', label: 'Kembali ke Oracle K2' };
        }
        if (ticket.handlingTeam === 'WEB_DEV') {
            return { path: '/tickets/web-dev', label: 'Kembali ke Web Dev' };
        }
        if (ticket.handlingTeam === 'MOBILE_DEV') {
            return { path: '/tickets/mobile-dev', label: 'Kembali ke Mobile Dev' };
        }
        if (ticket.category?.toLowerCase().includes('hardware')) {
            return { path: '/tickets/hardware', label: 'Kembali ke Hardware' };
        }

        return { path: '/tickets', label: 'Kembali ke Daftar Tiket' };
    }, [location.search, ticket.category, ticket.handlingTeam]);

    const handleBack = () => {
        navigate(targetInfo.path);
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

    const statusConfig = STATUS_CONFIG[ticket.status] || {
        label: ticket.status,
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        icon: CheckCircle2,
    };
    const StatusIcon = statusConfig.icon;

    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || {
        label: ticket.priority,
        color: 'text-slate-600',
        dot: 'bg-slate-400',
    };

    const isTerminal = ticket.status === 'RESOLVED' || ticket.status === 'CANCELLED';
    const isResolved = ticket.status === 'RESOLVED';
    const slaTargetDate = ticket.slaTarget || ticket.targetResolutionDate;

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
                resolutionTime: isResolved ? 'Resolved' : 'Cancelled',
                slaTooltip: isResolved ? 'Tiket telah selesai diselesaikan' : 'Tiket telah dibatalkan',
                slaStatus: 'normal' as const,
            };
        }

        if (ticket.status === 'WAITING_VENDOR' || ticket.status === 'PENDING') {
            return {
                resolutionTime: 'SLA Paused',
                slaTooltip: `Target SLA ditunda sementara (Target: ${formatDateTimeID(slaTargetDate)})`,
                slaStatus: 'paused' as const,
            };
        }

        const target = new Date(slaTargetDate).getTime();
        const now = currentTime.getTime();
        const diffMs = target - now;

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
    }, [slaTargetDate, ticket.status, isTerminal, isResolved, currentTime]);

    // First Response Metric
    const firstResponse = useMemo(() => {
        if (!ticket.firstResponseTarget && !ticket.firstResponseAt) return null;

        if (ticket.firstResponseAt) {
            return {
                text: 'Responded',
                tooltip: `Respon pertama telah dikirim pada ${formatDateTimeID(ticket.firstResponseAt)}`,
                color: 'text-emerald-700 dark:text-emerald-400',
                isBreached: ticket.isFirstResponseBreached || false,
            };
        }

        if (isTerminal) return null;

        if (!ticket.firstResponseTarget) return null;

        const target = new Date(ticket.firstResponseTarget).getTime();
        const now = currentTime.getTime();
        const diffMs = target - now;

        if (diffMs <= 0) {
            return {
                text: 'Resp Overdue',
                tooltip: `Target respon pertama telah terlewat (Target: ${formatDateTimeID(ticket.firstResponseTarget)})`,
                color: 'text-rose-700 dark:text-rose-400',
                isBreached: true,
            };
        }

        const remainingStr = formatTimeRemaining(diffMs);
        return {
            text: `Resp: ${remainingStr}`,
            tooltip: `Sisa waktu respon pertama: ${remainingStr} (Target: ${formatDateTimeID(ticket.firstResponseTarget)})`,
            color: 'text-amber-700 dark:text-amber-400',
            isBreached: false,
        };
    }, [ticket.firstResponseTarget, ticket.firstResponseAt, ticket.isFirstResponseBreached, isTerminal, currentTime]);

    const getSlaColors = () => {
        switch (slaStatus) {
            case 'overdue':
                return {
                    bg: 'bg-rose-50/90 dark:bg-rose-950/40',
                    text: 'text-rose-700 dark:text-rose-400',
                    border: 'border-rose-200 dark:border-rose-900/60',
                    icon: AlertCircle,
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50/90 dark:bg-amber-950/40',
                    text: 'text-amber-700 dark:text-amber-400',
                    border: 'border-amber-200 dark:border-amber-900/60',
                    icon: Clock,
                };
            case 'paused':
                return {
                    bg: 'bg-slate-100 dark:bg-slate-800',
                    text: 'text-slate-600 dark:text-slate-400',
                    border: 'border-slate-200 dark:border-slate-700',
                    icon: Pause,
                };
            case 'none':
                return {
                    bg: 'bg-slate-50 dark:bg-slate-800/60',
                    text: 'text-slate-500 dark:text-slate-400',
                    border: 'border-slate-200 dark:border-slate-700',
                    icon: Clock,
                };
            default:
                if (isTerminal) {
                    return {
                        bg: 'bg-emerald-50/90 dark:bg-emerald-950/40',
                        text: 'text-emerald-700 dark:text-emerald-400',
                        border: 'border-emerald-200 dark:border-emerald-900/60',
                        icon: CheckCircle2,
                    };
                }
                return {
                    bg: 'bg-blue-50/90 dark:bg-blue-950/40',
                    text: 'text-blue-700 dark:text-blue-400',
                    border: 'border-blue-200 dark:border-blue-900/60',
                    icon: Clock,
                };
        }
    };

    const slaColors = getSlaColors();
    const SlaIcon = slaColors.icon;

    // Format Category to Title Case
    const formattedCategory = useMemo(() => {
        if (!ticket.category) return null;
        return ticket.category
            .toLowerCase()
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }, [ticket.category]);

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

            <header className={cn(
                "px-3.5 py-3 sm:px-6 sm:py-4 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 transition-all",
                isTerminal && 'bg-slate-100/80 dark:bg-slate-900/80'
            )}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleBack}
                                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/90 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-xs font-bold transition-all shadow-2xs active:scale-[0.97] cursor-pointer shrink-0"
                                title={targetInfo.label}
                            >
                                <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
                                <span>{targetInfo.label}</span>
                            </button>

                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />

                            <button
                                type="button"
                                onClick={handleCopyNumber}
                                className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all border border-slate-200/90 dark:border-slate-700/80 cursor-pointer shadow-2xs active:scale-[0.98]"
                                title="Klik untuk salin nomor tiket"
                            >
                                <span>#{ticket.ticketNumber || ticket.id.split('-')[0]}</span>
                                {copied ? (
                                    <Check className="w-3 h-3 text-emerald-600 animate-in zoom-in" />
                                ) : (
                                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
                                )}
                            </button>

                            <span className={cn(
                                "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border shadow-2xs select-none",
                                statusConfig.color
                            )}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusConfig.label}
                            </span>

                            <span className={cn(
                                "px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs select-none",
                                priorityConfig.color
                            )}>
                                <span className={cn("w-2 h-2 rounded-full", priorityConfig.dot)} />
                                {priorityConfig.label}
                            </span>

                            {formattedCategory && (
                                <span className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 inline-flex items-center gap-1.5 shadow-2xs select-none">
                                    <Tag className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                    <span>{formattedCategory}</span>
                                </span>
                            )}

                            {ticket.participants && ticket.participants.length > 0 && (
                                <span className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 inline-flex items-center gap-1.5 shadow-2xs select-none">
                                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                    <span>{1 + ticket.participants.length} Anggota</span>
                                </span>
                            )}
                        </div>

                        <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug break-words">
                            {ticket.title}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 self-start lg:self-center">
                        <div
                            className={cn(
                                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border shadow-2xs select-none text-xs transition-colors",
                                slaColors.border
                            )}
                            title={slaTooltip}
                        >
                            <div className={cn("flex items-center gap-1.5 font-bold transition-colors", slaColors.text)}>
                                <SlaIcon className={cn("w-3.5 h-3.5 shrink-0", slaStatus === 'overdue' && "animate-pulse")} />
                                <span>{resolutionTime}</span>
                            </div>
                            {firstResponse && (
                                <>
                                    <span className="text-slate-300 dark:text-slate-600 font-bold select-none">·</span>
                                    <div
                                        className={cn("flex items-center gap-1.5 font-semibold", firstResponse.color)}
                                        title={firstResponse.tooltip}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                                        <span>{firstResponse.text}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {!isTerminal && (
                                <>
                                    {onForward && (
                                        <button
                                            type="button"
                                            onClick={onForward}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                                            title="Teruskan tiket ke tim lain"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                            <span>Teruskan</span>
                                        </button>
                                    )}

                                    {onCancel && (
                                        <button
                                            type="button"
                                            onClick={() => setShowCancelConfirm(true)}
                                            disabled={isCancelling}
                                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50/90 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 border border-slate-200/90 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-800/80 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                                            title="Batalkan tiket ini"
                                        >
                                            <XCircle className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" />
                                            <span>Cancel Ticket</span>
                                        </button>
                                    )}

                                    {onResolve && (
                                        <button
                                            type="button"
                                            onClick={() => setShowResolveConfirm(true)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
                                            title="Tandai tiket telah selesai (Resolved)"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>Resolve</span>
                                        </button>
                                    )}
                                </>
                            )}

                            {onToggleSidebar && (
                                <button
                                    type="button"
                                    onClick={onToggleSidebar}
                                    className={cn(
                                        "p-1.5 rounded-xl border transition-all shadow-2xs active:scale-[0.98] cursor-pointer",
                                        isSidebarOpen
                                            ? "bg-slate-200/80 dark:bg-slate-700/80 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
                                            : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-slate-700"
                                    )}
                                    title={isSidebarOpen ? "Sembunyikan Panel Properti Tiket" : "Tampilkan Panel Properti Tiket"}
                                >
                                    {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <ConfirmationDialog
                isOpen={showCancelConfirm}
                title="Batalkan Tiket Ini?"
                description={`Apakah Anda yakin ingin membatalkan tiket #${ticket.ticketNumber || ticket.id.split('-')[0]}? Tiket yang dibatalkan tidak dapat diproses kembali.`}
                confirmText="Ya, Batalkan Tiket"
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
