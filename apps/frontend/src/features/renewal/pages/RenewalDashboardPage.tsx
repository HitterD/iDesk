import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, CalendarClock, RefreshCw, Upload, FileText, ChevronLeft, ChevronRight, Download, Calendar, LayoutGrid, Table2, ChevronDown, CheckCircle2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/button';
import { ContractStats } from '../components/ContractStats';
import { ContractTable } from '../components/ContractTable';
import { ContractUploadModal } from '../components/ContractUploadModal';
import { ContractEditModal } from '../components/ContractEditModal';
import { ManualContractModal } from '../components/ManualContractModal';
import { PdfPreviewModal } from '../components/PdfPreviewModal';
import { ContractCalendar } from '../components/ContractCalendar';
import { BulkActionsBar } from '../components/BulkActionsBar';
import { useRenewalStats, useRenewalContracts, useDeleteContract } from '../hooks/useRenewalApi';
import { RenewalContract, ContractStatus, ContractCategory } from '../types/renewal.types';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const RenewalDashboardPage = () => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<RenewalContract | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
    const [categoryFilter, setCategoryFilter] = useState<ContractCategory | ''>('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [contractToDelete, setContractToDelete] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // New state for additional features
    const [previewContract, setPreviewContract] = useState<RenewalContract | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Debounced search (500ms delay)
    const debouncedSearch = useDebounce(searchInput, 500);

    const queryClient = useQueryClient();
    const { data: stats, isLoading: statsLoading } = useRenewalStats();

    // Server-side paginated query
    const { data: contractsData, isLoading: contractsLoading } = useRenewalContracts({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        search: debouncedSearch || undefined,
        page: currentPage,
        limit: pageSize,
    });
    const deleteMutation = useDeleteContract();

    // Extract pagination data from server response
    const contracts = contractsData?.items ?? [];
    const totalItems = contractsData?.total ?? 0;
    const totalPages = contractsData?.totalPages ?? 1;

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set());
    }, [debouncedSearch, statusFilter, categoryFilter, pageSize]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Ctrl/Cmd + U = Upload
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                setIsUploadModalOpen(true);
            }
            // Ctrl/Cmd + N = New Manual
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                setIsManualModalOpen(true);
            }
            // Escape = Clear selection
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
                setPreviewContract(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleDeleteClick = (id: string) => {
        setContractToDelete(id);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!contractToDelete) return;

        try {
            await deleteMutation.mutateAsync(contractToDelete);
            toast.success('Contract deleted successfully');
        } catch (error) {
            toast.error('Failed to delete contract');
        } finally {
            setDeleteConfirmOpen(false);
            setContractToDelete(null);
        }
    };

    const handleView = (contract: RenewalContract) => {
        // Use inline preview modal instead of opening new tab
        if (contract.filePath && contract.filePath !== '') {
            setPreviewContract(contract);
        } else {
            toast.info('This contract has no attached file');
        }
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['renewal'] });
        toast.success('Data refreshed');
    };

    // Handle clicking on stat card to filter
    const handleStatClick = (status: ContractStatus | '') => {
        setStatusFilter(status);
        toast.info(status ? `Filtering by ${status.replace('_', ' ').toLowerCase()}` : 'Showing all contracts');
    };

    // Export to CSV
    const handleExport = () => {
        if (contracts.length === 0) {
            toast.error('No contracts to export');
            return;
        }

        const headers = ['PO Number', 'Vendor', 'Description', 'Value (IDR)', 'Start Date', 'End Date', 'Status', 'Acknowledged'];
        const csvContent = [
            headers.join(','),
            ...contracts.map(c => [
                c.poNumber || '',
                c.vendorName || '',
                (c.description || '').replace(/,/g, ';'),
                c.contractValue || '',
                c.startDate ? new Date(c.startDate).toLocaleDateString('id-ID') : '',
                c.endDate ? new Date(c.endDate).toLocaleDateString('id-ID') : '',
                c.status,
                c.isAcknowledged ? 'Yes' : 'No'
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `contracts_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success(`Exported ${contracts.length} contracts`);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Compact Actions Row - Header is now in RenewalHubPage */}
            <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={contracts.length === 0}
                    className="border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm font-semibold h-10 px-4"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm font-semibold h-10 px-4"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsManualModalOpen(true)}
                    className="border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm font-semibold h-10 px-4"
                >
                    <FileText className="w-4 h-4 mr-2" />
                    Add Manual
                </Button>
                <Button
                    size="sm"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm h-10 px-5"
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload PDF
                </Button>
            </div>

            {/* Stats Cards - Now Clickable */}
            <ContractStats
                stats={stats}
                isLoading={statsLoading}
                onStatClick={handleStatClick}
                activeStatus={statusFilter}
            />

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by PO number, vendor, or filename..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out font-medium"
                    />
                    {searchInput !== debouncedSearch && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <div className="relative group shrink-0">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <Filter className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
                        className="appearance-none pl-12 pr-10 py-3 w-full md:w-auto bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[180px] transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out cursor-pointer font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                        <option value="">All Status</option>
                        <option value={ContractStatus.ACTIVE}>Active</option>
                        <option value={ContractStatus.EXPIRING_SOON}>Expiring Soon</option>
                        <option value={ContractStatus.EXPIRED}>Expired</option>
                        <option value={ContractStatus.DRAFT}>Draft</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                </div>
                {/* Category Filter */}
                <div className="relative group shrink-0">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as ContractCategory | '')}
                        className="appearance-none pl-4 pr-10 py-3 w-full md:w-auto bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-w-[160px] cursor-pointer font-medium transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                        <option value="">All Categories</option>
                        <option value={ContractCategory.SOFTWARE}>Software</option>
                        <option value={ContractCategory.HARDWARE}>Hardware</option>
                        <option value={ContractCategory.SERVICE}>Service</option>
                        <option value={ContractCategory.SUBSCRIPTION}>Subscription</option>
                        <option value={ContractCategory.MAINTENANCE}>Maintenance</option>
                        <option value={ContractCategory.OTHER}>Other</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                </div>
                {/* View Mode Toggle */}
                <div className="flex items-center p-1.5 bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-xl shrink-0">
                    <button
                        onClick={() => setViewMode('table')}
                        className={`flex items-center justify-center p-2 rounded-lg transition-[opacity,transform,colors] duration-200 ease-out ${
                            viewMode === 'table'
                                ? 'bg-white dark:bg-[hsl(var(--card))] text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="Table View"
                    >
                        <Table2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        className={`flex items-center justify-center p-2 rounded-lg transition-[opacity,transform,colors] duration-200 ease-out ${
                            viewMode === 'calendar'
                                ? 'bg-white dark:bg-[hsl(var(--card))] text-primary shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                        title="Calendar View"
                    >
                        <Calendar className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Contracts View - Table or Calendar */}
            {viewMode === 'table' ? (
                <ContractTable
                    contracts={contracts}
                    isLoading={contractsLoading}
                    onEdit={(contract) => setEditingContract(contract)}
                    onDelete={handleDeleteClick}
                    onView={handleView}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onUpload={() => setIsUploadModalOpen(true)}
                    onAddManual={() => setIsManualModalOpen(true)}
                />
            ) : (
                <ContractCalendar
                    contracts={contracts}
                    onContractClick={(contract) => setPreviewContract(contract)}
                    isLoading={contractsLoading}
                />
            )}

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-[hsl(var(--border))] bg-slate-50 dark:bg-slate-800/30 gap-4 mt-4 rounded-b-2xl">
                    <div className="flex items-center gap-4 text-sm font-medium text-slate-500 dark:text-slate-400 w-full sm:w-auto overflow-x-auto">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span>Tampilkan</span>
                            <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                    <button className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-[70px]">
                                        <span>{pageSize}</span>
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.Content side="top" className="z-50 min-w-[70px] bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl py-1.5 animate-in fade-in slide-in-from-bottom-2">
                                        {PAGE_SIZE_OPTIONS.map(size => (
                                            <DropdownMenu.Item
                                                key={size}
                                                onSelect={() => {
                                                    setPageSize(size);
                                                    setCurrentPage(1);
                                                }}
                                                className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer outline-none flex items-center justify-between font-medium"
                                            >
                                                {size}
                                                {pageSize === size && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                            </DropdownMenu.Item>
                                        ))}
                                    </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                            <span>baris</span>
                        </div>
                        <span className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <span>Halaman {currentPage} dari {Math.max(1, totalPages)}</span>
                            <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
                            <span>Total {totalItems} data</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-not-allowed shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <ChevronLeft className="w-4 h-4 -ml-2" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-not-allowed shadow-sm"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-not-allowed shadow-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-[hsl(var(--border))] bg-white dark:bg-[hsl(var(--card))] text-slate-500 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:cursor-not-allowed shadow-sm"
                        >
                            <ChevronRight className="w-4 h-4" />
                            <ChevronRight className="w-4 h-4 -ml-2" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            <ContractUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
            />
            <ContractEditModal
                isOpen={!!editingContract}
                contract={editingContract}
                onClose={() => setEditingContract(null)}
            />
            <ManualContractModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
            />
            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setContractToDelete(null);
                }}
                onConfirm={handleDeleteConfirm}
                title="Delete Contract"
                message="Are you sure you want to delete this contract? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />

            {/* PDF Preview Modal */}
            <PdfPreviewModal
                isOpen={!!previewContract}
                contract={previewContract}
                onClose={() => setPreviewContract(null)}
            />

            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedContracts={contracts.filter(c => selectedIds.has(c.id))}
                onClearSelection={() => setSelectedIds(new Set())}
                onExport={() => {
                    const selectedContracts = contracts.filter(c => selectedIds.has(c.id));
                    if (selectedContracts.length === 0) return;

                    const headers = ['PO Number', 'Vendor', 'Description', 'Value (IDR)', 'Start Date', 'End Date', 'Status'];
                    const csvContent = [
                        headers.join(','),
                        ...selectedContracts.map(c => [
                            c.poNumber || '',
                            c.vendorName || '',
                            (c.description || '').replace(/,/g, ';'),
                            c.contractValue || '',
                            c.startDate ? new Date(c.startDate).toLocaleDateString('id-ID') : '',
                            c.endDate ? new Date(c.endDate).toLocaleDateString('id-ID') : '',
                            c.status
                        ].join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `selected_contracts_${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                    toast.success(`Exported ${selectedContracts.length} selected contracts`);
                    setSelectedIds(new Set());
                }}
            />
        </div>
    );
};

export default RenewalDashboardPage;
