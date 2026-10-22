import React, { useState } from 'react';
import { FileText, FileSearch, FilePlus2, Upload, Pencil, Trash2, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, Hourglass, TriangleAlert } from 'lucide-react';
import { ResBub, ResEmpty, ResSkeletonRows, ResTable } from '@/components/resources/ResourceParts';
import { RenewalContract, ContractStatus } from '../types/renewal.types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAcknowledgeContract, useUnacknowledgeContract } from '../hooks/useRenewalApi';
import { toast } from 'sonner';

interface ContractTableProps {
    contracts: RenewalContract[];
    isLoading: boolean;
    onEdit: (contract: RenewalContract) => void;
    onDelete: (id: string) => void;
    onView: (contract: RenewalContract) => void;
    selectedIds?: Set<string>;
    onSelectionChange?: (selectedIds: Set<string>) => void;
    onUpload?: () => void;
    onAddManual?: () => void;
}

type SortField = 'endDate' | 'vendorName' | 'contractValue' | 'status';
type SortDirection = 'asc' | 'desc';

const statusConfig: Record<ContractStatus, { label: string; hue: string; ink?: string; priority: number }> = {
    [ContractStatus.EXPIRED]: { label: 'Expired', hue: 'var(--dash-red)', ink: 'var(--dash-ink-red)', priority: 0 },
    [ContractStatus.EXPIRING_SOON]: { label: 'Expiring Soon', hue: 'var(--dash-orange)', ink: 'var(--dash-ink-orange)', priority: 1 },
    [ContractStatus.ACTIVE]: { label: 'Active', hue: 'var(--dash-green)', ink: 'var(--dash-ink-green)', priority: 2 },
    [ContractStatus.DRAFT]: { label: 'Draft', hue: 'var(--dash-gray)', priority: 3 },
};
/** Mockup renewal.html columns: contract, vendor, expiry, value, status, actions. */
const CONTRACT_COLS = 'minmax(220px,1.6fr) minmax(150px,1fr) 150px 140px 130px 132px';
const CATEGORY_LABEL: Readonly<Record<string, string>> = {
    SOFTWARE: 'Software', HARDWARE: 'Hardware', SERVICE: 'Service', SUBSCRIPTION: 'Subscription', MAINTENANCE: 'Maintenance', OTHER: 'Other',
};
const EXPIRY_WARN_DAYS = 30;

/** Mockup days bubble: "Nh lewat" red, "Nh lagi" orange within 30 days, muted text otherwise. */
const ExpiryBub: React.FC<{ days: number }> = ({ days }) => {
    if (days < 0) return <ResBub color="var(--dash-red)" ink="var(--dash-ink-red)" icon={TriangleAlert}>{Math.abs(days)}h lewat</ResBub>;
    if (days === 0) return <ResBub color="var(--dash-red)" ink="var(--dash-ink-red)" icon={TriangleAlert}>Berakhir hari ini</ResBub>;
    if (days <= EXPIRY_WARN_DAYS) return <ResBub color="var(--dash-orange)" ink="var(--dash-ink-orange)" icon={Hourglass}>{days}h lagi</ResBub>;
    return <span className="res-muted text-xs">{days}h lagi</span>;
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
};

const getDaysUntilExpiry = (endDate: string | null): { days: number; label: string; color: string } | null => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days < 0) {
        return { days, label: `${Math.abs(days)}d overdue`, color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-500))] border border-[hsl(var(--error-200))] dark:border-[hsl(var(--error-800))]' };
    } else if (days === 0) {
        return { days, label: 'Expires today!', color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-500))] border border-[hsl(var(--error-200))] dark:border-[hsl(var(--error-800))]' };
    } else if (days <= 7) {
        return { days, label: `${days}d left`, color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-500))] border border-[hsl(var(--error-200))] dark:border-[hsl(var(--error-800))]' };
    } else if (days <= 30) {
        return { days, label: `${days}d left`, color: 'bg-[hsl(var(--warning-50))] text-[hsl(var(--warning-700))] dark:bg-[hsl(var(--warning-900))]/20 dark:text-[hsl(var(--warning-500))] border border-[hsl(var(--warning-200))] dark:border-[hsl(var(--warning-800))]' };
    } else if (days <= 60) {
        return { days, label: `${days}d left`, color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-800' };
    }
    return { days, label: `${days}d`, color: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' };
};

export const ContractTable: React.FC<ContractTableProps> = ({
    contracts,
    isLoading,
    onEdit,
    onDelete,
    onView,
    selectedIds = new Set(),
    onSelectionChange,
    onUpload,
    onAddManual,
}) => {
    const [sortField, setSortField] = useState<SortField>('endDate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const acknowledgeMutation = useAcknowledgeContract();
    const unacknowledgeMutation = useUnacknowledgeContract();

    const handleAcknowledge = async (contract: RenewalContract) => {
        try {
            if (contract.isAcknowledged) {
                await unacknowledgeMutation.mutateAsync(contract.id);
                toast.success('Contract marked as unacknowledged');
            } else {
                await acknowledgeMutation.mutateAsync(contract.id);
                toast.success('Contract acknowledged - no more reminders will be sent');
            }
        } catch (error) {
            toast.error('Failed to update acknowledgement status');
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedContracts = [...contracts].sort((a, b) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        switch (sortField) {
            case 'endDate':
                if (!a.endDate) return 1;
                if (!b.endDate) return -1;
                return (new Date(a.endDate).getTime() - new Date(b.endDate).getTime()) * direction;
            case 'vendorName':
                return ((a.vendorName || '').localeCompare(b.vendorName || '')) * direction;
            case 'contractValue':
                return ((a.contractValue || 0) - (b.contractValue || 0)) * direction;
            case 'status':
                return (statusConfig[a.status].priority - statusConfig[b.status].priority) * direction;
            default:
                return 0;
        }
    });

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-50" aria-hidden="true" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3 h-3" aria-hidden="true" />
            : <ArrowDown className="w-3 h-3" aria-hidden="true" />;
    };

    // Selection handlers
    const isAllSelected = contracts.length > 0 && contracts.every(c => selectedIds.has(c.id));
    const isSomeSelected = contracts.some(c => selectedIds.has(c.id)) && !isAllSelected;

    const handleSelectAll = () => {
        if (!onSelectionChange) return;
        if (isAllSelected) {
            onSelectionChange(new Set());
        } else {
            onSelectionChange(new Set(contracts.map(c => c.id)));
        }
    };

    const handleSelectOne = (id: string) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        onSelectionChange(newSet);
    };

    if (isLoading) {
        return <div className="res-table"><ResSkeletonRows rows={5} /></div>;
    }

    if (contracts.length === 0) {
        return (
            <div className="res-table">
                <ResEmpty icon={FileSearch} title="No Contracts Found"
                    cta={(onUpload || onAddManual) ? (
                        <div className="flex flex-wrap justify-center gap-2">
                            {onAddManual && <Button variant="soft" onClick={onAddManual}><FilePlus2 aria-hidden="true" />Add Manual</Button>}
                            {onUpload && <Button variant="primary" onClick={onUpload}><Upload aria-hidden="true" />Upload PDF</Button>}
                        </div>
                    ) : undefined}>
                    Coba ubah filter, atau upload kontrak pertama Anda.
                </ResEmpty>
            </div>
        );
    }

    const sortHead = (field: SortField, label: string) => (
        <button type="button" className="inline-flex items-center gap-1 hover:text-[hsl(var(--idesk-text))]" onClick={() => handleSort(field)}
            aria-label={`Urutkan ${label}`} aria-pressed={sortField === field}>
            {label}<SortIcon field={field} />
        </button>
    );
    const selectable = Boolean(onSelectionChange);

    return (
        <ResTable label="Daftar kontrak" cols={selectable ? `40px ${CONTRACT_COLS}` : CONTRACT_COLS} colsMobile={selectable ? '32px minmax(0,1fr) auto' : 'minmax(0,1fr) auto'}
            head={(
                <>
                    {selectable && (
                        <span><Checkbox checked={isAllSelected || (isSomeSelected ? 'indeterminate' : false)} onCheckedChange={handleSelectAll} aria-label="Select all" /></span>
                    )}
                    <span>Contract</span>
                    <span>{sortHead('vendorName', 'Vendor')}</span>
                    <span>{sortHead('endDate', 'Expiry')}</span>
                    <span>{sortHead('contractValue', 'Value')}</span>
                    <span>{sortHead('status', 'Status')}</span>
                    <span className="is-right">Actions</span>
                </>
            )}
            foot={<><span>Pengingat otomatis dikirim 60, 30, 7, dan 1 hari sebelum berakhir</span><span className="res-muted">{contracts.length} kontrak</span></>}>
            {sortedContracts.map((contract) => {
                const status = statusConfig[contract.status];
                const expiry = getDaysUntilExpiry(contract.endDate);
                return (
                    <div key={contract.id} className={cn('res-row is-static', contract.isAcknowledged && 'opacity-75', selectedIds.has(contract.id) && 'is-open')}>
                        {selectable && (
                            <span><Checkbox checked={selectedIds.has(contract.id)} onCheckedChange={() => handleSelectOne(contract.id)} aria-label={`Select contract ${contract.poNumber}`} /></span>
                        )}
                        <div className="res-tk">
                            <span className="res-tk-id">{contract.poNumber || 'No PO Number'}{contract.category ? ` · ${CATEGORY_LABEL[contract.category] ?? contract.category}` : ''}</span>
                            <span className="res-tk-title" title={contract.description || contract.originalFileName}>{contract.description || contract.originalFileName}</span>
                        </div>
                        <span className="res-cell res-hide-m">{contract.vendorName || '—'}</span>
                        <div className="res-hide-m grid gap-[3px] justify-items-start">
                            <span className="res-cell">{formatDate(contract.endDate)}</span>
                            {expiry && <ExpiryBub days={expiry.days} />}
                        </div>
                        <span className="res-cell is-num res-hide-m">{formatCurrency(contract.contractValue)}</span>
                        <span><ResBub color={status.hue} ink={status.ink}>{status.label}</ResBub></span>
                        <span className="res-acts res-wide-m" role="group" aria-label={`Aksi ${contract.poNumber ?? 'kontrak'}`}>
                            <button type="button" className="res-icon-btn" onClick={() => handleAcknowledge(contract)}
                                disabled={acknowledgeMutation.isPending || unacknowledgeMutation.isPending}
                                title={contract.isAcknowledged ? 'Mark as unacknowledged' : 'Acknowledge (stop reminders)'}
                                aria-label={contract.isAcknowledged ? `Batalkan acknowledge ${contract.poNumber ?? ''}` : `Acknowledge ${contract.poNumber ?? ''}`}
                                aria-pressed={contract.isAcknowledged}>
                                <CheckCircle className={cn(contract.isAcknowledged && 'text-[var(--dash-ink-green)]')} aria-hidden="true" />
                            </button>
                            <button type="button" className="res-icon-btn" onClick={() => onView(contract)} title="View PDF" aria-label={`Lihat PDF ${contract.poNumber ?? ''}`}><FileText aria-hidden="true" /></button>
                            <button type="button" className="res-icon-btn" onClick={() => onEdit(contract)} title="Edit" aria-label={`Edit ${contract.poNumber ?? ''}`}><Pencil aria-hidden="true" /></button>
                            <button type="button" className="res-icon-btn is-danger res-hide-m" onClick={() => onDelete(contract.id)} title="Delete" aria-label={`Hapus ${contract.poNumber ?? ''}`}><Trash2 aria-hidden="true" /></button>
                        </span>
                    </div>
                );
            })}
        </ResTable>
    );
};
