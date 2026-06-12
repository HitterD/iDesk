import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { TicketListSkeleton } from '../components/TicketListSkeleton';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useDebounce } from '@/hooks/useDebounce';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useOracleK2Tickets } from '../hooks/useOracleK2Tickets';
import { StatsCard } from '../components/StatsCard';
import { SortableHeader, SortField, SortOrder } from '../components/SortableHeader';
import { TicketListRow } from '../components/TicketListRow';
import { TicketBoardErrorBoundary } from '../components/TicketBoardErrorBoundary';
import type { Ticket } from '../types/ticket.types';

export const BentoOracleK2TicketsPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    const [searchInput, setSearchInput] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(50);
    const [sortBy, setSortBy] = useState<SortField>('createdAt');
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    const debouncedSearch = useDebounce(searchInput, 300);

    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        if (!isNaN(page) && page > 0) setCurrentPage(page);
    }, [searchParams]);

    const { data, isLoading, isError, refetch, isFetching } = useOracleK2Tickets({
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
        search: debouncedSearch,
    });

    useTicketListSocket(() => {
        queryClient.invalidateQueries({ queryKey: ['tickets', 'oracle-k2'] });
    });

    const tickets: Ticket[] = data?.data ?? [];
    const meta = data?.meta;

    const stats = useMemo(() => {
        return {
            open: tickets.filter((t) => t.status === 'TODO').length,
            inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
            waiting: tickets.filter((t) => t.status === 'WAITING_VENDOR').length,
            resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
        };
    }, [tickets]);

    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
    }, [sortBy, sortOrder]);

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

    const filteredTickets = useMemo(() => {
        if (!debouncedSearch) return tickets;
        const lower = debouncedSearch.toLowerCase();
        return tickets.filter((t) =>
            t.title?.toLowerCase().includes(lower) ||
            t.ticketNumber?.toLowerCase().includes(lower)
        );
    }, [tickets, debouncedSearch]);

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
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatsCard
                        label="Open"
                        value={stats.open}
                        icon={CircleDot}
                        color="text-slate-600"
                        bgColor="bg-slate-500/10"
                        animationIndex={0}
                    />
                    <StatsCard
                        label="In Progress"
                        value={stats.inProgress}
                        icon={Activity}
                        color="text-blue-600"
                        bgColor="bg-blue-500/10"
                        animationIndex={1}
                    />
                    <StatsCard
                        label="Waiting Vendor"
                        value={stats.waiting}
                        icon={Clock}
                        color="text-orange-600"
                        bgColor="bg-orange-500/10"
                        animationIndex={2}
                    />
                    <StatsCard
                        label="Resolved"
                        value={stats.resolved}
                        icon={CheckCircle2}
                        color="text-green-600"
                        bgColor="bg-green-500/10"
                        animationIndex={3}
                    />
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Cari tiket Oracle/K2..."
                                className="w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-slate-800"
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
                    </div>

                    {filteredTickets.length === 0 ? (
                        <div className="py-12 text-center">
                            <Inbox className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">No Oracle/K2 tickets in this view</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[hsl(var(--border))]">
                                            <SortableHeader field="ticketNumber" label="Ticket #" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="title" label="Title" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="status" label="Status" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="priority" label="Priority" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <SortableHeader field="createdAt" label="Created" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                            <th className="px-3 py-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTickets.map((t) => (
                                            <TicketListRow
                                                key={t.id}
                                                ticket={t}
                                                onClick={() => handleRowClick(t)}
                                                onClaim={() => handleClaim(t)}
                                                priorityConfig={PRIORITY_CONFIG}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {meta && (
                                <div className="flex items-center justify-between pt-4 mt-2 border-t border-[hsl(var(--border))]">
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Page <span className="font-medium text-slate-700 dark:text-slate-300">{meta.page}</span> of {meta.totalPages} ({meta.total} total)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={!meta.hasPrevPage}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage((p) => p + 1)}
                                            disabled={!meta.hasNextPage}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </TicketBoardErrorBoundary>
    );
};

export default BentoOracleK2TicketsPage;
