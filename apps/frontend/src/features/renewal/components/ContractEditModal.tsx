import React, { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateContract } from '../hooks/useRenewalApi';
import { RenewalContract } from '../types/renewal.types';
import { toast } from 'sonner';

interface ContractEditModalProps {
    isOpen: boolean;
    contract: RenewalContract | null;
    onClose: () => void;
}

export const ContractEditModal: React.FC<ContractEditModalProps> = ({ isOpen, contract, onClose }) => {
    const [formData, setFormData] = useState({
        poNumber: '',
        vendorName: '',
        description: '',
        startDate: '',
        endDate: '',
    });

    const updateMutation = useUpdateContract();

    useEffect(() => {
        if (contract) {
            setFormData({
                poNumber: contract.poNumber || '',
                vendorName: contract.vendorName || '',
                description: contract.description || '',
                startDate: contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : '',
                endDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : '',
            });
        }
    }, [contract]);

    const handleSave = async () => {
        if (!contract) return;

        try {
            await updateMutation.mutateAsync({
                id: contract.id,
                data: {
                    poNumber: formData.poNumber || undefined,
                    vendorName: formData.vendorName || undefined,
                    description: formData.description || undefined,
                    startDate: formData.startDate || undefined,
                    endDate: formData.endDate || undefined,
                },
            });
            toast.success('Contract updated successfully');
            onClose();
        } catch (error) {
            toast.error('Failed to update contract');
        }
    };

    if (!isOpen || !contract) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Edit Contract</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                PO Number
                            </label>
                            <input
                                type="text"
                                value={formData.poNumber}
                                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Enter PO number"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                Vendor Name
                            </label>
                            <input
                                type="text"
                                value={formData.vendorName}
                                onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Enter vendor name"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                Description
                            </label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Enter description"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">
                                End Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            {!formData.endDate && (
                                <p className="text-xs text-orange-500 mt-1">
                                    End date is required for reminders
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1 py-6 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={updateMutation.isPending}
                            className="flex-1 bg-primary text-slate-900 font-bold py-6 rounded-xl hover:bg-primary/90"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
