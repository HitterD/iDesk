import React, { useState } from 'react';
import { UserCheck, Users, X, Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AgentUser } from '../types';

interface BulkAssignDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    agents: AgentUser[];
    onAssign: (assigneeId: string) => Promise<void>;
}

export const BulkAssignDialog: React.FC<BulkAssignDialogProps> = ({
    isOpen,
    onClose,
    selectedCount,
    agents,
    onAssign,
}) => {
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleAssign = async () => {
        if (!selectedAgentId) return;

        setIsLoading(true);
        try {
            await onAssign(selectedAgentId);
            onClose();
        } finally {
            setIsLoading(false);
            setSelectedAgentId('');
        }
    };

    const handleClose = () => {
        if (!isLoading) {
            setSelectedAgentId('');
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
        >
            <div
                className="glass-card-elevated max-w-md w-full overflow-hidden animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                        </div>
                        Bulk Assign Tickets
                    </h3>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-xl">
                        <UserCheck className="w-5 h-5 text-primary" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Assigning <span className="text-primary font-bold">{selectedCount}</span> ticket{selectedCount > 1 ? 's' : ''}
                        </span>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 block">
                            Select Agent
                        </label>
                        <Select
                            value={selectedAgentId}
                            onValueChange={setSelectedAgentId}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="w-full text-slate-800 dark:text-white">
                                <SelectValue placeholder="Choose an agent to assign..." />
                            </SelectTrigger>
                            <SelectContent>
                                {agents.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-xs font-bold text-slate-900">
                                                {agent.fullName.charAt(0)}
                                            </div>
                                            {agent.fullName}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedAgentId || isLoading}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors duration-150",
                            "bg-gradient-to-r from-primary to-primary/90 text-slate-900",
                            "hover:from-primary/90 hover:to-primary/80 hover:shadow-lg hover:shadow-primary/20",
                            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                        )}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Assigning...
                            </>
                        ) : (
                            <>
                                <UserCheck className="w-4 h-4" />
                                Assign {selectedCount} Ticket{selectedCount > 1 ? 's' : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkAssignDialog;
