import React from 'react';
import { Trash2, CheckCircle, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RenewalContract } from '../types/renewal.types';
import { useBulkAcknowledge, useBulkDelete } from '../hooks/useRenewalApi';
import { toast } from 'sonner';

interface BulkActionsBarProps {
    selectedContracts: RenewalContract[];
    onClearSelection: () => void;
    onExport: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedContracts,
    onClearSelection,
    onExport,
}) => {
    const bulkAcknowledgeMutation = useBulkAcknowledge();
    const bulkDeleteMutation = useBulkDelete();

    const count = selectedContracts.length;

    if (count === 0) return null;

    const handleBulkAcknowledge = async () => {
        const ids = selectedContracts.filter(c => !c.isAcknowledged).map(c => c.id);
        if (ids.length === 0) {
            toast.info('All selected contracts are already acknowledged');
            return;
        }

        try {
            const result = await bulkAcknowledgeMutation.mutateAsync(ids);
            toast.success(`Acknowledged ${result.affected} contracts`);
            onClearSelection();
        } catch {
            toast.error('Failed to acknowledge contracts');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${count} contracts? This action cannot be undone.`)) {
            return;
        }

        const ids = selectedContracts.map(c => c.id);

        try {
            const result = await bulkDeleteMutation.mutateAsync(ids);
            toast.success(`Deleted ${result.affected} contract${result.affected !== 1 ? 's' : ''}`);
            onClearSelection();
        } catch {
            toast.error('Failed to delete contracts');
        }
    };

    const isProcessing = bulkAcknowledgeMutation.isPending || bulkDeleteMutation.isPending;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
            <div className="flex items-center gap-4 px-6 py-3 bg-slate-900 dark:bg-[hsl(var(--card))] rounded-full shadow-2xl border border-slate-800 dark:border-[hsl(var(--border))]">
                {/* Count */}
                <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 bg-primary rounded-full text-slate-900 text-sm font-bold">
                        {count}
                    </span>
                    <span className="text-white text-sm font-bold">selected</span>
                </div>

                <div className="w-px h-6 bg-slate-700 dark:bg-[hsl(var(--border))]" />

                {/* Actions */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkAcknowledge}
                    disabled={isProcessing}
                    className="text-white hover:text-[hsl(var(--success-400))] hover:bg-[hsl(var(--success-900))]/30 transition-colors"
                >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Acknowledge
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExport}
                    disabled={isProcessing}
                    className="text-white hover:text-blue-400 hover:bg-blue-900/30 transition-colors"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isProcessing}
                    className="text-white hover:text-[hsl(var(--error-400))] hover:bg-[hsl(var(--error-900))]/30 transition-colors"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                </Button>

                <div className="w-px h-6 bg-slate-700 dark:bg-[hsl(var(--border))]" />

                {/* Clear */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSelection}
                    disabled={isProcessing}
                    className="text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
