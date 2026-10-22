import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ResSearch } from '@/components/resources/ResourceParts';
import { MgStat } from '@/components/management/MgmtParts';
import {
    Shield,
    Plus,
    Search,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Wifi,
    AlertTriangle,
    MoreVertical,
    Edit2,
    Trash2,
    ChevronDown,
    ArrowUpDown,
    Columns,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ShieldCheck,
    Hourglass,
    CircleSlash,
} from 'lucide-react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getPaginationRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
    useVpnAccessList,
    useVpnStats,
    useDeleteVpnAccess,
    useBulkDeleteVpnAccess,
    VpnAccess,
    VpnFilters,
} from '../hooks/useVpnAccess';
import { VpnAccessModal } from '../components/VpnAccessModal';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const STATUS_CREATE_CONFIG = {
    'Selesai': { label: 'Selesai', color: 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-700))] border-[hsl(var(--success-200))] dark:bg-[hsl(var(--success-900))]/20 dark:text-[hsl(var(--success-400))] dark:border-[hsl(var(--success-800))]', icon: CheckCircle2 },
    'Proses': { label: 'Proses', color: 'bg-[hsl(var(--warning-50))] text-[hsl(var(--warning-700))] border-[hsl(var(--warning-200))] dark:bg-[hsl(var(--warning-900))]/20 dark:text-[hsl(var(--warning-400))] dark:border-[hsl(var(--warning-800))]', icon: Clock },
    'Batal': { label: 'Batal', color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700', icon: XCircle },
    'Non Aktif': { label: 'Non Aktif', color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-700))] border-[hsl(var(--error-200))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-400))] dark:border-[hsl(var(--error-800))]', icon: XCircle },
};

const AREA_OPTIONS = ['Karawang', 'Jakarta', 'Sepanjang', 'Semarang'];

export default function VpnAccessPage() {
    const [filters, setFilters] = useState<VpnFilters>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVpn, setSelectedVpn] = useState<VpnAccess | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

    const { data: vpnList = [], isLoading, refetch } = useVpnAccessList({
        ...filters,
        search: searchQuery || undefined,
    });
    const { data: stats } = useVpnStats();
    const deleteVpn = useDeleteVpnAccess();
    const bulkDeleteVpn = useBulkDeleteVpnAccess();

    const [rowSelection, setRowSelection] = useState({});
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    const filteredList = useMemo(() => {
        return vpnList;
    }, [vpnList]);

    const handleEdit = (vpn: VpnAccess) => {
        setSelectedVpn(vpn);
        setShowModal(true);
        setActiveMenu(null);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteConfirm({ open: true, id });
        setActiveMenu(null);
    };

    const handleDeleteConfirm = async () => {
        if (deleteConfirm.id) {
            await deleteVpn.mutateAsync(deleteConfirm.id);
        }
        setDeleteConfirm({ open: false, id: null });
    };

    const handleBulkDelete = async () => {
        const selectedIds = table.getSelectedRowModel().rows.map(row => row.original.id);
        if (selectedIds.length === 0) return;

        setIsBulkDeleting(true);
        try {
            await bulkDeleteVpn.mutateAsync(selectedIds);
            setRowSelection({});
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // TanStack Table setup
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        statusUserH1: false,
        statusIctH1: false,
        keteranganNonAktifVpn: false,
    });

    const columnHelper = createColumnHelper<VpnAccess>();

    const columns = useMemo(() => [
        columnHelper.display({
            id: 'select',
            header: ({ table }) => (
                <div className="px-1 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={table.getIsAllPageRowsSelected()}
                            ref={input => {
                                if (input) {
                                    input.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
                                }
                            }}
                            onChange={table.getToggleAllPageRowsSelectedHandler()}
                            className="w-4 h-4 rounded border-[hsl(var(--border))] text-primary focus:ring-primary/50 cursor-pointer appearance-none bg-white dark:bg-[hsl(var(--card))] transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out checked:bg-primary dark:checked:bg-primary hover:border-primary"
                        />
                        {(table.getIsAllPageRowsSelected() || table.getIsSomePageRowsSelected()) && (
                            <svg className="pointer-events-none absolute w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                {table.getIsAllPageRowsSelected() ? (
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                ) : (
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                )}
                            </svg>
                        )}
                    </div>
                </div>
            ),
            cell: ({ row }) => (
                <div className="px-1 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={row.getIsSelected()}
                            onChange={row.getToggleSelectedHandler()}
                            disabled={!row.getCanSelect()}
                            className="w-4 h-4 rounded border-[hsl(var(--border))] text-primary focus:ring-primary/50 cursor-pointer appearance-none bg-white dark:bg-[hsl(var(--card))] transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out checked:bg-primary dark:checked:bg-primary hover:border-primary disabled:opacity-50"
                        />
                        {row.getIsSelected() && <svg className="pointer-events-none absolute w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                </div>
            ),
            size: 40,
        }),
        columnHelper.accessor('area', {
            header: ({ column }) => (
                <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-primary transition-colors">
                    Area <ArrowUpDown className="w-3 h-3" />
                </button>
            ),
            cell: info => <span className="font-medium text-slate-900 dark:text-white">{info.getValue() || '-'}</span>,
            size: 100,
        }),
        columnHelper.accessor('namaUser', {
            header: ({ column }) => (
                <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-primary transition-colors">
                    Nama User <ArrowUpDown className="w-3 h-3" />
                </button>
            ),
            cell: info => <span className="text-slate-900 dark:text-white font-medium">{info.getValue()}</span>,
            size: 180,
        }),
        columnHelper.accessor('emailUser', {
            header: 'Email User',
            cell: info => <span className="text-slate-500 dark:text-slate-400">{info.getValue() || '-'}</span>,
            size: 180,
        }),
        columnHelper.accessor('tanggalAktif', {
            header: ({ column }) => (
                <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-primary transition-colors whitespace-nowrap">
                    Tanggal Aktif <ArrowUpDown className="w-3 h-3" />
                </button>
            ),
            cell: info => <span className="text-slate-500 dark:text-slate-300">{format(new Date(info.getValue()), 'dd MMM yyyy', { locale: localeId })}</span>,
            size: 130,
        }),
        columnHelper.accessor('tanggalNonAktif', {
            header: ({ column }) => (
                <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 hover:text-primary transition-colors whitespace-nowrap">
                    Tgl Non Aktif <ArrowUpDown className="w-3 h-3" />
                </button>
            ),
            cell: info => {
                const date = new Date(info.getValue());
                const isExpired = date < new Date();
                return (
                    <span className={`font-medium ${isExpired ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-300'}`}>
                        {format(date, 'dd MMM yyyy', { locale: localeId })}
                    </span>
                );
            },
            size: 130,
        }),
        columnHelper.accessor('statusCreateVpn', {
            header: 'Status Create',
            cell: info => {
                const val = info.getValue();
                const statusCfg = STATUS_CREATE_CONFIG[val as keyof typeof STATUS_CREATE_CONFIG];
                const StatusIcon = statusCfg?.icon || Clock;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusCfg?.color || 'bg-slate-500/20 text-slate-400 border-slate-500/30'} whitespace-nowrap`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg?.label || val}
                    </span>
                );
            },
            size: 140,
        }),
        columnHelper.accessor('keteranganNonAktifVpn', {
            header: 'Ket. Non Aktif',
            cell: info => <span className="text-xs text-slate-500 dark:text-slate-400 max-w-[150px] truncate block" title={info.getValue()}>{info.getValue() || '-'}</span>,
            size: 150,
        }),
        columnHelper.accessor('statusUserH1', {
            header: 'Status H-1',
            cell: info => <span className="text-xs font-mono text-primary">{info.getValue() || '-'}</span>,
            size: 120,
        }),
        columnHelper.accessor('statusIctH1', {
            header: 'Status H+1',
            cell: info => <span className="text-xs font-mono text-primary">{info.getValue() || '-'}</span>,
            size: 120,
        }),
        columnHelper.display({
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const vpn = row.original;
                return (
                    <div className="relative text-right">
                        <button
                            onClick={() => setActiveMenu(activeMenu === vpn.id ? null : vpn.id)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                        <AnimatePresence>
                            {activeMenu === vpn.id && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute right-8 top-0 z-50 w-36 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl overflow-hidden"
                                >
                                    <button
                                        onClick={() => { handleEdit(vpn); setActiveMenu(null); }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Edit2 className="w-4 h-4" /> Edit
                                    </button>
                                    <button
                                        onClick={() => { handleDeleteClick(vpn.id); setActiveMenu(null); }}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" /> Hapus
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            },
            size: 60,
        }),
    ], [activeMenu]);

    const table = useReactTable({
        data: filteredList,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });

    return (
        <div>
            <section className="res-stats is-four" aria-label="Ringkasan VPN">
                <MgStat icon={ShieldCheck} tone="navy" label="Total VPN" value={stats?.total || 0} />
                <MgStat icon={CheckCircle2} tone="green" label="Selesai" value={stats?.active || 0} />
                <MgStat icon={Hourglass} tone="amber" label="Expiring Soon" value={stats?.expiringSoon || 0} attention={(stats?.expiringSoon || 0) > 0} />
                <MgStat icon={CircleSlash} tone="neutral" label="Non Aktif" value={stats?.expired || 0} />
            </section>

            <div className="res-filters">
                    <ResSearch id="vpn-search" value={searchQuery} onChange={setSearchQuery} placeholder="Cari nama atau email..." label="Cari VPN" />
                    <div className="contents">
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button type="button" className="queue-pop" aria-label={`Status: ${filters.statusCreateVpn || 'Semua Status'}`}>
                                    <span className="queue-pop-k">Status</span><span className="queue-pop-v">{filters.statusCreateVpn || 'Semua'}</span><ChevronDown aria-hidden="true" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className="z-50 min-w-[160px] bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2">
                                    <DropdownMenu.Item
                                        onSelect={() => setFilters({ ...filters, statusCreateVpn: undefined })}
                                        className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] cursor-pointer outline-none"
                                    >
                                        Semua Status
                                    </DropdownMenu.Item>
                                    {Object.keys(STATUS_CREATE_CONFIG).map(status => (
                                        <DropdownMenu.Item
                                            key={status}
                                            onSelect={() => setFilters({ ...filters, statusCreateVpn: status })}
                                            className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] cursor-pointer outline-none flex items-center justify-between"
                                        >
                                            {status}
                                            {filters.statusCreateVpn === status && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                        </DropdownMenu.Item>
                                    ))}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>

                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button type="button" className="queue-pop" aria-label={`Area: ${filters.area || 'Semua Area'}`}>
                                    <span className="queue-pop-k">Area</span><span className="queue-pop-v">{filters.area || 'Semua'}</span><ChevronDown aria-hidden="true" />
                                </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                                <DropdownMenu.Content className="z-50 min-w-[160px] bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2">
                                    <DropdownMenu.Item
                                        onSelect={() => setFilters({ ...filters, area: undefined })}
                                        className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] cursor-pointer outline-none"
                                    >
                                        Semua Area
                                    </DropdownMenu.Item>
                                    {AREA_OPTIONS.map(area => (
                                        <DropdownMenu.Item
                                            key={area}
                                            onSelect={() => setFilters({ ...filters, area })}
                                            className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] cursor-pointer outline-none flex items-center justify-between"
                                        >
                                            {area}
                                            {filters.area === area && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                        </DropdownMenu.Item>
                                    ))}
                                </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button type="button" className="queue-pop" aria-label="Atur kolom">
                                    <Columns aria-hidden="true" className="w-3.5 h-3.5" /><span className="queue-pop-v">Kolom</span>
                                </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content className="z-50 min-w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl p-2 animate-in fade-in slide-in-from-top-2">
                                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    Toggle Columns
                                </div>
                                {table.getAllLeafColumns().map(column => {
                                    if (column.id === 'actions') return null;
                                    return (
                                        <label key={column.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={column.getIsVisible()}
                                                onChange={column.getToggleVisibilityHandler()}
                                                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-cyan-500 focus:ring-cyan-500/50"
                                            />
                                            {typeof column.columnDef.header === 'string'
                                                ? column.columnDef.header
                                                : column.id.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                        </label>
                                    );
                                })}
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <span className="res-spacer" />
                    <Button variant="soft" size="icon" onClick={() => refetch()} title="Refresh Data" aria-label="Refresh Data"><RefreshCw aria-hidden="true" /></Button>
                    <Button variant="primary" onClick={() => { setSelectedVpn(null); setShowModal(true); }}><Plus aria-hidden="true" />Tambah VPN Access</Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {Object.keys(rowSelection).length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center justify-between p-3 mb-6 bg-primary/10 border border-primary/20 rounded-xl"
                    >
                        <span className="text-primary font-medium text-sm">
                            {Object.keys(rowSelection).length} data VPN terpilih
                        </span>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--error-50))] hover:bg-[hsl(var(--error-100))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/20 dark:hover:bg-[hsl(var(--error-900))]/40 dark:text-[hsl(var(--error-400))] rounded-lg transition-colors font-semibold text-sm disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isBulkDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="res-table flex flex-col"
            >
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id} className="bg-[hsl(var(--idesk-surface))] border-b border-[var(--td-line)] sticky top-0 z-10">
                                    {headerGroup.headers.map(header => (
                                        <th key={header.id} className="py-2.5 px-4 text-[11.5px] font-medium text-[var(--td-text-3)] whitespace-nowrap" style={{ width: header.getSize() }}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="divide-y divide-[var(--td-line)]">
                            {isLoading ? (
                                [...Array(10)].map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="animate-pulse">
                                        {table.getAllLeafColumns().filter(c => c.getIsVisible()).map((col) => (
                                            <td key={col.id} className="py-4 px-4">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="py-24 text-center text-slate-400">
                                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                                        <p className="font-medium text-slate-500">Tidak ada data VPN access</p>
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map(row => (
                                    <tr key={row.id} className="hover:bg-[var(--res-surface-2)] transition-colors group relative">
                                        {row.getVisibleCells().map(cell => (
                                            <td key={cell.id} className="py-3 px-4 align-middle text-[12.5px]">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="res-foot">
                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 w-full sm:w-auto overflow-x-auto">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span>Tampilkan</span>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button className="flex items-center justify-between gap-2 px-3 py-1 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[70px]">
                                        <span>{table.getState().pagination.pageSize}</span>
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content side="top" className="z-50 min-w-[70px] bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl py-1.5 animate-in fade-in slide-in-from-bottom-2">
                                        {[10, 20, 30, 40, 50, 100].map(pageSize => (
                                            <DropdownMenu.Item
                                                key={pageSize}
                                                onSelect={() => table.setPageSize(pageSize)}
                                                className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] cursor-pointer outline-none flex items-center justify-between"
                                            >
                                                {pageSize}
                                                {table.getState().pagination.pageSize === pageSize && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </DropdownMenu.Item>
                                        ))}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <span>baris</span>
                        </div>
                        <span className="hidden sm:block h-4 w-px bg-slate-300 dark:bg-slate-700 shrink-0" />
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span>Halaman {table.getState().pagination.pageIndex + 1} dari {Math.max(1, table.getPageCount())}</span>
                            <span className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2" />
                            <span>Total {table.getPrePaginationRowModel().rows.length} data</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                            className="p-2 rounded-lg border border-[hsl(var(--border))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors disabled:cursor-not-allowed"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="p-2 rounded-lg border border-[hsl(var(--border))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="p-2 rounded-lg border border-[hsl(var(--border))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                            className="p-2 rounded-lg border border-[hsl(var(--border))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors disabled:cursor-not-allowed"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>

            <VpnAccessModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setSelectedVpn(null);
                }}
                vpnAccess={selectedVpn}
            />

            <ConfirmDialog
                isOpen={deleteConfirm.open}
                onClose={() => setDeleteConfirm({ open: false, id: null })}
                onConfirm={handleDeleteConfirm}
                title="Hapus VPN Access"
                message="Apakah Anda yakin ingin menghapus data VPN access ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                variant="danger"
            />
        </div>
    );
}

