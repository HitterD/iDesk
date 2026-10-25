import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSocket } from '@/lib/socket';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import {
    MessageSquare,
    Flame,
    X,
    Maximize2,
    Hand,
    Ticket as TicketIcon,
    Database,
    Code2,
    Smartphone,
    Layers,
    Inbox,
    CircleDot,
    Hourglass,
    CircleCheck,
    TriangleAlert,
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
import { STATUS_CONFIG, PRIORITY_CONFIG, KANBAN_COLUMNS, NON_SELECTABLE_STATUSES } from '@/lib/constants/ticket.constants';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { KanbanBoardSkeleton } from './KanbanSkeleton';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SiteSelector } from '@/components/site/SiteSelector';
import { QueueHeader, QueueToggles } from './QueueHeader';
import { StatsCard } from './StatsCard';
import type { TicketPillTone } from '@/components/ui/ticket-pill';
import { QueueFilterBar, PRIORITY_FILTER_OPTIONS } from './QueueFilterBar';
import { CustomDropdown } from './TicketDropdowns';
import { EnhancedKanbanCard, KanbanBoardColumn, type KanbanTicket } from './KanbanBoardParts';
import { isHandledByTakeoverDialog, useStatusTakeover, type TakeoverOptions } from '../hooks/useStatusTakeover';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';

const CROSS_SITE_ROLES = ['ADMIN','MANAGER','AGENT_ORACLE'] as const;
const isCrossSiteRole = (role?: string | null) => (CROSS_SITE_ROLES as readonly string[]).includes(role as string);


/** Statuses never counted overdue: finished, or WAITING_VENDOR (SLA clock paused). */
const NOT_OVERDUE_STATUSES: readonly string[] = ['RESOLVED', 'CLOSED', 'CANCELLED', 'WAITING_VENDOR'];

/** Overdue for the quick filter and stat card — same rule as the list page's Overdue filter. */
export const isCountedOverdue = (t: { status: string; isOverdue?: boolean }): boolean =>
    Boolean(t.isOverdue) && !NOT_OVERDUE_STATUSES.includes(t.status);

type Ticket = KanbanTicket;
type KanbanAttention = '' | 'overdue' | 'critical';
type StatKey = 'all' | 'open' | 'inProgress' | 'waitingVendor' | 'resolved' | 'overdue' | 'critical';
const KANBAN_STATS: readonly { key: StatKey; label: string; icon: React.ElementType; tone: TicketPillTone; status?: string; attention?: boolean }[] = [
    { key: 'all', label: 'Total', icon: Layers, tone: 'neutral' },
    { key: 'open', label: 'Open', icon: Inbox, tone: 'sky', status: 'TODO' },
    { key: 'inProgress', label: 'In Progress', icon: CircleDot, tone: 'navy', status: 'IN_PROGRESS' },
    { key: 'waitingVendor', label: 'Waiting Vendor', icon: Hourglass, tone: 'amber', status: 'WAITING_VENDOR', attention: true },
    { key: 'resolved', label: 'Resolved', icon: CircleCheck, tone: 'green', status: 'RESOLVED,CLOSED' },
    { key: 'overdue', label: 'Overdue', icon: TriangleAlert, tone: 'red', attention: true },
    { key: 'critical', label: 'Critical', icon: Flame, tone: 'red', attention: true },
];
/** "Saya Buat" is a server-side scope the Kanban query does not support, so the board offers Semua / Tugas Saya. */
const KANBAN_SCOPES = ['all', 'assigned_to_me'] as const;
export { EnhancedKanbanCard };

/** Landing highlight duration after a card changes column (matches --dur-3 with headroom). */
const LANDED_MS = 600;
const COLLAPSED_COLUMN = '52px';
const OPEN_COLUMN = 'minmax(250px, 1fr)';

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
                    <Select value={ticket.status} onValueChange={onStatusChange} disabled={ticket.status === 'CLOSED'}>
                        <SelectTrigger className={cn("h-8 w-auto min-w-[125px] text-xs font-semibold rounded-lg", statusConfig.color)}>
                            <SelectValue>
                                <span className="flex items-center gap-1.5">
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-popover shadow-xl z-50">
                            {Object.entries(STATUS_CONFIG).filter(([k]) => !NON_SELECTABLE_STATUSES.includes(k)).map(([key, cfg]) => {
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
    /** @deprecated The Kanban | Tabel toggle is a link group now (QueueViewToggle); kept for API compatibility. */
    currentView?: 'table' | 'kanban';
    /** @deprecated See `currentView`. */
    onToggleView?: (view: 'table' | 'kanban') => void;
    embedded?: boolean;
}

type QueueTone = 'blue' | 'red' | 'teal' | 'teal-deep';
/** Same header as each queue's Tabel view (mockup: Kanban and Tabel share header, data and vocabulary). */
const QUEUE_CONFIG: Record<KanbanQueue, {
    title: string;
    description: string;
    icon: React.ElementType;
    tone: QueueTone;
    tablePath: string;
    ticketType?: string;
}> = {
    'it-support': {
        title: 'IT Support Tickets',
        description: 'Antrian IT Support untuk semua site Anda',
        icon: TicketIcon, tone: 'blue',
        tablePath: '/tickets/list',
    },
    oracle: {
        title: 'Oracle K2 Request',
        description: 'ERP, database, dan workflow K2',
        icon: Database, tone: 'red',
        tablePath: '/tickets/oracle-k2',
        ticketType: 'ORACLE_REQUEST',
    },
    'web-dev': {
        title: 'Web Developer Request',
        description: 'Bug, fitur, dan integrasi web portal',
        icon: Code2, tone: 'teal',
        tablePath: '/tickets/web-developer',
        ticketType: 'WEB_DEV_REQUEST',
    },
    'mobile-dev': {
        title: 'Mobile Developer Request',
        description: 'Aplikasi mobile, APK, dan notifikasi',
        icon: Smartphone, tone: 'teal-deep',
        tablePath: '/tickets/mobile-developer',
        ticketType: 'MOBILE_DEV_REQUEST',
    },
};

export const BentoTicketKanban: React.FC<BentoTicketKanbanProps> = ({
    queue: propQueue,
}) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const effectiveQueue: KanbanQueue = propQueue || (searchParams.get('queue') as KanbanQueue) || 'it-support';
    const config = QUEUE_CONFIG[effectiveQueue] || QUEUE_CONFIG['it-support'];

    const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [scope, setScope] = useState<'all' | 'assigned_to_me'>('all');
    const [attention, setAttention] = useState<KanbanAttention>('');
    const [priorityFilter, setPriorityFilter] = useState('');
    /** Stat-card status filter (mockup: the same counters as the Tabel view filter the board). */
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [landedId, setLandedId] = useState<string | null>(null);
    const landedTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(landedTimer.current), []);

    // The parent page's ticket socket invalidates ['tickets']; poll only while it is down.
    const { isConnected } = useSocket();
    const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
        queryKey: ['tickets', 'kanban', effectiveQueue],
        queryFn: async () => {
            const res = await api.get('/tickets', {
                params: { queue: effectiveQueue },
            });
            return res.data;
        },
        refetchInterval: isConnected ? false : 30000,
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

    const statusTakeover = useStatusTakeover();
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, takeover }: { id: string; status: string; takeover?: TakeoverOptions }) => {
            // skipToast: the takeover 409 opens a dialog instead; other errors are toasted in onError.
            await api.patch(`/tickets/${id}/status`, { status, ...takeover }, { skipToast: true });
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
        onError: (err, variables, context) => {
            queryClient.setQueryData(['tickets', 'kanban', effectiveQueue], context?.previousTickets);
            if (!isHandledByTakeoverDialog(err, variables.takeover)) toast.error(getApiErrorMessage(err, 'Gagal memperbarui status'));
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'kanban'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'mobile-dev'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: (_, { id }) => {
            toast.success('Status tiket diperbarui');
            setLandedId(id);
            window.clearTimeout(landedTimer.current);
            landedTimer.current = window.setTimeout(() => setLandedId(null), LANDED_MS);
        },
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
        if (scope === 'assigned_to_me') result = result.filter(t => t.assignedTo?.id === user?.id);
        if (attention === 'overdue') result = result.filter(isCountedOverdue);
        if (attention === 'critical') result = result.filter(t => t.priority === 'CRITICAL');
        if (priorityFilter) result = result.filter(t => t.priority === priorityFilter);
        if (statusFilter) result = result.filter(t => statusFilter.split(',').includes(t.status));

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
    }, [tickets, scope, attention, priorityFilter, statusFilter, user?.id, selectedSites, searchQuery]);

    // Compute live stats for top cards
    const stats = useMemo(() => {
        return tickets.reduce(
            (acc, t) => {
                if (t.status !== 'CANCELLED') acc.all++;
                if (t.status === 'TODO') acc.open++;
                if (t.status === 'IN_PROGRESS') acc.inProgress++;
                if (t.status === 'WAITING_VENDOR') acc.waitingVendor++;
                const isDone = t.status === 'RESOLVED' || t.status === 'CLOSED';
                if (isDone) acc.resolved++;
                if (isCountedOverdue(t)) acc.overdue++;
                if (!isDone && t.status !== 'CANCELLED' && t.priority === 'CRITICAL') acc.critical++;
                return acc;
            },
            { all: 0, open: 0, inProgress: 0, waitingVendor: 0, resolved: 0, overdue: 0, critical: 0 } as Record<StatKey, number>
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
        if (NON_SELECTABLE_STATUSES.includes(destination.droppableId)) return;
        changeStatus(draggableId, destination.droppableId);
    };

    // A takeover confirmation opens before the optimistic move, so cancelling leaves the card in place.
    const changeStatus = (id: string, status: string) => {
        const ticket = tickets.find(t => t.id === id) ?? (selectedTicket?.id === id ? selectedTicket : undefined);
        if (!ticket) return;
        statusTakeover
            .request(ticket, status, (takeover) => updateStatusMutation.mutateAsync({ id, status, takeover }))
            .catch(() => undefined); // already reported by the mutation's onError
    };

    const handleQuickAssign = useCallback((ticketId: string) => {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) setSelectedTicket(ticket);
    }, [tickets]);

    if (isLoading) {
        return <KanbanBoardSkeleton />;
    }

    return (
        <div className="queue-page h-full flex flex-col min-h-0 space-y-4">
            {/* Same title (topbar) and toggles (end of the filter row) as the Tabel view. */}
            <QueueHeader title={config.title} description={config.description} icon={config.icon} tone={config.tone} />

            {/* Same counters as the Tabel view (computed from the loaded board). */}
            <div className="queue-stats queue-stats-7" aria-label="Ringkasan status">
                {KANBAN_STATS.map((card) => {
                    const active = card.key === 'all'
                        ? !statusFilter && !attention
                        : card.key === 'overdue' || card.key === 'critical' ? attention === card.key : statusFilter === card.status;
                    const select = () => {
                        if (card.key === 'all') { setStatusFilter(''); setAttention(''); return; }
                        if (card.key === 'overdue' || card.key === 'critical') { setStatusFilter(''); setAttention(active ? '' : card.key); return; }
                        setStatusFilter(active ? '' : card.status ?? '');
                    };
                    return <StatsCard key={card.key} icon={card.icon} tone={card.tone} label={card.label} value={stats[card.key]}
                        highlight={card.attention} color="" bgColor="" onClick={select} isActive={active} />;
                })}
            </div>

            {/* Toolbar (mockup kanban.html = list.html .filters): search + filter pops */}
            <QueueFilterBar id="kanban-ticket-search" search={searchQuery} onSearch={setSearchQuery}>
                <CustomDropdown value={priorityFilter} onChange={setPriorityFilter}
                    placeholder="Semua" filterKey="Prioritas" options={PRIORITY_FILTER_OPTIONS} />
                <CustomDropdown value={attention}
                    onChange={(value) => setAttention(value === 'overdue' || value === 'critical' ? value : '')}
                    placeholder="Semua" filterKey="Perhatian"
                    options={[
                        { value: 'ALL', label: 'Semua' },
                        { value: 'overdue', label: `Overdue (${stats.overdue})` },
                        { value: 'critical', label: `Critical (${stats.critical})` },
                    ]} />
                {isAdmin && (
                    <SiteSelector selectedSiteIds={selectedSites} onSelectionChange={setSelectedSites} mode="multi" variant="pop" />
                )}
                <QueueToggles canEdit view="kanban" tablePath={propQueue ? undefined : config.tablePath}
                    scopes={KANBAN_SCOPES} scope={scope}
                    onScopeChange={(value) => setScope(value === 'assigned_to_me' ? 'assigned_to_me' : 'all')} />
            </QueueFilterBar>
            {!isCrossSiteRole(user?.role) && !user?.siteId && (
                <div className="mx-0 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Akun Anda belum terpasang ke site. Hubungi admin untuk menetapkan site agar tiket dapat ditampilkan.</div>
            )}

            {/* Kanban board (mockup kanban.html): Open / In Progress / Waiting Vendor / Resolved (+ Closed, read only) */}
            <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
                <DragDropContext onDragEnd={onDragEnd}>
                    <section className="kanban-board flex-1 min-w-0" aria-label="Kanban tiket"
                        style={{ gridTemplateColumns: KANBAN_COLUMNS.map((c) => (collapsedColumns.includes(c.id) ? COLLAPSED_COLUMN : OPEN_COLUMN)).join(' ') }}>
                        {KANBAN_COLUMNS.map((column) => {
                            // CLOSED has no column of its own; it is shown (read-only) under Resolved.
                            let columnTickets = filteredTickets.filter(t => t.status === column.id || (column.id === 'RESOLVED' && t.status === 'CLOSED'));

                            if (column.id === 'RESOLVED') {
                                columnTickets = columnTickets.slice(0, 50);
                            }

                            return (
                                <KanbanBoardColumn
                                    key={column.id}
                                    column={column}
                                    tickets={columnTickets}
                                    landedId={landedId}
                                    isCollapsed={collapsedColumns.includes(column.id)}
                                    onToggleCollapse={() => toggleColumn(column.id)}
                                    onCardSelect={setSelectedTicket}
                                    onQuickAssign={handleQuickAssign}
                                    onCardOpen={(ticket) => navigate(`/tickets/${ticket.id}`, { state: { from: '/kanban' } })}
                                />
                            );
                        })}
                    </section>
                </DragDropContext>

                {/* Right Quick Preview Drawer Panel */}
                {selectedTicket && (
                    <TicketPreviewPanel
                        ticket={selectedTicket}
                        agents={agents}
                        onClose={() => setSelectedTicket(null)}
                        onOpenFull={() => navigate(`/tickets/${selectedTicket.id}`, { state: { from: '/kanban' } })}
                        onAssign={(id, reason) => assignMutation.mutate({ id: selectedTicket.id, assigneeId: id, reason })}
                        onStatusChange={(status) => changeStatus(selectedTicket.id, status)}
                        onPriorityChange={(priority) => updatePriorityMutation.mutate({ id: selectedTicket.id, priority })}
                    />
                )}
            </div>
            <p className="kanban-hint"><Hand aria-hidden="true" />Seret kartu ke kolom lain untuk mengubah status, atau buka pratinjau cepat dari menu kartu. Tiket Closed hanya baca.</p>

            {/* PIC takeover confirmation when starting a ticket handled by another agent */}
            {statusTakeover.dialogProps && <ReassignConfirmDialog {...statusTakeover.dialogProps} />}
        </div>
    );
};
