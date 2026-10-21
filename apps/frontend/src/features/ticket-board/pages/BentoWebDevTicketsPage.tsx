import { QueueCardToolbar } from '../components/QueueCardToolbar';
import { QueueHeader } from '../components/QueueHeader';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    X,
    Inbox,
    Loader2,
    CircleDot,
    CheckCircle2,
    TrendingUp,
    AlertTriangle,
    Flame,
    Code2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useWebDevTickets } from '../hooks/useWebDevTickets';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '../components/StatsCard';
import { CustomDropdown } from '../components/TicketDropdowns';
import { SortableHeader, SortField, SortOrder } from '../components/SortableHeader';
import { BulkActionsBar, SelectCheckbox } from '../components/BulkActionsBar';
import { BulkAssignDialog } from '../components/BulkAssignDialog';
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
import { MergeTicketsModal } from '../components/MergeTicketsModal';
import { SecondaryFiltersMenu } from '../components/SecondaryFiltersMenu';
import { VirtualizedTicketList } from '../components/VirtualizedTicketList';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import { TicketListPagination } from '../components/TicketListPagination';
import { TicketListActiveFilters } from '../components/TicketListActiveFilters';
import { useTicketListMutations } from '../hooks/useTicketListMutations';
import { isHandledByTakeoverDialog, type TakeoverOptions } from '../hooks/useStatusTakeover';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { BentoTicketKanban } from '../components/BentoTicketKanban';
import { SiteSelector } from '@/components/site/SiteSelector';
import type { Ticket } from '../hooks/useTickets';
import type { Agent, TicketRowData } from '../components/TicketListRow';

const ITEMS_PER_PAGE = 20;
const CROSS_SITE_ROLES = ['ADMIN', 'MANAGER', 'AGENT_ORACLE'] as const;
const isCrossSiteRole = (role?: string | null) => (CROSS_SITE_ROLES as readonly string[]).includes(role as string);

export const BentoWebDevTicketsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();

    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [selectedSites, setSelectedSites] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const showAssignedToMe = searchParams.get('filter') === 'assigned_to_me';
    const showCreatedByMe = searchParams.get('filter') === 'created_by_me';

    // Sorting state
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    // Bulk selection state
    const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
    const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const debouncedSearch = useDebounce(searchInput, 300);

    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        if (!isNaN(page) && page > 0) setCurrentPage(page);
    }, [searchParams]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, priorityFilter, selectedSites, showAssignedToMe, showCreatedByMe]);

    const { data, isLoading, isError, refetch, isFetching } = useWebDevTickets({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sortBy,
        sortOrder,
        search: debouncedSearch,
        createdByMe: showCreatedByMe,
        assignedToMe: showAssignedToMe,
    });

    const { isConnected } = useTicketListSocket({
        onTicketUpdated: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
        },
    });

    const tickets: Ticket[] = data?.data ?? [];
    const meta = data?.meta;
    const isAdmin = user?.role === 'ADMIN';

    // Fetch agents for assignment (Developer queue)
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', 'web-dev'],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('moduleSlug', 'web-developer');
            params.set('ticketType', 'WEB_DEV_REQUEST');
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
        staleTime: 60_000,
    });

    const { assignTicketMutation, updateStatusMutation, updatePriorityMutation } = useTicketListMutations(agents);

    // Compute stats from tickets in view / meta
    const stats = useMemo(() => {
        return {
            total: meta?.total ?? tickets.length,
            open: tickets.filter((t) => t.status === 'TODO').length,
            inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
            resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
            overdue: tickets.filter((t) => Boolean((t as { isOverdue?: boolean }).isOverdue)).length,
            critical: tickets.filter((t) => t.priority === 'CRITICAL').length,
        };
    }, [tickets, meta]);

    // Apply client-side filters
    const filteredTickets: Ticket[] = useMemo(() => {
        let result = tickets;
        if (statusFilter) {
            result = result.filter((t) => t.status === statusFilter);
        }
        if (priorityFilter) {
            result = result.filter((t) => t.priority === priorityFilter);
        }
        if (selectedSites.length > 0) {
            result = result.filter((t) => t.site?.id && selectedSites.includes(t.site.id));
        }
        return result;
    }, [tickets, statusFilter, priorityFilter, selectedSites]);

    // Map Ticket → TicketRowData shape (reused by VirtualizedTicketList)
    const rowData: TicketRowData[] = useMemo(
        () =>
            filteredTickets.map((t) => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                title: t.title ?? '',
                description: t.description ?? '',
                category: t.category ?? 'WEB_DEV_REQUEST',
                status: (t.status as TicketRowData['status']) ?? 'TODO',
                priority: (t.priority as TicketRowData['priority']) ?? 'MEDIUM',
                source: (t.source as TicketRowData['source']) ?? 'WEB',
                isOverdue: Boolean((t as { isOverdue?: boolean }).isOverdue),
                slaTarget: t.slaTarget,
                slaRemainingMinutes: (t as Ticket & { slaRemainingMinutes?: number | null }).slaRemainingMinutes,
                site: t.site ? { id: t.site.id, name: t.site.name, code: t.site.code } : undefined,
                assignedTo: t.assignedTo
                    ? {
                        id: t.assignedTo.id,
                        fullName: t.assignedTo.fullName,
                        avatarUrl: (t.assignedTo as typeof t.assignedTo & { avatarUrl?: string }).avatarUrl,
                    }
                    : undefined,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                user: {
                    id: t.user?.id,
                    fullName: t.user?.fullName ?? 'Unknown',
                    avatarUrl: (t.user as (NonNullable<Ticket['user']> & { avatarUrl?: string }) | undefined)?.avatarUrl,
                    email: t.user?.email,
                    department: t.user?.department
                        ? { name: t.user.department.name }
                        : undefined,
                },
                participants: (t as any).participants,
                isParticipant: Boolean((t as any).isParticipant),
                hasUnreadChat: Boolean(t.hasUnreadChat),
                unreadMessageCount: t.unreadMessageCount,
            })),
        [filteredTickets]
    );

    const hasActiveFilters = Boolean(searchInput || statusFilter || priorityFilter || showAssignedToMe || showCreatedByMe || selectedSites.length > 0);

    const clearFilters = () => {
        setSearchInput('');
        setStatusFilter('');
        setPriorityFilter('');
        setSelectedSites([]);
        setSearchParams({});
        setCurrentPage(1);
    };

    // Sorting handler
    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
        setCurrentPage(1);
    }, [sortBy]);

    const paginationInfo = useMemo(() => {
        const m = meta || { total: 0, page: 1, limit: ITEMS_PER_PAGE, totalPages: 0, hasNextPage: false, hasPrevPage: false };
        return {
            totalItems: m.total,
            totalPages: m.totalPages,
            startIndex: (m.page - 1) * m.limit,
            endIndex: Math.min((m.page - 1) * m.limit + filteredTickets.length, m.total),
            showPagination: m.total > ITEMS_PER_PAGE,
            currentPage: m.page,
            hasNextPage: m.hasNextPage,
            hasPrevPage: m.hasPrevPage,
        };
    }, [meta, filteredTickets.length]);

    const goToPage = useCallback((page: number) => {
        const targetPage = Math.max(1, Math.min(page, paginationInfo.totalPages));
        setCurrentPage(targetPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [paginationInfo.totalPages]);

    const getPageNumbers = useCallback(() => {
        const { totalPages, currentPage } = paginationInfo;
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    }, [paginationInfo]);

    const handleSelectTicket = useCallback((ticketId: string, selected: boolean) => {
        setSelectedTickets((prev) => {
            const next = new Set(prev);
            if (selected) next.add(ticketId);
            else next.delete(ticketId);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((selected: boolean) => {
        if (selected) {
            setSelectedTickets(new Set(rowData.map((t) => t.id)));
        } else {
            setSelectedTickets(new Set());
        }
    }, [rowData]);

    const clearSelection = useCallback(() => {
        setSelectedTickets(new Set());
    }, []);

    const handleBulkAssign = useCallback(() => {
        setShowBulkAssignDialog(true);
    }, []);

    const handleBulkAssignSubmit = useCallback(async (assigneeId: string, reason?: string) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/assign', { ticketIds, assigneeId, reason });
            toast.success(`${ticketIds.length} tiket Web Developer berhasil ditugaskan`);
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            clearSelection();
            setShowBulkAssignDialog(false);
        } catch (error) {
            toast.error('Gagal menugaskan tiket');
            throw error;
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleBulkStatusChange = useCallback(async (status: string, takeover?: TakeoverOptions) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/update', { ticketIds, status, ...takeover }, { skipToast: true });
            toast.success(`${ticketIds.length} tiket Web Developer diperbarui`);
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            clearSelection();
        } catch (error) {
            if (isHandledByTakeoverDialog(error, takeover)) throw error;
            toast.error(getApiErrorMessage(error, 'Gagal memperbarui tiket'));
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
                    ? `${deleted} tiket dihapus, ${failed} gagal`
                    : `${deleted} tiket dihapus`,
            );
            queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] });
            clearSelection();
            setDeleteDialogOpen(false);
        } catch (error) {
            toast.error('Gagal menghapus tiket');
        } finally {
            setIsDeleting(false);
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleAssign = useCallback(
        (ticketId: string, assigneeId: string, reason?: string) =>
            assignTicketMutation.mutate({ ticketId, assigneeId, reason }),
        [assignTicketMutation]
    );

    const handleUpdateStatus = useCallback(
        (ticketId: string, status: string, resolutionNote?: string, files?: File[], takeover?: TakeoverOptions) =>
            updateStatusMutation.mutateAsync({ ticketId, status, resolutionNote, files, takeover }),
        [updateStatusMutation]
    );

    const handleUpdatePriority = useCallback(
        (ticketId: string, priority: string) =>
            updatePriorityMutation.mutate({ ticketId, priority }),
        [updatePriorityMutation]
    );

    const isAllSelected = rowData.length > 0 && selectedTickets.size === rowData.length;
    const isIndeterminate = selectedTickets.size > 0 && selectedTickets.size < rowData.length;
    const canEdit = user?.role === 'ADMIN' || Boolean(user?.role && user.role.startsWith('AGENT')) || user?.role === 'MANAGER';
    const showSiteColumn = isCrossSiteRole(user?.role);

    const [showMergeDialog, setShowMergeDialog] = useState<boolean>(false);

    const selectedTicketsList = useMemo(
        () => rowData.filter((t) => selectedTickets.has(t.id)),
        [rowData, selectedTickets],
    );

    const selectedTicketNumbers = useMemo(
        () => rowData
            .filter((t) => selectedTickets.has(t.id))
            .map((t) => t.ticketNumber || t.id.slice(0, 8)),
        [rowData, selectedTickets],
    );

    const currentFilters = useMemo(() => ({
        status: statusFilter ? [statusFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
        search: searchInput || undefined,
    }), [statusFilter, priorityFilter, searchInput]);

    const currentView = searchParams.get('view') === 'kanban' ? 'kanban' : 'table';

    if (currentView === 'kanban') {
        return (
            <BentoTicketKanban
                queue="web-dev"
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

    if (isError) {
        return (
            <div className="p-12 text-center bg-card rounded-2xl border border-border shadow-xs">
                <p className="text-destructive font-medium mb-4">Gagal memuat tiket Web Developer</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
                >
                    Coba Lagi
                </button>
            </div>
        );
    }

    return (
        <TicketBoardErrorBoundary>
            <div className="queue-page space-y-4 pb-28 sm:pb-10 min-w-0">
                <QueueHeader title="Web Developer Request" description="Bug, fitur, dan integrasi web portal" icon={Code2} tone="teal"
                    connected={isConnected} canEdit={canEdit}
                    scope={showAssignedToMe ? 'assigned_to_me' : showCreatedByMe ? 'created_by_me' : 'all'}
                    onScopeChange={(scope) => setSearchParams(scope === 'all' ? {} : { filter: scope })} />

                <p className="text-xs text-muted-foreground">Ringkasan status, overdue, dan critical berdasarkan halaman yang dimuat; Total mengikuti server.</p>
                {/* Stats Cards */}
                <div className="queue-stats queue-stats-6" aria-label="Ringkasan status">
                    <StatsCard
                        icon={TrendingUp}
                        tone="neutral" label="Total"
                        value={stats.total}
                        color="text-primary dark:text-blue-400"
                        bgColor="bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/20"
                        animationIndex={0}
                        onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
                        isActive={!statusFilter && !priorityFilter}
                    />
                    <StatsCard
                        icon={Inbox}
                        tone="sky" label="Open"
                        value={stats.open}
                        color="text-[hsl(var(--info-500))]"
                        bgColor="bg-[hsl(var(--info-500))]/10"
                        animationIndex={1}
                        onClick={() => setStatusFilter('TODO')}
                        isActive={statusFilter === 'TODO'}
                    />
                    <StatsCard
                        icon={CircleDot}
                        tone="navy" label="In Progress"
                        value={stats.inProgress}
                        color="text-[hsl(var(--warning-500))]"
                        bgColor="bg-[hsl(var(--warning-500))]/10"
                        animationIndex={2}
                        onClick={() => setStatusFilter('IN_PROGRESS')}
                        isActive={statusFilter === 'IN_PROGRESS'}
                    />
                    <StatsCard
                        icon={CheckCircle2}
                        tone="green" label="Resolved"
                        value={stats.resolved}
                        color="text-[hsl(var(--success-500))]"
                        bgColor="bg-[hsl(var(--success-500))]/10"
                        animationIndex={3}
                        onClick={() => setStatusFilter('RESOLVED')}
                        isActive={statusFilter === 'RESOLVED'}
                    />
                    <StatsCard
                        icon={AlertTriangle}
                        tone="red" label="Overdue"
                        value={stats.overdue}
                        color="text-[hsl(var(--error-500))]"
                        bgColor="bg-[hsl(var(--error-500))]/10"
                        highlight
                        animationIndex={4}
                    />
                    <StatsCard
                        icon={Flame}
                        tone="red" label="Critical"
                        value={stats.critical}
                        color="text-[hsl(var(--error-500))]"
                        bgColor="bg-[hsl(var(--error-500))]/10"
                        highlight
                        animationIndex={5}
                        onClick={() => setPriorityFilter('CRITICAL')}
                        isActive={priorityFilter === 'CRITICAL'}
                    />
                </div>

                {/* Search & Filters */}
                <div
                    className="queue-filters"
                    role="search"
                    aria-label="Ticket search and filters"
                >
                    <div className="relative flex-1 bg-muted/40 rounded-xl transition-all focus-within:ring-1 focus-within:ring-primary focus-within:bg-background border border-transparent focus-within:border-primary/50">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                        <input
                            type="search"
                            id="web-dev-ticket-search"
                            name="search"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Cari tiket Web Developer (nomor / judul / requester)..."
                            aria-label="Search tickets"
                            autoComplete="off"
                            className="w-full pl-10 pr-10 py-2.5 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    <div className="w-px h-8 bg-border hidden lg:block mx-1" />

                    {/* Primary Filters - Horizontal row */}
                    <div className="flex items-center flex-wrap gap-2 min-w-0">
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
                                { value: 'CLOSED', label: 'Closed' },
                            ]}
                        />

                        <CustomDropdown
                            value={priorityFilter}
                            onChange={(val) => setPriorityFilter(val === "ALL" ? "" : val)}
                            placeholder="All Priority"
                            icon={AlertTriangle}
                            options={[
                                { value: 'ALL', label: 'All Priority' },
                                { value: 'LOW', label: 'Low (Minor/Cosmetic)' },
                                { value: 'MEDIUM', label: 'Normal (Moderate)' },
                                { value: 'HIGH', label: 'Urgent (Major Impact)' },
                                { value: 'CRITICAL', label: 'Blocker (Critical)' },
                            ]}
                        />

                        {/* Site Selector - cross-site roles only */}
                        {showSiteColumn && (
                            <SiteSelector
                                selectedSiteIds={selectedSites}
                                onSelectionChange={setSelectedSites}
                                mode="multi"
                                className="h-10"
                            />
                        )}

                        <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block" />

                        {/* Secondary Filters Menu */}
                        <SecondaryFiltersMenu
                            currentFilters={currentFilters}
                            onApplySavedFilter={() => {}}
                            exportData={filteredTickets.map((t) => ({
                                id: t.id,
                                ticketNumber: t.ticketNumber || t.id.slice(0, 8),
                                title: t.title,
                                site: t.site?.code || '-',
                                status: t.status,
                                priority: t.priority,
                                category: t.category || 'WEB_DEV_REQUEST',
                                requester: t.user?.fullName || '',
                                assignedTo: t.assignedTo?.fullName || 'Unassigned',
                                createdAt: format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm'),
                            }))}
                            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tickets', 'web-dev'] })}
                            hasActiveFilters={hasActiveFilters}
                            onClearFilters={clearFilters}
                        />
                    </div>
                </div>

                {/* Active Filter Chips */}
                <TicketListActiveFilters
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    priorityFilter={priorityFilter}
                    setPriorityFilter={setPriorityFilter}
                    searchQuery={searchInput}
                    setSearchQuery={setSearchInput}
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
                    aria-label="Web Developer Tickets list"
                    aria-busy={isFetching}
                >
                    {isFetching && !isLoading && (
                        <div
                            className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center"
                            aria-live="polite"
                        >
                            <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
                        </div>
                    )}

                <QueueCardToolbar sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort}
                    canEdit={canEdit} ticketCount={rowData.length} isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate} onSelectAll={handleSelectAll} />
                    {filteredTickets.length === 0 && !isFetching ? (
                        <div className="p-12 text-center" role="status" aria-live="polite">
                            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" aria-hidden="true" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {hasActiveFilters ? 'Tidak ada tiket yang sesuai dengan filter' : 'Belum ada tiket Web Developer Request'}
                            </p>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Table Header */}
                            <div
                                className={cn(
                                    "queue-grid queue-thead",
                                    showSiteColumn
                                        ? "queue-grid-sites"
                                        : "queue-grid-default"
                                )}
                                role="row"
                                aria-label="Table headers"
                            >
                                {canEdit ? (
                                    <SelectCheckbox
                                        cell
                                        label="Pilih semua tiket yang tampil"
                                        checked={isAllSelected}
                                        indeterminate={isIndeterminate}
                                        onChange={handleSelectAll}
                                    />
                                ) : <span aria-hidden="true" />}
                                <SortableHeader
                                    label="Ticket"
                                    field="title"
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                <SortableHeader
                                    label="Priority"
                                    field="priority"
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                {showSiteColumn && <div>Site</div>}
                                <SortableHeader
                                    label="Status"
                                    field="status"
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                                <div>Requester</div>
                                <div>Assigned To</div>
                                <div>Target Date</div>
                                <SortableHeader
                                    label="Created"
                                    field="createdAt"
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleSort}
                                />
                            </div>

                            <VirtualizedTicketList
                                tickets={rowData}
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

                            {/* Pagination Controls */}
                            <div className="px-4 pb-4">
                                <TicketListPagination
                                    paginationInfo={paginationInfo}
                                    currentPage={currentPage}
                                    goToPage={goToPage}
                                    getPageNumbers={getPageNumbers}
                                />
                                {!paginationInfo.showPagination && rowData.length > 0 && (
                                    <div className="text-center text-xs text-muted-foreground mt-4 font-medium">
                                        Showing {rowData.length} of {paginationInfo.totalItems} tickets
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Bulk Actions Floating Bar */}
                {canEdit && (
                    <BulkActionsBar
                        selectedCount={selectedTickets.size}
                        onClear={clearSelection}
                        onAssign={handleBulkAssign}
                        onChangeStatus={handleBulkStatusChange}
                        onMerge={() => setShowMergeDialog(true)}
                        onDelete={isAdmin ? () => setDeleteDialogOpen(true) : undefined}
                    />
                )}

                {/* Merge Tickets Modal */}
                <MergeTicketsModal
                    isOpen={showMergeDialog}
                    onClose={() => setShowMergeDialog(false)}
                    tickets={selectedTicketsList}
                    onSuccess={clearSelection}
                />

                {/* Bulk Assign Dialog */}
                <BulkAssignDialog
                    isOpen={showBulkAssignDialog}
                    onClose={() => setShowBulkAssignDialog(false)}
                    onAssign={handleBulkAssignSubmit}
                    agents={agents}
                    selectedCount={selectedTickets.size}
                />

                {/* Bulk Delete Confirmation Dialog (Admin Only) */}
                <BulkDeleteDialog
                    isOpen={deleteDialogOpen}
                    ticketNumbers={selectedTicketNumbers}
                    isLoading={isDeleting}
                    onConfirm={handleBulkDelete}
                    onCancel={() => setDeleteDialogOpen(false)}
                />
            </div>
        </TicketBoardErrorBoundary>
    );
};
