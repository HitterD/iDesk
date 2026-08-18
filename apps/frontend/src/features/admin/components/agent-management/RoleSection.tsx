import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Mail, Building, Edit2, Key, Trash2, CheckSquare, Square } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { User } from '@/types/admin.types';
import { PermissionPreset, ROLE_CONFIG, SITE_COLORS, type UserRoleKey } from './agent-types';
import { PresenceDot } from '@/components/ui/PresenceDot';
import { PresetDropdown } from './PresetDropdown';

export const RoleSection: React.FC<{
    role: UserRoleKey;
    users: User[];
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    applyingPresetUserId?: string | null;
}> = ({ role, users, onEdit, onDelete, onResetPassword, selectedIds, onToggleSelection, presets, onApplyPreset, applyingPresetUserId }) => {
    const [isOpen, setIsOpen] = useState(true);
    const config = ROLE_CONFIG[role];
    if (!config) return null;
    const Icon = config.icon;

    if (users.length === 0) return null;

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-4">
            <Collapsible.Trigger className="w-full min-h-[44px]" aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${config.pluralLabel}`}>
                <div className={cn(
                    "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-[opacity,transform,colors] duration-200 ease-out",
                    config.bgColor, "hover:opacity-90"
                )}>
                    <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className={cn("w-5 h-5", config.color)} aria-hidden="true" /> : <ChevronRight className={cn("w-5 h-5", config.color)} aria-hidden="true" />}
                        <Icon className={cn("w-5 h-5", config.color)} aria-hidden="true" />
                        <span className={cn("font-bold", config.color)}>{config.pluralLabel}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", config.badgeColor)}>
                            {users.length}
                        </span>
                    </div>
                </div>
            </Collapsible.Trigger>

            <Collapsible.Content className="mt-2 animate-in motion-reduce:animate-none slide-in-from-top-2 duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[180px]">Name</th>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[180px]">Email</th>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[60px]">Site</th>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Department</th>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[140px]">Preset</th>
                                <th scope="col" className="px-3 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-[90px]">Actions</th>
                                <th scope="col" className="px-2 py-3 w-10"><span className="sr-only">Select</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-shrink-0">
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", config.bgColor, config.color)}>
                                                    {user.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                {/* Announced here: unlike UnifiedUserTable this view has no
                                                    Presence column to state the status in words. */}
                                                <PresenceDot userId={user.id} userName={user.fullName} size="sm" ringed className="absolute -bottom-0.5 -right-0.5" />
                                            </div>
                                            <span className="font-medium text-slate-800 dark:text-white truncate max-w-[130px]">{user.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
                                            <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                                            <span className="truncate max-w-[140px]">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        {user.site ? (
                                            <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[user.site.code] || 'bg-slate-100 text-slate-600')}>
                                                {user.site.code}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {user.department ? (
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
                                                <Building className="w-3.5 h-3.5" aria-hidden="true" />
                                                <span className="truncate">{user.department.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        <PresetDropdown
                                            user={user}
                                            presets={presets}
                                            onApplyPreset={onApplyPreset}
                                            isApplying={applyingPresetUserId === user.id}
                                        />
                                    </td>
                                    <td className="px-3 py-3">
                                        {/* Actions fade in on hover but stay reachable: focus-within keeps
                                            them visible for keyboard users, and touch devices (no hover)
                                            get them permanently via the coarse-pointer media query. */}
                                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => onEdit(user)}
                                                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Edit"
                                                aria-label={`Edit ${user.fullName}`}
                                            >
                                                <Edit2 className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onResetPassword(user)}
                                                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title="Reset Password"
                                                aria-label={`Reset password for ${user.fullName}`}
                                            >
                                                <Key className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDelete(user)}
                                                className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                                aria-label={`Delete ${user.fullName}`}
                                            >
                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <button
                                            type="button"
                                            onClick={() => onToggleSelection(user.id)}
                                            role="checkbox"
                                            aria-checked={selectedIds.has(user.id)}
                                            aria-label={`Select ${user.fullName}`}
                                            className="p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            {selectedIds.has(user.id) ? (
                                                <CheckSquare className="w-4 h-4 text-primary" aria-hidden="true" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
};
