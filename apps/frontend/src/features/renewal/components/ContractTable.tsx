import React, { useState } from 'react';
import { FileText, Trash2, Edit2, ExternalLink, Calendar, Building2, CheckCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown, DollarSign } from 'lucide-react';
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

const statusConfig: Record<ContractStatus, { label: string; color: string; priority: number }> = {
    [ContractStatus.EXPIRED]: { label: 'Expired', color: 'bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/20 dark:text-[hsl(var(--error-400))] border border-[hsl(var(--error-200))] dark:border-[hsl(var(--error-800))]', priority: 0 },
    [ContractStatus.EXPIRING_SOON]: { label: 'Expiring Soon', color: 'bg-[hsl(var(--warning-50))] text-[hsl(var(--warning-600))] dark:bg-[hsl(var(--warning-900))]/20 dark:text-[hsl(var(--warning-400))] border border-[hsl(var(--warning-200))] dark:border-[hsl(var(--warning-800))]', priority: 1 },
    [ContractStatus.ACTIVE]: { label: 'Active', color: 'bg-[hsl(var(--success-50))] text-[hsl(var(--success-600))] dark:bg-[hsl(var(--success-900))]/20 dark:text-[hsl(var(--success-400))] border border-[hsl(var(--success-200))] dark:border-[hsl(var(--success-800))]', priority: 2 },
    [ContractStatus.DRAFT]: { label: 'Draft', color: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700', priority: 3 },
};

const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1" />
            : <ArrowDown className="w-3 h-3 ml-1" />;
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
        return (
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
                <div className="animate-pulse p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (contracts.length === 0) {
        return (
            <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-12">
                <div className="max-w-md mx-auto text-center">
                    {/* Floating animated icon */}
                    <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce border border-primary/20">
                        <FileText className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Contracts Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">Get started by uploading your first contract or adding one manually.</p>

                    {/* CTA Buttons - Clear Primary/Secondary */}
                    {(onUpload || onAddManual) && (
                        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                            {onUpload && (
                                <Button
                                    onClick={onUpload}
                                    className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors duration-150 rounded-xl"
                                >
                                    <FileText className="w-4 h-4 mr-2" />
                                    Upload PDF Contract
                                </Button>
                            )}
                            {onAddManual && (
                                <Button
                                    variant="outline"
                                    onClick={onAddManual}
                                    className="border-[hsl(var(--border))] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 rounded-xl font-bold"
                                >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Add Manually
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Quick Setup Guide */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 text-left border border-[hsl(var(--border))]">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">✨ Quick Setup Guide</h4>
                        <div className="space-y-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
                                Upload your contract PDF or add details manually
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
                                Review and confirm extracted data
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">3</span>
                                Get automated reminders before expiry
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1">
                <table className="w-full table-fixed text-left">
                    <thead className="bg-slate-50/80 dark:bg-[hsl(var(--background))] sticky top-0 z-10 border-b border-[hsl(var(--border))]">
                        <tr>
                            {onSelectionChange && (
                                <th className="px-5 py-4 w-12 sm:w-16">
                                    <Checkbox
                                        checked={isAllSelected || (isSomeSelected ? 'indeterminate' : false)}
                                        onCheckedChange={handleSelectAll}
                                        aria-label="Select all"
                                        className="dark:border-slate-500"
                                    />
                                </th>
                            )}
                            <th className="px-5 py-4 w-[30%] text-xs font-bold text-slate-500 uppercase tracking-wider">Contract</th>
                            <th
                                className="px-5 py-4 w-[20%] text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('vendorName')}
                            >
                                <div className="flex items-center">
                                    Vendor <SortIcon field="vendorName" />
                                </div>
                            </th>
                            <th
                                className="px-5 py-4 w-[15%] text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('endDate')}
                            >
                                <div className="flex items-center">
                                    Expiry <SortIcon field="endDate" />
                                </div>
                            </th>
                            <th
                                className="px-5 py-4 w-[15%] text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors hidden lg:table-cell"
                                onClick={() => handleSort('contractValue')}
                            >
                                <div className="flex items-center">
                                    Value <SortIcon field="contractValue" />
                                </div>
                            </th>
                            <th
                                className="px-5 py-4 w-[15%] text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                                onClick={() => handleSort('status')}
                            >
                                <div className="flex items-center">
                                    Status <SortIcon field="status" />
                                </div>
                            </th>
                            <th className="px-5 py-4 w-28 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--border))]">
                        {sortedContracts.map((contract) => {
                            const status = statusConfig[contract.status];
                            const expiryInfo = getDaysUntilExpiry(contract.endDate);
                            return (
                                <tr key={contract.id} className={cn(
                                    "hover:bg-slate-50 dark:hover:bg-[hsl(var(--background))] transition-colors group",
                                    contract.status === ContractStatus.EXPIRING_SOON && "animate-contract-warning",
                                    contract.status === ContractStatus.EXPIRED && "animate-contract-expired",
                                    contract.isAcknowledged && "opacity-75 grayscale-[50%]",
                                    selectedIds.has(contract.id) && "bg-primary/5 dark:bg-primary/10"
                                )}>
                                    {onSelectionChange && (
                                        <td className="px-5 py-4">
                                            <Checkbox
                                                checked={selectedIds.has(contract.id)}
                                                onCheckedChange={() => handleSelectOne(contract.id)}
                                                aria-label={`Select contract ${contract.poNumber}`}
                                                className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity dark:border-slate-500"
                                            />
                                        </td>
                                    )}
                                    <td className="px-5 py-4">
                                        <div className="flex items-start gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                                                contract.isAcknowledged
                                                    ? "bg-[hsl(var(--success-50))] border-[hsl(var(--success-200))] dark:bg-[hsl(var(--success-900))]/10 dark:border-[hsl(var(--success-800))]"
                                                    : "bg-[hsl(var(--error-50))] border-[hsl(var(--error-200))] dark:bg-[hsl(var(--error-900))]/10 dark:border-[hsl(var(--error-800))]"
                                            )}>
                                                {contract.isAcknowledged
                                                    ? <CheckCircle className="w-5 h-5 text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-500))]" />
                                                    : <FileText className="w-5 h-5 text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-500))]" />
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                                                    {contract.poNumber || 'No PO Number'}
                                                </p>
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                    {contract.originalFileName}
                                                </p>
                                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{formatFileSize(contract.fileSize)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2 truncate">
                                            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {contract.vendorName || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className={`text-sm font-bold ${contract.status === ContractStatus.EXPIRED ? 'text-[hsl(var(--error-600))] dark:text-[hsl(var(--error-400))]' :
                                                    contract.status === ContractStatus.EXPIRING_SOON ? 'text-[hsl(var(--warning-600))] dark:text-[hsl(var(--warning-500))]' :
                                                        'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                    {formatDate(contract.endDate)}
                                                </span>
                                            </div>
                                            {expiryInfo && (
                                                <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase", expiryInfo.color)}>
                                                    <Clock className="w-3 h-3" />
                                                    {expiryInfo.label}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 hidden lg:table-cell">
                                        <div className="flex items-center gap-2 truncate">
                                            <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                                                {formatCurrency(contract.contractValue)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={cn("inline-flex px-2.5 py-1 rounded-md text-xs font-bold", status.color)}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleAcknowledge(contract)}
                                                className={cn(
                                                    "text-slate-500 h-8 w-8 p-0 rounded-lg",
                                                    contract.isAcknowledged
                                                        ? "hover:text-[hsl(var(--warning-600))]"
                                                        : "hover:text-[hsl(var(--success-600))]"
                                                )}
                                                title={contract.isAcknowledged ? "Mark as unacknowledged" : "Acknowledge (stop reminders)"}
                                                disabled={acknowledgeMutation.isPending || unacknowledgeMutation.isPending}
                                            >
                                                <CheckCircle className={cn("w-4 h-4", contract.isAcknowledged && "fill-[hsl(var(--success-500))] text-[hsl(var(--success-500))]/20")} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onView(contract)}
                                                className="text-slate-500 hover:text-primary h-8 w-8 p-0 rounded-lg"
                                                title="View PDF"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEdit(contract)}
                                                className="text-slate-500 hover:text-primary h-8 w-8 p-0 rounded-lg"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(contract.id)}
                                                className="text-slate-500 hover:text-[hsl(var(--error-600))] h-8 w-8 p-0 rounded-lg"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
