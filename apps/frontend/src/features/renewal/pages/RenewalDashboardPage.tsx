import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, CalendarClock, RefreshCw, Upload, FileText, ChevronLeft, ChevronRight, Download, Calendar, LayoutGrid, Table2 } from 'lucide-react';
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
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <CalendarClock className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Renewal Reminders</h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Manage contract renewals and receive automated reminders
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleExport}
                        className="border-slate-200 dark:border-slate-700"
                        disabled={contracts.length === 0}
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        className="border-slate-200 dark:border-slate-700"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setIsManualModalOpen(true)}
                        className="border-slate-200 dark:border-slate-700"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Add Manual
                    </Button>
                    <Button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="bg-primary text-slate-900 font-bold hover:bg-primary/90"
                    >
                        <Upload className="w-5 h-5 mr-2" />
                        Upload PDF
                    </Button>
                </div>
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
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {searchInput !== debouncedSearch && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ContractStatus | '')}
                        className="appearance-none pl-12 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[180px]"
                    >
                        <option value="">All Status</option>
                        <option value={ContractStatus.ACTIVE}>Active</option>
                        <option value={ContractStatus.EXPIRING_SOON}>Expiring Soon</option>
                        <option value={ContractStatus.EXPIRED}>Expired</option>
                        <option value={ContractStatus.DRAFT}>Draft</option>
                    </select>
                </div>
                {/* Category Filter */}
                <div className="relative">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as ContractCategory | '')}
                        className="appearance-none px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[160px]"
                    >
                        <option value="">All Categories</option>
                        <option value={ContractCategory.SOFTWARE}>Software</option>
                        <option value={ContractCategory.HARDWARE}>Hardware</option>
                        <option value={ContractCategory.SERVICE}>Service</option>
                        <option value={ContractCategory.SUBSCRIPTION}>Subscription</option>
                        <option value={ContractCategory.MAINTENANCE}>Maintenance</option>
                        <option value={ContractCategory.OTHER}>Other</option>
                    </select>
                </div>
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <Button
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className={viewMode === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}
                    >
                        <Table2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('calendar')}
                        className={viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}
                    >
                        <Calendar className="w-4 h-4" />
                    </Button>
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
                />
            )}

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} of {totalItems} contracts
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 border-0 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let page: number;
                            if (totalPages <= 5) {
                                page = i + 1;
                            } else if (currentPage <= 3) {
                                page = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                page = totalPages - 4 + i;
                            } else {
                                page = currentPage - 2 + i;
                            }
                            return (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(page)}
                                    className={currentPage === page
                                        ? "bg-primary text-slate-900"
                                        : "border-slate-200 dark:border-slate-700"
                                    }
                                >
                                    {page}
                                </Button>
                            );
                        })}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="border-slate-200 dark:border-slate-700"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
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
