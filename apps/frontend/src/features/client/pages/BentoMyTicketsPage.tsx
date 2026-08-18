import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Plus, Search, CheckCircle2, CircleDot, Inbox, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import api from '@/lib/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { TicketListSkeleton } from '@/components/ui/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';

interface TicketItem {
    id: string;
    ticketNumber?: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    ticketType?: string;
    createdAt: string;
    updatedAt: string;
    assignedTo?: {
        id: string;
        fullName: string;
        avatarUrl?: string;
    };
}

interface PaginatedResponse {
    data: TicketItem[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'TODO', label: 'Open' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'RESOLVED', label: 'Resolved' },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;
const QUERY_RETRY_DELAY_MS = 1_000;
const TICKET_STAGGER_MS = 50;
const MS_PER_HOUR = 60 * 60 * 1_000;

function formatUpdatedAt(updatedAt: string) {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const diffInHours = Math.floor((Date.now() - date.getTime()) / MS_PER_HOUR);
    if (diffInHours <= 0) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;

    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

export const BentoMyTicketsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const filterRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Sockets
    const { isConnected } = useTicketListSocket();
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;
        
        const handleNewMessage = (data: any) => {
            // Check if user is not the sender
            if (data.message?.senderId === user?.id) return;
            
            const ticketId = data.ticketId;
            const ticketIdShort = ticketId?.split('-')[0] || 'Unknown';
            
            toast.info(`New reply on ticket #${ticketIdShort}`, { 
                action: { label: 'View', onClick: () => navigate(`/client/tickets/${ticketId}`) },
                duration: 5000,
            });
        };

        socket.on('ticket:newMessage', handleNewMessage);
        return () => {
            socket.off('ticket:newMessage', handleNewMessage);
        };
    }, [socket, navigate, user?.id]);

    const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    queryParams.set('limit', limit.toString());
    queryParams.set('sortBy', 'createdAt');
    queryParams.set('sortOrder', 'DESC');
    if (debouncedSearch) queryParams.set('search', debouncedSearch);
    if (statusFilter !== 'all') queryParams.set('status', statusFilter);

    const { data: response, isLoading, isError, refetch } = useQuery<PaginatedResponse>({
        queryKey: ['my-tickets', page, limit, debouncedSearch, statusFilter],
        queryFn: async () => {
            const res = await api.get(`/tickets/paginated?${queryParams.toString()}`);
            return res.data;
        },
        retry: 2,
        retryDelay: QUERY_RETRY_DELAY_MS,
    });

    // User-side type exclusions are applied in ticket-query.service before pagination.
    // Filtering this page again made valid server pages appear empty and left meta.total
    // disagreeing with the rendered rows.
    const tickets = response?.data ?? [];
    const meta = response?.meta;

    // Pagination API returns no aggregate status breakdown. Current-page counts stay
    // truthful; prior fixed zeroes falsely implied there were no active/resolved tickets.
    const openCount = tickets.filter(ticket => ticket.status === 'TODO').length;
    const inProgressCount = tickets.filter(ticket => ticket.status === 'IN_PROGRESS').length;
    const resolvedCount = tickets.filter(ticket => ticket.status === 'RESOLVED').length;

    const handleStatusChange = (status: string) => {
        setStatusFilter(status);
        setPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setPage(1);
    };

    const handlePageSizeChange = (newLimit: number) => {
        setLimit(newLimit);
        setPage(1);
    };

    const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!direction) return;

        e.preventDefault();
        // Keep keyboard navigation inside this page. document.querySelector could
        // target an unrelated duplicated data attribute inside a mounted dialog.
        const nextIndex = (index + direction + STATUS_FILTERS.length) % STATUS_FILTERS.length;
        filterRefs.current[nextIndex]?.focus();
    };

    if (isLoading) return <TicketListSkeleton rows={5} />;
    if (isError) return <ErrorState title="Failed to Load" message="An error occurred while loading your tickets." onRetry={() => refetch()} />;

    return (
        <div className="space-y-6 animate-in motion-reduce:animate-none fade-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Inbox className="w-6 h-6 text-slate-900" aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Tickets</h1>
                            <div
                                role="status"
                                aria-label={isConnected ? 'Live updates connected' : 'Connecting to live updates'}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider",
                                    isConnected ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                )}
                            >
                                <span className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-500 animate-pulse motion-reduce:animate-none" : "bg-slate-400")} aria-hidden="true" />
                                {isConnected ? 'Live' : 'Connecting...'}
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Track your support requests</p>
                    </div>
                </div>
                <Link
                    to="/client/create"
                    className="flex items-center gap-2 min-h-[44px] bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 motion-reduce:transform-none"
                >
                    <Plus className="w-5 h-5" aria-hidden="true" />
                    New Ticket
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            {React.createElement(STATUS_CONFIG['TODO']?.icon || Inbox, { className: "w-6 h-6 text-slate-600 dark:text-slate-400", 'aria-hidden': true })}
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">{openCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Open on this page</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            {React.createElement(STATUS_CONFIG['IN_PROGRESS']?.icon || CircleDot, { className: "w-6 h-6 text-blue-600 dark:text-blue-400", 'aria-hidden': true })}
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">{inProgressCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">In Progress on this page</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-all duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            {React.createElement(STATUS_CONFIG['RESOLVED']?.icon || CheckCircle2, { className: "w-6 h-6 text-green-600 dark:text-green-400", 'aria-hidden': true })}
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">{resolvedCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Resolved on this page</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart List Container */}
            <div className="glass-card overflow-hidden rounded-2xl">
                {/* Search & Filter Bar */}
                <div className="p-4 border-b border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                        <label htmlFor="ticket-search" className="sr-only">Search tickets by title or ID</label>
                        <input
                            id="ticket-search"
                            type="search"
                            placeholder="Search by title or ID..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm text-slate-800 dark:text-white transition-colors duration-150 focus:bg-white dark:focus:bg-slate-800"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 font-medium" role="group" aria-label="Filter tickets by status">
                        {STATUS_FILTERS.map((filter, index) => (
                            <button
                                key={filter.value}
                                ref={(element) => { filterRefs.current[index] = element; }}
                                type="button"
                                onClick={() => handleStatusChange(filter.value)}
                                onKeyDown={(e) => handleFilterKeyDown(e, index)}
                                aria-pressed={statusFilter === filter.value}
                                className={`px-4 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-[transform,box-shadow,border-color,opacity,background-color] duration-150 motion-reduce:transition-none flex items-center gap-2 ${statusFilter === filter.value
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105 motion-reduce:transform-none'
                                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 hover:bg-white dark:hover:bg-slate-700 hover:scale-105 motion-reduce:transform-none'
                                    }`}
                            >
                                {filter.value !== 'all' && STATUS_CONFIG[filter.value]?.icon &&
                                    React.createElement(STATUS_CONFIG[filter.value].icon as any, { className: "w-3.5 h-3.5", 'aria-hidden': true })
                                }
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Header */}
                <div className="hidden md:flex items-center px-6 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-b border-white/20 dark:border-white/10 text-xs font-bold text-slate-500 uppercase tracking-wider backdrop-blur-sm">
                    <div className="w-48 xl:w-56">Status / ID</div>
                    <div className="flex-1">Details</div>
                    <div className="w-32 xl:w-40">Priority</div>
                    <div className="w-40 xl:w-48">Assignee</div>
                    <div className="w-32 xl:w-40">Updated</div>
                    <div className="w-24 text-right">Action</div>
                </div>

                {/* List Items */}
                <div className="divide-y divide-white/20 dark:divide-white/10">
                    {tickets.length === 0 ? (
                        <div className="p-16 text-center bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm">
                            <div className="w-20 h-20 bg-primary/10 dark:bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md">
                                <Inbox className="w-10 h-10 text-primary" aria-hidden="true" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No tickets found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto text-sm">
                                {searchQuery || statusFilter !== 'all'
                                    ? "Try adjusting your search terms or filters to find what you're looking for."
                                    : "Create your first support ticket to get started with our IT team."}
                            </p>
                            <Link
                                to="/client/create"
                                className="inline-flex items-center gap-2 min-h-[44px] bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 motion-reduce:transform-none"
                            >
                                <Plus className="w-5 h-5" aria-hidden="true" />
                                Create Ticket
                            </Link>
                        </div>
                    ) : (
                        tickets.map((ticket: TicketItem, index: number) => {
                            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                            const StatusIcon = statusConfig.icon;
                            const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

                            const timeDisplay = formatUpdatedAt(ticket.updatedAt);

                            return (
                                <Link
                                    key={ticket.id}
                                    to={`/client/tickets/${ticket.id}`}
                                    className="relative flex flex-col md:flex-row md:items-center px-6 py-4 hover:bg-white/60 dark:hover:bg-slate-700/40 transition-colors duration-150 group gap-4 md:gap-0 animate-fade-in-up motion-reduce:animate-none"
                                    style={{ animationDelay: `${index * TICKET_STAGGER_MS}ms` }}
                                >
                                    <div className="md:w-48 xl:w-56 flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", statusConfig.bgColor)}>
                                            {StatusIcon && <StatusIcon className={cn("w-5 h-5", statusConfig.textColor)} aria-hidden="true" />}
                                        </div>
                                        <div>
                                            <div className="font-mono text-xs text-slate-500 font-medium tabular-nums">
                                                #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                            </div>
                                            <div className={cn("text-xs font-bold uppercase tracking-wider", statusConfig.textColor)}>
                                                {statusConfig.label}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors text-sm md:text-base">
                                            {ticket.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {ticket.category && (
                                                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                    {ticket.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="md:w-32 xl:w-40 flex items-center">
                                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900", priorityConfig.color)}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50" aria-hidden="true" />
                                            {priorityConfig.label}
                                        </span>
                                    </div>

                                    <div className="md:w-40 xl:w-48 flex items-center">
                                        {ticket.assignedTo ? (
                                            <div className="flex items-center gap-2">
                                                <UserAvatar user={ticket.assignedTo} size="xs" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                    {ticket.assignedTo.fullName}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">Unassigned</span>
                                        )}
                                    </div>

                                    <div className="md:w-32 xl:w-40 flex items-center text-xs text-slate-500 font-medium">
                                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" aria-hidden="true" />
                                        <time dateTime={ticket.updatedAt}>{timeDisplay}</time>
                                    </div>

                                    <div className="hidden md:flex md:w-24 items-center justify-end gap-1 text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-[transform,opacity] duration-200 motion-reduce:transition-none transform translate-x-[-10px] group-hover:translate-x-0 group-focus-visible:translate-x-0">
                                        <span className="text-xs font-bold uppercase tracking-wider">Open</span>
                                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                    </div>
                                    <div className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <ChevronRight className="w-5 h-5" aria-hidden="true" />
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                    <nav aria-label="Ticket pagination" className="p-4 border-t border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div role="status" className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                            <label htmlFor="ticket-page-size">Menampilkan</label>
                            <select
                                id="ticket-page-size"
                                value={limit}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="px-2 py-1 min-h-[44px] rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <span>dari {meta.total} tiket</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setPage(1)} disabled={!meta.hasPrevPage} aria-label="First page" className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsLeft className="w-4 h-4" aria-hidden="true" /></button>
                            <button type="button" onClick={() => setPage(page - 1)} disabled={!meta.hasPrevPage} aria-label="Previous page" className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-4 h-4" aria-hidden="true" /></button>
                            <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-lg tabular-nums" aria-current="page">{meta.page} / {meta.totalPages}</span>
                            <button type="button" onClick={() => setPage(page + 1)} disabled={!meta.hasNextPage} aria-label="Next page" className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-4 h-4" aria-hidden="true" /></button>
                            <button type="button" onClick={() => setPage(meta.totalPages)} disabled={!meta.hasNextPage} aria-label="Last page" className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronsRight className="w-4 h-4" aria-hidden="true" /></button>
                        </div>
                    </nav>
                )}
            </div>
        </div>
    );
};

export default BentoMyTicketsPage;
