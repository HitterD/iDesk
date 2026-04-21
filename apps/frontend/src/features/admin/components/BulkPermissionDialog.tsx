import React, { useState } from 'react';
import { X, Key, Sparkles, Users, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { usePermissionPresets } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface BulkPermissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUserIds: string[];
    selectedUserNames: string[];
}

export const BulkPermissionDialog: React.FC<BulkPermissionDialogProps> = ({
    isOpen,
    onClose,
    selectedUserIds,
    selectedUserNames,
}) => {
    const queryClient = useQueryClient();
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const { data: presets = [] } = usePermissionPresets();

    const applyBulkMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/permissions/bulk-apply', {
                userIds: selectedUserIds,
                presetId: selectedPresetId,
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Permission preset applied to ${data.updated} users`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to apply preset');
        },
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-500 to-purple-600">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Bulk Permission Assignment
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Selected users info */}
                    <div className="flex items-center gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                        <div className="p-2 bg-violet-100 dark:bg-violet-800 rounded-lg">
                            <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-800 dark:text-white">
                                {selectedUserIds.length} users selected
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                                {selectedUserNames.slice(0, 3).join(', ')}
                                {selectedUserNames.length > 3 && ` +${selectedUserNames.length - 3} more`}
                            </p>
                        </div>
                    </div>

                    {/* Preset selector */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Select Permission Preset
                        </label>
                        <div className="space-y-2">
                            {presets.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setSelectedPresetId(preset.id)}
                                    className={cn(
                                        "w-full p-4 rounded-xl border-2 text-left transition-colors duration-150",
                                        selectedPresetId === preset.id
                                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                                            : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                                {preset.name}
                                                {preset.isDefault && (
                                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
                                                        Default
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {preset.description || 'No description'}
                                            </p>
                                        </div>
                                        {selectedPresetId === preset.id && (
                                            <CheckCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => applyBulkMutation.mutate()}
                            disabled={!selectedPresetId || applyBulkMutation.isPending}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {applyBulkMutation.isPending ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Apply to All
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
