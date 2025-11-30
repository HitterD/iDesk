import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    LayoutGrid,
    List,
    UserCheck,
    Search,
    Clock,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    MessageSquare,
    X,
    ChevronRight,
    Inbox,
    TrendingUp,
    Flame,
    Calendar
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { toast } from 'sonner';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Agent } from '../components/ticket-detail/types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { format } from 'date-fns';

interface Ticket {
    id: string;
    ticketNumber?: string;
    title: string;
    description: string;
    category: string;
    status: 'TODO' | 'IN_PROGRESS' | 'WAITING_VENDOR' | 'RESOLVED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source: 'WEB' | 'TELEGRAM' | 'EMAIL';
    isOverdue: boolean;
    slaTarget?: string;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    createdAt: string;
    updatedAt: string;
    user: {
        fullName: string;
        role: string;
        email?: string;
        department?: {
            name: string;
        };
    };
    messages?: any[];
}

const StatsCard: React.FC<{
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bgColor: string;
    highlight?: boolean;
}> = ({ icon: Icon, label, value, color, bgColor, highlight }) => (
    <div className={cn(
        "bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700",
        "hover:shadow-lg transition-all duration-300",
        highlight && value > 0 && "ring-2 ring-red-500/50 border-red-300 dark:border-red-800"
    )}>
        <div className="flex items-center gap-3">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bgColor)}>
                <Icon className={cn("w-6 h-6", color)} />
            </div>
            <div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            </div>
        </div>
    </div>
);

const PriorityDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.MEDIUM;
    const Icon = config.icon;

    if (disabled) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", config.badgeColor)}>
                {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                <span className={cn("w-2 h-2 rounded-full", config.dot)} />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 border-0 text-xs font-medium px-2 gap-1", config.badgeColor)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1">
                        {Icon && <Icon className={cn("w-3 h-3", config.iconClass)} />}
                        <span className={cn("w-2 h-2 rounded-full", config.dot)} />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => {
                    const PIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                {PIcon && <PIcon className={cn("w-3 h-3", cfg.iconClass)} />}
                                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

const StatusDropdown: React.FC<{
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
    const config = STATUS_CONFIG[value] || STATUS_CONFIG.TODO;
    const Icon = config.icon;

    if (disabled) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", config.color)}>
                <Icon className="w-3 h-3" />
                {config.label}
            </span>
        );
    }

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn("h-7 w-auto min-w-0 border-0 text-xs font-medium px-2 gap-1", config.color)}>
                <SelectValue>
                    <span className="inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {Object.entries(STATUS_CONFIG).filter(([key]) => key !== 'CANCELLED').map(([key, cfg]) => {
                    const SIcon = cfg.icon;
                    return (
                        <SelectItem key={key} value={key}>
                            <span className="inline-flex items-center gap-1.5">
                                <SIcon className="w-3 h-3" />
                                {cfg.label}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

const TargetDateCell: React.FC<{ slaTarget?: string; status: string }> = ({ slaTarget, status }) => {
    if (!slaTarget || status === 'RESOLVED' || status === 'CANCELLED') {
        return <span className="text-xs text-slate-400">-</span>;
    }

    const target = new Date(slaTarget);
    const now = new Date();
    const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

    const isOverdue = diffHours < 0;
    const isApproaching = diffHours > 0 && diffHours <= 4;

    return (
        <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
            isOverdue && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            isApproaching && !isOverdue && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
            !isOverdue && !isApproaching && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        )}>
            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />}
            {isApproaching && !isOverdue && <Clock className="w-3.5 h-3.5" />}
            {!isOverdue && !isApproaching && <Calendar className="w-3.5 h-3.5" />}
            <span>{format(target, 'dd MMM HH:mm')}</span>
            {isOverdue && <span className="text-[10px]">(Overdue)</span>}
        </div>
    );
};

export const BentoTicketListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const handleNewTicket = useCallback((ticket: any) => {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            toast.info('New Ticket', {
                description: `${ticket.ticketNumber || ''}: ${ticket.title}`,
                action: {
                    label: 'View',
                    onClick: () => navigate(`/tickets/${ticket.id}`),
                },
                duration: 8000,
            });
        }
    }, [user, navigate]);

    useTicketListSocket({ onNewTicket: handleNewTicket });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';

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

    const assignTicketMutation = useMutation({
        mutationFn: async ({ ticketId, assigneeId }: { ticketId: string; assigneeId: string }) => {
            await api.patch(`/tickets/${ticketId}/assign`, { assigneeId });
        },
        onSuccess: () => {
            toast.success('Ticket assigned successfully');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to assign ticket');
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
            await api.patch(`/tickets/${ticketId}/status`, { status });
        },
        onSuccess: () => {
            toast.success('Status updated');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to update status');
        },
    });

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ ticketId, priority }: { ticketId: string; priority: string }) => {
            await api.patch(`/tickets/${ticketId}/priority`, { priority });
        },
        onSuccess: () => {
            toast.success('Priority updated');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        },
        onError: () => {
            toast.error('Failed to update priority');
        },
    });

    const filteredTickets = useMemo(() => {
        let result = tickets;

        if (showAssignedToMe) {
            result = result.filter((t) => t.assignedTo?.id === user?.id);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter((t) =>
                t.title.toLowerCase().includes(query) ||
                t.ticketNumber?.toLowerCase().includes(query) ||
                t.user?.fullName.toLowerCase().includes(query) ||
                t.category?.toLowerCase().includes(query)
            );
        }

        if (statusFilter) {
            result = result.filter((t) => t.status === statusFilter);
        }

        if (priorityFilter) {
            result = result.filter((t) => t.priority === priorityFilter);
        }

        return result;
    }, [tickets, showAssignedToMe, user, searchQuery, statusFilter, priorityFilter]);

    const stats = useMemo(() => ({
        total: tickets.length,
        open: tickets.filter((t) => t.status === 'TODO').length,
        inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
        resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        overdue: tickets.filter((t) => t.isOverdue).length,
        critical: tickets.filter((t) => t.priority === 'CRITICAL').length,
    }), [tickets]);

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPriorityFilter('');
        setSearchParams({});
    };

    const hasActiveFilters = searchQuery || statusFilter || priorityFilter || showAssignedToMe;
    const canEdit = user?.role === 'ADMIN' || user?.role === 'AGENT';

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">All Tickets</h1>
                    <p className="text-slate-500 dark:text-slate-400">View and manage all support requests</p>
                </div>
                <div className="flex gap-3">
                    {canEdit && (
                        <button
                            onClick={() => {
                                if (showAssignedToMe) {
                                    setSearchParams({});
                                } else {
                                    setSearchParams({ filter: 'assigned_to_me' });
                                }
                            }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 border rounded-2xl transition-colors shadow-sm",
                                showAssignedToMe
                                    ? 'bg-primary text-slate-900 border-primary font-bold'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                            )}
                        >
                            <UserCheck className="w-4 h-4" />
                            My Tasks
                        </button>
                    )}
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <button
                            onClick={() => navigate('/kanban')}
                            className="p-2 text-slate-400 hover:text-primary rounded-xl transition-colors"
                            title="Kanban View"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            className="p-2 bg-primary/10 text-primary rounded-xl"
                            title="List View"
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Dashboard Style */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-blue-600" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                <StatsCard icon={Inbox} label="Open" value={stats.open} color="text-slate-600" bgColor="bg-slate-100 dark:bg-slate-700" />
                <StatsCard icon={CircleDot} label="In Progress" value={stats.inProgress} color="text-blue-600" bgColor="bg-blue-100 dark:bg-blue-900/30" />
                <StatsCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="text-green-600" bgColor="bg-green-100 dark:bg-green-900/30" />
                <StatsCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="text-red-600" bgColor="bg-red-100 dark:bg-red-900/30" highlight />
                <StatsCard icon={Flame} label="Critical" value={stats.critical} color="text-red-600" bgColor="bg-red-100 dark:bg-red-900/30" highlight />
            </div>

            {/* Search & Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[250px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tickets by title, ID, requester..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">All Status</option>
                        <option value="TODO">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_VENDOR">Waiting Vendor</option>
                        <option value="RESOLVED">Resolved</option>
                    </select>
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                        <option value="">All Priority</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                    </select>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-2 px-4 py-3 text-slate-500 hover:text-red-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Tickets List Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filteredTickets.length === 0 ? (
                    <div className="p-12 text-center">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No tickets found</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden lg:flex items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <div className="flex-[3] min-w-0">Ticket</div>
                            <div className="w-28 shrink-0">Priority</div>
                            <div className="w-36 shrink-0">Status</div>
                            <div className="flex-[2] min-w-0">Requester</div>
                            <div className="flex-[2] min-w-0">Assigned To</div>
                            <div className="flex-[2] min-w-0">Target Date</div>
                            <div className="w-20 shrink-0">Created</div>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredTickets.map((ticket) => {
                                const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                                const PriorityIcon = priorityConfig.icon;

                                return (
                                    <div
                                        key={ticket.id}
                                        className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                    >
                                        {/* Ticket Info */}
                                        <div className="flex-[3] flex items-center gap-3 min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <div className={cn("w-1 h-12 rounded-full shrink-0", priorityConfig.barColor)} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-mono text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                    </span>
                                                    {ticket.isOverdue && (
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    )}
                                                    {ticket.priority === 'CRITICAL' && (
                                                        <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                                                    )}
                                                </div>
                                                <h3 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">
                                                    {ticket.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Priority Dropdown */}
                                        <div className="w-28 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <PriorityDropdown
                                                value={ticket.priority}
                                                onChange={(value) => updatePriorityMutation.mutate({ ticketId: ticket.id, priority: value })}
                                                disabled={!canEdit}
                                            />
                                        </div>

                                        {/* Status Dropdown */}
                                        <div className="w-36 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <StatusDropdown
                                                value={ticket.status}
                                                onChange={(value) => updateStatusMutation.mutate({ ticketId: ticket.id, status: value })}
                                                disabled={!canEdit}
                                            />
                                        </div>

                                        {/* Requester */}
                                        <div className="flex-[2] flex items-center gap-2 min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <UserAvatar 
                                                user={{ fullName: ticket.user?.fullName }} 
                                                size="sm" 
                                            />
                                            <div className="min-w-0 hidden md:block">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ticket.user?.fullName || 'Unknown'}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{ticket.user?.department?.name || '-'}</p>
                                            </div>
                                        </div>

                                        {/* Assigned To Dropdown */}
                                        <div className="flex-[2] min-w-0" onClick={(e) => e.stopPropagation()}>
                                            {canEdit ? (
                                                <Select
                                                    value={ticket.assignedTo?.id || "unassigned"}
                                                    onValueChange={(value) => {
                                                        if (value && value !== "unassigned") {
                                                            assignTicketMutation.mutate({ ticketId: ticket.id, assigneeId: value });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 w-full text-xs bg-transparent border-slate-200 dark:border-slate-700">
                                                        <SelectValue placeholder="Unassigned" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                                        {agents.map((agent) => (
                                                            <SelectItem key={agent.id} value={agent.id}>
                                                                {agent.fullName}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {ticket.assignedTo ? (
                                                        <>
                                                            <UserAvatar 
                                                                user={ticket.assignedTo} 
                                                                size="xs" 
                                                            />
                                                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                                {ticket.assignedTo.fullName}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Target Date */}
                                        <div className="flex-[2] min-w-0" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <TargetDateCell slaTarget={ticket.slaTarget} status={ticket.status} />
                                        </div>

                                        {/* Created Date & Actions */}
                                        <div className="w-20 shrink-0 flex items-center justify-between gap-1" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                                <span>{format(new Date(ticket.createdAt), 'dd MMM')}</span>
                                                {ticket.messages && ticket.messages.length > 0 && (
                                                    <span className="flex items-center gap-0.5">
                                                        <MessageSquare className="w-3 h-3" />
                                                        {ticket.messages.length}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Results Count */}
            {filteredTickets.length > 0 && (
                <div className="text-center text-sm text-slate-400">
                    Showing {filteredTickets.length} of {tickets.length} tickets
                </div>
            )}
        </div>
    );
};
