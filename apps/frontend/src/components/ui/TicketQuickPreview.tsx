import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    MessageSquare,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Hourglass,
    XCircle,
    Laptop,
    Code2,
    Calendar,
    FileText,
    ArrowUpRight,
    Flame,
    Building2,
    Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExternalSourceBadge } from './ExternalSourceBadge';
import { TicketPill, PRIORITY_TONES, STATUS_TONES, type TicketPillTone } from './ticket-pill';
import { formatDateTimeID } from '@/lib/utils/dateFormat';
import { formatSlaTime, offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { formatSlaTarget } from '@/lib/utils/slaDuration';
import './ticket-quick-preview.css';

export interface TicketPreviewData {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    criticalReason?: string;
    category?: string;
    source?: 'WEB' | 'TELEGRAM' | 'EMAIL' | string;
    /** Connected app that filed it (source API), e.g. 'EBBK'. */
    externalSource?: string | null;
    device?: string;
    software?: string;
    createdAt: string;
    updatedAt?: string;
    slaTarget?: string;
    isOverdue?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    isHardwareInstallation?: boolean;
    slaAdjustments?: any[];
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
    site?: {
        code: string;
        name: string;
    };
    messages?: any[];
}

interface TicketQuickPreviewProps {
    ticket: TicketPreviewData;
    children: React.ReactNode;
    side?: 'left' | 'right' | 'top' | 'bottom';
    align?: 'start' | 'center' | 'end';
    disabled?: boolean;
}

const OPEN_DELAY_MS = 320;
/** Grace period so the pointer can travel from the row into the card without it closing. */
const CLOSE_DELAY_MS = 150;
const ENTER_OFFSET_PX = 6;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
    TODO: { label: 'Open', icon: CircleDot },
    IN_PROGRESS: { label: 'In Progress', icon: Clock },
    WAITING_VENDOR: { label: 'Waiting Vendor', icon: Hourglass },
    RESOLVED: { label: 'Resolved', icon: CheckCircle2 },
    CLOSED: { label: 'Closed', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; icon?: React.ElementType }> = {
    LOW: { label: 'Low (Minor/Cosmetic)' },
    MEDIUM: { label: 'Normal (Moderate)' },
    HIGH: { label: 'Urgent (Major Impact)', icon: AlertTriangle },
    CRITICAL: { label: 'Blocker (Critical)', icon: Flame },
    HARDWARE_INSTALLATION: { label: 'Hardware Installation', icon: Laptop },
};

type SlaKind = 'resolved' | 'scheduled' | 'overdue' | 'active';
const SLA_TONE: Record<SlaKind, TicketPillTone> = { resolved: 'green', scheduled: 'blue', overdue: 'red', active: 'neutral' };
const SLA_ICON: Record<SlaKind, React.ElementType> = { resolved: CheckCircle2, scheduled: Calendar, overdue: AlertTriangle, active: Clock };

const enterOffset = (side: TicketQuickPreviewProps['side']) => ({
    x: side === 'right' ? -ENTER_OFFSET_PX : side === 'left' ? ENTER_OFFSET_PX : 0,
    y: side === 'bottom' ? -ENTER_OFFSET_PX : side === 'top' ? ENTER_OFFSET_PX : 0,
});

export const TicketQuickPreview: React.FC<TicketQuickPreviewProps> = ({
    ticket,
    children,
    side = 'right',
    align = 'start',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = status.icon;
    const PriorityIcon = priority.icon;

    const schedule = (open: boolean, delay: number) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setIsOpen(open), delay);
    };
    const show = () => { if (!disabled) schedule(true, OPEN_DELAY_MS); };
    const hide = () => schedule(false, CLOSE_DELAY_MS);
    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const cleanDescription = useMemo(() => {
        if (!ticket.description) return '';
        return ticket.description
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
    }, [ticket.description]);

    const formattedCategory = useMemo(() => {
        if (!ticket.category) return null;
        return ticket.category.replace(/_/g, ' ');
    }, [ticket.category]);

    // SLA Relative Countdown Context
    const slaClock = useSlaClock();
    const slaInfo = useMemo((): { type: SlaKind; label: string; detail: string } | null => {
        if (ticket.status === 'RESOLVED') {
            return { type: 'resolved', label: 'Tiket Selesai', detail: 'Target SLA terpenuhi' };
        }

        if (ticket.scheduledDate) {
            return {
                type: 'scheduled',
                label: 'Jadwal Instalasi',
                detail: `${ticket.scheduledDate} ${ticket.scheduledTime ? `• ${ticket.scheduledTime}` : ''}`,
            };
        }

        if (ticket.slaTarget) {
            const targetDate = new Date(ticket.slaTarget);
            const now = new Date();
            const clock = slaCountdown(targetDate, now, ticket.priority, slaClock);
            const overdue = ticket.isOverdue || clock.remainingMs <= 0;
            const due = formatSlaTarget(targetDate, now);
            const left = formatSlaTime(clock.remainingMs, slaClock, ticket.priority);

            if (overdue) {
                return { type: 'overdue', label: 'SLA Overdue (Terlambat)', detail: `${due} · lewat ${left}` };
            }

            return {
                type: 'active',
                label: 'Target SLA',
                detail: clock.offHours ? `${due} · sisa ${left}. ${offHoursLabel(clock, now, slaClock)}` : `${due} · sisa ${left}`,
            };
        }

        return null;
    }, [ticket.status, ticket.scheduledDate, ticket.scheduledTime, ticket.slaTarget, ticket.isOverdue, ticket.priority, slaClock]);

    const SlaIcon = slaInfo ? SLA_ICON[slaInfo.type] : null;

    return (
        <PopoverPrimitive.Root open={isOpen}>
            <PopoverPrimitive.Trigger asChild>
                <div
                    className="inline-block"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                    onFocus={show}
                    onBlur={hide}
                    onKeyDown={(e) => { if (e.key === 'Escape') schedule(false, 0); }}
                >
                    {children}
                </div>
            </PopoverPrimitive.Trigger>

            <AnimatePresence>
                {isOpen && (
                    <PopoverPrimitive.Portal forceMount>
                        <PopoverPrimitive.Content
                            asChild
                            forceMount
                            side={side}
                            align={align}
                            sideOffset={8}
                            avoidCollisions
                            collisionPadding={16}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onMouseEnter={() => schedule(true, 0)}
                            onMouseLeave={hide}
                            className="z-[110] outline-none"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.97, ...enterOffset(side) }}
                                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                                transition={{ duration: 0.2, ease: EASE_OUT }}
                                className="qp-card"
                                style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
                            >
                                <PopoverPrimitive.Arrow className="qp-arrow" width={12} height={6} />

                                <div className="qp-head">
                                    <span className="qp-id">#{ticket.ticketNumber || ticket.id.slice(0, 8)}</span>
                                    <TicketPill tone={STATUS_TONES[ticket.status] ?? 'sky'}>
                                        <StatusIcon aria-hidden="true" />
                                        {status.label}
                                    </TicketPill>
                                </div>
                                <h4 className="qp-title">{ticket.title}</h4>

                                <div className="qp-pills">
                                    <TicketPill tone={PRIORITY_TONES[ticket.priority] ?? 'blue'}>
                                        {PriorityIcon
                                            ? <PriorityIcon aria-hidden="true" />
                                            : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
                                        {priority.label}
                                    </TicketPill>
                                    {formattedCategory && (
                                        <TicketPill tone="neutral" className="max-w-[160px]">
                                            <Tag aria-hidden="true" />
                                            <span className="truncate">{formattedCategory}</span>
                                        </TicketPill>
                                    )}
                                    {ticket.site?.code && (
                                        <TicketPill tone="neutral" className="font-mono">
                                            <Building2 aria-hidden="true" />
                                            {ticket.site.code}
                                        </TicketPill>
                                    )}
                                    {ticket.hasUnreadChat && (
                                        <TicketPill tone="amber">
                                            <MessageSquare aria-hidden="true" />
                                            Pesan baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}
                                        </TicketPill>
                                    )}
                                    <ExternalSourceBadge source={ticket.source} externalSource={ticket.externalSource} />
                                </div>

                                <div className="qp-body">
                                    {ticket.priority === 'CRITICAL' && ticket.criticalReason && (
                                        <div className="qp-tint ticket-tone-red">
                                            <AlertTriangle aria-hidden="true" />
                                            <div>
                                                <strong>Alasan prioritas Blocker</strong>
                                                <p>{ticket.criticalReason}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div className="qp-section-label">
                                            <FileText aria-hidden="true" />
                                            <span>Rincian masalah</span>
                                        </div>
                                        <div className="qp-desc custom-scrollbar">
                                            {cleanDescription || <span className="qp-desc-empty">Tidak ada rincian tambahan pada tiket ini.</span>}
                                        </div>
                                    </div>

                                    {(ticket.device || ticket.software) && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {ticket.device && (
                                                <TicketPill tone="neutral"><Laptop aria-hidden="true" />{ticket.device}</TicketPill>
                                            )}
                                            {ticket.software && (
                                                <TicketPill tone="neutral"><Code2 aria-hidden="true" />{ticket.software}</TicketPill>
                                            )}
                                        </div>
                                    )}

                                    {slaInfo && SlaIcon && (
                                        <div className={cn('qp-tint', `ticket-tone-${SLA_TONE[slaInfo.type]}`)}>
                                            <SlaIcon aria-hidden="true" />
                                            <span className="min-w-0">
                                                <strong>{slaInfo.label}:</strong>{' '}
                                                <span className="text-[hsl(var(--idesk-text))]">{slaInfo.detail}</span>
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="qp-foot">
                                    <span>Dibuat <strong>{formatDateTimeID(ticket.createdAt)}</strong></span>
                                    <span className="qp-open">Klik untuk membuka <ArrowUpRight aria-hidden="true" /></span>
                                </div>
                            </motion.div>
                        </PopoverPrimitive.Content>
                    </PopoverPrimitive.Portal>
                )}
            </AnimatePresence>
        </PopoverPrimitive.Root>
    );
};

export default TicketQuickPreview;
