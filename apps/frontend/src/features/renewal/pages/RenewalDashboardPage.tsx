import React, { useState, useEffect, useMemo } from 'react';
import { downloadBlob } from '@/lib/utils/downloadBlob';
import { Search, RefreshCw, Upload, FilePlus2, Download, Calendar, Table2, ChevronDown, Check } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ResPager } from '@/components/resources/ResourceParts';
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

/** Radio menu in the shared popover style for the Status / Kategori / Per halaman pops. */
const PopMenu: React.FC<{ value: string; labels: Readonly<Record<string, string>>; onChange: (v: string) => void; label: string; side?: 'top' | 'bottom' }> = ({ value, labels, onChange, label, side }) => (
    <DropdownMenu.Portal>
        <DropdownMenu.Content side={side} align="start" sideOffset={6} aria-label={label}
            className="z-50 min-w-[180px] rounded-xl bg-[hsl(var(--idesk-surface))] p-1 shadow-[var(--queue-pop-shadow)]">
            <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
                {Object.entries(labels).map(([k, l]) => (
                    <DropdownMenu.RadioItem key={k || 'all'} value={k} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] outline-none cursor-pointer data-[highlighted]:bg-[var(--dash-hover)]">
                        {l}<DropdownMenu.ItemIndicator><Check className="w-3.5 h-3.5 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" /></DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                ))}
            </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
    </DropdownMenu.Portal>
);

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
        downloadBlob(blob, `contracts_export_${new Date().toISOString().split('T')[0]}.csv`);
        toast.success(`Exported ${contracts.length} contracts`);
    };

    const STATUS_LABEL: Readonly<Record<string, string>> = {
        '': 'All Status', [ContractStatus.ACTIVE]: 'Active', [ContractStatus.EXPIRING_SOON]: 'Expiring Soon', [ContractStatus.EXPIRED]: 'Expired', [ContractStatus.DRAFT]: 'Draft',
    };
    const CATEGORY_LABEL: Readonly<Record<string, string>> = {
        '': 'All Categories', [ContractCategory.SOFTWARE]: 'Software', [ContractCategory.HARDWARE]: 'Hardware', [ContractCategory.SERVICE]: 'Service',
        [ContractCategory.SUBSCRIPTION]: 'Subscription', [ContractCategory.MAINTENANCE]: 'Maintenance', [ContractCategory.OTHER]: 'Other',
    };

    return (
        <div>
            {/* Stats Cards - clickable filters */}
            <ContractStats
                stats={stats}
                isLoading={statsLoading}
                onStatClick={handleStatClick}
                activeStatus={statusFilter}
            />

            {/* Filters + actions (mockup .filters) */}
            <div className="res-filters">
                <label className="queue-field flex-1" htmlFor="contract-search">
                    <Search aria-hidden="true" />
                    <input id="contract-search" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Cari nomor PO, vendor, atau nama file..." aria-label="Cari kontrak" />
                    {searchInput !== debouncedSearch && <span role="status" aria-label="Mencari" className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                </label>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button type="button" className="queue-pop" aria-label={`Status: ${STATUS_LABEL[statusFilter]}`}>
                            <span className="queue-pop-k">Status</span><span className="queue-pop-v">{STATUS_LABEL[statusFilter]}</span><ChevronDown aria-hidden="true" />
                        </button>
                    </DropdownMenu.Trigger>
                    <PopMenu value={statusFilter} labels={STATUS_LABEL} onChange={(v) => setStatusFilter(v as ContractStatus | '')} label="Filter status" />
                </DropdownMenu.Root>
                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button type="button" className="queue-pop" aria-label={`Kategori: ${CATEGORY_LABEL[categoryFilter]}`}>
                            <span className="queue-pop-k">Kategori</span><span className="queue-pop-v">{CATEGORY_LABEL[categoryFilter]}</span><ChevronDown aria-hidden="true" />
                        </button>
                    </DropdownMenu.Trigger>
                    <PopMenu value={categoryFilter} labels={CATEGORY_LABEL} onChange={(v) => setCategoryFilter(v as ContractCategory | '')} label="Filter kategori" />
                </DropdownMenu.Root>
                <SegmentedControl aria-label="Tampilan" className="dash-seg" value={viewMode} onValueChange={setViewMode} options={[
                    { value: 'table', label: 'Tabel', icon: Table2, ariaLabel: 'Table View' },
                    { value: 'calendar', label: 'Kalender', icon: Calendar, ariaLabel: 'Calendar View' },
                ]} />
                <Button variant="soft" size="icon" onClick={handleRefresh} aria-label="Refresh" title="Refresh"><RefreshCw aria-hidden="true" /></Button>
                <Button variant="soft" size="icon" onClick={handleExport} disabled={contracts.length === 0} aria-label="Export CSV" title="Export CSV"><Download aria-hidden="true" /></Button>
                <Button variant="soft" onClick={() => setIsManualModalOpen(true)}><FilePlus2 aria-hidden="true" />Add Manual</Button>
                <Button variant="primary" onClick={() => setIsUploadModalOpen(true)}><Upload aria-hidden="true" />Upload PDF</Button>
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
                <div className="dash-panel">
                    <ContractCalendar
                        contracts={contracts}
                        onContractClick={(contract) => setPreviewContract(contract)}
                        isLoading={contractsLoading}
                    />
                </div>
            )}

            {/* Pagination */}
            {totalItems > 0 && (
                <div className="res-foot mt-3 rounded-2xl" style={{ borderTop: 0 }}>
                    <span className="flex items-center gap-2 flex-wrap">
                        <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                                <button type="button" className="queue-pop" aria-label={`Per halaman: ${pageSize}`}>
                                    <span className="queue-pop-k">Per halaman</span><span className="queue-pop-v">{pageSize}</span><ChevronDown aria-hidden="true" />
                                </button>
                            </DropdownMenu.Trigger>
                            <PopMenu value={String(pageSize)} labels={Object.fromEntries(PAGE_SIZE_OPTIONS.map((n) => [String(n), String(n)]))}
                                onChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }} label="Per halaman" side="top" />
                        </DropdownMenu.Root>
                        <span>Halaman {currentPage} dari {Math.max(1, totalPages)} · Total {totalItems} data</span>
                    </span>
                    <ResPager page={currentPage} totalPages={Math.max(1, totalPages)} onChange={setCurrentPage} />
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
                    downloadBlob(blob, `selected_contracts_${new Date().toISOString().split('T')[0]}.csv`);
                    toast.success(`Exported ${selectedContracts.length} selected contracts`);
                    setSelectedIds(new Set());
                }}
            />
        </div>
    );
};

export default RenewalDashboardPage;
