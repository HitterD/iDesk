import { useState } from 'react';
import { Search, Filter, CalendarClock, RefreshCw, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContractStats } from '../components/ContractStats';
import { ContractTable } from '../components/ContractTable';
import { ContractUploadModal } from '../components/ContractUploadModal';
import { ContractEditModal } from '../components/ContractEditModal';
import { ManualContractModal } from '../components/ManualContractModal';
import { useRenewalStats, useRenewalContracts, useDeleteContract } from '../hooks/useRenewalApi';
import { RenewalContract, ContractStatus } from '../types/renewal.types';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export const RenewalDashboardPage = () => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<RenewalContract | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');

    const queryClient = useQueryClient();
    const { data: stats, isLoading: statsLoading } = useRenewalStats();
    const { data: contracts = [], isLoading: contractsLoading } = useRenewalContracts({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
    });
    const deleteMutation = useDeleteContract();

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this contract?')) return;

        try {
            await deleteMutation.mutateAsync(id);
            toast.success('Contract deleted successfully');
        } catch (error) {
            toast.error('Failed to delete contract');
        }
    };

    const handleView = (contract: RenewalContract) => {
        // Only open if file exists
        if (contract.filePath && contract.filePath !== '') {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050';
            window.open(`${baseUrl}${contract.filePath}`, '_blank');
        } else {
            toast.info('This contract has no attached file');
        }
    };

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['renewal'] });
        toast.success('Data refreshed');
    };

    return (
        <div className="space-y-8">
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

            {/* Stats Cards */}
            <ContractStats stats={stats} isLoading={statsLoading} />

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by PO number, vendor, or filename..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
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
            </div>

            {/* Contracts Table */}
            <ContractTable
                contracts={contracts}
                isLoading={contractsLoading}
                onEdit={(contract) => setEditingContract(contract)}
                onDelete={handleDelete}
                onView={handleView}
            />

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
        </div>
    );
};

export default RenewalDashboardPage;
