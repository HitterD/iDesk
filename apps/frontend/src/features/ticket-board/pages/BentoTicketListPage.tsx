import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Columns3,
    TableProperties,
    UserCheck,
    Search,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    MessageSquare,
    X,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    Inbox,
    TrendingUp,
    Flame,
    RefreshCw,
    Plus,
    Ticket as TicketIcon,
    Loader2
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Agent } from '../components/ticket-detail/types';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { format } from 'date-fns';
import { useSavedFilters, SavedFilter } from '@/hooks/useSavedFilters';
import { useSoundNotification } from '@/hooks/useSoundNotification';
import { useDebounce } from '@/hooks/useDebounce';
import type { Ticket as ApiTicket } from '@/lib/api/types';

// Extracted components
import { StatsCard } from '../components/StatsCard';
import { CustomDropdown, PriorityDropdown, StatusDropdown } from '../components/TicketDropdowns';
import { TargetDateCell } from '../components/TargetDateCell';
import { SortableHeader, SortField, SortOrder } from '../components/SortableHeader';
import { BulkActionsBar, SelectCheckbox } from '../components/BulkActionsBar';
import { SecondaryFiltersMenu } from '../components/SecondaryFiltersMenu';
import { TicketListRow } from '../components/TicketListRow';
import { VirtualizedTicketList } from '../components/VirtualizedTicketList';
import { BulkAssignDialog } from '../components/BulkAssignDialog';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import { TicketListActiveFilters } from '../components/TicketListActiveFilters';
import { TicketListPagination } from '../components/TicketListPagination';
import { Ticket } from '../types/ticket.types';
import { useTicketListMutations } from '../hooks/useTicketListMutations';
import { SiteSelector } from '@/components/site/SiteSelector';

interface LocalPaginationMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

interface PaginatedResponse {
    data: Ticket[];
    meta: LocalPaginationMeta;
}

// Inline component definitions removed - now imported from separate files

export const BentoTicketListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { playNewTicketSound, playCriticalSound } = useSoundNotification();

    const handleNewTicket = useCallback((ticket: ApiTicket) => {
        if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
            // Play notification sound
            if (ticket.priority === 'CRITICAL') {
                playCriticalSound();
            } else {
                playNewTicketSound();
            }

            toast.info('New Ticket', {
                description: `${ticket.ticketNumber || ''}: ${ticket.subject}`,
                action: {
                    label: 'View',
                    onClick: () => navigate(`/tickets/${ticket.id}`),
                },
                duration: 8000,
            });
        }
    }, [user, navigate, playNewTicketSound, playCriticalSound]);

    const { isConnected } = useTicketListSocket({ onNewTicket: handleNewTicket });
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';

    // Sorting state
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    // Bulk selection state
    const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
    const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);

    // Debounce search query to avoid excessive API calls
    const debouncedSearch = useDebounce(searchQuery, 300);

    // Saved Filters
    const { currentFilter, getFilterValues } = useSavedFilters();

    // Apply saved filter on load
    useEffect(() => {
        const filterValues = getFilterValues();
        if (filterValues) {
            if (filterValues.status?.length) setStatusFilter(filterValues.status[0]);
            if (filterValues.priority?.length) setPriorityFilter(filterValues.priority[0]);
            if (filterValues.search) setSearchQuery(filterValues.search);
        }
    }, [currentFilter]);

    // Current filters object for SavedFiltersDropdown
    const currentFilters = useMemo(() => ({
        status: statusFilter ? [statusFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
        search: searchQuery || undefined,
    }), [statusFilter, priorityFilter, searchQuery]);

    const handleApplySavedFilter = (filters: SavedFilter['filters'] | null) => {
        if (!filters) {
            setSearchQuery('');
            setStatusFilter('');
            setPriorityFilter('');
            return;
        }
        if (filters.status?.length) setStatusFilter(filters.status[0]);
        else setStatusFilter('');
        if (filters.priority?.length) setPriorityFilter(filters.priority[0]);
        else setPriorityFilter('');
        if (filters.search) setSearchQuery(filters.search);
        else setSearchQuery('');
    };

    // Reset to page 1 when filters change (before the query)
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, priorityFilter, showAssignedToMe, selectedSites]);

    // Server-side paginated tickets query
    const { data: paginatedData, isLoading, isFetching } = useQuery<PaginatedResponse>({
        queryKey: ['tickets', 'paginated', {
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            search: debouncedSearch || undefined,
            siteIds: selectedSites.length > 0 ? selectedSites : undefined,
            assignedToMe: showAssignedToMe || undefined,
            sortBy: sortBy || 'createdAt',
            sortOrder: sortOrder || 'DESC',
        }],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', String(currentPage));
            params.append('limit', String(ITEMS_PER_PAGE));
            params.append('excludeCategory', 'ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST'); // Exclude Request Center categories
            params.append('excludeType', 'HARDWARE_INSTALLATION'); // Exclude HW from general list
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (selectedSites.length > 0) {
                selectedSites.forEach(siteId => params.append('siteIds', siteId));
            }
            if (sortBy) params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);
            const res = await api.get(`/tickets/paginated?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData, // Keep previous data while fetching
        refetchInterval: 60000, // Auto-poll every 60s as fallback
    });

    // Fetch dashboard stats separately (for stat cards - doesn't need to refetch on pagination)
    const { data: statsData } = useQuery<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
        overdue: number;
        critical: number;
    }>({
        queryKey: ['dashboard-stats', { excludeCategory: 'ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST' }],
        queryFn: async () => {
            const res = await api.get('/tickets/dashboard/stats?excludeCategory=ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST');
            return res.data;
        },
        staleTime: 30000, // 30 seconds
    });

    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
    });

    const { assignTicketMutation, updateStatusMutation, updatePriorityMutation } = useTicketListMutations(agents);

    // Use server response data
    const tickets = paginatedData?.data || [];
    const paginationMeta = paginatedData?.meta;

    // Client-side filter for "My Tasks" (assigned to me)
    const filteredTickets = useMemo(() => {
        let result = tickets;

        if (showAssignedToMe) {
            result = result.filter((t) => t.assignedTo?.id === user?.id);
        }
        return result;
    }, [tickets, showAssignedToMe, user?.id]);

    // Pagination info from server
    const paginationInfo = useMemo(() => {
        const meta = paginationMeta || { total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 0, hasNextPage: false, hasPrevPage: false };
        return {
            totalItems: meta.total,
            totalPages: meta.totalPages,
            startIndex: (meta.page - 1) * meta.limit,
            endIndex: Math.min((meta.page - 1) * meta.limit + filteredTickets.length, meta.total),
            showPagination: meta.total > ITEMS_PER_PAGE,
            currentPage: meta.page,
            hasNextPage: meta.hasNextPage,
            hasPrevPage: meta.hasPrevPage,
        };
    }, [paginationMeta, filteredTickets.length, ITEMS_PER_PAGE]);

    // Stats from dashboard endpoint
    const stats = useMemo(() => ({
        total: statsData?.total || 0,
        open: statsData?.open || 0,
        inProgress: statsData?.inProgress || 0,
        resolved: statsData?.resolved || 0,
        overdue: statsData?.overdue || 0,
        critical: statsData?.critical || 0,
    }), [statsData]);

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPriorityFilter('');
        setSelectedSites([]);
        setSearchParams({});
        setCurrentPage(1);
    };

    // Sorting handler
    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            // Toggle order if same field
            setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
        } else {
            // New field, default to DESC
            setSortBy(field);
            setSortOrder('DESC');
        }
        setCurrentPage(1);
    }, [sortBy]);

    // Bulk selection handlers
    const handleSelectTicket = useCallback((ticketId: string, selected: boolean) => {
        setSelectedTickets(prev => {
            const next = new Set(prev);
            if (selected) {
                next.add(ticketId);
            } else {
                next.delete(ticketId);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((selected: boolean) => {
        if (selected) {
            setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
        } else {
            setSelectedTickets(new Set());
        }
    }, [filteredTickets]);

    const clearSelection = useCallback(() => {
        setSelectedTickets(new Set());
    }, []);

    // Bulk actions using existing mutations
    const handleBulkAssign = useCallback(() => {
        setShowBulkAssignDialog(true);
    }, []);

    const handleBulkAssignSubmit = useCallback(async (assigneeId: string) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/assign', { ticketIds, assigneeId });
            toast.success(`${ticketIds.length} tickets assigned successfully`);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            clearSelection();
        } catch (error) {
            toast.error('Failed to assign tickets');
            throw error; // Re-throw to let dialog handle loading state
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleBulkStatusChange = useCallback(async (status: string) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/update', { ticketIds, status });
            toast.success(`${ticketIds.length} tickets updated to ${status}`);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            clearSelection();
        } catch (error) {
            toast.error('Failed to update tickets');
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const isAllSelected = filteredTickets.length > 0 && selectedTickets.size === filteredTickets.length;
    const isIndeterminate = selectedTickets.size > 0 && selectedTickets.size < filteredTickets.length;

    // Pagination handlers
    const goToPage = useCallback((page: number) => {
        const targetPage = Math.max(1, Math.min(page, paginationInfo.totalPages));
        setCurrentPage(targetPage);
        // Scroll to top of list
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [paginationInfo.totalPages]);

    const getPageNumbers = useCallback(() => {
        const { totalPages, currentPage } = paginationInfo;
        const pages: (number | string)[] = [];

        if (totalPages <= 7) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show pages around current page
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    }, [paginationInfo]);

    const hasActiveFilters = Boolean(searchQuery || statusFilter || priorityFilter || showAssignedToMe || selectedSites.length > 0);
    const canEdit = user?.role === 'ADMIN' || user?.role === 'AGENT';
    const showSiteColumn = user?.role === 'ADMIN';

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
                        <TicketIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">All Tickets</h1>
                            {isConnected && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-icon-pulse" />
                                    <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Live</span>
                                </div>
                            )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">View and manage all support requests</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* New Ticket Button */}
                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Ticket</span>
                    </button>

                    {/* My Tasks Filter */}
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
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-semibold shadow-sm border",
                                showAssignedToMe
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-white dark:bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200'
                            )}
                        >
                            <UserCheck className="w-4 h-4" />
                            <span className="hidden sm:inline">My Tasks</span>
                        </button>
                    )}

                    {/* View Toggle */}
                    <div className="flex bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-1 rounded-xl shadow-sm">
                        <button
                            onClick={() => navigate('/kanban')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:text-primary rounded-lg transition-colors"
                            title="Kanban Board"
                        >
                            <Columns3 className="w-4 h-4" />
                            <span className="text-xs font-semibold hidden md:inline">Kanban</span>
                        </button>
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-bold"
                            title="Table View"
                        >
                            <TableProperties className="w-4 h-4" />
                            <span className="text-xs font-semibold hidden md:inline">Table</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Cards - Click to filter */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatsCard icon={TrendingUp} label="Total" value={stats.total} color="text-primary dark:text-blue-400" bgColor="bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/20" animationIndex={0} onClick={() => { setStatusFilter(''); setPriorityFilter(''); }} isActive={!statusFilter && !priorityFilter} />
                <StatsCard icon={Inbox} label="Open" value={stats.open} color="text-[hsl(var(--info-500))]" bgColor="bg-[hsl(var(--info-500))]/10" animationIndex={1} onClick={() => setStatusFilter('TODO')} isActive={statusFilter === 'TODO'} />
                <StatsCard icon={CircleDot} label="In Progress" value={stats.inProgress} color="text-[hsl(var(--warning-500))]" bgColor="bg-[hsl(var(--warning-500))]/10" animationIndex={2} onClick={() => setStatusFilter('IN_PROGRESS')} isActive={statusFilter === 'IN_PROGRESS'} />
                <StatsCard icon={CheckCircle2} label="Resolved" value={stats.resolved} color="text-[hsl(var(--success-500))]" bgColor="bg-[hsl(var(--success-500))]/10" animationIndex={3} onClick={() => setStatusFilter('RESOLVED')} isActive={statusFilter === 'RESOLVED'} />
                <StatsCard icon={AlertTriangle} label="Overdue" value={stats.overdue} color="text-[hsl(var(--error-500))]" bgColor="bg-[hsl(var(--error-500))]/10" highlight animationIndex={4} />
                <StatsCard icon={Flame} label="Critical" value={stats.critical} color="text-[hsl(var(--error-500))]" bgColor="bg-[hsl(var(--error-500))]/10" highlight animationIndex={5} onClick={() => setPriorityFilter('CRITICAL')} isActive={priorityFilter === 'CRITICAL'} />
            </div>

            {/* Search & Filters */}
            <div
                className="flex flex-col lg:flex-row lg:items-center gap-3 p-2 bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] relative z-20 shadow-sm"
                role="search"
                aria-label="Ticket search and filters"
            >
                <div className="relative flex-1 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                        type="search"
                        id="ticket-search"
                        name="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tickets by title, number, or requester..."
                        aria-label="Search tickets"
                        aria-describedby="search-hint"
                        autoComplete="off"
                        className="w-full pl-10 pr-4 py-2 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 text-sm font-medium"
                    />
                    <span id="search-hint" className="sr-only">
                        Type to search tickets. Results will update automatically.
                    </span>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden lg:block mx-1" />

                {/* Primary Filters */}
                <div className="flex flex-wrap items-center gap-2 px-1 pb-1 lg:pb-0">
                    <CustomDropdown
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val === "ALL" ? "" : val)}
                        placeholder="All Status"
                        options={[
                            { value: 'ALL', label: 'All Status' },
                            { value: 'TODO', label: 'Open' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'WAITING_VENDOR', label: 'Waiting Vendor' },
                            { value: 'RESOLVED', label: 'Resolved' },
                        ]}
                    />

                    <CustomDropdown
                        value={priorityFilter}
                        onChange={(val) => setPriorityFilter(val === "ALL" ? "" : val)}
                        placeholder="All Priority"
                        icon={AlertTriangle}
                        options={[
                            { value: 'ALL', label: 'All Priority' },
                            { value: 'LOW', label: 'Low' },
                            { value: 'MEDIUM', label: 'Medium' },
                            { value: 'HIGH', label: 'High' },
                            { value: 'CRITICAL', label: 'Critical' },
                        ]}
                    />

                    {/* Site Selector - Visible for Admin */}
                    {user?.role === 'ADMIN' && (
                        <SiteSelector
                            selectedSiteIds={selectedSites}
                            onSelectionChange={setSelectedSites}
                            mode="multi"
                            className="h-9"
                        />
                    )}

                    <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                    {/* Secondary Filters Menu - Saved Filters, Export */}
                    <SecondaryFiltersMenu
                        currentFilters={currentFilters}
                        onApplySavedFilter={handleApplySavedFilter}
                        exportData={filteredTickets.map(t => ({
                            id: t.id,
                            ticketNumber: t.ticketNumber || t.id.slice(0, 8),
                            title: t.title,
                            site: t.site?.code || '-',
                            status: t.status,
                            priority: t.priority,
                            category: t.category || '',
                            requester: t.user?.fullName || '',
                            assignedTo: t.assignedTo?.fullName || 'Unassigned',
                            createdAt: format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm'),
                        }))}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
                        hasActiveFilters={hasActiveFilters}
                        onClearFilters={clearFilters}
                    />
                </div>
            </div>

            {/* Active Filter Chips - P3 MEDIUM: Removable filter badges */}
            <TicketListActiveFilters
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                priorityFilter={priorityFilter}
                setPriorityFilter={setPriorityFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showAssignedToMe={showAssignedToMe}
                setSearchParams={setSearchParams}
                selectedSites={selectedSites}
                setSelectedSites={setSelectedSites}
                clearFilters={clearFilters}
            />

            {/* Tickets List Table */}
            <div
                className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden relative shadow-sm"
                role="region"
                aria-label="Tickets list"
                aria-busy={isFetching}
            >
                {/* Loading overlay for filter/pagination changes */}
                {isFetching && !isLoading && (
                    <div
                        className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center"
                        aria-live="polite"
                    >
                        <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
                        <span className="sr-only">Loading tickets...</span>
                    </div>
                )}
                {filteredTickets.length === 0 && !isFetching ? (
                    <div className="p-12 text-center" role="status" aria-live="polite">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" aria-hidden="true" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No tickets found</p>
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div
                            className={cn(
                                "sticky top-0 z-20 hidden lg:grid items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-[hsl(var(--border))]",
                                "border-l-4 border-l-transparent", // Fix the 4px shifter bug
                                showSiteColumn
                                    ? "lg:grid-cols-[32px_minmax(280px,2fr)_112px_80px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]"
                                    : "lg:grid-cols-[32px_minmax(280px,2fr)_112px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]"
                            )}
                            role="row"
                            aria-label="Table headers"
                        >
                            {/* Checkbox column */}
                            {canEdit && (
                                <div className="w-8 shrink-0">
                                    <SelectCheckbox
                                        checked={isAllSelected}
                                        indeterminate={isIndeterminate}
                                        onChange={handleSelectAll}
                                    />
                                </div>
                            )}
                            <SortableHeader
                                label="Ticket"
                                field="title"
                                currentSortBy={sortBy}
                                currentSortOrder={sortOrder}
                                onSort={handleSort}
                                className=""
                            />
                            <SortableHeader
                                label="Priority"
                                field="priority"
                                currentSortBy={sortBy}
                                currentSortOrder={sortOrder}
                                onSort={handleSort}
                                className=""
                            />
                            {showSiteColumn && <div className="">Site</div>}
                            <SortableHeader
                                label="Status"
                                field="status"
                                currentSortBy={sortBy}
                                currentSortOrder={sortOrder}
                                onSort={handleSort}
                                className=""
                            />
                            <div className="">Requester</div>
                            <div className="">Assigned To</div>
                            <div className="">Target Date</div>
                            <SortableHeader
                                label="Created"
                                field="createdAt"
                                currentSortBy={sortBy}
                                currentSortOrder={sortOrder}
                                onSort={handleSort}
                                className=""
                            />
                        </div>

                        <VirtualizedTicketList
                            tickets={filteredTickets}
                            showSiteColumn={showSiteColumn}
                            canEdit={canEdit}
                            selectedTickets={selectedTickets}
                            agents={agents}
                            onSelect={handleSelectTicket}
                            onUpdatePriority={(ticketId, priority) =>
                                updatePriorityMutation.mutate({ ticketId, priority })
                            }
                            onUpdateStatus={(ticketId, status) =>
                                updateStatusMutation.mutate({ ticketId, status })
                            }
                            onAssign={(ticketId, assigneeId) =>
                                assignTicketMutation.mutate({ ticketId, assigneeId })
                            }
                            hasActiveFilters={hasActiveFilters}
                            onClearFilters={clearFilters}
                        />
                        
                        {/* Pagination Controls - Inline, inside table container */}
                        <div className="px-4 pb-4">
                            <TicketListPagination
                                paginationInfo={paginationInfo}
                                currentPage={currentPage}
                                goToPage={goToPage}
                                getPageNumbers={getPageNumbers}
                            />
                            
                            {/* Results Count (when no pagination needed) */}
                            {
                                !paginationInfo.showPagination && filteredTickets.length > 0 && (
                                    <div className="text-center text-sm text-slate-400 mt-4">
                                        Showing {filteredTickets.length} of {paginationInfo.totalItems || tickets.length} tickets
                                    </div>
                                )
                            }
                        </div>
                    </>
                )}
            </div>

            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedCount={selectedTickets.size}
                onAssign={handleBulkAssign}
                onChangeStatus={handleBulkStatusChange}
                onClear={clearSelection}
            />

            {/* Bulk Assign Dialog */}
            <BulkAssignDialog
                isOpen={showBulkAssignDialog}
                onClose={() => setShowBulkAssignDialog(false)}
                selectedCount={selectedTickets.size}
                agents={agents}
                onAssign={handleBulkAssignSubmit}
            />
        </div >
    );
};

// Export wrapped with Error Boundary
export default function BentoTicketListPageWithErrorBoundary() {
    return (
        <TicketBoardErrorBoundary>
            <BentoTicketListPage />
        </TicketBoardErrorBoundary>
    );
}
