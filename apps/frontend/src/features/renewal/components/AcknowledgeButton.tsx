import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAcknowledgeContract, useUnacknowledgeContract } from '../hooks/useRenewalApi';
import { RenewalContract } from '../types/renewal.types';
import { toast } from 'sonner';

interface AcknowledgeButtonProps {
    contract: RenewalContract;
    showUnacknowledge?: boolean;
    className?: string;
}

export const AcknowledgeButton: React.FC<AcknowledgeButtonProps> = ({
    contract,
    showUnacknowledge = true,
    className = '',
}) => {
    const { mutate: acknowledge, isPending: isAcknowledging } = useAcknowledgeContract();
    const { mutate: unacknowledge, isPending: isUnacknowledging } = useUnacknowledgeContract();

    const handleAcknowledge = () => {
        acknowledge(contract.id, {
            onSuccess: () => {
                toast.success('Contract acknowledged', {
                    description: 'You will no longer receive reminders for this contract.',
                });
            },
            onError: (error: any) => {
                toast.error('Failed to acknowledge', {
                    description: error?.response?.data?.message || 'Please try again.',
                });
            },
        });
    };

    const handleUnacknowledge = () => {
        unacknowledge(contract.id, {
            onSuccess: () => {
                toast.success('Acknowledgment removed', {
                    description: 'You will resume receiving reminders for this contract.',
                });
            },
            onError: (error: any) => {
                toast.error('Failed to remove acknowledgment', {
                    description: error?.response?.data?.message || 'Please try again.',
                });
            },
        });
    };

    if (contract.isAcknowledged) {
        const acknowledgedDate = contract.acknowledgedAt
            ? new Date(contract.acknowledgedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
              })
            : 'Unknown date';

        return (
            <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 ${className}`}>
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <div className="text-sm">
                        <span className="font-medium">Acknowledged</span>
                        <span className="text-green-500 dark:text-green-500 ml-1">
                            on {acknowledgedDate}
                        </span>
                        {contract.acknowledgedBy && (
                            <span className="text-green-500 dark:text-green-500 ml-1">
                                by {contract.acknowledgedBy.fullName}
                            </span>
                        )}
                    </div>
                </div>
                {showUnacknowledge && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnacknowledge}
                        disabled={isUnacknowledging}
                        className="text-slate-600 hover:text-red-600 hover:border-red-300"
                    >
                        <XCircle className="h-4 w-4 mr-1" />
                        {isUnacknowledging ? 'Processing...' : 'Remove Acknowledgment'}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <Button
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className={`bg-blue-600 hover:bg-blue-700 text-white ${className}`}
        >
            <CheckCircle className="h-4 w-4 mr-2" />
            {isAcknowledging ? 'Processing...' : 'Acknowledge Renewal'}
        </Button>
    );
};

export default AcknowledgeButton;
