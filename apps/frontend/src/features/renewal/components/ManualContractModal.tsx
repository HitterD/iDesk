import { useState } from 'react';
import { X, Loader2, Save, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateManualContract } from '../hooks/useRenewalApi';
import { toast } from 'sonner';

interface ManualContractModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManualContractModal: React.FC<ManualContractModalProps> = ({ isOpen, onClose }) => {
    const [formData, setFormData] = useState({
        poNumber: '',
        vendorName: '',
        description: '',
        startDate: '',
        endDate: '',
    });

    const createMutation = useCreateManualContract();

    const handleSubmit = async () => {
        try {
            await createMutation.mutateAsync({
                poNumber: formData.poNumber || undefined,
                vendorName: formData.vendorName || undefined,
                description: formData.description || undefined,
                startDate: formData.startDate || undefined,
                endDate: formData.endDate || undefined,
            });
            toast.success('Contract created successfully');
            handleClose();
        } catch (error) {
            toast.error('Failed to create contract');
        }
    };

    const handleClose = () => {
        setFormData({
            poNumber: '',
            vendorName: '',
            description: '',
            startDate: '',
            endDate: '',
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl m-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Add Contract Manually</h2>
                    </div>
                    <button
                        onClick={handleClose}
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
                                placeholder="e.g. PO-2025-001"
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
                                placeholder="e.g. PT. Example"
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
                                placeholder="e.g. Annual Software License"
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
                            onClick={handleClose}
                            className="flex-1 py-6 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={createMutation.isPending}
                            className="flex-1 bg-primary text-slate-900 font-bold py-6 rounded-xl hover:bg-primary/90"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Create Contract
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
