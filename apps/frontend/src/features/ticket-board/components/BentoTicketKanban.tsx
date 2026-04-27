import { useState, useMemo, useCallback } from 'react';
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
    CircleDot,
    CheckCircle2,
    Flame,
    ChevronLeft,
    Eye,
    UserPlus,
    X,
    Maximize2,
    ArrowRight,
    TrendingUp,
    Plus,
    Ticket,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import api from '../../../lib/api';
import { cn } from '@/lib/utils';
import { AgentSelectList } from './AgentSelectList';
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

// Helper function to generate consistent color from name hash
const getAvatarGradient = (name: string): string => {
    if (!name) return 'from-slate-400 to-slate-500';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
        'from-blue-400 to-blue-600',
        'from-purple-400 to-purple-600',
        'from-emerald-400 to-emerald-600',
        'from-rose-400 to-rose-600',
        'from-amber-400 to-amber-600',
        'from-cyan-400 to-cyan-600',
        'from-indigo-400 to-indigo-600',
        'from-pink-400 to-pink-600',
    ];
    return gradients[Math.abs(hash) % gradients.length];
};

// Proper types for messages and attachments
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
    assignedTo?: { id: string; fullName: string };
    user?: { fullName: string; department?: { name: string } };
    messages?: Message[];
    attachments?: Attachment[];
    createdAt: string;
}

interface Agent {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    site?: { code: string; name: string };
}

// SLA warning threshold: 4 hours in milliseconds
const SLA_WARNING_THRESHOLD_MS = 4 * 60 * 60 * 1000;

// Helper function to get column accent color
const getColumnAccentColor = (columnId: string): string => {
    const colors: Record<string, string> = {
        'TODO': '#64748b',        // slate-500
        'IN_PROGRESS': '#3b82f6', // blue-500
        'WAITING_VENDOR': '#f97316', // orange-500
        'RESOLVED': '#22c55e',    // green-500
        'CANCELLED': '#ef4444',   // red-500
    };
    return colors[columnId] || '#64748b';
};

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
            "bg-white dark:bg-slate-800 rounded-xl px-5 py-4 border transition-colors duration-150",
            "hover:shadow-lg hover:-translate-y-0.5",
            active ? "border-primary ring-2 ring-primary/30 shadow-primary/10 shadow-lg" : "border-slate-200 dark:border-slate-700",
            highlight && value > 0 && "border-red-300 dark:border-red-800 animate-pulse"
        )}
    >
        <div className="flex items-center gap-3">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shadow-sm", bgColor)}>
                <Icon className={cn("w-5 h-5", color)} />
            </div>
            <div className="text-left">
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
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

    // Memoize date calculations to avoid creating new Date objects on every render
    const { isOverdue, isApproaching } = useMemo(() => {
        if (!ticket.slaTarget) return { isOverdue: false, isApproaching: false };
        const slaTime = new Date(ticket.slaTarget).getTime();
        const now = Date.now();
        return {
            isOverdue: slaTime < now,
            isApproaching: slaTime >= now && (slaTime - now) < SLA_WARNING_THRESHOLD_MS
        };
    }, [ticket.slaTarget]);

    return (
        <Draggable draggableId={ticket.id} index={index}>
            {(provided: any, snapshot: any) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onMouseEnter={() => setShowActions(true)}
                    onMouseLeave={() => setShowActions(false)}
                    style={{
                        ...provided.draggableProps.style,
                        // Remove any transforms that might cause offset issues
                    }}
                    className={cn(
                        "bg-white dark:bg-slate-800 rounded-xl border transition-[opacity,transform,colors] duration-200 ease-out",
                        "hover:shadow-lg hover:shadow-black/5 cursor-grab group",
                        snapshot.isDragging && "shadow-2xl ring-2 ring-primary/50 cursor-grabbing scale-[1.02]",
                        // Resolved tickets get success border, NOT urgency styling
                        ticket.status === 'RESOLVED' && "border-green-300 dark:border-green-700",
                        // Only show urgency for non-resolved tickets
                        ticket.status !== 'RESOLVED' && isOverdue && "border-red-300 dark:border-red-800 animate-overdue",
                        ticket.status !== 'RESOLVED' && isApproaching && !isOverdue && "border-orange-300 dark:border-orange-800 animate-sla-warning",
                        ticket.status !== 'RESOLVED' && !isOverdue && !isApproaching && "border-slate-200 dark:border-slate-700",
                        ticket.status !== 'RESOLVED' && ticket.priority === 'CRITICAL' && !isOverdue && "animate-critical-pulse ring-2 ring-red-500/20",
                        ticket.status !== 'RESOLVED' && ticket.priority === 'HIGH' && !isOverdue && !isApproaching && "animate-high-priority"
                    )}
                >
                    {/* Priority Bar - Enhanced with gradient */}
                    <div className={cn(
                        "h-1.5 rounded-t-xl bg-gradient-to-r shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]",
                        priorityConfig.barColor,
                        ticket.priority === 'CRITICAL' && "from-red-500 to-red-600 shadow-[0_2px_8px_rgba(239,68,68,0.4)]",
                        ticket.priority === 'HIGH' && "from-orange-400 to-orange-500 shadow-[0_2px_6px_rgba(251,146,60,0.3)]",
                        ticket.priority === 'MEDIUM' && "from-yellow-400 to-yellow-500",
                        ticket.priority === 'LOW' && "from-slate-300 to-slate-400",
                        ticket.status === 'RESOLVED' && "from-green-400 to-green-500"
                    )} />

                    <div className="p-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                </span>
                                {ticket.priority === 'CRITICAL' && (
                                    <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse-red" />
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

                        {/* Title with Quick Preview */}
                        <TicketQuickPreview ticket={ticket} side="right">
                            <h4
                                onClick={onSelect}
                                className="font-semibold text-slate-800 dark:text-white text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors"
                            >
                                {ticket.title}
                            </h4>
                        </TicketQuickPreview>

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
                                    <AlertTriangle className="w-3 h-3 animate-pulse-red" />
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
                                {/* Requester Avatar with dynamic gradient */}
                                <div
                                    className={cn(
                                        "w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-800 shadow-sm",
                                        getAvatarGradient(ticket.user?.fullName || '')
                                    )}
                                    title={ticket.user?.fullName}
                                >
                                    {ticket.user?.fullName?.charAt(0) || '?'}
                                </div>
                                {ticket.assignedTo ? (
                                    <>
                                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                        {/* Assignee Avatar with dynamic gradient */}
                                        <div
                                            className={cn(
                                                "w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-800 shadow-sm",
                                                getAvatarGradient(ticket.assignedTo.fullName)
                                            )}
                                            title={ticket.assignedTo.fullName}
                                        >
                                            {ticket.assignedTo.fullName.charAt(0)}
                                        </div>
                                    </>
                                ) : (
                                    <span className="text-[10px] text-orange-500 dark:text-orange-400 font-medium bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">Unassigned</span>
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
    column: typeof KANBAN_COLUMNS[number];
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
        <div className="flex-1 min-w-[300px] flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden shadow-sm">
            {/* Column Header - Enhanced with accent border using actual color */}
            <div
                className="p-4 bg-white dark:bg-slate-800"
                style={{ borderBottom: `3px solid ${getColumnAccentColor(column.id)}` }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-md", column.columnColor)}>
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-slate-800 dark:text-white">{column.title}</h3>
                            <p className="text-xs text-slate-500 font-medium">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:scale-105"
                        title="Collapse column"
                    >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Cards Area */}
            <Droppable droppableId={column.id}>
                {(provided: any, snapshot: any) => (
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

                        {column.id === 'RESOLVED' && tickets.length === 50 && (
                            <div className="text-center p-2 text-[11px] font-semibold text-slate-400 bg-white dark:bg-slate-800 rounded-xl mt-3 shadow-sm border border-slate-100 dark:border-slate-700">
                                🔒 Showing 50 most recent tickets
                            </div>
                        )}

                        {tickets.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-inner">
                                    <Inbox className="w-8 h-8 opacity-40" />
                                </div>
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">No tickets here</span>
                                <span className="text-xs opacity-70">Drag cards here to update status</span>
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
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [assignPopoverOpen, setAssignPopoverOpen] = useState(false);

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

                    {/* Priority - show static badge if system-locked, otherwise dropdown */}
                    {priorityConfig.isSystemLocked ? (
                        <span className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium", priorityConfig.badgeColor)}>
                            {PriorityIcon && <PriorityIcon className="w-3 h-3" />}
                            {priorityConfig.label}
                        </span>
                    ) : (
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
                                {Object.entries(PRIORITY_CONFIG)
                                    .filter(([, cfg]) => !cfg.isSystemLocked)
                                    .map(([key, cfg]) => {
                                        const PIcon = cfg.icon;
                                        return (
                                            <SelectItem key={key} value={key}>
                                                <span className="flex items-center gap-1.5">
                                                    {PIcon && <PIcon className="w-3 h-3" />}
                                                    {cfg.label}
                                                </span>
                                            </SelectItem>
                                        );
                                    })
                                }
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Assignee */}
                <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Assigned To</label>
                    <Popover open={assignPopoverOpen} onOpenChange={setAssignPopoverOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="h-9 w-full flex items-center gap-2 px-3 text-sm border border-[hsl(var(--border))] rounded-md bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                {ticket.assignedTo ? (
                                    <span className="flex-1 text-left font-medium">{ticket.assignedTo.fullName}</span>
                                ) : (
                                    <span className="flex-1 text-left text-slate-400">Unassigned</span>
                                )}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-72" align="start">
                            <AgentSelectList
                                agents={agents}
                                selectedId={ticket.assignedTo?.id}
                                isAdmin={isAdmin}
                                onSelect={(agentId) => {
                                    onAssign(agentId);
                                    setAssignPopoverOpen(false);
                                }}
                            />
                        </PopoverContent>
                    </Popover>
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

    const isAdmin = user?.role === 'ADMIN';
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
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
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['tickets'] });

            // Snapshot the previous value
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets']);

            // Optimistically update to the new value
            queryClient.setQueryData<Ticket[]>(['tickets'], (old) =>
                old?.map(t => t.id === id ? { ...t, status: status as Ticket['status'] } : t) ?? []
            );

            // Update selected ticket if it's the one being moved
            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, status: status as Ticket['status'] } : null);
            }

            // Return context with the snapshotted value
            return { previousTickets };
        },
        onError: (_, __, context) => {
            // Rollback on error
            queryClient.setQueryData(['tickets'], context?.previousTickets);
            toast.error('Failed to update status');
        },
        onSettled: () => {
            // Always refetch after error or success to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Status updated'),
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
            await api.patch(`/tickets/${id}/priority`, { priority });
        },
        onMutate: async ({ id, priority }) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets']);

            queryClient.setQueryData<Ticket[]>(['tickets'], (old) =>
                old?.map(t => t.id === id ? { ...t, priority: priority as Ticket['priority'] } : t) ?? []
            );

            // Update selected ticket if it's the one being modified
            if (selectedTicket?.id === id) {
                setSelectedTicket(prev => prev ? { ...prev, priority: priority as Ticket['priority'] } : null);
            }

            return { previousTickets };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['tickets'], context?.previousTickets);
            toast.error('Failed to update priority');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Priority updated'),
    });

    const assignMutation = useMutation({
        mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string }) => {
            await api.patch(`/tickets/${id}/assign`, { assigneeId });
        },
        onMutate: async ({ id, assigneeId }) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ['tickets'] });
            const previousTickets = queryClient.getQueryData<Ticket[]>(['tickets']);
            const assignee = agents.find(a => a.id === assigneeId);

            queryClient.setQueryData<Ticket[]>(['tickets'], (old) =>
                old?.map(t => t.id === id ? { ...t, assignedTo: assignee } : t) ?? []
            );

            // Update selected ticket if it's the one being assigned
            if (selectedTicket?.id === id && assignee) {
                setSelectedTicket(prev => prev ? { ...prev, assignedTo: assignee } : null);
            }

            return { previousTickets };
        },
        onError: (_, __, context) => {
            queryClient.setQueryData(['tickets'], context?.previousTickets);
            toast.error('Failed to assign');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onSuccess: () => toast.success('Ticket assigned'),
    });

    const filteredTickets = useMemo(() => {
        let result = tickets;
        if (filter === 'my') result = result.filter(t => t.assignedTo?.id === user?.id);
        if (filter === 'overdue') result = result.filter(t => t.isOverdue);
        if (filter === 'critical') result = result.filter(t => t.priority === 'CRITICAL');
        return result;
    }, [tickets, filter, user]);

    // Single-pass stats computation - O(n) instead of O(6n)
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

    // Use imported skeleton component instead of defining inline
    if (isLoading) {
        return <KanbanBoardSkeleton />;
    }

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Ticket className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Kanban Board</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Drag and drop to update status</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* New Ticket Button - Enhanced with gradient */}
                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary via-primary to-primary/90 text-slate-900 rounded-xl font-semibold hover:from-primary/90 hover:to-primary transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-0.5 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Ticket</span>
                    </button>

                    {/* Quick Filters - Enhanced with active ring and better transitions */}
                    <div className="hidden md:flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            onClick={() => setFilter('all')}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-lg transition-colors duration-150",
                                filter === 'all'
                                    ? "bg-primary/10 text-primary font-semibold ring-2 ring-primary/20 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('my')}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-lg transition-colors duration-150 flex items-center gap-1",
                                filter === 'my'
                                    ? "bg-primary/10 text-primary font-semibold ring-2 ring-primary/20 shadow-sm"
                                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                            )}
                        >
                            <UserCheck className="w-3 h-3" />
                            My Tasks
                        </button>
                        <button
                            onClick={() => setFilter('overdue')}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-lg transition-colors duration-150 flex items-center gap-1",
                                filter === 'overdue'
                                    ? "bg-red-100 text-red-600 font-semibold ring-2 ring-red-200 shadow-sm dark:bg-red-900/30 dark:ring-red-800"
                                    : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            )}
                        >
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                            {stats.overdue > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                                    {stats.overdue}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setFilter('critical')}
                            className={cn(
                                "px-3 py-1.5 text-xs rounded-lg transition-colors duration-150 flex items-center gap-1",
                                filter === 'critical'
                                    ? "bg-red-100 text-red-600 font-semibold ring-2 ring-red-200 shadow-sm dark:bg-red-900/30 dark:ring-red-800"
                                    : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            )}
                        >
                            <Flame className="w-3 h-3" />
                            Critical
                            {stats.critical > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                                    {stats.critical}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* View Toggle */}
                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-medium"
                            title="Kanban Board"
                        >
                            <Columns3 className="w-4 h-4" />
                            <span className="text-xs font-medium hidden md:inline">Kanban</span>
                        </button>
                        <button
                            onClick={() => navigate('/tickets/list')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-primary rounded-lg transition-colors"
                            title="Table View"
                        >
                            <TableProperties className="w-4 h-4" />
                            <span className="text-xs font-medium hidden md:inline">Table</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-slate-600 dark:text-slate-300" bgColor="bg-slate-100 dark:bg-slate-700" />
                <StatsCard icon={Inbox} label="Open" value={stats.open} color="text-blue-600 dark:text-blue-400" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                <StatsCard icon={CircleDot} label="In Progress" value={stats.inProgress} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-100 dark:bg-amber-900/30" />
                <StatsCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="text-green-600 dark:text-green-400" bgColor="bg-green-100 dark:bg-green-900/30" />
                <StatsCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="text-red-600 dark:text-red-400" bgColor="bg-red-100 dark:bg-red-900/30" highlight onClick={() => setFilter('overdue')} active={filter === 'overdue'} />
                <StatsCard icon={Flame} label="Critical" value={stats.critical} color="text-red-600 dark:text-red-400" bgColor="bg-red-100 dark:bg-red-900/30" highlight onClick={() => setFilter('critical')} active={filter === 'critical'} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Kanban Columns */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
                        {KANBAN_COLUMNS.map((column) => {
                            let columnTickets = filteredTickets.filter(t => t.status === column.id);

                            // Prevent DOM Overload: Limit Resolved array length
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
                                />
                            );
                        })}
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
