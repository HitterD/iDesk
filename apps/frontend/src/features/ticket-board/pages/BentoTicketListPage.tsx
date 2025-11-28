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
    Hourglass,
    MessageSquare,
    Tag,
    X,
    ChevronRight,
    Inbox,
    TrendingUp
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
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
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Agent } from '../components/ticket-detail/types';

// Data Type
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

const STATUS_CONFIG = {
    TODO: { label: 'Open', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: Inbox },
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: CircleDot },
    WAITING_VENDOR: { label: 'Waiting', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', icon: Hourglass },
    RESOLVED: { label: 'Resolved', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const PRIORITY_CONFIG = {
    LOW: { label: 'Low', color: 'text-slate-400 bg-slate-50 dark:bg-slate-800', dot: 'bg-slate-400' },
    MEDIUM: { label: 'Medium', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500' },
    HIGH: { label: 'High', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-500' },
    CRITICAL: { label: 'Critical', color: 'text-red-600 bg-red-50 dark:bg-red-900/20', dot: 'bg-red-500 animate-pulse' },
};

export const BentoTicketListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();

    // Handle new ticket notification for admins/agents
    const handleNewTicket = useCallback((ticket: any) => {
        // Only show toast for admins/agents
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            toast.info('🎫 New Ticket', {
                description: `${ticket.ticketNumber || ''}: ${ticket.title}`,
                action: {
                    label: 'View',
                    onClick: () => navigate(`/tickets/${ticket.id}`),
                },
                duration: 8000,
            });
        }
    }, [user, navigate]);

    // Real-time updates for ticket list with new ticket notification
    useTicketListSocket({ onNewTicket: handleNewTicket });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';

    const queryClient = useQueryClient();
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
        },
        onError: () => {
            toast.error('Failed to assign ticket');
        },
    });

    // Filter tickets
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

    // Stats
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
                    {(user?.role === 'ADMIN' || user?.role === 'AGENT') && (
                        <button
                            onClick={() => {
                                if (showAssignedToMe) {
                                    setSearchParams({});
                                } else {
                                    setSearchParams({ filter: 'assigned_to_me' });
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-2xl transition-colors shadow-sm ${showAssignedToMe
                                ? 'bg-primary text-slate-900 border-primary font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
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

            {/* Stats Cards */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                    { icon: TrendingUp, label: 'Total', value: stats.total, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { icon: Inbox, label: 'Open', value: stats.open, color: 'text-slate-400', bg: 'bg-slate-500/10' },
                    { icon: CircleDot, label: 'In Progress', value: stats.inProgress, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                    { icon: CheckCircle2, label: 'Resolved', value: stats.resolved, color: 'text-green-400', bg: 'bg-green-500/10' },
                    { icon: AlertTriangle, label: 'Overdue', value: stats.overdue, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { icon: Clock, label: 'Critical', value: stats.critical, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-2xl font-bold ${stat.color} leading-none`}>{stat.value}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search & Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
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

            {/* Tickets List - Compact Table Style */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                {filteredTickets.length === 0 ? (
                    <div className="p-12 text-center">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">No tickets found</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                            <div className="col-span-3">Ticket</div>
                            <div className="col-span-2">Requester</div>
                            <div className="col-span-1">Status</div>
                            <div className="col-span-2">Assigned</div>
                            <div className="col-span-2">Target Date</div>
                            <div className="col-span-2">Date</div>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredTickets.map((ticket) => {
                                const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                                const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                                const StatusIcon = statusConfig.icon;

                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                                        className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group items-center"
                                    >
                                        {/* Ticket Info */}
                                        <div className="col-span-3 flex items-center gap-3 min-w-0">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityConfig.dot}`}></div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-mono text-[11px] text-slate-400">
                                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityConfig.color}`}>
                                                        {priorityConfig.label}
                                                    </span>
                                                    {ticket.isOverdue && (
                                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                                    )}
                                                </div>
                                                <h3 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">
                                                    {ticket.title}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Requester */}
                                        <div className="col-span-2 flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                                {ticket.user?.fullName?.charAt(0) || '?'}
                                            </div>
                                            <div className="min-w-0 hidden md:block">
                                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ticket.user?.fullName || 'Unknown'}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{ticket.user?.department?.name || '-'}</p>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-1">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${statusConfig.color}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                <span className="hidden xl:inline">{statusConfig.label}</span>
                                            </span>
                                        </div>

                                        {/* Assigned To - with dropdown */}
                                        <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                                            {(user?.role === 'ADMIN' || user?.role === 'AGENT') ? (
                                                <Select
                                                    value={ticket.assignedTo?.id || "unassigned"}
                                                    onValueChange={(value) => {
                                                        if (value && value !== "unassigned") {
                                                            assignTicketMutation.mutate({ ticketId: ticket.id, assigneeId: value });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="h-8 w-full text-xs bg-transparent border-slate-200 dark:border-slate-700">
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
                                                            <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                                                <UserCheck className="w-3 h-3 text-green-600" />
                                                            </div>
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
                                        <div className="col-span-2">
                                            {ticket.slaTarget ? (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className={`${new Date(ticket.slaTarget) < new Date() ? 'text-red-500 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {formatDate(ticket.slaTarget)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </div>

                                        {/* Date & Actions */}
                                        <div className="col-span-2 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                <span className="hidden sm:inline">{formatDate(ticket.createdAt)}</span>
                                                {ticket.messages && ticket.messages.length > 0 && (
                                                    <span className="flex items-center gap-1">
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
