import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    X,
    Inbox,
    RefreshCw,
    Loader2,
    Database,
    CircleDot,
    Activity,
    Clock,
    CheckCircle2,
    Plus,
    TrendingUp,
    UserCheck,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import { useDebounce } from '@/hooks/useDebounce';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useOracleK2Tickets } from '../hooks/useOracleK2Tickets';
import { useAuth } from '@/stores/useAuth';
import { StatsCard } from '../components/StatsCard';
import { TicketListRow } from '../components/TicketListRow';
import { VirtualizedTicketList } from '../components/VirtualizedTicketList';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import { TicketListPagination } from '../components/TicketListPagination';
import { TicketListActiveFilters } from '../components/TicketListActiveFilters';
import { useTicketListMutations } from '../hooks/useTicketListMutations';
import type { Ticket } from '../types/ticket.types';
import type { TicketRowData } from '../components/TicketListRow';
import type { Agent } from '../components/ticket-detail/types';

const ITEMS_PER_PAGE = 20;

export const BentoOracleK2TicketsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();

    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

    const debouncedSearch = useDebounce(searchInput, 300);

    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        if (!isNaN(page) && page > 0) setCurrentPage(page);
    }, [searchParams]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter, priorityFilter]);

    const { data, isLoading, isError, refetch, isFetching } = useOracleK2Tickets({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        search: debouncedSearch,
    });

    useTicketListSocket(() => {
        queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
    });

    const tickets: Ticket[] = data?.data ?? [];
    const meta = data?.meta;

    // Fetch agents for assignment
    const isAdmin = user?.role === 'ADMIN';
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', 'oracle', isAdmin ? 'all' : user?.siteId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (!isAdmin && user?.siteId) {
                params.set('siteId', user.siteId);
            }
            params.set('ticketType', 'ORACLE_REQUEST');
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
    });

    const { assignTicketMutation, updateStatusMutation, updatePriorityMutation } = useTicketListMutations(agents);

    // Local stats from returned tickets (Oracle queue size is small)
    const stats = useMemo(() => {
        return {
            total: meta?.total ?? tickets.length,
            open: tickets.filter((t) => t.status === 'TODO').length,
            inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
            waiting: tickets.filter((t) => t.status === 'WAITING_VENDOR').length,
            resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        };
    }, [tickets, meta]);

    // Apply client-side filters
    const filteredTickets: Ticket[] = useMemo(() => {
        let result = tickets;
        if (statusFilter) result = result.filter((t) => t.status === statusFilter);
        if (priorityFilter) result = result.filter((t) => t.priority === priorityFilter);
        return result;
    }, [tickets, statusFilter, priorityFilter]);

    // Map Ticket → TicketRowData shape (reused by VirtualizedTicketList)
    const rowData: TicketRowData[] = useMemo(
        () =>
            filteredTickets.map((t) => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                title: t.title ?? '',
                description: t.description ?? '',
                category: t.category ?? 'ORACLE_REQUEST',
                status: (t.status as TicketRowData['status']) ?? 'TODO',
                priority: (t.priority as TicketRowData['priority']) ?? 'MEDIUM',
                source: (t.source as TicketRowData['source']) ?? 'WEB',
                isOverdue: Boolean((t as { isOverdue?: boolean }).isOverdue),
                slaTarget: t.slaTarget,
                scheduledDate: t.scheduledDate,
                isHardwareInstallation: t.isHardwareInstallation,
                ictBudgetRequestId: t.ictBudgetRequestId,
                assignedTo: t.assignedTo
                    ? {
                        id: t.assignedTo.id,
                        fullName: t.assignedTo.fullName ?? '',
                        avatarUrl: t.assignedTo.avatarUrl,
                    }
                    : undefined,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                user: {
                    id: t.user?.id,
                    fullName: t.user?.fullName ?? 'Unknown',
                    role: t.user?.role,
                    email: t.user?.email,
                    avatarUrl: t.user?.avatarUrl,
                    department: t.user?.department
                        ? { name: t.user.department.name }
                        : undefined,
                },
                site: t.site
                    ? { id: t.site.id, code: t.site.code, name: t.site.name }
                    : undefined,
            })),
        [filteredTickets]
    );

    const hasActiveFilters = Boolean(searchInput || statusFilter || priorityFilter);

    const clearFilters = () => {
        setSearchInput('');
        setStatusFilter('');
        setPriorityFilter('');
        setCurrentPage(1);
        setSearchParams({});
    };

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

    const handleBulkAssignSubmit = useCallback(async (assigneeId: string) => {
        const ticketIds = Array.from(selectedTickets);
        try {
            await api.patch('/tickets/bulk/assign', { ticketIds, assigneeId });
            toast.success(`${ticketIds.length} Oracle/K2 tickets assigned`);
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
            clearSelection();
        } catch (error) {
            toast.error('Failed to assign tickets');
            throw error;
        }
    }, [selectedTickets, queryClient, clearSelection]);

    const handleClaim = useCallback(async (ticket: Ticket) => {
        try {
            await api.patch(`/tickets/${ticket.id}/assign`, { assigneeId: 'me' });
            toast.success(`Claimed ticket ${ticket.ticketNumber}`);
            queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to claim ticket';
            toast.error(message);
        }
    }, [queryClient]);

    const handleRowClick = useCallback((ticket: Ticket) => {
        navigate(`/tickets/${ticket.id}`);
    }, [navigate]);

    const isAllSelected = rowData.length > 0 && selectedTickets.size === rowData.length;
    const isIndeterminate = selectedTickets.size > 0 && selectedTickets.size < rowData.length;
    const canEdit = user?.role === 'ADMIN' || user?.role === 'AGENT_ORACLE';

    if (isLoading) {
        return <TicketListSkeleton />;
    }

    if (isError) {
        return (
            <div className="p-6 text-center">
                <p className="text-red-600 mb-4">Gagal memuat tiket Oracle/K2</p>
                <button onClick={() => refetch()} className="px-4 py-2 bg-primary text-white rounded-lg">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <TicketBoardErrorBoundary>
            <div className="space-y-6 p-6 animate-fade-in-up">
                {/* Header — mirrors BentoTicketListPage header shape */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[hsl(var(--card))] p-5 rounded-xl border border-[hsl(var(--border))] shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Oracle K2 Request</h1>
                            <p className="text-muted-foreground text-sm mt-1">Tiket khusus Oracle/K2 — hanya AGENT_ORACLE &amp; ADMIN</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/tickets/create?type=oracle-request')}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            <Plus className="h-4 w-4" />
                            New Oracle/K2 Request
                        </button>
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Stats Cards — reuse StatsCard with icon/color/bgColor API (no variant) */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatsCard
                        icon={TrendingUp}
                        label="Total"
                        value={stats.total}
                        color="text-primary dark:text-blue-400"
                        bgColor="bg-[hsl(var(--primary))]/10 dark:bg-[hsl(var(--primary))]/20"
                        animationIndex={0}
                        onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
                        isActive={!statusFilter && !priorityFilter}
                    />
                    <StatsCard
                        icon={CircleDot}
                        label="Open"
                        value={stats.open}
                        color="text-slate-600 dark:text-slate-300"
                        bgColor="bg-slate-500/10"
                        animationIndex={1}
                        onClick={() => setStatusFilter('TODO')}
                        isActive={statusFilter === 'TODO'}
                    />
                    <StatsCard
                        icon={Activity}
                        label="In Progress"
                        value={stats.inProgress}
                        color="text-blue-600 dark:text-blue-400"
                        bgColor="bg-blue-500/10"
                        animationIndex={2}
                        onClick={() => setStatusFilter('IN_PROGRESS')}
                        isActive={statusFilter === 'IN_PROGRESS'}
                    />
                    <StatsCard
                        icon={Clock}
                        label="Waiting Vendor"
                        value={stats.waiting}
                        color="text-orange-600 dark:text-orange-400"
                        bgColor="bg-orange-500/10"
                        animationIndex={3}
                        onClick={() => setStatusFilter('WAITING_VENDOR')}
                        isActive={statusFilter === 'WAITING_VENDOR'}
                    />
                    <StatsCard
                        icon={CheckCircle2}
                        label="Resolved"
                        value={stats.resolved}
                        color="text-green-600 dark:text-green-400"
                        bgColor="bg-green-500/10"
                        animationIndex={4}
                        onClick={() => setStatusFilter('RESOLVED')}
                        isActive={statusFilter === 'RESOLVED'}
                    />
                </div>

                {/* Search & Filters — mirrors BentoTicketListPage toolbar */}
                <div
                    className="flex flex-col lg:flex-row lg:items-center gap-3 p-2 bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] relative z-20 shadow-sm"
                    role="search"
                >
                    <div className="relative flex-1 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Cari tiket Oracle/K2 (nomor / judul)..."
                            className="w-full pl-10 pr-10 py-2 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 text-sm font-medium"
                        />
                        {searchInput && (
                            <button
                                onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-1 pb-1 lg:pb-0">
                        <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} />
                        <PriorityFilterSelect value={priorityFilter} onChange={setPriorityFilter} />
                    </div>
                </div>

                <TicketListActiveFilters
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    priorityFilter={priorityFilter}
                    setPriorityFilter={setPriorityFilter}
                    searchQuery={searchInput}
                    setSearchQuery={setSearchInput}
                    showAssignedToMe={false}
                    setSearchParams={setSearchParams}
                    selectedSites={[]}
                    setSelectedSites={() => {}}
                    clearFilters={clearFilters}
                />

                {/* Ticket list — reuse VirtualizedTicketList from tickets/list */}
                <div
                    className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden relative shadow-sm"
                    role="region"
                    aria-busy={isFetching}
                >
                    {isFetching && !isLoading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center" aria-live="polite">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    )}
                    {rowData.length === 0 && !isFetching ? (
                        <div className="p-12 text-center">
                            <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-500 dark:text-slate-400 font-medium">
                                {hasActiveFilters ? 'No tickets match your filters' : 'No Oracle/K2 tickets in this view'}
                            </p>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Optional list-header bar so columns line up with VirtualizedTicketList grid */}
                            <div
                                className={cn(
                                    'sticky top-0 z-20 hidden lg:grid items-center gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-[hsl(var(--border))]',
                                    'border-l-4 border-l-transparent',
                                    'lg:grid-cols-[32px_minmax(280px,2fr)_112px_144px_minmax(120px,1fr)_minmax(140px,1fr)_minmax(100px,1fr)_80px]'
                                )}
                                role="row"
                            >
                                {canEdit && (
                                    <div className="w-8 shrink-0">
                                        <input
                                            type="checkbox"
                                            aria-label="Select all Oracle/K2 tickets"
                                            checked={isAllSelected}
                                            ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                    </div>
                                )}
                                <div>Ticket</div>
                                <div>Priority</div>
                                <div>Status</div>
                                <div>Requester</div>
                                <div>Assigned To</div>
                                <div>Created</div>
                                <div className="text-right">Actions</div>
                            </div>

                            <VirtualizedTicketList
                                tickets={rowData}
                                showSiteColumn={false}
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

                            <div className="px-4 pb-4">
                                <TicketListPagination
                                    paginationInfo={paginationInfo}
                                    currentPage={currentPage}
                                    goToPage={goToPage}
                                    getPageNumbers={getPageNumbers}
                                />
                                {!paginationInfo.showPagination && rowData.length > 0 && (
                                    <div className="text-center text-sm text-slate-400 mt-4">
                                        Showing {rowData.length} of {paginationInfo.totalItems} tickets
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Bulk assign dialog (Oracle/K2 only allows AGENT_ORACLE + ADMIN as assignees) */}
                {canEdit && selectedTickets.size > 0 && (
                    <BulkAssignBar
                        selectedCount={selectedTickets.size}
                        onClear={clearSelection}
                        onAssign={handleBulkAssignSubmit}
                    />
                )}
            </div>
        </TicketBoardErrorBoundary>
    );
};

// Lightweight inline filter selects to avoid coupling to the BentoTicketListPage's
// CustomDropdown internal expectations. Mirrors the same look.

const StatusFilterSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <Select value={value || 'ALL'} onValueChange={(v) => onChange(v === 'ALL' ? '' : v)}>
        <SelectTrigger className="h-9 min-w-[140px] bg-slate-50 dark:bg-slate-800/30 border-[hsl(var(--border))]">
            <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="TODO">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="WAITING_VENDOR">Waiting Vendor</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
        </SelectContent>
    </Select>
);

const PriorityFilterSelect: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
    <Select value={value || 'ALL'} onValueChange={(v) => onChange(v === 'ALL' ? '' : v)}>
        <SelectTrigger className="h-9 min-w-[140px] bg-slate-50 dark:bg-slate-800/30 border-[hsl(var(--border))]">
            <SelectValue placeholder="All Priority" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="ALL">All Priority</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
        </SelectContent>
    </Select>
);

import { UserCheck as _UserCheck } from 'lucide-react'; void _UserCheck;

const BulkAssignBar: React.FC<{ selectedCount: number; onClear: () => void; onAssign: (id: string) => Promise<void> }> = ({ selectedCount, onClear, onAssign }) => {
    const [open, setOpen] = useState(false);
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', 'oracle-bar'],
        queryFn: async () => {
            const res = await api.get('/users/agents');
            return res.data;
        },
    });
    const restricted = agents.filter((a) => a.role === 'AGENT_ORACLE' || a.role === 'ADMIN');
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-fade-in-up">
            <span className="text-sm font-semibold">{selectedCount} selected</span>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
                <UserCheck className="w-4 h-4" />
                Assign
            </button>
            <button onClick={onClear} className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-700">
                Clear
            </button>
            {open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-bold mb-3 text-slate-800 dark:text-white">Assign to Oracle Agent</h3>
                        <Select onValueChange={async (v) => { await onAssign(v); setOpen(false); }}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose an agent" />
                            </SelectTrigger>
                            <SelectContent>
                                {restricted.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-slate-500">No Oracle agents available</div>
                                ) : (
                                    restricted.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BentoOracleK2TicketsPage;
