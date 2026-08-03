import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Sparkles, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { usePermissionPresets } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { getFilteredPresetsByRole } from './EditUserDialog';
import { ConfirmDialog } from './ConfirmDialog';

/** How many selected names to spell out before collapsing into "+N more". */
const NAMES_PREVIEW_COUNT = 3;

interface BulkPermissionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedUsers: Array<{ id: string; fullName: string; role: string }>;
}

export const BulkPermissionDialog: React.FC<BulkPermissionDialogProps> = ({
    isOpen,
    onClose,
    selectedUsers,
}) => {
    const queryClient = useQueryClient();
    const [selectedPresetId, setSelectedPresetId] = useState<string>('');
    const [isConfirming, setIsConfirming] = useState(false);
    const { data: presets = [] } = usePermissionPresets();
    const dialogRef = useRef<HTMLDivElement>(null);

    const selectedUserIds = useMemo(() => selectedUsers.map(u => u.id), [selectedUsers]);
    const selectedRoles = useMemo(
        () => Array.from(new Set(selectedUsers.map(u => u.role))),
        [selectedUsers]
    );

    /**
     * Only offer presets valid for EVERY selected role. Applying an ADMIN preset to a
     * USER row silently grants privileges the admin never intended, so a preset that
     * fits only part of the selection is not offered at all.
     */
    const compatiblePresets = useMemo(() => {
        if (selectedRoles.length === 0) return [];
        return selectedRoles.reduce<typeof presets>(
            (acc, role) => {
                const allowedIds = new Set(getFilteredPresetsByRole(role, presets).map(p => p.id));
                return acc.filter(p => allowedIds.has(p.id));
            },
            presets
        );
    }, [selectedRoles, presets]);

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
            setIsConfirming(false);
            setSelectedPresetId('');
            onClose();
        },
        onError: (error: any) => {
            setIsConfirming(false);
            toast.error(error.response?.data?.message || 'Failed to apply preset');
        },
    });

    const isPending = applyBulkMutation.isPending;

    const handleClose = useCallback(() => {
        if (isPending) return;
        setSelectedPresetId('');
        onClose();
    }, [isPending, onClose]);

    useFocusTrap(dialogRef, { enabled: isOpen, onEscape: handleClose });

    useEffect(() => {
        if (!isOpen) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen]);

    // A preset that stops being compatible (selection changed underneath) must not stay armed.
    useEffect(() => {
        if (selectedPresetId && !compatiblePresets.some(p => p.id === selectedPresetId)) {
            setSelectedPresetId('');
        }
    }, [compatiblePresets, selectedPresetId]);

    if (!isOpen) return null;

    const selectedPreset = compatiblePresets.find(p => p.id === selectedPresetId);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bulk-permission-title"
                    className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md my-auto overflow-hidden animate-in zoom-in-95 duration-200 z-10 border border-slate-200/50 dark:border-slate-800 flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-violet-500 to-purple-600">
                        <h2 id="bulk-permission-title" className="text-xl font-bold text-white flex items-center gap-2">
                            <Key className="w-5 h-5" aria-hidden="true" />
                            Bulk Permission Assignment
                        </h2>
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isPending}
                            aria-label="Close bulk permission dialog"
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5 overflow-y-auto">
                        {/* Selected users info */}
                        <div className="flex items-center gap-3 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                            <div className="p-2 bg-violet-100 dark:bg-violet-800 rounded-lg">
                                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium text-slate-800 dark:text-white">
                                    {selectedUsers.length} users selected
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {selectedUsers.slice(0, NAMES_PREVIEW_COUNT).map(u => u.fullName).join(', ')}
                                    {selectedUsers.length > NAMES_PREVIEW_COUNT && ` +${selectedUsers.length - NAMES_PREVIEW_COUNT} more`}
                                </p>
                                {selectedRoles.length > 1 && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Roles: {selectedRoles.join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Preset selector */}
                        <div className="space-y-3">
                            <p id="bulk-preset-label" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Select Permission Preset
                            </p>
                            {compatiblePresets.length === 0 ? (
                                <div
                                    role="alert"
                                    className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                >
                                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                                    <p className="text-sm text-amber-700 dark:text-amber-400">
                                        No preset fits every selected user
                                        {selectedRoles.length > 1 ? ` (${selectedRoles.join(', ')})` : ''}.
                                        Narrow the selection to one role and try again.
                                    </p>
                                </div>
                            ) : (
                                <div role="radiogroup" aria-labelledby="bulk-preset-label" className="space-y-2">
                                    {compatiblePresets.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={selectedPresetId === preset.id}
                                            onClick={() => setSelectedPresetId(preset.id)}
                                            className={cn(
                                                "w-full p-4 rounded-xl border-2 text-left transition-colors duration-150",
                                                selectedPresetId === preset.id
                                                    ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                                                    : "border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
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
                                                    <CheckCircle className="w-5 h-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isPending}
                                className="flex-1 min-h-[44px] px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsConfirming(true)}
                                disabled={!selectedPresetId || isPending}
                                className="flex-1 min-h-[44px] px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isPending ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                                        <span className="sr-only">Applying</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                                        Apply to All
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bulk permission changes overwrite existing per-user overrides — confirm first. */}
            <ConfirmDialog
                isOpen={isConfirming}
                onClose={() => setIsConfirming(false)}
                onConfirm={() => applyBulkMutation.mutate()}
                title="Apply preset to all selected users?"
                message={`"${selectedPreset?.name ?? ''}" will replace the current permissions of ${selectedUsers.length} user(s). Existing per-user overrides are discarded.`}
                confirmText="Apply"
                variant="warning"
                isLoading={isPending}
            />
        </>,
        document.body
    );
};
