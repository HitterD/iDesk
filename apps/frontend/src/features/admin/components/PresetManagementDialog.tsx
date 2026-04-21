import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, Plus, Edit2, Trash2, Lock, Copy, Users, Shield, UserCog, Crown, Search, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PagePresetEditor } from './PagePresetEditor';

interface PageAccess {
    [pageKey: string]: boolean;
}

interface PermissionPreset {
    id: string;
    name: string;
    description?: string;
    targetRole?: 'USER' | 'AGENT' | 'MANAGER' | 'ADMIN';
    pageAccess?: PageAccess;
    isSystem: boolean;
    permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;
    createdAt: string;
    usageCount?: number; // Number of users with this preset applied
}

interface PresetManagementDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// Role icons and colors based on preset name
const getPresetStyle = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('admin')) {
        return { icon: Crown, color: 'bg-violet-500', textColor: 'text-violet-600', bgLight: 'bg-violet-50 dark:bg-violet-900/20' };
    }
    if (lowerName.includes('manager')) {
        return { icon: Shield, color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-50 dark:bg-amber-900/20' };
    }
    if (lowerName.includes('agent')) {
        return { icon: UserCog, color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-50 dark:bg-blue-900/20' };
    }
    return { icon: Users, color: 'bg-slate-500', textColor: 'text-slate-600', bgLight: 'bg-slate-50 dark:bg-slate-800' };
};

export const PresetManagementDialog: React.FC<PresetManagementDialogProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<PermissionPreset | null>(null);
    const [deletingPreset, setDeletingPreset] = useState<PermissionPreset | null>(null);

    // Fetch all presets
    const { data: presets = [], isLoading } = useQuery<PermissionPreset[]>({
        queryKey: ['permission-presets'],
        queryFn: async () => {
            const response = await api.get('/permissions/presets');
            return response.data;
        },
        enabled: isOpen,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (presetId: string) => {
            return api.delete(`/permissions/presets/${presetId}`);
        },
        onSuccess: () => {
            toast.success('Preset deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
            setDeletingPreset(null);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to delete preset');
        },
    });

    // Clone mutation
    const cloneMutation = useMutation({
        mutationFn: async (preset: PermissionPreset) => {
            return api.post(`/permissions/presets/${preset.id}/clone`, { name: `${preset.name} (Copy)` });
        },
        onSuccess: () => {
            toast.success('Preset cloned successfully');
            queryClient.invalidateQueries({ queryKey: ['permission-presets'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to clone preset');
        },
    });

    // Filter presets
    const filteredPresets = searchQuery.trim()
        ? presets.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : presets;

    // Separate system and custom presets
    const systemPresets = filteredPresets.filter(p => p.isSystem);
    const customPresets = filteredPresets.filter(p => !p.isSystem);

    // Count enabled pages (NEW: uses pageAccess, fallback to permissions)
    const countEnabledPages = (preset: PermissionPreset) => {
        // NEW: Use pageAccess if available
        if (preset.pageAccess) {
            return Object.values(preset.pageAccess).filter(Boolean).length;
        }
        // Fallback: count old permissions (View only)
        let count = 0;
        for (const perm of Object.values(preset.permissions || {})) {
            if (perm.canView) count++;
        }
        return count;
    };

    const handleEdit = (preset: PermissionPreset) => {
        setEditingPreset(preset);
        setIsEditorOpen(true);
    };

    const handleCreateNew = () => {
        setEditingPreset(null);
        setIsEditorOpen(true);
    };

    const handleEditorClose = () => {
        setIsEditorOpen(false);
        setEditingPreset(null);
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
                <div className="relative bg-[hsl(var(--card))] rounded-xl shadow-xl border border-[hsl(var(--border))] w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))] bg-slate-50/50 dark:bg-slate-800/20 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-slate-500" />
                                Manage Permission Presets
                            </h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {presets.length} presets • {systemPresets.length} system, {customPresets.length} custom
                            </p>
                        </div>
                        <button onClick={onClose} aria-label="Close dialog" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search presets..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent outline-none transition-colors duration-150 text-sm text-slate-800 dark:text-white placeholder:text-slate-400"
                            />
                        </div>

                        {/* Create New */}
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-slate-900 font-bold rounded-lg hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Create Preset
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isLoading ? (
                            <div className="space-y-6">
                                {/* Skeleton Loading */}
                                <div>
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-3" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-[hsl(var(--card))]">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
                                                    <div className="flex-1 space-y-2">
                                                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                                        <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                                        <div className="flex gap-2">
                                                            <div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                                                            <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* System Presets */}
                                {systemPresets.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Lock className="w-4 h-4" />
                                            System Presets ({systemPresets.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {systemPresets.map(preset => {
                                                const style = getPresetStyle(preset.name);
                                                const IconComponent = style.icon;
                                                const permCount = countEnabledPages(preset);

                                                return (
                                                    <div
                                                        key={preset.id}
                                                        className={cn(
                                                            "relative p-4 rounded-xl border border-[hsl(var(--border))] transition-[opacity,transform,colors] duration-200 ease-out",
                                                            style.bgLight
                                                        )}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", style.color)}>
                                                                <IconComponent className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-bold text-slate-800 dark:text-white">{preset.name}</h4>
                                                                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                                </div>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                                                    {preset.description || 'No description'}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    {preset.targetRole && (
                                                                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-full font-medium">
                                                                            {preset.targetRole}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                                                                        {permCount} {permCount === 1 ? 'page' : 'pages'}
                                                                    </span>
                                                                    {typeof preset.usageCount === 'number' && (
                                                                        <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                                                            <Users className="w-3 h-3" />
                                                                            {preset.usageCount} {preset.usageCount === 1 ? 'user' : 'users'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Actions for system presets - only clone */}
                                                        <div className="absolute top-3 right-3 flex items-center gap-1">
                                                            <button
                                                                onClick={() => cloneMutation.mutate(preset)}
                                                                aria-label={`Clone system preset ${preset.name}`}
                                                                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="Clone preset"
                                                            >
                                                                <Copy className="w-4 h-4 text-slate-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Custom Presets */}
                                {customPresets.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Settings className="w-4 h-4" />
                                            Custom Presets ({customPresets.length})
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {customPresets.map(preset => {
                                                const style = getPresetStyle(preset.name);
                                                const IconComponent = style.icon;
                                                const permCount = countEnabledPages(preset);

                                                return (
                                                    <div
                                                        key={preset.id}
                                                        className="relative p-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-slate-400 dark:hover:border-slate-500 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", style.color)}>
                                                                <IconComponent className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-bold text-slate-800 dark:text-white">{preset.name}</h4>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                                                    {preset.description || 'No description'}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    {preset.targetRole && (
                                                                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-full font-medium">
                                                                            {preset.targetRole}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">
                                                                        {permCount} {permCount === 1 ? 'page' : 'pages'}
                                                                    </span>
                                                                    {typeof preset.usageCount === 'number' && (
                                                                        <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center gap-1">
                                                                            <Users className="w-3 h-3" />
                                                                            {preset.usageCount} {preset.usageCount === 1 ? 'user' : 'users'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Actions for custom presets */}
                                                        <div className="absolute top-3 right-3 flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleEdit(preset)}
                                                                aria-label={`Edit custom preset ${preset.name}`}
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="Edit preset"
                                                            >
                                                                <Edit2 className="w-4 h-4 text-slate-500" />
                                                            </button>
                                                            <button
                                                                onClick={() => cloneMutation.mutate(preset)}
                                                                aria-label={`Clone custom preset ${preset.name}`}
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                title="Clone preset"
                                                            >
                                                                <Copy className="w-4 h-4 text-slate-500" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingPreset(preset)}
                                                                aria-label={`Delete custom preset ${preset.name}`}
                                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                                title="Delete preset"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {customPresets.length === 0 && systemPresets.length > 0 && (
                                    <div className="mt-6 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-center bg-slate-50/50 dark:bg-slate-800/10">
                                        <Settings className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">No custom presets yet</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Click "Create Preset" to make your own</p>
                                    </div>
                                )}

                                {/* Empty State */}
                                {filteredPresets.length === 0 && (
                                    <div className="text-center py-12">
                                        <Settings className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                        <p className="text-slate-500 dark:text-slate-400">
                                            {searchQuery ? `No presets match "${searchQuery}"` : 'No presets found'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation */}
            {deletingPreset && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingPreset(null)} />
                    <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col p-6 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete Preset?</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Are you sure you want to delete <strong>"{deletingPreset.name}"</strong>? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingPreset(null)}
                                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors border border-slate-300 dark:border-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingPreset.id)}
                                disabled={deleteMutation.isPending}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <PagePresetEditor
                isOpen={isEditorOpen}
                onClose={handleEditorClose}
                preset={editingPreset}
            />
        </>,
        document.body
    );
};
