import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Tag, Clock, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';

interface Agent {
    id: string;
    fullName: string;
}

interface BulkActionsToolbarProps {
    selectedIds: string[];
    agents: Agent[];
    onClear: () => void;
}

type DialogType = 'status' | 'priority' | 'assign' | null;

export const BulkActionsToolbar = ({ selectedIds, agents, onClear }: BulkActionsToolbarProps) => {
    const queryClient = useQueryClient();
    const [dialogType, setDialogType] = useState<DialogType>(null);
    const [selectedValue, setSelectedValue] = useState('');

    const bulkMutation = useMutation({
        mutationFn: async (data: {
            ticketIds: string[];
            status?: string;
            priority?: string;
            assigneeId?: string;
        }) => {
            const response = await api.patch('/tickets/bulk/update', data);
            return response.data;
        },
        onSuccess: (res) => {
            toast.success(`Updated ${res.updated} tickets successfully`);
            if (res.failed?.length > 0) {
                toast.warning(`${res.failed.length} tickets could not be updated`);
            }
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            onClear();
            setDialogType(null);
            setSelectedValue('');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || 'Failed to update tickets');
        },
    });

    const handleApply = () => {
        if (!selectedValue) {
            toast.error('Please select a value');
            return;
        }

        const payload: any = { ticketIds: selectedIds };

        switch (dialogType) {
            case 'status':
                payload.status = selectedValue;
                break;
            case 'priority':
                payload.priority = selectedValue;
                break;
            case 'assign':
                payload.assigneeId = selectedValue;
                break;
        }

        bulkMutation.mutate(payload);
    };

    const getDialogTitle = () => {
        switch (dialogType) {
            case 'status': return 'Change Status';
            case 'priority': return 'Change Priority';
            case 'assign': return 'Assign to Agent';
            default: return '';
        }
    };

    if (selectedIds.length === 0) return null;

    return (
        <>
            {/* Floating Toolbar */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900 dark:bg-slate-800 px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4">
                    {/* Selection Count */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{selectedIds.length}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-300">
                            {selectedIds.length === 1 ? 'ticket selected' : 'tickets selected'}
                        </span>
                    </div>

                    <div className="h-6 w-px bg-slate-700" />

                    {/* Status Action */}
                    <button
                        onClick={() => setDialogType('status')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Clock className="w-4 h-4" />
                        Status
                    </button>

                    {/* Priority Action */}
                    <button
                        onClick={() => setDialogType('priority')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Tag className="w-4 h-4" />
                        Priority
                    </button>

                    {/* Assign Action */}
                    <button
                        onClick={() => setDialogType('assign')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-medium transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        Assign
                    </button>

                    <div className="h-6 w-px bg-slate-700" />

                    {/* Clear Selection */}
                    <button
                        onClick={onClear}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="Clear selection"
                    >
                        <X className="w-4 h-4 text-slate-400 hover:text-white" />
                    </button>
                </div>
            </div>

            {/* Bulk Action Dialog */}
            <Dialog open={dialogType !== null} onOpenChange={(open) => {
                if (!open) {
                    setDialogType(null);
                    setSelectedValue('');
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {dialogType === 'status' && <Clock className="w-5 h-5 text-blue-500" />}
                            {dialogType === 'priority' && <Tag className="w-5 h-5 text-amber-500" />}
                            {dialogType === 'assign' && <UserPlus className="w-5 h-5 text-green-500" />}
                            {getDialogTitle()}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="py-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            This action will update <strong>{selectedIds.length}</strong> ticket{selectedIds.length > 1 ? 's' : ''}.
                        </p>

                        <Select value={selectedValue} onValueChange={setSelectedValue}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={`Select ${dialogType === 'assign' ? 'agent' : dialogType}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {/* Status Options */}
                                {dialogType === 'status' &&
                                    Object.entries(STATUS_CONFIG)
                                        .filter(([key]) => key !== 'CANCELLED')
                                        .map(([key, config]) => {
                                            const Icon = config.icon;
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        <Icon className="w-4 h-4" />
                                                        {config.label}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })
                                }

                                {/* Priority Options */}
                                {dialogType === 'priority' &&
                                    Object.entries(PRIORITY_CONFIG).map(([key, config]) => {
                                        const Icon = config.icon;
                                        return (
                                            <SelectItem key={key} value={key}>
                                                <span className="flex items-center gap-2">
                                                    {Icon && <Icon className="w-4 h-4" />}
                                                    {config.label}
                                                </span>
                                            </SelectItem>
                                        );
                                    })
                                }

                                {/* Agent Options */}
                                {dialogType === 'assign' &&
                                    agents.map(agent => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                            <span className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/30 to-primary/50 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {agent.fullName.charAt(0)}
                                                </div>
                                                {agent.fullName}
                                            </span>
                                        </SelectItem>
                                    ))
                                }
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <button
                            onClick={() => {
                                setDialogType(null);
                                setSelectedValue('');
                            }}
                            className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!selectedValue || bulkMutation.isPending}
                            className={cn(
                                "flex-1 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2",
                                "bg-primary text-slate-900 hover:bg-primary/90",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {bulkMutation.isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                                    Applying...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Apply to {selectedIds.length} ticket{selectedIds.length > 1 ? 's' : ''}
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
