import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
    Inbox,
    Plus,
    Search,
    CheckCircle2,
    CircleDot,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    X,
    Clock,
    MessageSquare,
    TrendingUp,
    AlertTriangle,
    Flame,
    RotateCw,
    Users,
} from 'lucide-react';
import api from '@/lib/api';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { formatSmartDate } from '@/lib/utils/dateFormat';

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
    hasUnreadChat?: boolean;
    isParticipant?: boolean;
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
    { value: 'all', label: 'All Status', icon: null },
    { value: 'TODO', label: 'Open', icon: Inbox },
    { value: 'IN_PROGRESS', label: 'In Progress', icon: CircleDot },
    { value: 'RESOLVED', label: 'Resolved', icon: CheckCircle2 },
] as const;

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;
const QUERY_RETRY_DELAY_MS = 1_000;
const MS_PER_HOUR = 60 * 60 * 1_000;

function formatUpdatedAtRelative(updatedAt: string) {
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const diffInHours = Math.floor((Date.now() - date.getTime()) / MS_PER_HOUR);
    if (diffInHours <= 0) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;

    return formatSmartDate(date);
}

export const BentoMyTicketsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const filterRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Sockets for real-time updates
    const { isConnected } = useTicketListSocket({
        onNewTicket: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'my-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'my-stats'] });
        },
        onTicketUpdated: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'my-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'my-stats'] });
        },
    });
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (data: any) => {
            if (data.message?.senderId === user?.id) return;

            const ticketId = data.ticketId;
            const ticketIdShort = ticketId?.split('-')[0] || 'Unknown';

            toast.info(`New reply on ticket #${ticketIdShort}`, {
                action: { label: 'View', onClick: () => navigate(`/client/tickets/${ticketId}`) },
                duration: 5000,
            });

            queryClient.invalidateQueries({ queryKey: ['tickets', 'my-tickets'] });
        };

        socket.on('ticket:newMessage', handleNewMessage);
        return () => {
            socket.off('ticket:newMessage', handleNewMessage);
        };
    }, [socket, navigate, user?.id, queryClient]);

    const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

    // Fetch user aggregate stats (Total, Open, In Progress, Resolved)
    const { data: statsData, isLoading: isStatsLoading } = useQuery<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
    }>({
        queryKey: ['tickets', 'my-stats'],
        queryFn: async () => {
            const [allRes, openRes, inProgRes, resRes] = await Promise.all([
                api.get('/tickets/paginated?limit=1'),
                api.get('/tickets/paginated?limit=1&status=TODO'),
                api.get('/tickets/paginated?limit=1&status=IN_PROGRESS'),
                api.get('/tickets/paginated?limit=1&status=RESOLVED'),
            ]);
            return {
                total: allRes.data?.meta?.total ?? 0,
                open: openRes.data?.meta?.total ?? 0,
                inProgress: inProgRes.data?.meta?.total ?? 0,
                resolved: resRes.data?.meta?.total ?? 0,
            };
        },
        staleTime: 20_000,
    });

    const queryParams = new URLSearchParams();
    queryParams.set('page', page.toString());
    queryParams.set('limit', limit.toString());
    queryParams.set('sortBy', 'createdAt');
    queryParams.set('sortOrder', 'DESC');
    if (debouncedSearch) queryParams.set('search', debouncedSearch);
    if (statusFilter !== 'all') queryParams.set('status', statusFilter);

    // Main paginated query
    const {
        data: response,
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useQuery<PaginatedResponse>({
        queryKey: ['tickets', 'my-tickets', page, limit, debouncedSearch, statusFilter],
        queryFn: async () => {
            const res = await api.get(`/tickets/paginated?${queryParams.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData,
        retry: 2,
        retryDelay: QUERY_RETRY_DELAY_MS,
    });

    const tickets = response?.data ?? [];
    const meta = response?.meta;

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

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setPage(1);
    };

    const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!direction) return;

        e.preventDefault();
        const nextIndex = (index + direction + STATUS_FILTERS.length) % STATUS_FILTERS.length;
        filterRefs.current[nextIndex]?.focus();
    };

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all');

    if (isLoading && !response) {
        return (
            <div className="space-y-6 pb-28 sm:pb-10">
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 animate-pulse">
                    <div className="space-y-2">
                        <div className="h-8 w-44 bg-muted rounded-xl" />
                        <div className="h-4 w-64 bg-muted/60 rounded" />
                    </div>
                    <div className="h-10 w-32 bg-muted rounded-xl" />
                </div>

                {/* Stats Skeleton */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-card border border-border/70 rounded-2xl p-4 animate-pulse" />
                    ))}
                </div>

                {/* Table Skeleton */}
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4 animate-pulse">
                    <div className="h-10 bg-muted rounded-xl" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 bg-muted/40 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <ErrorState
                title="Gagal Memuat Tiket"
                message="Terjadi kendala saat memuat tiket Anda. Silakan coba kembali."
                onRetry={() => refetch()}
            />
        );
    }

    return (
        <div className="space-y-6 pb-28 sm:pb-10 animate-in motion-reduce:animate-none fade-in duration-200">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">My Tickets</h1>
                        {isConnected ? (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                                Connecting...
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm font-medium mt-0.5 sm:mt-1">
                        Pantau dan kelola tiket permintaan dukungan Anda
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['tickets'] });
                            refetch();
                        }}
                        className="p-2 sm:px-3 sm:py-2.5 bg-card border border-border hover:bg-muted/50 rounded-xl text-xs sm:text-sm font-semibold text-foreground transition-colors shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                        title="Segarkan daftar tiket"
                    >
                        <RotateCw className={cn("w-4 h-4", isFetching && "animate-spin text-primary")} aria-hidden="true" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <Link
                        to="/client/create"
                        className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all duration-200 shadow-xs active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>New Ticket</span>
                    </Link>
                </div>
            </div>

            {/* Stats Cards - Bento Style identical to Agent page */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
                <StatsCard
                    icon={TrendingUp}
                    label="Total"
                    value={statsData?.total ?? meta?.total ?? 0}
                    color="text-primary dark:text-blue-400"
                    bgColor="bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/20"
                    animationIndex={0}
                    onClick={() => handleStatusChange('all')}
                    isActive={statusFilter === 'all'}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={Inbox}
                    label="Open"
                    value={statsData?.open ?? 0}
                    color="text-[hsl(var(--info-500))]"
                    bgColor="bg-[hsl(var(--info-500))]/10"
                    animationIndex={1}
                    onClick={() => handleStatusChange('TODO')}
                    isActive={statusFilter === 'TODO'}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={CircleDot}
                    label="In Progress"
                    value={statsData?.inProgress ?? 0}
                    color="text-[hsl(var(--warning-500))]"
                    bgColor="bg-[hsl(var(--warning-500))]/10"
                    animationIndex={2}
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    isActive={statusFilter === 'IN_PROGRESS'}
                    isLoading={isStatsLoading && !statsData}
                />
                <StatsCard
                    icon={CheckCircle2}
                    label="Resolved"
                    value={statsData?.resolved ?? 0}
                    color="text-[hsl(var(--success-500))]"
                    bgColor="bg-[hsl(var(--success-500))]/10"
                    animationIndex={3}
                    onClick={() => handleStatusChange('RESOLVED')}
                    isActive={statusFilter === 'RESOLVED'}
                    isLoading={isStatsLoading && !statsData}
                />
            </div>

            {/* Search & Filter Toolbar */}
            <div
                className="flex flex-col lg:flex-row lg:items-center gap-3 p-2 bg-card rounded-2xl border border-border relative z-20 shadow-xs"
                role="search"
                aria-label="Filter dan cari tiket"
            >
                {/* Search Bar */}
                <div className="relative flex-1 bg-muted/40 rounded-xl transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-background border border-transparent focus-within:border-primary/50">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <label htmlFor="client-ticket-search" className="sr-only">Cari tiket berdasarkan judul atau ID</label>
                    <input
                        id="client-ticket-search"
                        type="search"
                        placeholder="Search by title or ticket ID..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        autoComplete="off"
                        className="w-full pl-10 pr-10 py-2.5 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => handleSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                            aria-label="Hapus pencarian"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="w-px h-8 bg-border hidden lg:block mx-1" />

                {/* Status Segmented Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar pb-1 lg:pb-0" role="group" aria-label="Filter status tiket">
                    {STATUS_FILTERS.map((filter, index) => {
                        const Icon = filter.icon;
                        const isSelected = statusFilter === filter.value;
                        return (
                            <button
                                key={filter.value}
                                ref={(el) => { filterRefs.current[index] = el; }}
                                type="button"
                                onClick={() => handleStatusChange(filter.value)}
                                onKeyDown={(e) => handleFilterKeyDown(e, index)}
                                aria-pressed={isSelected}
                                className={cn(
                                    "px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] shrink-0",
                                    isSelected
                                        ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                                        : "bg-card border border-border hover:bg-muted/50 text-foreground"
                                )}
                            >
                                {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                                <span>{filter.label}</span>
                            </button>
                        );
                    })}

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors cursor-pointer shrink-0 ml-1 flex items-center gap-1"
                            title="Reset semua filter"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Reset</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tickets List Table Card */}
            <div
                className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden relative shadow-xs"
                role="region"
                aria-label="Daftar tiket saya"
            >
                {/* Table Header (Desktop >= lg) */}
                <div className="sticky top-0 z-10 hidden lg:grid items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-[hsl(var(--border))] lg:grid-cols-[minmax(280px,2.5fr)_120px_140px_160px_110px_40px]">
                    <div>Ticket / ID</div>
                    <div>Priority</div>
                    <div>Status</div>
                    <div>Assigned To</div>
                    <div>Updated</div>
                    <div className="text-right">Action</div>
                </div>

                {/* List Content */}
                {tickets.length === 0 ? (
                    <div className="p-12 text-center" role="status">
                        <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                            <Inbox className="w-7 h-7" aria-hidden="true" />
                        </div>
                        <h3 className="text-base font-bold text-foreground mb-1">
                            {hasActiveFilters ? 'Tidak ada tiket yang cocok' : 'Belum ada tiket'}
                        </h3>
                        <p className="text-muted-foreground max-w-sm mx-auto text-xs sm:text-sm mb-6">
                            {hasActiveFilters
                                ? 'Coba ubah kata kunci pencarian atau ganti filter status di atas.'
                                : 'Buat tiket dukungan pertama Anda untuk mendapatkan bantuan dari tim IT.'}
                        </p>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border hover:bg-muted/50 rounded-xl text-xs font-bold text-foreground transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                                <span>Reset Filter</span>
                            </button>
                        ) : (
                            <Link
                                to="/client/create"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-xs active:scale-[0.98]"
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                <span>Buat Tiket Baru</span>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div>
                        {tickets.map((ticket: TicketItem, index: number) => {
                            const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.TODO;
                            const StatusIcon = statusConfig.icon;
                            const priorityConfig = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
                            const timeDisplay = formatUpdatedAtRelative(ticket.updatedAt);

                            return (
                                <Link
                                    key={ticket.id}
                                    to={`/client/tickets/${ticket.id}`}
                                    className={cn(
                                        "block transition-colors duration-150 group border-b border-border/80 last:border-0",
                                        index % 2 === 0 ? "bg-white dark:bg-transparent" : "bg-[hsl(var(--background))] dark:bg-slate-800/40",
                                        "hover:bg-slate-50 dark:hover:bg-[hsl(var(--muted))]/10"
                                    )}
                                    aria-label={`Lihat tiket #${ticket.ticketNumber || ticket.id.slice(0, 8)}: ${ticket.title}`}
                                >
                                    {/* ========================================= */}
                                    {/* MOBILE CARD VIEW (< lg) */}
                                    {/* ========================================= */}
                                    <div className="block lg:hidden p-3.5 sm:p-4 space-y-2.5">
                                        {/* Mobile Top Row */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                {/* Priority Dot */}
                                                <span className={cn("w-2 h-2 rounded-full shrink-0", priorityConfig.dot || priorityConfig.barColor)} aria-hidden="true" />

                                                {/* Ticket Number */}
                                                <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                    #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                </span>

                                                {/* Category Badge */}
                                                {ticket.category && (
                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        {ticket.category}
                                                    </span>
                                                )}

                                                {/* Joined Ticket Badge */}
                                                {ticket.isParticipant && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/60">
                                                        <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                                        Joined
                                                    </span>
                                                )}

                                                {/* Priority Badge */}
                                                {ticket.priority === 'CRITICAL' && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-800/50">
                                                        <Flame className="w-3 h-3" />
                                                        Critical
                                                    </span>
                                                )}
                                                {ticket.priority === 'HIGH' && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800/50">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        High
                                                    </span>
                                                )}
                                            </div>

                                            {/* Right: Updated Date */}
                                            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                                                <Clock className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
                                                <time dateTime={ticket.updatedAt}>{timeDisplay}</time>
                                            </div>
                                        </div>

                                        {/* Mobile Middle Row: Title & Unread Badge */}
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                                                {ticket.title}
                                            </h3>
                                            {ticket.hasUnreadChat && (
                                                <div className="mt-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-xs animate-pulse">
                                                        <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                        <span>Balasan Baru</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Mobile Bottom Row: Status & Assignee */}
                                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                                            {/* Status Badge */}
                                            <div className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border", statusConfig.color)}>
                                                {StatusIcon && <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                                                <span>{statusConfig.label}</span>
                                            </div>

                                            {/* Assignee & Chevron */}
                                            <div className="flex items-center gap-2 min-w-0 justify-end">
                                                {ticket.assignedTo ? (
                                                    <div className="flex items-center gap-1.5 min-w-0 max-w-[140px]" title={`Teknisi: ${ticket.assignedTo.fullName}`}>
                                                        <UserAvatar user={ticket.assignedTo} size="xs" />
                                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                                                            {ticket.assignedTo.fullName}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/70 italic">Menunggu Teknisi</span>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ========================================= */}
                                    {/* DESKTOP TABLE ROW (>= lg) */}
                                    {/* ========================================= */}
                                    <div className="hidden lg:grid items-center gap-4 px-4 py-3.5 lg:grid-cols-[minmax(280px,2.5fr)_120px_140px_160px_110px_40px]">
                                        {/* Column 1: Ticket ID, Title & Category */}
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={cn("w-2 h-2 rounded-full shrink-0 mt-2", priorityConfig.dot || priorityConfig.barColor)} aria-hidden="true" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-[hsl(var(--muted))] dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        #{ticket.ticketNumber || ticket.id.slice(0, 8)}
                                                    </span>
                                                    {ticket.category && (
                                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                            {ticket.category}
                                                        </span>
                                                    )}
                                                    {ticket.isParticipant && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                                                            <Users className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                                            Joined
                                                        </span>
                                                    )}
                                                    {ticket.priority === 'CRITICAL' && (
                                                        <span title="Critical Priority">
                                                            <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" aria-hidden="true" />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">
                                                        {ticket.title}
                                                    </h3>
                                                    {ticket.hasUnreadChat && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-xs animate-pulse shrink-0">
                                                            <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                            <span>Balasan Baru</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column 2: Priority */}
                                        <div>
                                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border/80 bg-background", priorityConfig.color)}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full", priorityConfig.dot || priorityConfig.barColor)} aria-hidden="true" />
                                                {priorityConfig.label}
                                            </span>
                                        </div>

                                        {/* Column 3: Status */}
                                        <div>
                                            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", statusConfig.color)}>
                                                {StatusIcon && <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        {/* Column 4: Assigned To */}
                                        <div className="min-w-0">
                                            {ticket.assignedTo ? (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <UserAvatar user={ticket.assignedTo} size="xs" />
                                                    <span className="text-xs font-semibold text-foreground truncate">
                                                        {ticket.assignedTo.fullName}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground/70 italic font-medium">Menunggu Teknisi</span>
                                            )}
                                        </div>

                                        {/* Column 5: Updated */}
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 opacity-60 shrink-0" aria-hidden="true" />
                                            <time dateTime={ticket.updatedAt}>{timeDisplay}</time>
                                        </div>

                                        {/* Column 6: Action */}
                                        <div className="flex justify-end">
                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all" aria-hidden="true" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Footer */}
                {meta && meta.total > 0 && (
                    <div className="p-4 border-t border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <label htmlFor="client-page-size">Menampilkan</label>
                            <select
                                id="client-page-size"
                                value={limit}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                className="px-2.5 py-1 min-h-[36px] rounded-lg bg-card border border-border text-foreground outline-none font-medium focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <span>dari {meta.total} tiket</span>
                        </div>

                        {meta.totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setPage(1)}
                                    disabled={!meta.hasPrevPage}
                                    aria-label="Halaman pertama"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage(page - 1)}
                                    disabled={!meta.hasPrevPage}
                                    aria-label="Halaman sebelumnya"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-lg tabular-nums">
                                    {meta.page} / {meta.totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage(page + 1)}
                                    disabled={!meta.hasNextPage}
                                    aria-label="Halaman berikutnya"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPage(meta.totalPages)}
                                    disabled={!meta.hasNextPage}
                                    aria-label="Halaman terakhir"
                                    className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                >
                                    <ChevronsRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BentoMyTicketsPage;

