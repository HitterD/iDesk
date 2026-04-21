import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, Plus, Search, CheckCircle2, CircleDot, Inbox, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import api from '@/lib/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { TicketListSkeleton } from '@/components/ui/skeletons';
import { ErrorState } from '@/components/ui/ErrorState';

// Using a comprehensive interface matching standard API response
interface TicketItem {
    id: string;
    ticketNumber?: string;
    title: string;
    status: string;
    priority: string;
    category?: string;
    ticketType?: string; // Added to support filtering
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

export const BentoMyTicketsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Debounce search query to reduce API calls
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Build query params for server-side filtering
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
        retryDelay: 1000,
    });

    const tickets = (response?.data ?? []).filter(t => 
        t.ticketType !== 'ICT_BUDGET' && 
        t.ticketType !== 'HARDWARE_INSTALLATION'
    );
    const meta = response?.meta;

    // Count stats for display (use totals from meta when on first page with no filters)
    const openCount = meta?.total ?? 0; // Simplified - shows total count
    const inProgressCount = 0; // Would need separate API call for accurate counts
    const resolvedCount = 0;

    // Reset to page 1 when filters change
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

    // Handle keyboard navigation for filter buttons
    const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (e.key === 'ArrowRight' && index < STATUS_FILTERS.length - 1) {
            e.preventDefault();
            const nextButton = document.querySelector(`[data-filter-index="${index + 1}"]`) as HTMLButtonElement;
            nextButton?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            const prevButton = document.querySelector(`[data-filter-index="${index - 1}"]`) as HTMLButtonElement;
            prevButton?.focus();
        }
    };

    if (isLoading) {
        return <TicketListSkeleton rows={5} />;
    }

    if (isError) {
        return (
            <ErrorState
                title="Gagal Memuat Tiket"
                message="Terjadi kesalahan saat memuat daftar tiket. Silakan coba lagi."
                onRetry={() => refetch()}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                        <Inbox className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">My Tickets</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Track your support requests</p>
                    </div>
                </div>
                <Link
                    to="/client/create"
                    className="flex items-center gap-2 bg-primary text-slate-900 px-6 py-3 rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" />
                    New Ticket
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Inbox className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{openCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Open</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                            <CircleDot className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{inProgressCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">In Progress</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card hover:glass-hover-lift rounded-2xl p-4 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{resolvedCount}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Resolved</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Smart List Container */}
            <div className="glass-card overflow-hidden rounded-2xl">
                {/* Search & Filter Bar */}
                <div className="p-4 border-b border-white/20 dark:border-white/10 flex flex-col md:flex-row gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                    <div className="flex-1 relative">
                        <label htmlFor="ticket-search" className="sr-only">
                            Search tickets by title or ID
                        </label>
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                        <input
                            id="ticket-search"
                            type="text"
                            placeholder="Search by title or ID..."
                            aria-label="Search tickets by title or ID"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-white/40 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-sm text-slate-800 dark:text-white transition-colors duration-150 focus:bg-white dark:focus:bg-slate-800"
                        />
                    </div>
                    <div
                        className="flex gap-2 font-medium"
                        role="group"
                        aria-label="Filter tickets by status"
                    >
                        {STATUS_FILTERS.map((filter, index) => (
                            <button
                                key={filter.value}
                                data-filter-index={index}
                                onClick={() => handleStatusChange(filter.value)}
                                onKeyDown={(e) => handleFilterKeyDown(e, index)}
                                aria-pressed={statusFilter === filter.value}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors duration-150 ${statusFilter === filter.value
                                    ? 'bg-primary text-slate-900 shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10 hover:bg-white dark:hover:bg-slate-700 hover:scale-105'
                                    }`}
                            >
                                {filter.label}
                            </button>
                        ))}

                    </div>
                </div>

                {/* List Header (Desktop) */}
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
                            <div className="w-20 h-20 bg-white/50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-lg shadow-slate-200/50 dark:shadow-none">
                                <Inbox className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No tickets found</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your search terms or filters to find what you\'re looking for.'
                                    : 'Create your first support ticket to get started with our team.'}
                            </p>
                            <Link
                                to="/client/create"
                                className="inline-flex items-center gap-2 bg-primary text-slate-900 px-8 py-3.5 rounded-xl font-bold hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                            >
                                <Plus className="w-5 h-5" />
                                Create Ticket
                            </Link>
                        </div>
                    ) : (
                        tickets.map((ticket: TicketItem, index: number) => {
                            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                            const StatusIcon = statusConfig.icon;
                            const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;

                            // Safe date handling
                            let timeDisplay = '';
                            try {
                                const date = new Date(ticket.updatedAt);
                                const now = new Date();
                                const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

                                if (diffInHours < 24) {
                                    timeDisplay = `${diffInHours}h ago`;
                                    if (diffInHours === 0) timeDisplay = 'Just now';
                                } else {
                                    timeDisplay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                }
                            } catch (e) {
                                timeDisplay = '-';
                            }

                            return (
                                <Link
                                    key={ticket.id}
                                    to={`/client/tickets/${ticket.id}`}
                                    className="flex flex-col md:flex-row md:items-center px-6 py-4 hover:bg-white/60 dark:hover:bg-slate-700/40 transition-colors duration-150 group gap-4 md:gap-0 animate-fade-in-up"
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    {/* Column 1: Status & ID */}
                                    <div className="md:w-48 xl:w-56 flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${statusConfig.bgColor}`}>
                                            <StatusIcon className={`w-5 h-5 ${statusConfig.textColor}`} />
                                        </div>
                                        <div>
                                            <div className="font-mono text-xs text-slate-500 font-medium">
                                                #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                            </div>
                                            <div className={`text-[10px] font-bold uppercase tracking-wider ${statusConfig.textColor}`}>
                                                {statusConfig.label}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Column 2: Main Details */}
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors text-sm md:text-base">
                                            {ticket.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {ticket.category && (
                                                <span className="text-xs text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                                                    {ticket.category}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Column 3: Priority */}
                                    <div className="md:w-32 xl:w-40 flex items-center">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm",
                                            priorityConfig.badgeColor
                                        )}>
                                            <span className={cn("w-2 h-2 rounded-full", priorityConfig.dot)} />
                                            {priorityConfig.label}
                                        </span>
                                    </div>

                                    {/* Column 4: Assignee */}
                                    <div className="md:w-40 xl:w-48 flex items-center">
                                        {ticket.assignedTo ? (
                                            <div className="flex items-center gap-2">
                                                <UserAvatar user={ticket.assignedTo} size="xs" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                                    {ticket.assignedTo.fullName.split(' ')[0]}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic pl-1">Unassigned</span>
                                        )}
                                    </div>

                                    {/* Column 5: Time */}
                                    <div className="md:w-32 xl:w-40 flex items-center text-xs text-slate-500">
                                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                        {timeDisplay}
                                    </div>

                                    {/* Column 6: Action */}
                                    <div className="md:w-24 flex items-center justify-end gap-1 text-primary opacity-0 group-hover:opacity-100 transition-colors duration-150 transform translate-x-[-10px] group-hover:translate-x-0">
                                        <span className="text-xs font-bold">Detail</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                    {/* Mobile chevron fallback (always visible) */}
                                    <div className="md:hidden absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>

                {/* Pagination UI */}
                {meta && meta.totalPages > 1 && (
                    <div className="p-4 border-t border-white/20 dark:border-white/10 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <span>Menampilkan</span>
                            <select
                                value={limit}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium"
                                aria-label="Items per page"
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <span>dari {meta.total} tiket</span>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={!meta.hasPrevPage}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                aria-label="First page"
                            >
                                <ChevronsLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={!meta.hasPrevPage}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                aria-label="Previous page"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="px-4 py-1.5 bg-primary/10 text-primary font-bold text-sm rounded-lg">
                                {meta.page} / {meta.totalPages}
                            </span>

                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={!meta.hasNextPage}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                aria-label="Next page"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(meta.totalPages)}
                                disabled={!meta.hasNextPage}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                aria-label="Last page"
                            >
                                <ChevronsRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
