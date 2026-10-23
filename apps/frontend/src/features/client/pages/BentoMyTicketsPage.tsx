import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
    Inbox,
    ArrowRight,
    Search,
    CheckCircle2,
    CircleDot,
    ChevronRight,
    ChevronLeft,
    ChevronsLeft,
    ChevronsRight,
    X,
    Layers,
    RotateCw,
    MousePointerClick,
    ChevronDown,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { ErrorState } from '@/components/ui/ErrorState';
import { useTicketListSocket } from '@/hooks/useTicketSocket';
import { useSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useAuth } from '@/stores/useAuth';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CLIENT_ROUTES } from '@/config/routes';
import {
    CREATE_TICKET_TEXT_LINK,
    HelpBanner,
    MyTicketRow,
    MY_TICKETS_GRID,
    OPEN_HINT,
    StatCard,
    type MyTicketItem as TicketItem,
} from '../components/MyTicketsParts';

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

/**
 * Mockup my-tickets groups (my-tickets-demo.js): "Dalam penanganan" = In Progress + Waiting Vendor,
 * "Selesai" = Resolved + Closed. The paginated endpoint already accepts comma-separated statuses.
 */
const IN_HANDLING_FILTER = 'IN_PROGRESS,WAITING_VENDOR';
const DONE_FILTER = 'RESOLVED,CLOSED';
const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'Semua' },
    { value: 'TODO', label: 'Open' },
    { value: IN_HANDLING_FILTER, label: 'Dalam penanganan' },
    { value: DONE_FILTER, label: 'Selesai' },
    { value: 'CANCELLED', label: 'Dibatalkan' },
];

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const SEARCH_DEBOUNCE_MS = 300;
const QUERY_RETRY_DELAY_MS = 1_000;
const STAT_SKELETON_COUNT = 4;
const ROW_SKELETON_COUNT = 5;

const PAGER_BUTTON = 'p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer';

export const BentoMyTicketsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Sockets for real-time updates. The hook already invalidates the ['tickets'] prefix
    // (covering my-tickets and my-stats) with debouncing, so no extra refetch here.
    const { isConnected } = useTicketListSocket();
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
            // List refresh is handled (debounced) by useTicketListSocket.
        };

        socket.on('ticket:newMessage', handleNewMessage);
        return () => {
            socket.off('ticket:newMessage', handleNewMessage);
        };
    }, [socket, navigate, user?.id, queryClient]);

    const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

    // Fetch user aggregate stats (Total, Open, Dalam penanganan, Selesai)
    const { data: statsData, isLoading: isStatsLoading } = useQuery<{
        total: number;
        open: number;
        inProgress: number;
        resolved: number;
    }>({
        queryKey: ['tickets', 'my-stats'],
        queryFn: async () => {
            const [allRes, openRes, inProgRes, resRes, closedRes, vendorRes] = await Promise.all([
                api.get('/tickets/paginated?limit=1'),
                api.get('/tickets/paginated?limit=1&status=TODO'),
                api.get('/tickets/paginated?limit=1&status=IN_PROGRESS'),
                api.get('/tickets/paginated?limit=1&status=RESOLVED'),
                api.get('/tickets/paginated?limit=1&status=CLOSED'),
                api.get('/tickets/paginated?limit=1&status=WAITING_VENDOR'),
            ]);
            return {
                total: allRes.data?.meta?.total ?? 0,
                open: openRes.data?.meta?.total ?? 0,
                // "Dalam penanganan": being worked on, including waiting for a vendor.
                inProgress: (inProgRes.data?.meta?.total ?? 0) + (vendorRes.data?.meta?.total ?? 0),
                // Awaiting confirmation (RESOLVED) plus final (CLOSED).
                resolved: (resRes.data?.meta?.total ?? 0) + (closedRes.data?.meta?.total ?? 0),
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

    const hasActiveFilters = Boolean(searchQuery || statusFilter !== 'all');

    if (isLoading && !response) {
        return (
            <div className="space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true">
                <div className="space-y-2">
                    <div className="h-8 w-44 bg-muted rounded-xl" />
                    <div className="h-4 w-64 max-w-full bg-muted/60 rounded" />
                </div>
                <div className="h-20 bg-muted/50 rounded-2xl" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                    {Array.from({ length: STAT_SKELETON_COUNT }, (_, i) => (
                        <div key={i} className="h-[76px] bg-card border border-border/70 rounded-2xl" />
                    ))}
                </div>
                <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                    {Array.from({ length: ROW_SKELETON_COUNT }, (_, i) => (
                        <div key={i} className="h-14 bg-muted/40 rounded-xl" />
                    ))}
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

    const statsLoading = isStatsLoading && !statsData;
    const statCards = [
        { key: 'all', label: 'Total', tone: 'neutral', icon: Layers, value: statsData?.total ?? meta?.total ?? 0 },
        { key: 'TODO', label: 'Open', tone: 'sky', icon: Inbox, value: statsData?.open ?? 0 },
        { key: IN_HANDLING_FILTER, label: 'Dalam penanganan', tone: 'navy', icon: CircleDot, value: statsData?.inProgress ?? 0 },
        { key: DONE_FILTER, label: 'Selesai', tone: 'green', icon: CheckCircle2, value: statsData?.resolved ?? 0 },
    ] as const;

    return (
        <div className="space-y-5">
            {/* Header Area */}
            <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Tiket Saya</h1>
                        {/* Mockup `.live`: a green dot + "Live"; muted while the socket connects. */}
                        <span className={cn('portal-live', !isConnected && 'is-off')}>
                            <i aria-hidden="true" />{isConnected ? 'Live' : 'Menghubungkan…'}
                        </span>
                    </div>
                    <p className="text-muted-foreground text-[13px] mt-1">
                        Pantau tiket bantuan yang Anda ajukan
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ['tickets'] });
                        refetch();
                    }}
                    className="idesk-btn is-soft shrink-0"
                    title="Muat ulang"
                    aria-label="Muat ulang"
                    aria-busy={isFetching || undefined}
                >
                    <RotateCw className={cn(isFetching && 'idesk-spin')} aria-hidden="true" />
                    <span className="hidden sm:inline">Muat ulang</span>
                </button>
            </div>

            <HelpBanner />

            {/* Tinted stat cards: fetched counts, each a status shortcut */}
            <div role="group" aria-label="Ringkasan tiket" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {statCards.map((card) => (
                    <StatCard
                        key={card.key}
                        label={card.label}
                        value={card.value}
                        tone={card.tone}
                        icon={card.icon}
                        active={statusFilter === card.key}
                        loading={statsLoading}
                        onClick={() => handleStatusChange(card.key)}
                    />
                ))}
            </div>

            {/* Search & Filter Toolbar */}
            <div
                className="flex flex-col lg:flex-row lg:items-center gap-2.5"
                role="search"
                aria-label="Filter dan cari tiket"
            >
                <div className="portal-search relative flex-1 min-w-0">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                    <label htmlFor="client-ticket-search" className="sr-only">Cari tiket berdasarkan judul atau ID</label>
                    <input
                        id="client-ticket-search"
                        type="search"
                        placeholder="Cari judul atau nomor tiket"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        autoComplete="off"
                        className="w-full h-8 pl-10 pr-10 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm font-medium"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => handleSearchChange('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
                            aria-label="Hapus pencarian"
                        >
                            <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 min-w-0">
                    <SegmentedControl
                        aria-label="Filter status tiket"
                        options={STATUS_FILTER_OPTIONS}
                        value={STATUS_FILTER_OPTIONS.some((option) => option.value === statusFilter) ? statusFilter : null}
                        onValueChange={handleStatusChange}
                    />

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="px-3 h-9 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                            title="Reset semua filter"
                        >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reset filter</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tickets List */}
            {tickets.length > 0 && (
                <p className="portal-open-hint"><MousePointerClick aria-hidden="true" />{OPEN_HINT}</p>
            )}
            <div className="portal-table" role="region" aria-label="Daftar tiket saya">
                <div className={cn('portal-thead hidden lg:grid items-center gap-4 px-4', MY_TICKETS_GRID)}>
                    <div>Tiket</div>
                    <div>Prioritas</div>
                    <div>Status</div>
                    <div>Ditangani oleh</div>
                    <div>Diperbarui</div>
                    <div><span className="sr-only">Buka</span></div>
                </div>

                {tickets.length === 0 ? (
                    <div className="p-10 sm:p-12 text-center" role="status">
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
                                className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border hover:bg-muted/60 rounded-xl text-xs font-bold text-foreground transition-colors active:scale-[0.98] cursor-pointer"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                                <span>Reset Filter</span>
                            </button>
                        ) : (
                            <Link to={CLIENT_ROUTES.CREATE_TICKET} className="idesk-text-link">
                                {CREATE_TICKET_TEXT_LINK}
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="portal-rows">
                        {tickets.map((ticket) => <MyTicketRow key={ticket.id} ticket={ticket} />)}
                    </div>
                )}

                {/* Pagination Footer (mockup .foot: "Menampilkan X dari Y hasil" + "Per halaman" pop) */}
                {meta && meta.total > 0 && (
                    <div className="portal-tfoot px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                            Menampilkan {tickets.length} dari {meta.total} hasil
                        </span>
                        <div className="flex items-center gap-3">
                        <label className="queue-pop portal-page-size" htmlFor="client-page-size">
                            <span className="queue-pop-k">Per halaman</span>
                            <select
                                id="client-page-size"
                                value={limit}
                                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                            >
                                {PAGE_SIZE_OPTIONS.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                            <ChevronDown aria-hidden="true" />
                        </label>

                {meta.totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setPage(1)} disabled={!meta.hasPrevPage} aria-label="Halaman pertama" className={PAGER_BUTTON}>
                                    <ChevronsLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => setPage(page - 1)} disabled={!meta.hasPrevPage} aria-label="Halaman sebelumnya" className={PAGER_BUTTON}>
                                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <span className="px-3 py-1 bg-[hsl(var(--idesk-selection))] text-[hsl(var(--idesk-sapphire))] font-bold text-xs rounded-lg tabular-nums">
                                    {meta.page} / {meta.totalPages}
                                </span>
                                <button type="button" onClick={() => setPage(page + 1)} disabled={!meta.hasNextPage} aria-label="Halaman berikutnya" className={PAGER_BUTTON}>
                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => setPage(meta.totalPages)} disabled={!meta.hasNextPage} aria-label="Halaman terakhir" className={PAGER_BUTTON}>
                                    <ChevronsRight className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BentoMyTicketsPage;
