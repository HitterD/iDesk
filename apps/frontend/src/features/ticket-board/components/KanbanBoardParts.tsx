import React from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { format } from 'date-fns';
import {
    AlertTriangle, ChevronLeft, CircleCheck, Clock, Flame, Inbox, Lock, MessageSquare, Pause, UserRoundPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TicketPill, PRIORITY_TONES, STATUS_TONES } from '@/components/ui/ticket-pill';
import { TicketQuickPreview } from '@/components/ui/TicketQuickPreview';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { STATUS_CONFIG, PRIORITY_CONFIG, KANBAN_COLUMNS } from '@/lib/constants/ticket.constants';
import { formatSlaDuration, MS_PER_MINUTE } from '@/lib/utils/slaDuration';
import { offHoursLabel, slaCountdown, useSlaClock } from '@/lib/slaCountdown';
import { TicketRowActions } from './TicketRowActions';

export interface KanbanTicket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    category?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
    isOverdue?: boolean;
    slaTarget?: string;
    slaRemainingMinutes?: number | null;
    assignedTo?: { id: string; fullName: string; email?: string; avatarUrl?: string; role?: string };
    user?: { id?: string; fullName: string; avatarUrl?: string; department?: { name: string } };
    site?: { id: string; code: string; name: string };
    messages?: { id: string; content: string; createdAt: string; sender?: { id: string; fullName: string } }[];
    attachments?: { id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }[];
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
    createdAt: string;
}

/** CLOSED is final (set by requester/system): read only, never draggable — same rule as before. */
export const isKanbanLocked = (status: string): boolean => status === 'CLOSED';
const APPROACHING_MS = 2 * 60 * 60 * 1000;
const SLA_DATE_FORMAT = 'dd MMM HH:mm';
const RESOLVED_LIMIT = 50;

const SlaPill: React.FC<{ ticket: KanbanTicket }> = ({ ticket }) => {
    const slaClock = useSlaClock();
    const now = new Date();
    if (ticket.status === 'WAITING_VENDOR') {
        return (
            <TicketPill tone="amber">
                <Pause className="w-3 h-3 shrink-0" aria-hidden="true" />
                {ticket.slaRemainingMinutes != null ? `Dijeda · sisa ${formatSlaDuration(ticket.slaRemainingMinutes * MS_PER_MINUTE)}` : 'Dijeda'}
            </TicketPill>
        );
    }
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        return <TicketPill tone="green"><CircleCheck className="w-3 h-3 shrink-0" aria-hidden="true" />Selesai</TicketPill>;
    }
    if (!ticket.slaTarget) return null;
    const clock = slaCountdown(ticket.slaTarget, now, ticket.priority, slaClock);
    const target = format(new Date(ticket.slaTarget), SLA_DATE_FORMAT);
    const offHours = clock.offHours ? offHoursLabel(clock, now, slaClock) : undefined;
    if (ticket.isOverdue || clock.remainingMs <= 0) {
        return <TicketPill tone="red"><AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />Overdue: {target}</TicketPill>;
    }
    if (clock.remainingMs < APPROACHING_MS) {
        return <TicketPill tone="amber" title={offHours}><Clock className="w-3 h-3 shrink-0" aria-hidden="true" />Due soon: {target}</TicketPill>;
    }
    return (
        <TicketPill tone="blue" title={offHours} className="font-mono">
            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />Target: {target}{offHours ? ' · dijeda' : ''}
        </TicketPill>
    );
};

interface KanbanCardProps {
    ticket: KanbanTicket;
    index: number;
    onSelect: () => void;
    onQuickAssign: () => void;
    onOpen: () => void;
    /** Card that just moved column: plays the landing animation once. */
    landed?: boolean;
}

/** Card per mockup `kanban.html` cardHtml; existing drag library, preview and assign entry points. */
export const EnhancedKanbanCard: React.FC<KanbanCardProps> = ({ ticket, index, onSelect, onQuickAssign, onOpen, landed }) => {
    const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const PriorityIcon = ticket.priority === 'CRITICAL' && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' ? Flame : priority.icon;
    const locked = isKanbanLocked(ticket.status);
    const number = ticket.ticketNumber || ticket.id.slice(0, 8);

    return (
        <Draggable draggableId={ticket.id} index={index} isDragDisabled={locked}>
            {(provided, snapshot) => (
                <article
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    aria-label={`${number}: ${ticket.title}`}
                    aria-roledescription={locked ? 'kartu hanya baca' : undefined}
                    data-locked={locked || undefined}
                    onClick={onOpen}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen();
                    }}
                    className={cn(
                        'kanban-card',
                        locked && 'is-locked',
                        snapshot.isDragging && 'is-dragging',
                        snapshot.isDropAnimating && 'is-dropping',
                        landed && 'is-landed',
                    )}
                >
                    <div className="kanban-id">
                        <span>#{number}</span>
                        {ticket.category && <span className="src">{ticket.category.replace(/_/g, ' ')}</span>}
                        {locked && <span className="kanban-lock" title="Hanya baca"><Lock aria-label="Hanya baca" /></span>}
                    </div>
                    <span className="card-acts">
                        <TicketRowActions layout="card" number={number} onOpen={onOpen} onPreview={onSelect}
                            onChangePic={locked ? undefined : onQuickAssign} />
                    </span>
                    <TicketQuickPreview ticket={ticket as never} side="right">
                        <div className="kanban-title">{ticket.title}</div>
                    </TicketQuickPreview>
                    {ticket.hasUnreadChat && (
                        <TicketPill tone="amber" className="w-fit !min-h-5 !py-0 !px-2 !text-[11px]">
                            <MessageSquare className="w-3 h-3" aria-hidden="true" />
                            Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}
                        </TicketPill>
                    )}
                    <div className="kanban-pills">
                        <TicketPill tone={PRIORITY_TONES[ticket.priority] || 'neutral'} title={priority.label}>
                            {PriorityIcon ? <PriorityIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                                : <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />}
                            {priority.shortLabel || priority.label}
                        </TicketPill>
                        <SlaPill ticket={ticket} />
                    </div>
                    <div className="kanban-foot">
                        {ticket.assignedTo ? (
                            <span className="kanban-pic" title={`PIC: ${ticket.assignedTo.fullName}`}>
                                <UserAvatar user={ticket.assignedTo} size="xs" className="shrink-0" />
                                <span>{ticket.assignedTo.fullName}</span>
                            </span>
                        ) : (
                            <span className="kanban-pic is-empty"><UserRoundPlus aria-hidden="true" /><span>Belum ada PIC</span></span>
                        )}
                        <TicketPill tone={STATUS_TONES[ticket.status] || 'neutral'}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                            {status.label}
                        </TicketPill>
                    </div>
                </article>
            )}
        </Draggable>
    );
};

interface KanbanColumnProps {
    column: typeof KANBAN_COLUMNS[number];
    tickets: KanbanTicket[];
    isCollapsed: boolean;
    landedId: string | null;
    onToggleCollapse: () => void;
    onCardSelect: (ticket: KanbanTicket) => void;
    onQuickAssign: (ticketId: string) => void;
    onCardOpen: (ticket: KanbanTicket) => void;
}

export const KanbanBoardColumn: React.FC<KanbanColumnProps> = ({
    column, tickets, isCollapsed, landedId, onToggleCollapse, onCardSelect, onQuickAssign, onCardOpen,
}) => {
    const headId = `kh-${column.id}`;
    if (isCollapsed) {
        return (
            <button type="button" onClick={onToggleCollapse} data-status={column.id}
                className="kanban-col kanban-col-collapsed" title={`Buka kolom ${column.title}`}>
                <span className="kanban-head"><span className="dot" /><b>{column.title}</b><span className="kanban-count">{tickets.length}</span></span>
            </button>
        );
    }
    return (
        <Droppable droppableId={column.id}>
            {(provided, snapshot) => (
                <div className={cn('kanban-col', snapshot.isDraggingOver && 'is-over')} data-status={column.id}
                    role="group" aria-labelledby={headId}>
                    <div className="kanban-head">
                        <span className="dot" aria-hidden="true" />
                        <b id={headId}>{column.title}</b>
                        <span className="kanban-count">{tickets.length}</span>
                        <button type="button" onClick={onToggleCollapse} className="queue-act-btn kanban-collapse"
                            aria-label={`Ciutkan kolom ${column.title}`} title="Ciutkan kolom">
                            <ChevronLeft aria-hidden="true" />
                        </button>
                    </div>
                    <div ref={provided.innerRef} {...provided.droppableProps} className="kanban-list">
                        {tickets.map((ticket, index) => (
                            <EnhancedKanbanCard key={ticket.id} ticket={ticket} index={index} landed={landedId === ticket.id}
                                onSelect={() => onCardSelect(ticket)} onQuickAssign={() => onQuickAssign(ticket.id)}
                                onOpen={() => onCardOpen(ticket)} />
                        ))}
                        {provided.placeholder}
                        {tickets.length === 0 && !snapshot.isDraggingOver && (
                            <div className="kanban-empty"><Inbox aria-hidden="true" />Kosong</div>
                        )}
                        {column.id === 'RESOLVED' && tickets.length >= RESOLVED_LIMIT && (
                            <div className="kanban-note">Menampilkan {RESOLVED_LIMIT} tiket terselesaikan terbaru</div>
                        )}
                    </div>
                </div>
            )}
        </Droppable>
    );
};
