import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { Ticket } from '@/types/ticket.types';
import { Agent } from '../components/ticket-detail/types';
import { ICON_MAP } from '@/features/settings/pages/TicketModulesSettingsTab';
import {
    Ticket as TicketIcon,
    Search,
    RefreshCw,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    Inbox,
    UserCheck,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { TargetDateCell } from '../components/TargetDateCell';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { BulkAssignDialog } from '../components/BulkAssignDialog';
import { BulkDeleteDialog } from '../components/BulkDeleteDialog';
import { MergeTicketsModal } from '../components/MergeTicketsModal';
import { useTicketListSocket } from '@/hooks/useTicketSocket';

export const DynamicTicketQueuePage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Filters and pagination state
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
    const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
    const [showMergeDialog, setShowMergeDialog] = useState(false);
    const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // WebSocket real-time subscription
    useTicketListSocket({
        onTicketUpdated: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', 'module', slug] });
        },
    });

    // Query tickets for this module
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ['tickets', 'module', slug, page, limit, debouncedSearch, statusFilter, priorityFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', page.toString());
            params.set('limit', limit.toString());
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (statusFilter !== 'ALL') params.set('status', statusFilter);
            if (priorityFilter !== 'ALL') params.set('priority', priorityFilter);

            const res = await api.get(`/tickets/paginated/module/${slug}?${params.toString()}`);
            return res.data;
        },
        enabled: Boolean(slug),
        staleTime: 15_000,
    });

    const tickets: Ticket[] = data?.data ?? [];
    const meta = data?.meta;
    const stats = data?.stats;
    const moduleInfo = data?.module;
    const isAdmin = user?.role === 'ADMIN';

    const selectedTicketsList = React.useMemo(
        () => tickets.filter((t) => selectedTicketIds.includes(t.id)),
        [tickets, selectedTicketIds]
    );

    // Fetch agents for assignment
    const { data: agents = [] } = useQuery<Agent[]>({
        queryKey: ['agents', 'module', slug, moduleInfo?.assigneeRoles],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (moduleInfo?.assigneeRoles && moduleInfo.assigneeRoles.length > 0) {
                params.set('assigneeRoles', moduleInfo.assigneeRoles.join(','));
            } else if (slug === 'mobile-developer') {
                params.set('ticketType', 'MOBILE_DEV_REQUEST');
            } else if (slug === 'web-developer') {
                params.set('ticketType', 'WEB_DEV_REQUEST');
            } else if (slug === 'oracle-k2') {
                params.set('ticketType', 'ORACLE_REQUEST');
            }
            const res = await api.get(`/users/agents?${params.toString()}`);
            return res.data;
        },
        staleTime: 60_000,
    });

    const ModuleIcon = moduleInfo?.icon && ICON_MAP[moduleInfo.icon] ? ICON_MAP[moduleInfo.icon] : TicketIcon;

    // Bulk selection handlers
    const toggleSelectAll = () => {
        if (selectedTicketIds.length === tickets.length) {
            setSelectedTicketIds([]);
        } else {
            setSelectedTicketIds(tickets.map((t) => t.id));
        }
    };

    const toggleSelectTicket = (id: string) => {
        setSelectedTicketIds((prev) =>
            prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
        );
    };

    const handleBulkAssign = async (agentId: string, reason?: string) => {
        try {
            await api.patch('/tickets/bulk/assign', {
                ticketIds: selectedTicketIds,
                assigneeId: agentId,
                reason,
            });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'module', slug] });
            setSelectedTicketIds([]);
            setShowBulkAssignDialog(false);
            toast.success(`Berhasil menugaskan ${selectedTicketIds.length} tiket`);
        } catch {
            toast.error('Gagal melakukan penugasan massal');
        }
    };

    const handleBulkStatusChange = async (status: string) => {
        try {
            await api.patch('/tickets/bulk/update', {
                ticketIds: selectedTicketIds,
                status,
            });
            queryClient.invalidateQueries({ queryKey: ['tickets', 'module', slug] });
            setSelectedTicketIds([]);
            toast.success(`Status ${selectedTicketIds.length} tiket berhasil diperbarui`);
        } catch {
            toast.error('Gagal memperbarui status tiket');
        }
    };

    const selectedTicketNumbers = tickets
        .filter((t) => selectedTicketIds.includes(t.id))
        .map((t) => t.ticketNumber);

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    Gagal Memuat Antrian Tiket
                </h2>
                <p className="text-sm text-slate-500 max-w-md mb-6">
                    {(error as any)?.response?.data?.message || 'Modul antrian tidak ditemukan atau Anda tidak memiliki hak akses.'}
                </p>
                <button
                    onClick={() => navigate('/tickets/list')}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                    Kembali ke Antrian Utama
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                        <ModuleIcon className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                {moduleInfo?.name || 'Antrian Tiket'}
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Live Queue
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {moduleInfo?.description || 'Daftar tiket dan permohonan antrian kerja.'}
                        </p>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={() => navigate('/tickets/create')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Buat Tiket
                    </button>
                </div>
            </div>

            {/* Quick Stats Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        <Inbox className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Tiket</span>
                        <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">{stats?.total ?? 0}</h4>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Open / Todo</span>
                        <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">{stats?.open ?? 0}</h4>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">In Progress</span>
                        <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">{stats?.inProgress ?? 0}</h4>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Selesai</span>
                        <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">{stats?.resolved ?? 0}</h4>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Cari berdasarkan nomor tiket, judul, requester..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">Semua Status</option>
                        <option value="TODO">Open / Todo</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_VENDOR">Waiting Vendor</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={priorityFilter}
                        onChange={(e) => {
                            setPriorityFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="ALL">Semua Prioritas</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                    </select>
                </div>
            </div>

            {/* Table View */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                <th className="py-3.5 px-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={tickets.length > 0 && selectedTicketIds.length === tickets.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                                <th className="py-3.5 px-4">Tiket</th>
                                <th className="py-3.5 px-4">Prioritas</th>
                                <th className="py-3.5 px-4">Site</th>
                                <th className="py-3.5 px-4">Status</th>
                                <th className="py-3.5 px-4">Requester</th>
                                <th className="py-3.5 px-4">Assignee</th>
                                <th className="py-3.5 px-4">Target Date</th>
                                <th className="py-3.5 px-4">Dibuat</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                                            <span>Memuat data tiket...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center">
                                        <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                        <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">
                                            Tidak ada tiket dalam antrian ini
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Tiket yang sesuai dengan kriteria modul akan muncul di sini.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((t) => {
                                    const isSelected = selectedTicketIds.includes(t.id);
                                    return (
                                        <tr
                                            key={t.id}
                                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                                            }`}
                                            onClick={() => navigate(`/tickets/${t.id}`)}
                                        >
                                            <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectTicket(t.id)}
                                                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>

                                            {/* Ticket Number & Title */}
                                            <td className="py-3.5 px-4 max-w-xs">
                                                <div className="flex items-center gap-2">
                                                    {(t as any).hasUnreadChat && (
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse shadow-xs"
                                                            title="Ada pesan chat belum dibaca"
                                                        />
                                                    )}
                                                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                                                        {t.ticketNumber}
                                                    </span>
                                                    {(t as any).hasUnreadChat && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700/60 shadow-2xs animate-pulse">
                                                            <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                            <span>Pesan Baru{(t as any).unreadMessageCount ? ` (${(t as any).unreadMessageCount})` : ''}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-semibold text-slate-900 dark:text-white truncate">
                                                    {t.title}
                                                </div>
                                            </td>

                                            {/* Priority */}
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                        t.priority === 'CRITICAL'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                                                            : t.priority === 'HIGH'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                                                            : t.priority === 'MEDIUM'
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                                                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    {t.priority}
                                                </span>
                                            </td>

                                            {/* Site */}
                                            <td className="py-3.5 px-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                {(t as any).site?.code || 'SPJ'}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-4">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                                        t.status === 'RESOLVED'
                                                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50'
                                                            : t.status === 'IN_PROGRESS'
                                                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50'
                                                            : t.status === 'WAITING_VENDOR'
                                                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50'
                                                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                    }`}
                                                >
                                                    {t.status.replace('_', ' ')}
                                                </span>
                                            </td>

                                            {/* Requester */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                                                    {(t as any).user?.fullName || '-'}
                                                </div>
                                            </td>

                                            {/* Assignee */}
                                            <td className="py-3.5 px-4">
                                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                                    {t.assignedTo ? (
                                                        <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                                                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                            {t.assignedTo.fullName}
                                                        </span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Belum di-assign</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Target Date */}
                                            <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                                                <TargetDateCell ticket={t} />
                                            </td>

                                            {/* Created At */}
                                            <td className="py-3.5 px-4 text-xs text-slate-400">
                                                {new Date(t.createdAt).toLocaleDateString('id-ID', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                })}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                        <span className="text-xs text-slate-500">
                            Menampilkan Halaman <span className="font-bold">{meta.page}</span> dari{' '}
                            <span className="font-bold">{meta.totalPages}</span> ({meta.total} Total Tiket)
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                                disabled={page >= meta.totalPages}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedTicketIds.length > 0 && (
                <BulkActionsBar
                    selectedCount={selectedTicketIds.length}
                    onAssign={() => setShowBulkAssignDialog(true)}
                    onChangeStatus={handleBulkStatusChange}
                    onClear={() => setSelectedTicketIds([])}
                    onMerge={() => setShowMergeDialog(true)}
                    onDelete={isAdmin ? () => setDeleteDialogOpen(true) : undefined}
                />
            )}

            {/* Merge Tickets Modal */}
            <MergeTicketsModal
                isOpen={showMergeDialog}
                onClose={() => setShowMergeDialog(false)}
                tickets={selectedTicketsList}
                onSuccess={() => setSelectedTicketIds([])}
            />

            {/* Bulk Assign Dialog */}
            <BulkAssignDialog
                isOpen={showBulkAssignDialog}
                onClose={() => setShowBulkAssignDialog(false)}
                selectedCount={selectedTicketIds.length}
                agents={agents}
                onAssign={handleBulkAssign}
            />

            {/* Bulk Delete Dialog */}
            <BulkDeleteDialog
                isOpen={deleteDialogOpen}
                ticketNumbers={selectedTicketNumbers}
                isLoading={isDeleting}
                onCancel={() => setDeleteDialogOpen(false)}
                onConfirm={async () => {
                    try {
                        setIsDeleting(true);
                        await api.delete('/tickets/bulk', { data: { ticketIds: selectedTicketIds } });
                        queryClient.invalidateQueries({ queryKey: ['tickets', 'module', slug] });
                        setSelectedTicketIds([]);
                        setDeleteDialogOpen(false);
                        toast.success(`${selectedTicketIds.length} tiket berhasil dihapus`);
                    } catch {
                        toast.error('Gagal menghapus tiket');
                    } finally {
                        setIsDeleting(false);
                    }
                }}
            />
        </div>
    );
};
