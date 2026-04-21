import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Clock, 
    Plus, 
    Ticket, 
    Search, 
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    Clock4,
    Hourglass,
    XCircle,
    RefreshCw,
    X,
    Inbox,
    MessageSquare,
    User,
    Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { format } from 'date-fns';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface TicketData {
    id: string;
    ticketNumber: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    category?: string;
    ticketType?: string; // Added to support filtering
    createdAt: string;
    updatedAt: string;
    slaTarget?: string;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
    messages?: any[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    TODO: { 
        label: 'Open', 
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        icon: AlertCircle 
    },
    IN_PROGRESS: { 
        label: 'In Progress', 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        icon: Clock4 
    },
    WAITING_VENDOR: { 
        label: 'Waiting Vendor', 
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        icon: Hourglass 
    },
    RESOLVED: { 
        label: 'Resolved', 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle2 
    },
    CANCELLED: { 
        label: 'Cancelled', 
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
        icon: XCircle 
    },
};

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; bar: string }> = {
    LOW: { label: 'Low', dot: 'bg-slate-400', bar: 'bg-slate-400' },
    MEDIUM: { label: 'Medium', dot: 'bg-blue-500', bar: 'bg-blue-500' },
    HIGH: { label: 'High', dot: 'bg-orange-500', bar: 'bg-orange-500' },
    CRITICAL: { label: 'Critical', dot: 'bg-red-500', bar: 'bg-red-500' },
};

export const MyTicketsPage: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    const { data: tickets = [], isLoading, refetch, isFetching } = useQuery<TicketData[]>({
        queryKey: ['my-tickets'],
        queryFn: async () => {
            const res = await api.get('/tickets/my-tickets');
            return res.data;
        },
    });

    // Filter tickets
    const filteredTickets = useMemo(() => {
        // First, filter out tickets that should be managed in the Request Center
        let result = tickets.filter(t => 
            t.ticketType !== 'ICT_BUDGET' && 
            t.ticketType !== 'HARDWARE_INSTALLATION'
        );
        
        if (search) {
            const query = search.toLowerCase();
            result = result.filter(t => 
                t.title.toLowerCase().includes(query) ||
                t.ticketNumber?.toLowerCase().includes(query) ||
                t.category?.toLowerCase().includes(query)
            );
        }
        
        if (statusFilter) {
            result = result.filter(t => t.status === statusFilter);
        }
        
        return result;
    }, [tickets, search, statusFilter]);

    // Stats
    const stats = useMemo(() => {
        const baseTickets = tickets.filter(t => 
            t.ticketType !== 'ICT_BUDGET' && 
            t.ticketType !== 'HARDWARE_INSTALLATION'
        );

        return {
            total: baseTickets.length,
            open: baseTickets.filter(t => t.status === 'TODO').length,
            inProgress: baseTickets.filter(t => t.status === 'IN_PROGRESS').length,
            waiting: baseTickets.filter(t => t.status === 'WAITING_VENDOR').length,
            resolved: baseTickets.filter(t => t.status === 'RESOLVED').length,
        };
    }, [tickets]);

    const hasActiveFilters = search || statusFilter;

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('');
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
                <div className="h-12 bg-white dark:bg-slate-800 rounded-2xl animate-pulse" />
                <div className="bg-white dark:bg-slate-800 rounded-2xl animate-pulse">
                    {[1,2,3,4,5].map(i => (
                        <div key={i} className="h-16 border-b border-slate-100 dark:border-slate-700" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tickets</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Track and manage your support requests
                    </p>
                </div>
                <Link
                    to="/client/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-slate-900 rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" />
                    New Ticket
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <Ticket className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-slate-500">Total</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.open}</p>
                            <p className="text-xs text-slate-500">Open</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Clock4 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.inProgress}</p>
                            <p className="text-xs text-slate-500">In Progress</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Hourglass className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.waiting}</p>
                            <p className="text-xs text-slate-500">Waiting</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.resolved}</p>
                            <p className="text-xs text-slate-500">Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[250px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title, ticket number, category..."
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
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={cn("w-5 h-5 text-slate-500", isFetching && "animate-spin")} />
                    </button>
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

            {/* Tickets Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {filteredTickets.length === 0 ? (
                    <div className="p-12 text-center">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                            {hasActiveFilters ? 'No tickets found' : 'No tickets yet'}
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            {hasActiveFilters 
                                ? 'Try adjusting your search or filter' 
                                : 'Create your first support ticket'}
                        </p>
                        {!hasActiveFilters && (
                            <Link
                                to="/client/create"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-slate-900 rounded-xl hover:bg-primary/90 transition-colors duration-150 font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                Create Ticket
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="hidden lg:grid lg:grid-cols-[1fr_auto_auto_auto_auto] gap-6 px-6 py-3 bg-slate-50 dark:bg-slate-900/50 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            <div>Ticket</div>
                            <div className="w-28 text-center">Status</div>
                            <div className="w-24 text-center">Priority</div>
                            <div className="w-36">Agent</div>
                            <div className="w-32 text-right">Created</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredTickets.map((ticket) => {
                                const status = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                                const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                                const StatusIcon = status.icon;

                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => navigate(`/client/tickets/${ticket.id}`)}
                                        className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-3 lg:gap-6 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                                    >
                                        {/* Ticket Info - Takes remaining space */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={cn("w-1 h-12 rounded-full shrink-0", priority.bar)} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-mono text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                    </span>
                                                    {ticket.category && (
                                                        <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                                                            {ticket.category}
                                                        </span>
                                                    )}
                                                    {ticket.messages && ticket.messages.length > 0 && (
                                                        <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded lg:hidden">
                                                            <MessageSquare className="w-3 h-3" />
                                                            {ticket.messages.length}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary transition-colors line-clamp-1">
                                                    {ticket.title}
                                                </h3>
                                            </div>
                                            {/* Mobile-only chevron */}
                                            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-primary lg:hidden shrink-0" />
                                        </div>

                                        {/* Status */}
                                        <div className="w-28 flex items-center justify-center">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
                                                status.color
                                            )}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">{status.label}</span>
                                            </span>
                                        </div>

                                        {/* Priority */}
                                        <div className="w-24 flex items-center justify-center">
                                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                <span className={cn("w-2.5 h-2.5 rounded-full", priority.dot)} />
                                                {priority.label}
                                            </span>
                                        </div>

                                        {/* Agent */}
                                        <div className="w-36 flex items-center gap-2 min-w-0">
                                            {ticket.assignedTo ? (
                                                <>
                                                    <UserAvatar 
                                                        user={ticket.assignedTo} 
                                                        size="sm" 
                                                    />
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                        {ticket.assignedTo.fullName}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                                    </div>
                                                    <span className="hidden sm:inline">Unassigned</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Created Date + Messages + Arrow */}
                                        <div className="w-32 flex items-center justify-end gap-3">
                                            <div className="text-right">
                                                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                                    {format(new Date(ticket.createdAt), 'dd MMM')}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {format(new Date(ticket.createdAt), 'HH:mm')}
                                                </div>
                                            </div>
                                            {ticket.messages && ticket.messages.length > 0 && (
                                                <span className="hidden lg:flex items-center gap-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                                                    <MessageSquare className="w-3 h-3" />
                                                    {ticket.messages.length}
                                                </span>
                                            )}
                                            <ChevronRight className="hidden lg:block w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-primary group-hover:translate-x-1 transition-[color,transform] duration-150 shrink-0" />
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
