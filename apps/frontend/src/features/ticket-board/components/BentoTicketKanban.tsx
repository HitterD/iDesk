import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
    MessageSquare,
    Clock,
    AlertTriangle,
    Tag,
    UserCheck,
    LayoutGrid,
    List,
    Inbox,
    CircleDot,
    Hourglass,
    CheckCircle2,
    Flame,
    ChevronLeft,
    ChevronRight,
    Eye,
    UserPlus,
    X,
    Maximize2,
    ArrowRight,
    Paperclip,
    TrendingUp,
    Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { STATUS_CONFIG, PRIORITY_CONFIG, KANBAN_COLUMNS } from '@/lib/constants/ticket.constants';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description?: string;
    category?: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isOverdue?: boolean;
    slaTarget?: string;
    assignedTo?: { id: string; fullName: string };
    user?: { fullName: string; department?: { name: string } };
    messages?: any[];
    attachments?: any[];
    createdAt: string;
}

interface Agent {
    id: string;
    fullName: string;
}

const StatsCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bgColor: string;
    highlight?: boolean;
    onClick?: () => void;
    active?: boolean;
}> = ({ icon: Icon, label, value, color, bgColor, highlight, onClick, active }) => (
    <button
        onClick={onClick}
        className={cn(
            "bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border transition-all duration-200",
            "hover:shadow-md",
            active ? "border-primary ring-2 ring-primary/30" : "border-slate-200 dark:border-slate-700",
            highlight && value > 0 && "border-red-300 dark:border-red-800"
        )}
    >
        <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bgColor)}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
            <div className="text-left">
                <p className={cn("text-xl font-bold", color)}>{value}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
            </div>
        </div>
    </button>
);

const EnhancedKanbanCard: React.FC<{
    ticket: Ticket;
    index: number;
    onSelect: () => void;
    onQuickAssign: () => void;
}> = ({ ticket, index, onSelect, onQuickAssign }) => {
    const [showActions, setShowActions] = useState(false);
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConfig.icon;

    const isOverdue = ticket.slaTarget && new Date(ticket.slaTarget) < new Date();
    const isApproaching = ticket.slaTarget && !isOverdue &&
        (new Date(ticket.slaTarget).getTime() - Date.now()) < 4 * 60 * 60 * 1000;

    return (
        <Draggable draggableId={ticket.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                    className={cn(
                        "bg-white dark:bg-slate-800 rounded-xl border transition-all duration-200",
                        "hover:shadow-lg cursor-pointer group",
                        snapshot.isDragging && "shadow-2xl rotate-1 scale-105 z-50",
                        isOverdue && "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
                        isApproaching && !isOverdue && "border-orange-300 dark:border-orange-800",
                        !isOverdue && !isApproaching && "border-slate-200 dark:border-slate-700"
                    )}
                >
                    {/* Priority Bar */}
                    <div className={cn("h-1 rounded-t-xl", priorityConfig.barColor)} />

                    <div className="p-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                </span>
                                {ticket.priority === 'CRITICAL' && (
                                    <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className={cn(
                                "flex items-center gap-0.5 transition-opacity",
                                showActions ? "opacity-100" : "opacity-0"
                            )}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                    title="View Details"
                                >
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onQuickAssign(); }}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                    title="Assign"
                                >
                                    <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Title */}
                        <h4
                            onClick={onSelect}
                            className="font-semibold text-slate-800 dark:text-white text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                        >
                            {ticket.title}
                        </h4>

                        {/* Category & Priority */}
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {ticket.category && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500">
                                    {ticket.category}
                                </span>
                            )}
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1",
                                priorityConfig.badgeColor
                            )}>
                                {PriorityIcon && <PriorityIcon className="w-2.5 h-2.5" />}
                                {priorityConfig.label}
                            </span>
                        </div>

                        {/* SLA Target */}
                        {ticket.slaTarget && ticket.status !== 'RESOLVED' && (
                            <div className={cn(
                                "flex items-center gap-1.5 text-[10px] mb-2 px-2 py-1 rounded",
                                isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                isApproaching && !isOverdue && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                                !isOverdue && !isApproaching && "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            )}>
                                {isOverdue ? (
                                    <AlertTriangle className="w-3 h-3 animate-pulse" />
                                ) : (
                                    <Clock className="w-3 h-3" />
                                )}
                                <span className="font-medium">
                                    {isOverdue ? 'Overdue' : format(new Date(ticket.slaTarget), 'dd MMM HH:mm')}
                                </span>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-1.5">
                                <div
                                    className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[9px] font-bold text-primary"
                                    title={ticket.user?.fullName}
                                >
                                    {ticket.user?.fullName?.charAt(0) || '?'}
                                </div>
                                {ticket.assignedTo ? (
                                    <>
                                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                        <div
                                            className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-[9px] font-bold text-green-600"
                                            title={ticket.assignedTo.fullName}
                                        >
                                            {ticket.assignedTo.fullName.charAt(0)}
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-slate-400">
                                {ticket.messages && ticket.messages.length > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px]">
                                        <MessageSquare className="w-3 h-3" />
                                        {ticket.messages.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    );
};

const KanbanColumn: React.FC<{
    column: typeof KANBAN_COLUMNS[0];
    tickets: Ticket[];
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onCardSelect: (ticket: Ticket) => void;
    onQuickAssign: (ticketId: string) => void;
}> = ({ column, tickets, isCollapsed, onToggleCollapse, onCardSelect, onQuickAssign }) => {
    const Icon = column.icon;

    if (isCollapsed) {
        return (
            <div
                className="w-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center py-4 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                onClick={onToggleCollapse}
            >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", column.columnColor)}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="[writing-mode:vertical-rl] text-xs font-bold text-slate-500 dark:text-slate-400 rotate-180">
                    {column.title}
                </span>
                <span className="mt-3 bg-white dark:bg-slate-700 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm">
                    {tickets.length}
                </span>
            </div>
        );
    }

    return (
        <div className="flex-1 min-w-[280px] flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden">
            {/* Column Header */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", column.columnColor)}>
                            <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-800 dark:text-white">{column.title}</h3>
                            <p className="text-[10px] text-slate-500">{tickets.length} tickets</p>
                        </div>
                    </div>
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Collapse"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Cards Area */}
            <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                            "flex-1 overflow-y-auto p-2 space-y-2",
                            snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
                        )}
                    >
                        {tickets.map((ticket, index) => (
                            <EnhancedKanbanCard
                                key={ticket.id}
                                ticket={ticket}
                                index={index}
                                onSelect={() => onCardSelect(ticket)}
                                onQuickAssign={() => onQuickAssign(ticket.id)}
                            />
                        ))}
                        {provided.placeholder}

                        {tickets.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                <Inbox className="w-10 h-10 mb-2 opacity-50" />
                                <span className="text-xs">No tickets</span>
                                <span className="text-[10px]">Drag here</span>
                            </div>
                        )}
                    </div>
                )}
            </Droppable>
        </div>
    );
};

const TicketPreviewPanel: React.FC<{
    ticket: Ticket;
    agents: Agent[];
    onClose: () => void;
    onOpenFull: () => void;
    onAssign: (assigneeId: string) => void;
    onStatusChange: (status: string) => void;
    onPriorityChange: (priority: string) => void;
}> = ({ ticket, agents, onClose, onOpenFull, onAssign, onStatusChange, onPriorityChange }) => {
    const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
    const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const StatusIcon = statusConfig.icon;
    const PriorityIcon = priorityConfig.icon;

    return (
        <div className="w-[380px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-slate-500">#{ticket.ticketNumber}</span>
                    {ticket.priority === 'CRITICAL' && (
                        <Flame className="w-4 h-4 text-red-500 animate-pulse" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onOpenFull}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                        title="Open Full View"
                    >
                        <Maximize2 className="w-4 h-4 text-slate-400" />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {ticket.title}
                </h2>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                    <Select value={ticket.status} onValueChange={onStatusChange}>
                        <SelectTrigger className={cn("h-8 w-[130px] border-0 text-xs", statusConfig.color)}>
                            <SelectValue>
                                <span className="flex items-center gap-1.5">
                                    <StatusIcon className="w-3 h-3" />
                                    {statusConfig.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'CANCELLED').map(([key, cfg]) => {
                                const SIcon = cfg.icon;
                                return (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-1.5">
                                            <SIcon className="w-3 h-3" />
                                            {cfg.label}
                                        </span>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>

                    <Select value={ticket.priority} onValueChange={onPriorityChange}>
                        <SelectTrigger className={cn("h-8 w-[110px] border-0 text-xs", priorityConfig.badgeColor)}>
                            <SelectValue>
                                <span className="flex items-center gap-1.5">
                                    {PriorityIcon && <PriorityIcon className="w-3 h-3" />}
                                    {priorityConfig.label}
                                </span>
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
                                const PIcon = cfg.icon;
                                return (
                                    <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-1.5">
                                            {PIcon && <PIcon className="w-3 h-3" />}
                                            {cfg.label}
                                        </span>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>

                {/* Assignee */}
                <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Assigned To</label>
                    <Select value={ticket.assignedTo?.id || "unassigned"} onValueChange={(v) => v !== "unassigned" && onAssign(v)}>
                        <SelectTrigger className="h-9 w-full text-sm">
                            <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {agents.map((agent) => (
                                <SelectItem key={agent.id} value={agent.id}>{agent.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-slate-500">Requester</p>
                        <p className="font-medium text-slate-800 dark:text-white">{ticket.user?.fullName}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Category</p>
                        <p className="font-medium text-slate-800 dark:text-white">{ticket.category || '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Created</p>
                        <p className="font-medium text-slate-800 dark:text-white">{format(new Date(ticket.createdAt), 'dd MMM yyyy')}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Target</p>
                        <p className={cn("font-medium", ticket.isOverdue ? "text-red-500" : "text-slate-800 dark:text-white")}>
                            {ticket.slaTarget ? format(new Date(ticket.slaTarget), 'dd MMM HH:mm') : '-'}
                        </p>
                    </div>
                </div>

                {/* Description */}
                {ticket.description && (
                    <div>
                        <p className="text-xs text-slate-500 mb-1">Description</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {ticket.description}
                        </p>
                    </div>
                )}

                {/* Messages Preview */}
                {ticket.messages && ticket.messages.length > 0 && (
                    <div>
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {ticket.messages.length} messages
                        </p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={onOpenFull}
                    className="w-full py-2.5 bg-primary text-slate-900 font-medium rounded-xl hover:bg-primary/90 transition-colors"
                >
                    Open Full Details
                </button>
            </div>
        </div>
    );
};

export const BentoTicketKanban = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filter, setFilter] = useState<'all' | 'my' | 'overdue' | 'critical'>('all');

    const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
        queryKey: ['tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets');
            return res.data;
        },
    });

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            await api.patch(`/tickets/${id}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast.success('Status updated');
        },
        onError: () => toast.error('Failed to update status'),
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
            await api.patch(`/tickets/${id}/priority`, { priority });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast.success('Priority updated');
        },
        onError: () => toast.error('Failed to update priority'),
    });

    const assignMutation = useMutation({
        mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string }) => {
            await api.patch(`/tickets/${id}/assign`, { assigneeId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            toast.success('Ticket assigned');
        },
        onError: () => toast.error('Failed to assign'),
    });

    const filteredTickets = useMemo(() => {
        let result = tickets;
        if (filter === 'my') result = result.filter(t => t.assignedTo?.id === user?.id);
        if (filter === 'overdue') result = result.filter(t => t.isOverdue);
        if (filter === 'critical') result = result.filter(t => t.priority === 'CRITICAL');
        return result;
    }, [tickets, filter, user]);

    const stats = useMemo(() => ({
        total: tickets.length,
        open: tickets.filter(t => t.status === 'TODO').length,
        inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
        resolved: tickets.filter(t => t.status === 'RESOLVED').length,
        overdue: tickets.filter(t => t.isOverdue).length,
        critical: tickets.filter(t => t.priority === 'CRITICAL').length,
    }), [tickets]);

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
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ticket Board</h1>
                        <p className="text-sm text-slate-500">Drag and drop to update status</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Quick Filters */}
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button
                                onClick={() => setFilter('all')}
                                className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors", filter === 'all' ? "bg-white dark:bg-slate-700 shadow-sm font-medium" : "text-slate-500 hover:text-slate-800")}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setFilter('my')}
                                className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors", filter === 'my' ? "bg-white dark:bg-slate-700 shadow-sm font-medium" : "text-slate-500 hover:text-slate-800")}
                            >
                                My Tasks
                            </button>
                            <button
                                onClick={() => setFilter('overdue')}
                                className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1", filter === 'overdue' ? "bg-red-100 text-red-600 font-medium" : "text-red-500 hover:bg-red-50")}
                            >
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                            </button>
                            <button
                                onClick={() => setFilter('critical')}
                                className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1", filter === 'critical' ? "bg-red-100 text-red-600 font-medium" : "text-red-500 hover:bg-red-50")}
                            >
                                <Flame className="w-3 h-3" />
                                Critical
                            </button>
                        </div>

                        {/* View Toggle */}
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button className="p-2 bg-white dark:bg-slate-700 text-primary rounded-lg shadow-sm">
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button onClick={() => navigate('/tickets/list')} className="p-2 text-slate-400 hover:text-primary rounded-lg">
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-6 gap-3">
                    <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-blue-600" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                    <StatsCard icon={Inbox} label="Open" value={stats.open} color="text-slate-600" bgColor="bg-slate-100 dark:bg-slate-700" />
                    <StatsCard icon={CircleDot} label="In Progress" value={stats.inProgress} color="text-blue-600" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                    <StatsCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="text-green-600" bgColor="bg-green-100 dark:bg-green-900/30" />
                    <StatsCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="text-red-600" bgColor="bg-red-100 dark:bg-red-900/30" highlight onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
                    <StatsCard icon={Flame} label="Critical" value={stats.critical} color="text-red-600" bgColor="bg-red-100 dark:bg-red-900/30" highlight onClick={() => setFilter('critical')} active={filter === 'critical'} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Kanban Columns */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
                        {KANBAN_COLUMNS.map((column) => (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                tickets={filteredTickets.filter(t => t.status === column.id)}
                                isCollapsed={collapsedColumns.includes(column.id)}
                                onToggleCollapse={() => toggleColumn(column.id)}
                                onCardSelect={setSelectedTicket}
                                onQuickAssign={handleQuickAssign}
                            />
                        ))}
                    </div>
                </DragDropContext>

                {/* Preview Panel */}
                {selectedTicket && (
                    <TicketPreviewPanel
                        ticket={selectedTicket}
                        agents={agents}
                        onClose={() => setSelectedTicket(null)}
                        onOpenFull={() => navigate(`/tickets/${selectedTicket.id}`)}
                        onAssign={(id) => assignMutation.mutate({ id: selectedTicket.id, assigneeId: id })}
                        onStatusChange={(status) => updateStatusMutation.mutate({ id: selectedTicket.id, status })}
                        onPriorityChange={(priority) => updatePriorityMutation.mutate({ id: selectedTicket.id, priority })}
                    />
                )}
            </div>
        </div>
    );
};
