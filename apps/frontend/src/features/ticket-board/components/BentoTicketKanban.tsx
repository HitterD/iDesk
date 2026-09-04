import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    MessageSquare,
    Clock,
    AlertTriangle,
    UserCheck,
    Columns3,
    TableProperties,
    Inbox,
    Flame,
    ChevronLeft,
    ChevronRight,
    Eye,
    UserPlus,
    X,
    Maximize2,
    ArrowRight,
    Plus,
    Ticket as TicketIcon,
    Search,
    Filter,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';
import { AgentSelectList, Agent } from './AgentSelectList';
import { ReassignConfirmDialog, type TargetAgentInfo } from './ReassignConfirmDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/stores/useAuth';
import { STATUS_CONFIG, PRIORITY_CONFIG, KANBAN_COLUMNS } from '@/lib/constants/ticket.constants';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { TicketQuickPreview } from '@/components/ui/TicketQuickPreview';
import { KanbanBoardSkeleton } from './KanbanSkeleton';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SiteSelector } from '@/components/site/SiteSelector';

const CROSS_SITE_ROLES = ['ADMIN','MANAGER','AGENT_ORACLE'] as const;
const isCrossSiteRole = (role?: string | null) => (CROSS_SITE_ROLES as readonly string[]).includes(role as string);


// SLA warning threshold: 4 hours in milliseconds
const SLA_WARNING_THRESHOLD_MS = 4 * 60 * 60 * 1000;

interface Message {
    id: string;
    content: string;
    createdAt: string;
    sender?: { id: string; fullName: string };
}

interface Attachment {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
}

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    category?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'HARDWARE_INSTALLATION';
    isOverdue?: boolean;
    slaTarget?: string;
    assignedTo?: { id: string; fullName: string; email?: string; avatarUrl?: string; role?: string };
    user?: { id?: string; fullName: string; avatarUrl?: string; department?: { name: string } };
    site?: { id: string; code: string; name: string };
    messages?: Message[];
    attachments?: Attachment[];
    hasUnreadChat?: boolean;
    unreadMessageCount?: number;
    createdAt: string;
}

// Column accent indicator colors
const COLUMN_ACCENTS: Record<string, { dot: string; border: string; bg: string; text: string }> = {
    TODO: {
        dot: 'bg-slate-500',
        border: 'border-slate-500/30',
        bg: 'bg-slate-500/10',
        text: 'text-slate-700 dark:text-slate-300',
    },
    IN_PROGRESS: {
        dot: 'bg-blue-500',
        border: 'border-blue-500/30',
        bg: 'bg-blue-500/10',
        text: 'text-blue-600 dark:text-blue-400',
    },
    WAITING_VENDOR: {
        dot: 'bg-amber-500',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        text: 'text-amber-600 dark:text-amber-400',
    },
    RESOLVED: {
        dot: 'bg-emerald-500',
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    CANCELLED: {
        dot: 'bg-destructive',
        border: 'border-destructive/30',
        bg: 'bg-destructive/10',
        text: 'text-destructive',
    },
};


// Enhanced Linear-style Kanban card
const EnhancedKanbanCard: React.FC<{
    ticket: Ticket;
    index: number;
    onSelect: () => void;
    onQuickAssign: () => void;
    onOpen: () => void;
}> = ({ ticket, index, onSelect, onQuickAssign, onOpen }) => {
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const isOverdue = ticket.isOverdue || (ticket.slaTarget && new Date(ticket.slaTarget) < new Date() && ticket.status !== 'RESOLVED');
    const isApproaching = ticket.slaTarget && !isOverdue && (new Date(ticket.slaTarget).getTime() - Date.now() < 2 * 60 * 60 * 1000);
    const PriorityIcon = priorityConfig.icon;

    const cleanDescription = ticket.description
        ? ticket.description.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim()
        : '';

    return (
        <Draggable draggableId={ticket.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={onOpen}
                    style={{
                        ...provided.draggableProps.style,
                    }}
                    className={cn(
                        "rounded-xl border bg-card p-3 transition-all duration-150 group relative select-none cursor-pointer",
                        "hover:shadow-md hover:border-primary/40",
                        snapshot.isDragging
                            ? "shadow-2xl ring-2 ring-primary border-primary scale-[1.02] z-50 bg-card/95 backdrop-blur-sm"
                            : "border-border/90 shadow-xs",
                        isOverdue && "!border-destructive/50 bg-destructive/5",
                        ticket.priority === 'CRITICAL' && !isOverdue && "border-destructive/40"
                    )}
                >
                    {/* Top Meta Row */}
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded border border-border/50 truncate">
                                #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                            </span>

                            {ticket.category && (
                                <span className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                                    {ticket.category.replace(/_/g, ' ')}
                                </span>
                            )}
                        </div>

                        {/* Priority Badge & Quick Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 border",
                                priorityConfig.badgeColor || 'bg-muted text-muted-foreground border-border'
                            )}>
                                {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5" />}
                                <span>{priorityConfig.label}</span>
                            </span>

                            {/* Quick Actions (visible on hover) */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                    title="Detail & Pratinjau Cepat"
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onQuickAssign(); }}
                                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                                    title="Tugaskan Agent"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Ticket Title with Rich Hover Card / Tooltip */}
                    <TicketQuickPreview ticket={ticket as any} side="right">
                        <h4
                            className="font-bold text-xs sm:text-sm text-foreground mb-1.5 line-clamp-2 group-hover:text-primary transition-colors leading-snug"
                        >
                            {ticket.title}
                        </h4>
                    </TicketQuickPreview>

                    {ticket.hasUnreadChat && (
                        <div className="mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs animate-pulse">
                                <MessageSquare className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                <span>Pesan Baru{ticket.unreadMessageCount ? ` (${ticket.unreadMessageCount})` : ''}</span>
                            </span>
                        </div>
                    )}

                    {/* Ticket Description Snippet */}
                    {cleanDescription && (
                        <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mb-2.5 leading-relaxed font-normal break-words">
                            {cleanDescription}
                        </p>
                    )}

                    {/* SLA / Target Date Pill if active */}
                    {ticket.slaTarget && ticket.status !== 'RESOLVED' && (
                        <div className="mb-2.5">
                            {isOverdue ? (
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                                    <AlertTriangle className="w-3 h-3 animate-pulse" />
                                    <span>Overdue: {format(new Date(ticket.slaTarget), 'dd MMM HH:mm')}</span>
                                </div>
                            ) : isApproaching ? (
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <Clock className="w-3 h-3" />
                                    <span>Due soon: {format(new Date(ticket.slaTarget), 'dd MMM HH:mm')}</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>Target: {format(new Date(ticket.slaTarget), 'dd MMM HH:mm')}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom Footer Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                        {/* Users: Requester -> Assignee */}
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <UserAvatar
                                user={ticket.user}
                                size="xs"
                                className="ring-1 ring-border shrink-0"
                            />

                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />

                            {ticket.assignedTo ? (
                                <div className="flex items-center gap-1 min-w-0 max-w-[120px]" title={`PIC: ${ticket.assignedTo.fullName}`}>
                                    <UserAvatar
                                        user={ticket.assignedTo}
                                        size="xs"
                                        className="ring-1 ring-border shrink-0"
                                    />
                                    <span className="text-[11px] font-semibold text-foreground truncate">
                                        {ticket.assignedTo.fullName}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    Unassigned
                                </span>
                            )}
                        </div>

                        {/* Messages Counter */}
                        {ticket.messages && ticket.messages.length > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0 ml-1">
                                <MessageSquare className="w-3 h-3" />
                                <span>{ticket.messages.length}</span>
                            </span>
                        )}
                    </div>
                </div>
            )}
        </Draggable>
    );
};

// Kanban Column with independent vertical scroll
const KanbanColumn: React.FC<{
    column: typeof KANBAN_COLUMNS[number];
    tickets: Ticket[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onCardSelect: (ticket: Ticket) => void;
    onQuickAssign: (ticketId: string) => void;
    onCardOpen: (ticket: Ticket) => void;
}> = ({ column, tickets, isCollapsed, onToggleCollapse, onCardSelect, onQuickAssign, onCardOpen }) => {
    const accent = COLUMN_ACCENTS[column.id] || COLUMN_ACCENTS.TODO;

    if (isCollapsed) {
        return (
            <div
                onClick={onToggleCollapse}
                className="w-12 h-full bg-card border border-border rounded-2xl flex flex-col items-center py-4 cursor-pointer hover:bg-muted/60 transition-colors shrink-0 select-none shadow-xs"
                title={`Buka kolom ${column.title}`}
            >
                <div className={cn("w-2.5 h-2.5 rounded-full mb-3", accent.dot)} />
                <span className="[writing-mode:vertical-rl] text-xs font-bold text-foreground rotate-180 tracking-wider">
                    {column.title}
                </span>
                <span className="mt-auto bg-muted border border-border w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground">
                    {tickets.length}
                </span>
            </div>
        );
    }

    return (
        <div className="flex-1 min-w-[290px] max-w-[370px] h-full flex flex-col rounded-2xl border border-border bg-card/60 dark:bg-card/40 shadow-xs overflow-hidden">
            {/* Pinned Column Header */}
            <div className="shrink-0 px-3.5 py-3 bg-card border-b border-border/80 flex items-center justify-between select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", accent.dot)} />
                    <h3 className="font-bold text-sm text-foreground truncate">{column.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-xs font-bold border border-border/60">
                        {tickets.length}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                    title="Ciutkan kolom"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            </div>

            {/* Independent Scrollable Cards Container */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5 custom-scrollbar transition-colors",
                            snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset rounded-xl"
                        )}
                    >
                        {tickets.map((ticket, index) => (
                            <EnhancedKanbanCard
                                key={ticket.id}
                                ticket={ticket}
                                index={index}
                                onSelect={() => onCardSelect(ticket)}
                                onQuickAssign={() => onQuickAssign(ticket.id)}
                                onOpen={() => onCardOpen(ticket)}
                            />
                        ))}
                        {provided.placeholder}

                        {column.id === 'RESOLVED' && tickets.length >= 50 && (
                            <div className="text-center p-2 text-[11px] font-semibold text-muted-foreground bg-muted/60 rounded-xl mt-2 border border-border/50">
                                🔒 Menampilkan 50 tiket terselesaikan terbaru
                            </div>
                        )}

                        {tickets.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                <div className="w-12 h-12 mb-2 rounded-2xl bg-muted/60 flex items-center justify-center border border-border/40">
                                    <Inbox className="w-6 h-6 opacity-40" />
                                </div>
                                <span className="text-xs font-bold text-foreground mb-0.5">Tidak ada tiket</span>
                                <span className="text-[11px] text-muted-foreground text-center">Tarik tiket ke sini untuk memindahkan status</span>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

// Side Drawer Quick Preview Panel
const TicketPreviewPanel: React.FC<{
    ticket: Ticket;
    agents: Agent[];
    onClose: () => void;
    onOpenFull: () => void;
    onAssign: (assigneeId: string, reason?: string) => void;
    onStatusChange: (status: string) => void;
    onPriorityChange: (priority: string) => void;
}> = ({ ticket, agents, onClose, onOpenFull, onAssign, onStatusChange, onPriorityChange }) => {
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;
    const PriorityIcon = priorityConfig.icon;
    const { user } = useAuth();
    const isAdmin = isCrossSiteRole(user?.role);
    const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);
    const [reassignModalOpen, setReassignModalOpen] = useState(false);
    const [targetAgentToAssign, setTargetAgentToAssign] = useState<TargetAgentInfo | null>(null);

    const handleAgentSelect = (agentId: string) => {
        setAssignPopoverOpen(false);

        if (ticket.assignedTo?.id === agentId) return;

        const target = agentId
            ? (agents.find((a) => a.id === agentId) || { id: agentId, fullName: 'Selected Agent' })
            : null;

        // If ticket already has an assigned PIC, prompt for confirmation and reason
        if (ticket.assignedTo?.id) {
            setTargetAgentToAssign(target);
            setReassignModalOpen(true);
        } else {
            // Unassigned ticket being assigned for the first time
            onAssign(agentId);
        }
    };

    const handleConfirmReassign = (reason: string) => {
        onAssign(targetAgentToAssign ? targetAgentToAssign.id : '', reason);
        setReassignModalOpen(false);
    };

    return (
        <div className="w-[380px] max-w-full h-full bg-card border-l border-border flex flex-col shrink-0 shadow-2xl z-20 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                    </span>
                    {ticket.priority === 'CRITICAL' && (
                        <Flame className="w-4 h-4 text-destructive animate-pulse" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onOpenFull}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                        title="Buka Halaman Lengkap"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                        title="Tutup"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div>
                    <h2 className="text-base font-bold text-foreground leading-snug">
                        {ticket.title}
                    </h2>
                </div>

                {/* Quick Status & Priority */}
                <div className="flex flex-wrap gap-2">
                    <Select value={ticket.status} onValueChange={onStatusChange}>
                        <SelectTrigger className={cn("h-8 w-auto min-w-[125px] text-xs font-semibold rounded-lg", statusConfig.color)}>
                            <SelectValue>
                                <span className="flex items-center gap-1.5">
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-popover shadow-xl z-50">
                            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'CANCELLED').map(([key, cfg]) => {
                                const SIcon = cfg.icon;
                                return (
                                    <SelectItem key={key} value={key} className="text-xs py-2 rounded-lg cursor-pointer">
                                        <span className="flex items-center gap-1.5">
                                            <SIcon className="w-3.5 h-3.5" />
                                            {cfg.label}
                                        </span>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>

                    {priorityConfig.isSystemLocked ? (
                        <span className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border", priorityConfig.badgeColor)}>
                            {PriorityIcon && <PriorityIcon className="w-3 h-3" />}
                            {priorityConfig.label}
                        </span>
                    ) : (
                        <Select value={ticket.priority} onValueChange={onPriorityChange}>
                            <SelectTrigger className={cn("h-8 w-auto min-w-[110px] text-xs font-semibold rounded-lg", priorityConfig.badgeColor)}>
                                <SelectValue>
                                    <span className="flex items-center gap-1.5">
                                        {PriorityIcon && <PriorityIcon className="w-3 h-3" />}
                                        {priorityConfig.label}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-popover shadow-xl z-50">
                                {Object.entries(PRIORITY_CONFIG)
                                    .filter(([, cfg]) => !cfg.isSystemLocked)
                                    .map(([key, cfg]) => {
                                        const PIcon = cfg.icon;
                                        return (
                                            <SelectItem key={key} value={key} className="text-xs py-2 rounded-lg cursor-pointer">
                                                <span className="flex items-center gap-1.5">
                                                    {PIcon && <PIcon className="w-3.5 h-3.5" />}
                                                    {cfg.label}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Assigned To Section */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground block">PIC Agent (Assigned To)</label>
                    <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="h-9 w-full flex items-center justify-between gap-2 px-3 text-xs border border-border rounded-xl bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                            >
                                {ticket.assignedTo ? (
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <UserAvatar user={ticket.assignedTo} size="xs" />
                                        <span className="truncate font-semibold text-foreground">{ticket.assignedTo.fullName}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground italic">Unassigned (Belum Ditugaskan)</span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-80 shadow-2xl border-border bg-card overflow-hidden rounded-xl" align="start" sideOffset={4}>
                            <AgentSelectList
                                agents={agents}
                                selectedId={ticket.assignedTo?.id}
                                isAdmin={isAdmin}
                                onSelect={handleAgentSelect}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/60 text-xs">
                    <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Pemohon</p>
                        <p className="font-bold text-foreground truncate mt-0.5">{ticket.user?.fullName || '-'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Kategori</p>
                        <p className="font-bold text-foreground truncate mt-0.5">{ticket.category || '-'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Dibuat</p>
                        <p className="font-bold text-foreground truncate mt-0.5">{format(new Date(ticket.createdAt), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Target SLA</p>
                        <p className={cn("font-bold truncate mt-0.5", ticket.isOverdue ? "text-destructive" : "text-foreground")}>
                            {ticket.slaTarget ? format(new Date(ticket.slaTarget), 'dd MMM HH:mm') : '-'}
                        </p>
                    </div>
                </div>

                {/* Description */}
                {ticket.description && (
                    <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground">Deskripsi</p>
                        <div className="p-3 bg-muted/30 rounded-xl border border-border text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                            {ticket.description}
                        </div>
                    </div>
                )}

                {/* Messages Count */}
                {ticket.messages && ticket.messages.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{ticket.messages.length} Pesan diskusi pada tiket</span>
                    </div>
                )}
            </div>

            {/* Fixed Footer */}
            <div className="p-3 border-t border-border shrink-0 bg-muted/20">
                <button
                    type="button"
                    onClick={onOpenFull}
                    className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
                >
                    Buka Detail Lengkap Tiket
                </button>
            </div>

            {/* Reassign Modal */}
            <ReassignConfirmDialog
                isOpen={reassignModalOpen}
                onClose={() => setReassignModalOpen(false)}
                ticket={{
                    id: ticket.id,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    assignedTo: ticket.assignedTo
                        ? {
                              id: ticket.assignedTo.id,
                              fullName: ticket.assignedTo.fullName,
                          }
                        : null,
                }}
                targetAgent={targetAgentToAssign}
                onConfirm={handleConfirmReassign}
            />
        </div>
    );
};

export type KanbanQueue = 'it-support' | 'oracle' | 'web-dev' | 'mobile-dev';

export interface BentoTicketKanbanProps {
    queue?: KanbanQueue;
    currentView?: 'table' | 'kanban';
    onToggleView?: (view: 'table' | 'kanban') => void;
    embedded?: boolean;
}

const QUEUE_CONFIG: Record<KanbanQueue, {
    title: string;
    description: string;
    createPath: string;
    createLabel: string;
    tablePath: string;
    ticketType?: string;
}> = {
    'it-support': {
        title: 'IT Support Kanban',
        description: 'Geser dan lepas kartu tiket untuk memperbarui status secara instan',
        createPath: '/tickets/create',
        createLabel: 'New Ticket',
        tablePath: '/tickets/list',
    },
    oracle: {
        title: 'Oracle / K2 Kanban',
        description: 'Papan alur kerja tiket Oracle ERP & K2 Request',
        createPath: '/tickets/create?type=oracle-request',
        createLabel: 'New Oracle/K2 Request',
        tablePath: '/tickets/oracle-k2',
        ticketType: 'ORACLE_REQUEST',
    },
    'web-dev': {
        title: 'Web Developer Kanban',
        description: 'Papan alur kerja tiket Web Development & Portal',
        createPath: '/tickets/create?type=web-dev-request',
        createLabel: 'New Web Dev Request',
        tablePath: '/tickets/web-developer',
        ticketType: 'WEB_DEV_REQUEST',
    },
    'mobile-dev': {
        title: 'Mobile Developer Kanban',
        description: 'Papan alur kerja tiket Aplikasi Mobile iOS & Android',
        createPath: '/tickets/create?type=mobile-dev-request',
        createLabel: 'New Mobile Dev Request',
        tablePath: '/tickets/mobile-developer',
        ticketType: 'MOBILE_DEV_REQUEST',
    },
};

export const BentoTicketKanban: React.FC<BentoTicketKanbanProps> = ({
    queue: propQueue,
    currentView = 'kanban',
    onToggleView,
    embedded = false,
}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const effectiveQueue: KanbanQueue = propQueue || (searchParams.get('queue') as KanbanQueue) || 'it-support';
    const config = QUEUE_CONFIG[effectiveQueue] || QUEUE_CONFIG['it-support'];

    const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filter, setFilter] = useState<'all' | 'my' | 'overdue' | 'critical'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);

    const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
        queryKey: ['tickets', 'kanban', effectiveQueue],
        queryFn: async () => {
            const res = await api.get('/tickets', {
                params: { queue: effectiveQueue },
            });
            return res.data;
        },
        refetchInterval: 30000,
    });

    const isAdmin = isCrossSiteRole(user?.role);
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', effectiveQueue, isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            if (config.ticketType) {
                params.set('ticketType', config.ticketType);
            }
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.patch(`/tickets/${id}/status`, { status });
        },
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets', 'kanban', effectiveQueue] });
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue]);

            queryClient.setQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue], (old) =>
                old?.map(t => t.id === id ? { ...t, status: status as Ticket['status'] } : t) ?? []
            );

            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, status: status as Ticket['status'] } : null);
            }

            return { previousTickets };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['tickets', 'kanban', effectiveQueue], context?.previousTickets);
            toast.error('Gagal memperbarui status');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'kanban'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Status tiket diperbarui'),
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
            await api.patch(`/tickets/${id}/priority`, { priority });
        },
        onMutate: async ({ id, priority }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets', 'kanban', effectiveQueue] });
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue]);

            queryClient.setQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue], (old) =>
                old?.map(t => t.id === id ? { ...t, priority: priority as Ticket['priority'] } : t) ?? []
            );

            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, priority: priority as Ticket['priority'] } : null);
            }

            return { previousTickets };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['tickets', 'kanban', effectiveQueue], context?.previousTickets);
            toast.error('Gagal memperbarui prioritas');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'kanban'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Prioritas diperbarui'),
    });

    const assignMutation = useMutation({
        mutationFn: async ({ id, assigneeId, reason }: { id: string; assigneeId?: string | null; reason?: string }) => {
            await api.patch(`/tickets/${id}/assign`, { assigneeId: assigneeId || undefined, reason });
        },
        onMutate: async ({ id, assigneeId }) => {
            await queryClient.cancelQueries({ queryKey: ['tickets', 'kanban', effectiveQueue] });
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue]);
            const assignee = assigneeId ? agents.find(a => a.id === assigneeId) || null : null;

            queryClient.setQueryData<Ticket[]>(['tickets', 'kanban', effectiveQueue], (old) =>
                old?.map(t => t.id === id ? { ...t, assignedTo: assignee || undefined } : t) ?? []
            );

            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, assignedTo: assignee || undefined } : null);
            }

            return { previousTickets };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['tickets', 'kanban', effectiveQueue], context?.previousTickets);
            toast.error('Gagal menugaskan agent');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'kanban'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Agent berhasil ditugaskan'),
    });

    // Client-side filtering and sorting for Kanban
    const filteredTickets = useMemo(() => {
        let result = [...tickets];

        // 1. Sort newest to oldest (createdAt descending)
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // 2. Quick filter pills
        if (filter === 'my') result = result.filter(t => t.assignedTo?.id === user?.id);
        if (filter === 'overdue') result = result.filter(t => t.isOverdue);
        if (filter === 'critical') result = result.filter(t => t.priority === 'CRITICAL');

        // 3. Site filter
        if (selectedSites.length > 0) {
            result = result.filter(t => t.site?.id && selectedSites.includes(t.site.id));
        }

        // 4. Live search filter
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.ticketNumber && t.ticketNumber.toLowerCase().includes(q)) ||
                (t.user?.fullName && t.user.fullName.toLowerCase().includes(q)) ||
                (t.assignedTo?.fullName && t.assignedTo.fullName.toLowerCase().includes(q)) ||
                (t.category && t.category.toLowerCase().includes(q)) ||
                (t.description && t.description.toLowerCase().includes(q))
            );
        }

        return result;
    }, [tickets, filter, user?.id, selectedSites, searchQuery]);

    // Compute live stats for top cards
    const stats = useMemo(() => {
        return tickets.reduce(
            (acc, t) => {
                if (t.status !== 'CANCELLED') acc.total++;
                if (t.status === 'TODO' || t.status === 'WAITING_VENDOR') acc.open++;
                if (t.status === 'IN_PROGRESS') acc.inProgress++;
                if (t.status === 'RESOLVED') acc.resolved++;
                if (t.status !== 'RESOLVED' && t.status !== 'CANCELLED' && t.isOverdue) acc.overdue++;
                if (t.status !== 'RESOLVED' && t.status !== 'CANCELLED' && t.priority === 'CRITICAL') acc.critical++;
                return acc;
            },
            { total: 0, open: 0, inProgress: 0, resolved: 0, overdue: 0, critical: 0 }
        );
    }, [tickets]);

    const toggleColumn = (columnId: string) => {
        setCollapsedColumns(prev =>
            prev.includes(columnId) ? prev.filter(c => c !== columnId) : [...prev, columnId]
        );
    };

    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;
        updateStatusMutation.mutate({ id: draggableId, status: destination.droppableId });
    };

    const handleQuickAssign = useCallback((ticketId: string) => {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) setSelectedTicket(ticket);
    }, [tickets]);

    if (isLoading) {
        return <KanbanBoardSkeleton />;
    }

    return (
        <div className="h-full flex flex-col min-h-0 space-y-4 select-none">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{config.title}</h1>
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate(config.createPath)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-xs hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{config.createLabel}</span>
                    </button>

                    {/* View Toggle */}
                    <div className="flex bg-card p-1 rounded-xl border border-border shadow-xs">
                        <button
                            type="button"
                            onClick={() => onToggleView ? onToggleView('kanban') : undefined}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer",
                                currentView === 'kanban'
                                    ? "bg-primary/10 text-primary font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Kanban Board"
                        >
                            <Columns3 className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Kanban</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (onToggleView) {
                                    onToggleView('table');
                                } else {
                                    navigate(config.tablePath);
                                }
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer",
                                currentView === 'table'
                                    ? "bg-primary/10 text-primary font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Table View"
                        >
                            <TableProperties className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Table</span>
                        </button>
                    </div>
                </div>
            </div>


            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 bg-card rounded-2xl border border-border shrink-0 shadow-xs">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md bg-muted/40 rounded-xl transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-background border border-transparent focus-within:border-primary/50">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari tiket, pemohon, nomor, atau PIC..."
                        className="w-full pl-9 pr-8 py-2 bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground outline-none"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto shrink-0 py-0.5">
                    <button
                        type="button"
                        onClick={() => setFilter('all')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                            filter === 'all'
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        Semua ({tickets.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('my')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                            filter === 'my'
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Tugas Saya</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('overdue')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                            filter === 'overdue'
                                ? "bg-destructive text-destructive-foreground shadow-xs"
                                : "text-destructive hover:bg-destructive/10"
                        )}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Overdue ({stats.overdue})</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('critical')}
                        className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                            filter === 'critical'
                                ? "bg-destructive text-destructive-foreground shadow-xs"
                                : "text-destructive hover:bg-destructive/10"
                        )}
                    >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Critical ({stats.critical})</span>
                    </button>

                    {/* Site Selector - cross-site roles */}
                    {isAdmin && (
                        <div className="ml-1 pl-1 border-l border-border">
                            <SiteSelector
                                selectedSiteIds={selectedSites}
                                onSelectionChange={setSelectedSites}
                                mode="multi"
                                className="h-8 text-xs"
                            />
                        </div>
                    )}
                </div>
            </div>
            {!isCrossSiteRole(user?.role) && !user?.siteId && (
                <div className="mx-0 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Akun Anda belum terpasang ke site. Hubungi admin untuk menetapkan site agar tiket dapat ditampilkan.</div>
            )}

            {/* Kanban Columns Board Area (Independent Vertical Scroll per Column) */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex-1 min-h-0 flex gap-3.5 overflow-x-auto pb-1 items-stretch">
                        {KANBAN_COLUMNS.map((column) => {
                            let columnTickets = filteredTickets.filter(t => t.status === column.id);

                            if (column.id === 'RESOLVED') {
                                columnTickets = columnTickets.slice(0, 50);
                            }

                            return (
                                <KanbanColumn
                                    key={column.id}
                                    column={column}
                                    tickets={columnTickets}
                                    isCollapsed={collapsedColumns.includes(column.id)}
                                    onToggleCollapse={() => toggleColumn(column.id)}
                                    onCardSelect={setSelectedTicket}
                                    onQuickAssign={handleQuickAssign}
                                    onCardOpen={(ticket) => navigate(`/tickets/${ticket.id}`, { state: { from: '/kanban' } })}
                                />
                            );
                        })}
                    </div>
                </DragDropContext>

                {/* Right Quick Preview Drawer Panel */}
                {selectedTicket && (
                    <TicketPreviewPanel
                        ticket={selectedTicket}
                        agents={agents}
                        onClose={() => setSelectedTicket(null)}
                        onOpenFull={() => navigate(`/tickets/${selectedTicket.id}`, { state: { from: '/kanban' } })}
                        onAssign={(id, reason) => assignMutation.mutate({ id: selectedTicket.id, assigneeId: id, reason })}
                        onStatusChange={(status) => updateStatusMutation.mutate({ id: selectedTicket.id, status })}
                        onPriorityChange={(priority) => updatePriorityMutation.mutate({ id: selectedTicket.id, priority })}
                    />
                )}
            </div>
        </div>
    );
};
