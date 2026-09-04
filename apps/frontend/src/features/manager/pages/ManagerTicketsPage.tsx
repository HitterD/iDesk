import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Ticket,
    Search,
    RefreshCw,
    Eye,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Filter,
    Flame,
    TrendingUp,
    Inbox,
    CircleDot,
    X,
    Building2,
    Radio,
    ChevronUp,
    ChevronDown,
    User as UserIcon,
} from 'lucide-react';
import { SiteSelector } from '@/components/site/SiteSelector';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { StatsCard } from '@/features/ticket-board/components/StatsCard';
import { TicketListPagination, PaginationInfo } from '@/features/ticket-board/components/TicketListPagination';
import { ManagerTicketActivityModal } from '../components/ManagerTicketActivityModal';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useDebounce } from '@/hooks/useDebounce';
import { useSoundNotification } from '@/hooks/useSoundNotification';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface TicketItem {
    id: string;
    ticketNumber: string;
    title?: string;
    subject?: string;
    status: string;
    priority: string;
    createdAt: string;
    user?: { fullName: string; email?: string; avatarUrl?: string };
    requester?: { fullName: string; email?: string; avatarUrl?: string };
    site?: { code: string; name: string };
    assignedTo?: { id: string; fullName: string; email?: string; avatarUrl?: string };
    category?: { name: string; code?: string };
    targetDate?: string;
}

interface PaginatedTicketResponse {
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

type SortField = 'ticketNumber' | 'createdAt' | 'priority' | 'status' | 'site';
type SortOrder = 'ASC' | 'DESC';

export const ManagerTicketsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { playNewTicketSound, playCriticalSound } = useSoundNotification();

    // Filters state
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const ITEMS_PER_PAGE = 20;

    // Sorting state
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    // Debounce search query
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, priorityFilter, selectedSites, sortBy, sortOrder]);

    // WebSocket real-time updates
    const handleNewTicket = useCallback((ticket: any) => {
        if (ticket.priority === 'CRITICAL') {
            playCriticalSound();
        } else {
            playNewTicketSound();
        }

        toast.info('Tiket Baru Diterima', {
            description: `${ticket.ticketNumber || ''}: ${ticket.subject || ticket.title || ''}`,
            action: {
                label: 'Lihat Log',
                onClick: () => setSelectedTicketId(ticket.id),
            },
            duration: 7000,
        });

        // Invalidate queries so table and stats refresh automatically
        queryClient.invalidateQueries({ queryKey: ['manager-tickets-paginated'] });
        queryClient.invalidateQueries({ queryKey: ['manager-tickets-stats'] });
    }, [playCriticalSound, playNewTicketSound, queryClient]);

    const { isConnected } = useTicketListSocket({ onNewTicket: handleNewTicket });

    // Fetch Paginated Tickets
    const {
        data: paginatedData,
        isLoading,
        isFetching,
        refetch,
    } = useQuery<PaginatedTicketResponse>({
        queryKey: [
            'manager-tickets-paginated',
            {
                page: currentPage,
                limit: ITEMS_PER_PAGE,
                status: statusFilter === 'all' ? undefined : statusFilter,
                priority: priorityFilter === 'all' ? undefined : priorityFilter,
                search: debouncedSearch || undefined,
                siteIds: selectedSites.length > 0 ? selectedSites : undefined,
                sortBy,
                sortOrder,
            },
        ],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', String(currentPage));
            params.append('limit', String(ITEMS_PER_PAGE));
            params.append('excludeCategory', 'ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST');

            if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
            if (priorityFilter && priorityFilter !== 'all') params.append('priority', priorityFilter);
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (selectedSites.length > 0) {
                selectedSites.forEach(id => params.append('siteIds', id));
            }
            if (sortBy) params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);

            const res = await api.get(`/tickets/paginated?${params.toString()}`);
            return res.data;
        },
        placeholderData: (prev) => prev,
        refetchInterval: 45000, // 45s fallback poll
    });

    // Fetch Stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['manager-tickets-stats', selectedSites],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('excludeCategory', 'ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST');
            if (selectedSites.length > 0) {
                selectedSites.forEach(id => params.append('siteIds', id));
            }
            const res = await api.get(`/tickets/dashboard/stats?${params.toString()}`);
            return res.data;
        },
        staleTime: 30000,
    });

    const tickets = paginatedData?.data || [];
    const meta = paginatedData?.meta;

    // Computed pagination info
    const paginationInfo: PaginationInfo = useMemo(() => {
        const total = meta?.total || 0;
        const totalPages = meta?.totalPages || 1;
        return {
            totalItems: total,
            totalPages,
            startIndex: (currentPage - 1) * ITEMS_PER_PAGE,
            endIndex: Math.min((currentPage - 1) * ITEMS_PER_PAGE + tickets.length, total),
            showPagination: total > ITEMS_PER_PAGE,
            currentPage,
            hasNextPage: meta?.hasNextPage ?? currentPage < totalPages,
            hasPrevPage: meta?.hasPrevPage ?? currentPage > 1,
        };
    }, [meta, currentPage, tickets.length]);

    const getPageNumbers = (): (number | string)[] => {
        const total = paginationInfo.totalPages;
        const current = currentPage;
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 3) {
            return [1, 2, 3, 4, '...', total];
        }
        if (current >= total - 2) {
            return [1, '...', total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    };

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setPriorityFilter('all');
        setSelectedSites([]);
        setCurrentPage(1);
    };

    const hasActiveFilters = Boolean(
        searchQuery ||
        (statusFilter && statusFilter !== 'all') ||
        (priorityFilter && priorityFilter !== 'all') ||
        selectedSites.length > 0
    );

    // Stats calculations
    const stats = {
        total: statsData?.total ?? meta?.total ?? 0,
        critical: statsData?.critical ?? statsData?.byPriority?.CRITICAL ?? 0,
        open: statsData?.open ?? 0,
        inProgress: statsData?.inProgress ?? 0,
        resolved: statsData?.resolved ?? 0,
        overdue: statsData?.overdue ?? 0,
    };

    return (
        <div className="space-y-6 animate-fade-in-up pb-10">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-semibold text-primary border-primary/30 bg-primary/5">
                            <Building2 className="w-3.5 h-3.5 mr-1" />
                            Manager Portal
                        </Badge>
                        {isConnected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Live Real-Time
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                                <Radio className="w-3 h-3 animate-spin" />
                                Connecting...
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
                        <Ticket className="w-7 h-7 text-primary" />
                        Ticket Overview
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Monitor, filter, dan kelola seluruh tiket dari semua cabang secara terpusat
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            refetch();
                            queryClient.invalidateQueries({ queryKey: ['manager-tickets-stats'] });
                            toast.success('Data tiket diperbarui');
                        }}
                        disabled={isFetching}
                        className="rounded-xl border-border/80 bg-card hover:bg-muted shadow-xs transition-all duration-150 cursor-pointer"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", isFetching && "animate-spin text-primary")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Bento KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <StatsCard
                    icon={Inbox}
                    label="Total Tiket"
                    value={stats.total}
                    color="text-slate-700 dark:text-slate-200"
                    bgColor="bg-slate-100 dark:bg-slate-800"
                    animationIndex={0}
                    isLoading={statsLoading}
                    onClick={() => {
                        setStatusFilter('all');
                        setPriorityFilter('all');
                    }}
                    isActive={statusFilter === 'all' && priorityFilter === 'all'}
                />

                <StatsCard
                    icon={Flame}
                    label="Critical"
                    value={stats.critical}
                    color="text-red-600 dark:text-red-400"
                    bgColor="bg-red-50 dark:bg-red-950/50"
                    animationIndex={1}
                    isLoading={statsLoading}
                    onClick={() => setPriorityFilter(priorityFilter === 'CRITICAL' ? 'all' : 'CRITICAL')}
                    isActive={priorityFilter === 'CRITICAL'}
                />

                <StatsCard
                    icon={CircleDot}
                    label="Open"
                    value={stats.open}
                    color="text-blue-600 dark:text-blue-400"
                    bgColor="bg-blue-50 dark:bg-blue-950/50"
                    animationIndex={2}
                    isLoading={statsLoading}
                    onClick={() => setStatusFilter(statusFilter === 'TODO' ? 'all' : 'TODO')}
                    isActive={statusFilter === 'TODO'}
                />

                <StatsCard
                    icon={Clock}
                    label="In Progress"
                    value={stats.inProgress}
                    color="text-indigo-600 dark:text-indigo-400"
                    bgColor="bg-indigo-50 dark:bg-indigo-950/50"
                    animationIndex={3}
                    isLoading={statsLoading}
                    onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'all' : 'IN_PROGRESS')}
                    isActive={statusFilter === 'IN_PROGRESS'}
                />

                <StatsCard
                    icon={CheckCircle2}
                    label="Resolved"
                    value={stats.resolved}
                    color="text-emerald-600 dark:text-emerald-400"
                    bgColor="bg-emerald-50 dark:bg-emerald-950/50"
                    animationIndex={4}
                    isLoading={statsLoading}
                    onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? 'all' : 'RESOLVED')}
                    isActive={statusFilter === 'RESOLVED'}
                />

                <StatsCard
                    icon={TrendingUp}
                    label="SLA Overdue"
                    value={stats.overdue}
                    color="text-amber-600 dark:text-amber-400"
                    bgColor="bg-amber-50 dark:bg-amber-950/50"
                    animationIndex={5}
                    isLoading={statsLoading}
                />
            </div>

            {/* Dynamic Filter Section */}
            <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">Filter & Pencarian Tiket</span>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                            Reset Filter
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Search Query */}
                    <div className="md:col-span-4 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari no tiket, subjek, requester..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-8 h-10 rounded-xl bg-background border-border/80 focus-visible:ring-primary text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Multi-Site Selector */}
                    <div className="md:col-span-3">
                        <SiteSelector
                            selectedSiteIds={selectedSites}
                            onSelectionChange={setSelectedSites}
                            mode="multi"
                        />
                    </div>

                    {/* Status Select */}
                    <div className="md:col-span-2.5">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10 rounded-xl bg-background border-border/80 text-sm">
                                <SelectValue placeholder="Semua Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/80">
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="TODO">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                                        To Do / Open
                                    </span>
                                </SelectItem>
                                <SelectItem value="IN_PROGRESS">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        In Progress
                                    </span>
                                </SelectItem>
                                <SelectItem value="WAITING_VENDOR">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                                        Waiting Vendor
                                    </span>
                                </SelectItem>
                                <SelectItem value="RESOLVED">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Resolved
                                    </span>
                                </SelectItem>
                                <SelectItem value="CANCELLED">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                        Cancelled
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Priority Select */}
                    <div className="md:col-span-2.5">
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-10 rounded-xl bg-background border-border/80 text-sm">
                                <SelectValue placeholder="Semua Prioritas" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/80">
                                <SelectItem value="all">Semua Prioritas</SelectItem>
                                <SelectItem value="CRITICAL">
                                    <span className="flex items-center gap-2 text-red-600 font-semibold">
                                        <Flame className="w-3.5 h-3.5 text-red-500" />
                                        Critical
                                    </span>
                                </SelectItem>
                                <SelectItem value="HIGH">
                                    <span className="flex items-center gap-2 text-orange-600 font-semibold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                                        High
                                    </span>
                                </SelectItem>
                                <SelectItem value="MEDIUM">
                                    <span className="flex items-center gap-2 text-yellow-600 font-semibold">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        Medium
                                    </span>
                                </SelectItem>
                                <SelectItem value="LOW">
                                    <span className="flex items-center gap-2 text-slate-600 font-semibold">
                                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                                        Low
                                    </span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Interactive Bento Table Card */}
            <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/40 border-b border-border/80">
                            <TableRow className="hover:bg-transparent">
                                <TableHead
                                    className="cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-muted-foreground w-[160px]"
                                    onClick={() => handleSort('ticketNumber')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Tiket</span>
                                        {sortBy === 'ticketNumber' && (
                                            sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        )}
                                    </div>
                                </TableHead>

                                <TableHead
                                    className="cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-muted-foreground w-[90px]"
                                    onClick={() => handleSort('site')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Site</span>
                                        {sortBy === 'site' && (
                                            sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        )}
                                    </div>
                                </TableHead>

                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground min-w-[240px]">
                                    Judul / Subjek
                                </TableHead>

                                <TableHead
                                    className="cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-muted-foreground w-[130px]"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Status</span>
                                        {sortBy === 'status' && (
                                            sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        )}
                                    </div>
                                </TableHead>

                                <TableHead
                                    className="cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-muted-foreground w-[110px]"
                                    onClick={() => handleSort('priority')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Prioritas</span>
                                        {sortBy === 'priority' && (
                                            sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        )}
                                    </div>
                                </TableHead>

                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground w-[180px]">
                                    Requester
                                </TableHead>

                                <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground w-[180px]">
                                    Assigned To
                                </TableHead>

                                <TableHead
                                    className="cursor-pointer select-none font-bold text-xs uppercase tracking-wider text-muted-foreground w-[150px]"
                                    onClick={() => handleSort('createdAt')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span>Dibuat</span>
                                        {sortBy === 'createdAt' && (
                                            sortOrder === 'ASC' ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5 text-primary" />
                                        )}
                                    </div>
                                </TableHead>

                                <TableHead className="text-right font-bold text-xs uppercase tracking-wider text-muted-foreground w-[80px]">
                                    Aksi
                                </TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 8 }).map((_, idx) => (
                                    <TableRow key={idx} className="animate-pulse">
                                        <TableCell><div className="h-4 w-24 bg-muted rounded" /></TableCell>
                                        <TableCell><div className="h-5 w-12 bg-muted rounded-full" /></TableCell>
                                        <TableCell><div className="h-4 w-56 bg-muted rounded" /></TableCell>
                                        <TableCell><div className="h-5 w-20 bg-muted rounded-full" /></TableCell>
                                        <TableCell><div className="h-5 w-16 bg-muted rounded-full" /></TableCell>
                                        <TableCell><div className="h-4 w-32 bg-muted rounded" /></TableCell>
                                        <TableCell><div className="h-4 w-32 bg-muted rounded" /></TableCell>
                                        <TableCell><div className="h-4 w-20 bg-muted rounded" /></TableCell>
                                        <TableCell><div className="h-8 w-8 bg-muted rounded-lg ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : tickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                                            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3 text-muted-foreground">
                                                <Ticket className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-base font-bold text-foreground">Tidak Ada Tiket Ditemukan</h3>
                                            <p className="text-xs text-muted-foreground mt-1 text-center">
                                                {hasActiveFilters
                                                    ? 'Coba sesuaikan filter atau kata kunci pencarian Anda untuk melihat tiket lainnya.'
                                                    : 'Belum ada tiket yang terdaftar saat ini.'}
                                            </p>
                                            {hasActiveFilters && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={clearAllFilters}
                                                    className="mt-4 rounded-xl text-xs"
                                                >
                                                    Reset Filter
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tickets.map((ticket) => {
                                    const statusCfg = STATUS_CONFIG[ticket.status] || {
                                        label: ticket.status,
                                        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                                    };
                                    const priorityCfg = PRIORITY_CONFIG[ticket.priority] || {
                                        label: ticket.priority,
                                        badgeColor: 'bg-slate-100 text-slate-600',
                                        dot: 'bg-slate-400',
                                    };

                                    const requesterName = ticket.user?.fullName || ticket.requester?.fullName || '-';
                                    const assigneeName = ticket.assignedTo?.fullName || 'Unassigned';

                                    return (
                                        <TableRow
                                            key={ticket.id}
                                            onClick={() => setSelectedTicketId(ticket.id)}
                                            className="group hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/50"
                                        >
                                            {/* Ticket Number */}
                                            <TableCell className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{ticket.ticketNumber}</span>
                                                </div>
                                            </TableCell>

                                            {/* Site Badge */}
                                            <TableCell>
                                                {ticket.site?.code ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-secondary/80 text-foreground border border-border/60">
                                                        {ticket.site.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </TableCell>

                                            {/* Subject / Title */}
                                            <TableCell>
                                                <div className="max-w-[320px] sm:max-w-[420px]">
                                                    <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                                        {ticket.subject || ticket.title || 'Untitled Ticket'}
                                                    </p>
                                                    {ticket.category?.name && (
                                                        <span className="text-[11px] text-muted-foreground truncate block">
                                                            {ticket.category.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Status Badge */}
                                            <TableCell>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs",
                                                    statusCfg.color
                                                )}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                                                    {statusCfg.label}
                                                </span>
                                            </TableCell>

                                            {/* Priority Badge */}
                                            <TableCell>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-2xs",
                                                    priorityCfg.badgeColor
                                                )}>
                                                    {ticket.priority === 'CRITICAL' && <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" />}
                                                    {ticket.priority === 'HIGH' && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                                                    {priorityCfg.label}
                                                </span>
                                            </TableCell>

                                            {/* Requester */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {requesterName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-xs font-medium text-foreground truncate max-w-[140px]" title={requesterName}>
                                                        {requesterName}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Assigned To */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className={cn(
                                                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                                        ticket.assignedTo ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {assigneeName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={cn(
                                                        "text-xs truncate max-w-[140px]",
                                                        ticket.assignedTo ? "font-medium text-foreground" : "text-muted-foreground italic"
                                                    )} title={assigneeName}>
                                                        {assigneeName}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Created At */}
                                            <TableCell>
                                                <span
                                                    className="text-xs text-muted-foreground whitespace-nowrap"
                                                    title={ticket.createdAt ? format(new Date(ticket.createdAt), 'dd MMMM yyyy HH:mm', { locale: idLocale }) : undefined}
                                                >
                                                    {ticket.createdAt
                                                        ? formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: idLocale })
                                                        : '-'}
                                                </span>
                                            </TableCell>

                                            {/* Action Detail */}
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedTicketId(ticket.id)}
                                                    className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                                                    title="Lihat Log Aktivitas Tiket"
                                                    aria-label="Lihat Log Aktivitas Tiket"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Server Pagination */}
                <div className="px-4 pb-4">
                    <TicketListPagination
                        paginationInfo={paginationInfo}
                        currentPage={currentPage}
                        goToPage={(page) => setCurrentPage(page)}
                        getPageNumbers={getPageNumbers}
                    />
                </div>
            </div>

            {/* Manager Ticket Activity & Audit Trail Modal */}
            <ManagerTicketActivityModal
                ticketId={selectedTicketId}
                open={!!selectedTicketId}
                onOpenChange={(open) => {
                    if (!open) setSelectedTicketId(null);
                }}
            />
        </div>
    );
};

export default ManagerTicketsPage;
