import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Clock, MessageSquare, Users } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { TicketPill, PRIORITY_TONES, STATUS_TONES, type TicketPillTone } from '@/components/ui/ticket-pill';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { CLIENT_ROUTES } from '@/config/routes';
import { formatSmartDate } from '@/lib/utils/dateFormat';
import { cn } from '@/lib/utils';

export interface MyTicketItem {
    id: string;
    ticketNumber?: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    ticketType?: string;
    createdAt: string;
    updatedAt: string;
    hasUnreadChat?: boolean;
    isParticipant?: boolean;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    } | null;
}

const MS_PER_HOUR = 60 * 60 * 1_000;
const HOURS_PER_DAY = 24;
const SHORT_ID_LENGTH = 8;
const MASCOT_SRC = '/characters/mascot-service.png';
const UNASSIGNED_LABEL = 'Menunggu Teknisi';

function formatUpdatedAtRelative(updatedAt: string) {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const diffInHours = Math.floor((Date.now() - date.getTime()) / MS_PER_HOUR);
    if (diffInHours <= 0) return 'Just now';
    if (diffInHours < HOURS_PER_DAY) return `${diffInHours}h ago`;

    return formatSmartDate(date);
}

/** Shared grid template so the header and the desktop rows always line up. */
export const MY_TICKETS_GRID = 'lg:grid-cols-[minmax(240px,3fr)_116px_148px_minmax(180px,1.3fr)_112px_28px]';

/** Text-link label for secondary create entry points; amber stays on the topbar CTA and mobile FAB only. */
export const CREATE_TICKET_TEXT_LINK = 'Buat tiket';

/** Approved requester help banner with the original service mascot. No response-time promise. */
export const HelpBanner: React.FC = () => (
    <Link to={CLIENT_ROUTES.CREATE_TICKET} className="portal-help-banner">
        <img src={MASCOT_SRC} alt="" width={56} height={56} />
        <span className="portal-help-copy">
            <b>Ada kendala IT?</b>
            <span>Laporkan masalah komputer, printer, jaringan, atau aplikasi ke tim IT.</span>
        </span>
        <span className="idesk-text-link portal-help-cta">
            {CREATE_TICKET_TEXT_LINK}
            <ArrowRight aria-hidden="true" />
        </span>
    </Link>
);

interface StatCardProps {
    label: string;
    value: number;
    tone: TicketPillTone;
    icon: React.ElementType;
    active: boolean;
    loading: boolean;
    onClick: () => void;
}

/** Soft tinted stat card that doubles as a status filter shortcut. */
export const StatCard: React.FC<StatCardProps> = ({ label, value, tone, icon: Icon, active, loading, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        aria-busy={loading || undefined}
        className={cn('portal-stat', `ticket-tone-${tone}`, active && 'is-active', !loading && value === 0 && 'is-zero')}
    >
        <span className="portal-stat-top">
            <span className="portal-stat-icon"><Icon aria-hidden="true" /></span>
            <span className="portal-stat-label">{label}</span>
        </span>
        {loading ? (
            <span className="portal-stat-skeleton" aria-hidden="true" />
        ) : (
            <span className="portal-stat-value"> {value}</span>
        )}
    </button>
);

const AssigneePill: React.FC<{ assignee: MyTicketItem['assignedTo'] }> = ({ assignee }) =>
    assignee ? (
        <TicketPill tone="neutral" className="portal-pic" title={`Ditangani oleh ${assignee.fullName}`}>
            <span aria-hidden="true" className="contents">
                <UserAvatar user={assignee} size="xs" className="!w-5 !h-5 !text-[9px]" />
            </span>
            <span className="truncate">{assignee.fullName}</span>
        </TicketPill>
    ) : (
        <span className="text-xs italic font-medium text-muted-foreground">{UNASSIGNED_LABEL}</span>
    );

/** One requester ticket: card below lg, table row at lg+. All values are readonly. */
export const MyTicketRow: React.FC<{ ticket: MyTicketItem }> = ({ ticket }) => {
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const StatusIcon = statusConfig.icon;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConfig.icon;
    const statusTone = STATUS_TONES[ticket.status] || 'neutral';
    const priorityTone = PRIORITY_TONES[ticket.priority] || PRIORITY_TONES.MEDIUM;
    const timeDisplay = formatUpdatedAtRelative(ticket.updatedAt);
    const number = ticket.ticketNumber || ticket.id.slice(0, SHORT_ID_LENGTH);

    const statusPill = (
        <TicketPill tone={statusTone}>
            {StatusIcon ? <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                : <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />}
            {statusConfig.label}
        </TicketPill>
    );
    const priorityPill = (
        <TicketPill tone={priorityTone} title={priorityConfig.label}>
            {PriorityIcon ? <PriorityIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                : <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />}
            {priorityConfig.shortLabel || priorityConfig.label}
        </TicketPill>
    );
    const meta = (
        <>
            <span className="font-mono text-xs font-semibold text-muted-foreground">#{number}</span>
            {ticket.category && <span className="portal-tag">{ticket.category}</span>}
            {ticket.isParticipant && (
                <TicketPill tone="navy" className="!min-h-5 !py-0 !px-2 !text-[11px]">
                    <Users className="w-3 h-3" aria-hidden="true" />
                    Joined
                </TicketPill>
            )}
        </>
    );
    const unread = ticket.hasUnreadChat && (
        <TicketPill tone="blue" className="!min-h-5 !py-0 !px-2 !text-[11px] shrink-0">
            <MessageSquare className="w-3 h-3" aria-hidden="true" />
            Balasan Baru
        </TicketPill>
    );
    const updated = (
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <time dateTime={ticket.updatedAt}>{timeDisplay}</time>
        </span>
    );

    return (
        <Link
            to={`/client/tickets/${ticket.id}`}
            className="portal-row group"
            aria-label={`Lihat tiket #${number}: ${ticket.title}`}
        >
            {/* Card (< lg) */}
            <div className="lg:hidden p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">{meta}</div>
                    {updated}
                </div>
                <div className="min-w-0 space-y-1.5">
                    <h3 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2 leading-snug">{ticket.title}</h3>
                    {unread}
                </div>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">{statusPill}{priorityPill}</div>
                    <div className="min-w-0 max-w-full"><AssigneePill assignee={ticket.assignedTo} /></div>
                </div>
            </div>

            {/* Table row (>= lg) */}
            <div className={cn('hidden lg:grid items-center gap-4 px-4 py-3', MY_TICKETS_GRID)}>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 min-w-0">{meta}</div>
                    <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate">{ticket.title}</h3>
                        {unread}
                    </div>
                </div>
                <div>{priorityPill}</div>
                <div>{statusPill}</div>
                <div className="min-w-0"><AssigneePill assignee={ticket.assignedTo} /></div>
                {updated}
                <ChevronRight className="w-4 h-4 justify-self-end text-muted-foreground group-hover:text-[hsl(var(--idesk-sapphire))] group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </div>
        </Link>
    );
};
