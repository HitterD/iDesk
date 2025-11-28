import React from 'react';
import { FileText, Trash2, Edit2, ExternalLink, Calendar, Building2 } from 'lucide-react';
import { RenewalContract, ContractStatus } from '../types/renewal.types';
import { Button } from '@/components/ui/button';

interface ContractTableProps {
    contracts: RenewalContract[];
    isLoading: boolean;
    onEdit: (contract: RenewalContract) => void;
    onDelete: (id: string) => void;
    onView: (contract: RenewalContract) => void;
}

const statusConfig: Record<ContractStatus, { label: string; color: string }> = {
    [ContractStatus.ACTIVE]: { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    [ContractStatus.EXPIRING_SOON]: { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    [ContractStatus.EXPIRED]: { label: 'Expired', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    [ContractStatus.DRAFT]: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
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

export const ContractTable: React.FC<ContractTableProps> = ({
    contracts,
    isLoading,
    onEdit,
    onDelete,
    onView,
}) => {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="animate-pulse p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (contracts.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">No Contracts Found</h3>
                <p className="text-slate-500 dark:text-slate-400">Upload your first contract to get started.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Contract</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Confidence</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {contracts.map((contract) => {
                            const status = statusConfig[contract.status];
                            return (
                                <tr key={contract.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-5 h-5 text-red-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">
                                                    {contract.poNumber || 'No PO Number'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                                    {contract.originalFileName}
                                                </p>
                                                <p className="text-xs text-slate-400">{formatFileSize(contract.fileSize)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700 dark:text-slate-300">
                                                {contract.vendorName || '-'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-400" />
                                            <div className="text-sm">
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    {formatDate(contract.startDate)}
                                                </span>
                                                <span className="text-slate-400 mx-1">→</span>
                                                <span className={`font-medium ${contract.status === ContractStatus.EXPIRED ? 'text-red-500' :
                                                    contract.status === ContractStatus.EXPIRING_SOON ? 'text-orange-500' :
                                                        'text-slate-700 dark:text-slate-300'
                                                    }`}>
                                                    {formatDate(contract.endDate)}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {contract.extractionConfidence !== null ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${contract.extractionConfidence >= 0.7 ? 'bg-green-500' :
                                                            contract.extractionConfidence >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${contract.extractionConfidence * 100}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-500">
                                                    {Math.round(contract.extractionConfidence * 100)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onView(contract)}
                                                className="text-slate-500 hover:text-blue-500"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEdit(contract)}
                                                className="text-slate-500 hover:text-primary"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onDelete(contract.id)}
                                                className="text-slate-500 hover:text-red-500"
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
