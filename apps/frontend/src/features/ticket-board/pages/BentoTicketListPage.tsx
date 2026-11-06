import { QueueCardToolbar } from '../components/QueueCardToolbar';
import { Ticket as TicketIcon } from 'lucide-react';
import { QueueHeader, QueueToggles } from '../components/QueueHeader';
import { QueueFilterBar, PRIORITY_FILTER_OPTIONS } from '../components/QueueFilterBar';
import { QueueTableHeader } from '../components/QueueTableHeader';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import {
    Columns3,
    TableProperties,
    UserCheck,
    FilePen,
    AlertTriangle,
    CheckCircle2,
    CircleDot,
    Hourglass,
    MessageSquare,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    Inbox,
    TrendingUp,
    Flame,
    RefreshCw,
    Plus,
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
import type { Agent } from '../components/TicketListRow';
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
import type { SortField, SortOrder } from '../components/SortableHeader';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
import { MergeTicketsModal } from '../components/MergeTicketsModal';
import { SecondaryFiltersMenu } from '../components/SecondaryFiltersMenu';
import { TicketListRow } from '../components/TicketListRow';
import { VirtualizedTicketList } from '../components/VirtualizedTicketList';
import { BulkAssignDialog } from '../components/BulkAssignDialog';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import { TicketListActiveFilters } from '../components/TicketListActiveFilters';
import { TicketListPagination } from '../components/TicketListPagination';
import { Ticket } from '../types/ticket.types';
import { useTicketListMutations } from '../hooks/useTicketListMutations';
import { useQueueStats } from '../hooks/useQueueStats';
import { isHandledByTakeoverDialog, type TakeoverOptions } from '../hooks/useStatusTakeover';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { BentoTicketKanban } from '../components/BentoTicketKanban';
import { ACTIVE_STATUS_FILTER, DONE_STATUS_FILTER } from '../constants/statusFilters';
import { useResetPageOnChange, useTicketListUrlState } from '../hooks/useTicketListUrlState';
import { SiteSelector } from '@/components/site/SiteSelector';
import { REPORT_TEAM_LABELS, TEAM_FILTER_ORDER } from '@/features/reports/reportTeams';

const CROSS_SITE_ROLES = ['ADMIN','MANAGER','AGENT_ORACLE'] as const;
const isCrossSiteRole = (role?: string | null) => (CROSS_SITE_ROLES as readonly string[]).includes(role as string);
/** The manager oversees every team: one overview of IT Support and the developer queues. */
const ALL_TEAMS_ROLES = ['MANAGER'] as const;
const seesAllTeams = (role?: string | null) => (ALL_TEAMS_ROLES as readonly string[]).includes(role as string);
const TEAM_PARAM = 'team';
const TEAM_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Semua' },
    ...TEAM_FILTER_ORDER.map((team) => ({ value: team, label: REPORT_TEAM_LABELS[team] })),
];

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
    const {
        searchQuery, setSearchQuery,
        statusFilter, setStatusFilter,
        priorityFilter, setPriorityFilter,
        overdueFilter, setOverdueFilter,
        selectedSites, setSelectedSites,
        currentPage, setCurrentPage,
    } = useTicketListUrlState();
    const ITEMS_PER_PAGE = 20;
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';
    // Tickets I filed (for myself or on behalf of someone), from any team.
    const showCreatedByMe = searchParams.get('filter') === 'created_by_me';
    const allTeams = seesAllTeams(user?.role);
    const teamFilter = allTeams ? (searchParams.get(TEAM_PARAM) ?? '') : '';
    const setTeamFilter = (team: string) => setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (team) next.set(TEAM_PARAM, team); else next.delete(TEAM_PARAM);
        return next;
    }, { replace: true });

    // Sorting state
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    // Bulk selection state
    const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
    const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

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
    useResetPageOnChange([debouncedSearch, statusFilter, priorityFilter, overdueFilter, showAssignedToMe, showCreatedByMe, selectedSites, teamFilter], setCurrentPage);

    // Server-side paginated tickets query
    const { data: paginatedData, isLoading, isFetching } = useQuery<PaginatedResponse>({
        queryKey: ['tickets', 'paginated', {
            page: currentPage,
            limit: ITEMS_PER_PAGE,
            status: statusFilter || undefined,
            priority: priorityFilter || undefined,
            overdue: overdueFilter || undefined,
            search: debouncedSearch || undefined,
            siteIds: selectedSites.length > 0 ? selectedSites : undefined,
            assignedToMe: showAssignedToMe || undefined,
            createdByMe: showCreatedByMe || undefined,
            allTeams: allTeams || undefined,
            team: teamFilter || undefined,
            sortBy: sortBy || 'createdAt',
            sortOrder: sortOrder || 'DESC',
        }],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', String(currentPage));
            params.append('limit', String(ITEMS_PER_PAGE));
            params.append('excludeCategory', 'ICT_BUDGET,LOST_ITEM,ACCESS_REQUEST'); // Exclude Request Center categories
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);
            if (overdueFilter) params.append('overdue', 'true');
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (selectedSites.length > 0) {
                selectedSites.forEach(siteId => params.append('siteIds', siteId));
            }
            if (sortBy) params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);
            if (showCreatedByMe) params.append('createdByMe', 'true');
            if (showAssignedToMe) params.append('assignedToMe', 'true');
            if (allTeams) params.append('allTeams', 'true');
            if (teamFilter) params.append('handlingTeam', teamFilter);
            const res = await api.get(`/tickets/paginated?${params.toString()}`);
            return res.data;
        },
        placeholderData: (previousData) => previousData, // Keep previous data while fetching
        refetchInterval: isConnected ? false : 60000, // fallback poll only while the socket is down
    });

    // Stat cards count the same IT Support queue as the list (team, sites, "Tugas Saya" / "Saya Buat"),
    // so clicking a card always shows that many tickets. Not refetched on pagination.
    const { data: statsData } = useQueueStats(allTeams ? 'all' : 'it-support', { siteIds: selectedSites, assignedToMe: showAssignedToMe, createdByMe: showCreatedByMe, handlingTeam: teamFilter || undefined });

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
        staleTime: 60_000,
    });

    const { assignTicketMutation, updateStatusMutation, updatePriorityMutation } = useTicketListMutations(agents);

    const handleUpdatePriority = useCallback(
        (ticketId: string, priority: string) => updatePriorityMutation.mutate({ ticketId, priority }),
        [updatePriorityMutation]
    );
    const handleUpdateStatus = useCallback(
        (ticketId: string, status: string, resolutionNote?: string, files?: File[], takeover?: TakeoverOptions) =>
            updateStatusMutation.mutateAsync({ ticketId, status, resolutionNote, files, takeover }),
        [updateStatusMutation]
    );
    const handleAssign = useCallback(
        (ticketId: string, assigneeId: string, reason?: string) =>
            assignTicketMutation.mutate({ ticketId, assigneeId, reason }),
        [assignTicketMutation]
    );

    // Use server response data
    const tickets = paginatedData?.data || [];
    const paginationMeta = paginatedData?.meta;

    // "My Tasks" is filtered by the server, so paging and totals match what is shown.
    const filteredTickets = tickets;

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
        waitingVendor: statsData?.waitingVendor || 0,
        resolved: statsData?.resolved || 0,
        overdue: statsData?.overdue || 0,
        critical: statsData?.critical || 0,
    }), [statsData]);

    const applyCardFilters = (status: string, priority = '', overdue = false) => {
        setStatusFilter(status);
        setPriorityFilter(priority);
        setOverdueFilter(overdue);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setPriorityFilter('');
        setOverdueFilter(false);
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

    const handleBulkAssignSubmit = useCallback(async (assigneeId: string, reason?: string) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/assign', { ticketIds, assigneeId, reason });
            toast.success(`${ticketIds.length} tickets assigned successfully`);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            clearSelection();
        } catch (error) {
            toast.error('Failed to assign tickets');
            throw error; // Re-throw to let dialog handle loading state
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleBulkStatusChange = useCallback(async (status: string, takeover?: TakeoverOptions) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/update', { ticketIds, status, ...takeover }, { skipToast: true });
            toast.success(`${ticketIds.length} tickets updated to ${status}`);
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            clearSelection();
        } catch (error) {
            if (isHandledByTakeoverDialog(error, takeover)) throw error;
            toast.error(getApiErrorMessage(error, 'Failed to update tickets'));
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleBulkDelete = useCallback(async () => {
        const ticketIds = Array.from(selectedTickets);
        setIsDeleting(true);
        try {
            const res = await api.delete('/tickets/bulk', { data: { ticketIds } });
            const deleted = res.data?.deleted ?? ticketIds.length;
            const failed = res.data?.failed?.length ?? 0;
            toast.success(
                failed > 0
                    ? `${deleted} ticket dihapus, ${failed} gagal`
                    : `${deleted} ticket dihapus`,
            );
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            clearSelection();
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error('Gagal menghapus ticket');
        } finally {
            setIsDeleting(false);
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const [showMergeDialog, setShowMergeDialog] = useState<boolean>(false);

    const selectedTicketsList = useMemo(
        () => filteredTickets.filter((t) => selectedTickets.has(t.id)),
        [filteredTickets, selectedTickets],
    );

    const selectedTicketNumbers = useMemo(
        () => filteredTickets
            .filter((t) => selectedTickets.has(t.id))
            .map((t) => t.ticketNumber || t.id.slice(0, 8)),
        [filteredTickets, selectedTickets],
    );

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

    const currentView = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';
    const hasActiveFilters = Boolean(searchQuery || statusFilter || priorityFilter || overdueFilter || showAssignedToMe || showCreatedByMe || selectedSites.length > 0 || teamFilter);
    const canEdit = user?.role === 'ADMIN' || Boolean(user?.role && user.role.startsWith('AGENT')) || user?.role === 'MANAGER';
    const showSiteColumn = isCrossSiteRole(user?.role);

    if (user?.role === 'AGENT_ORACLE' && !showCreatedByMe) {
        return <Navigate to="/tickets/oracle-k2" replace />;
    }

    if (currentView === 'kanban') {
        return (
            <BentoTicketKanban
                queue="it-support"
                currentView="kanban"
                onToggleView={(view) => {
                    if (view === 'table') {
                        setSearchParams(prev => {
                            const next = new URLSearchParams(prev);
                            next.delete('view');
                            return next;
                        });
                    }
                }}
            />
        );
    }

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    return (
        <div className="queue-page space-y-4 pb-28 sm:pb-10 min-w-0">
            {allTeams
                ? <QueueHeader title="Ticket Overview" description="Semua tiket dari semua tim dan cabang" icon={TicketIcon} tone="blue" />
                : <QueueHeader title="IT Support Tickets" description="Antrian IT Support untuk semua site Anda" icon={TicketIcon} tone="blue" />}

            {/* Stats Cards - Horizontally scrollable snap strip on mobile, grid on tablet/desktop */}
            <div className="queue-stats queue-stats-7" aria-label="Ringkasan status">
                <StatsCard icon={TrendingUp} tone="neutral" label="Total" value={stats.total} color="text-primary dark:text-blue-400" bgColor="bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/20" animationIndex={0} onClick={() => applyCardFilters('')} isActive={!statusFilter && !priorityFilter && !overdueFilter} />
                <StatsCard icon={Inbox} tone="sky" label="Open" value={stats.open} color="text-[hsl(var(--info-500))]" bgColor="bg-[hsl(var(--info-500))]/10" animationIndex={1} onClick={() => applyCardFilters('TODO')} isActive={statusFilter === 'TODO' && !priorityFilter && !overdueFilter} />
                <StatsCard icon={CircleDot} tone="navy" label="In Progress" value={stats.inProgress} color="text-[hsl(var(--warning-500))]" bgColor="bg-[hsl(var(--warning-500))]/10" animationIndex={2} onClick={() => applyCardFilters('IN_PROGRESS')} isActive={statusFilter === 'IN_PROGRESS' && !priorityFilter && !overdueFilter} />
                <StatsCard icon={Hourglass} tone="amber" label="Waiting Vendor" highlight value={stats.waitingVendor} color="text-amber-600 dark:text-amber-400" bgColor="bg-amber-500/10" animationIndex={3} onClick={() => applyCardFilters('WAITING_VENDOR')} isActive={statusFilter === 'WAITING_VENDOR' && !priorityFilter && !overdueFilter} />
                <StatsCard icon={CheckCircle2} tone="green" label="Resolved" value={stats.resolved} color="text-[hsl(var(--success-500))]" bgColor="bg-[hsl(var(--success-500))]/10" animationIndex={4} onClick={() => applyCardFilters(DONE_STATUS_FILTER)} isActive={statusFilter === DONE_STATUS_FILTER && !priorityFilter && !overdueFilter} />
                <StatsCard icon={AlertTriangle} tone="red" label="Overdue" value={stats.overdue} color="text-[hsl(var(--error-500))]" bgColor="bg-[hsl(var(--error-500))]/10" highlight animationIndex={5} onClick={() => applyCardFilters('', '', !overdueFilter)} isActive={overdueFilter && !statusFilter && !priorityFilter} />
                <StatsCard icon={Flame} tone="red" label="Critical" value={stats.critical} color="text-[hsl(var(--error-500))]" bgColor="bg-[hsl(var(--error-500))]/10" highlight animationIndex={6} onClick={() => applyCardFilters(ACTIVE_STATUS_FILTER, 'CRITICAL')} isActive={priorityFilter === 'CRITICAL' && statusFilter === ACTIVE_STATUS_FILTER && !overdueFilter} />
            </div>

            {/* Search & Filters */}
            <QueueFilterBar id="ticket-search" search={searchQuery} onSearch={setSearchQuery}>


                
                    <CustomDropdown
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val === "ALL" ? "" : val)}
                        placeholder="Semua" filterKey="Status"
                        options={[
                            { value: 'ALL', label: 'Semua' },
                            { value: 'TODO', label: 'Open' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'WAITING_VENDOR', label: 'Waiting Vendor' },
                            { value: 'RESOLVED', label: 'Resolved' },
                            { value: 'CLOSED', label: 'Closed' },
                            { value: DONE_STATUS_FILTER, label: 'Selesai (Resolved + Closed)' },
                            { value: ACTIVE_STATUS_FILTER, label: 'Aktif' },
                        ]}
                    />

                    <CustomDropdown
                        value={priorityFilter}
                        onChange={(val) => setPriorityFilter(val === "ALL" ? "" : val)}
                        placeholder="Semua" filterKey="Prioritas"
                        icon={AlertTriangle}
                        options={PRIORITY_FILTER_OPTIONS}
                    />

                    {allTeams && (
                        <CustomDropdown
                            value={teamFilter}
                            onChange={(val) => setTeamFilter(val === 'ALL' ? '' : val)}
                            placeholder="Semua" filterKey="Tim"
                            options={TEAM_FILTER_OPTIONS}
                        />
                    )}

                    {/* Site Selector - cross-site roles only */}
                    {isCrossSiteRole(user?.role) && (
                        <SiteSelector
                            selectedSiteIds={selectedSites}
                            onSelectionChange={setSelectedSites}
                            mode="multi"
                            variant="pop"
                        />
                    )}

                    <span className="queue-filters-spacer" aria-hidden="true" />

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
                    <QueueToggles canEdit={canEdit}
                        scope={showAssignedToMe ? 'assigned_to_me' : showCreatedByMe ? 'created_by_me' : 'all'}
                        onScopeChange={(scope) => setSearchParams(scope === 'all' ? {} : { filter: scope })} />
                </QueueFilterBar>

            {/* Active Filter Chips - P3 MEDIUM: Removable filter badges */}
            <TicketListActiveFilters
                overdueFilter={overdueFilter}
                setOverdueFilter={setOverdueFilter}
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
                className="queue-table"
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
                <QueueCardToolbar sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}
                    canEdit={canEdit} ticketCount={filteredTickets.length} isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate} onSelectAll={handleSelectAll} />
                {filteredTickets.length === 0 && !isFetching ? (
                    <div className="p-12 text-center" role="status" aria-live="polite">
                        <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" aria-hidden="true" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No tickets found</p>
                    </div>
                ) : (
                    <>
                        <QueueTableHeader showSiteColumn={showSiteColumn} canEdit={canEdit}
                            isAllSelected={isAllSelected} isIndeterminate={isIndeterminate} onSelectAll={handleSelectAll}
                            sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />

                        <VirtualizedTicketList
                            tickets={filteredTickets}
                            showSiteColumn={showSiteColumn}
                            canEdit={canEdit}
                            selectedTickets={selectedTickets}
                            agents={agents}
                            onSelect={handleSelectTicket}
                            onUpdatePriority={handleUpdatePriority}
                            onUpdateStatus={handleUpdateStatus}
                            onAssign={handleAssign}
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
                                    <div className="text-center text-sm text-muted-foreground mt-4">
                                        Menampilkan {filteredTickets.length} dari {paginationInfo.totalItems || tickets.length} tiket
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
                onMerge={() => setShowMergeDialog(true)}
                onDelete={isAdmin ? () => setDeleteDialogOpen(true) : undefined}
            />

            {/* Merge Tickets Modal */}
            <MergeTicketsModal
                isOpen={showMergeDialog}
                onClose={() => setShowMergeDialog(false)}
                tickets={selectedTicketsList}
                onSuccess={clearSelection}
            />

            <BulkDeleteDialog
                isOpen={deleteDialogOpen}
                ticketNumbers={selectedTicketNumbers}
                isLoading={isDeleting}
                onConfirm={handleBulkDelete}
                onCancel={() => setDeleteDialogOpen(false)}
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
