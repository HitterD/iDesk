import React from 'react';
import { Edit2, Key, Trash2, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/types/admin.types';
import { PermissionPreset } from './agent-types';
import { ROLE_CONFIG, SITE_COLORS, getAvatarColor, highlightText, formatLastActive } from './agent-utils';
import { PresetDropdown } from './PresetDropdown';

export const UnifiedUserTable: React.FC<{
    users: User[];
    searchQuery: string;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onSelectAll: () => void;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    applyingPresetUserId?: string | null;
}> = ({ users, searchQuery, onEdit, onDelete, onResetPassword, selectedIds, onToggleSelection, onSelectAll, presets, onApplyPreset, applyingPresetUserId }) => {
    const allSelected = users.length > 0 && users.every(u => selectedIds.has(u.id));

    return (
        <div className="bg-white dark:bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-[hsl(var(--border))]">
                    <tr>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[220px]">User</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[90px]">Role</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[60px]">Site</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[80px]">Status</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[140px]">Preset</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[110px]">Last Active</th>
                        <th className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[90px]">Actions</th>
                        <th className="px-2 py-3 w-10">
                            <button onClick={onSelectAll} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm", getAvatarColor(user.fullName))}>
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-white truncate max-w-[160px]">
                                            {highlightText(user.fullName, searchQuery)}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                                            {highlightText(user.email, searchQuery)}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-3 py-3">
                                <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", (ROLE_CONFIG as any)[user.role]?.badgeColor || 'bg-slate-100 text-slate-600')}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-3 py-3">
                                {user.site ? (
                                    <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[user.site.code] || 'bg-slate-100 text-slate-600')}>
                                        {user.site.code}
                                    </span>
                                ) : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-3">
                                <span className={cn(
                                    "px-2 py-1 rounded-lg text-xs font-bold",
                                    user.isActive !== false
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {user.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-3 py-3">
                                <PresetDropdown
                                    user={user}
                                    presets={presets}
                                    onApplyPreset={onApplyPreset}
                                    isApplying={applyingPresetUserId === user.id}
                                />
                            </td>
                            <td className="px-3 py-3 text-xs">
                                {formatLastActive((user as any).lastActiveAt)}
                            </td>
                            <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => onEdit(user)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Edit" aria-label="Edit user">
                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button onClick={() => onResetPassword(user)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Reset Password" aria-label="Reset password">
                                        <Key className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button onClick={() => onDelete(user)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete" aria-label="Delete user">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                            <td className="px-2 py-3">
                                <button onClick={() => onToggleSelection(user.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    {selectedIds.has(user.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
