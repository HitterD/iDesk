import { Users, RefreshCw, Plus } from 'lucide-react';
import type { User } from '@/types/admin.types';
import { AgentTableSkeleton, ErrorState } from './AgentTableSkeletons';
import { UnifiedUserTable } from './UnifiedUserTable';
import { RoleSection } from './RoleSection';
import type { PermissionPreset } from './agent-types';

interface UsersByRoleSectionProps {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    onRetry: () => void;
    filteredUsers: User[];
    usersByRole: { ADMIN: User[]; MANAGER: User[]; AGENT: User[]; USER: User[] };
    displayMode: 'unified' | 'collapsed';
    searchQuery: string;
    deferredSearchQuery: string;
    selectedSite: string;
    selectedRole: string;
    selectedUserIds: Set<string>;
    onClearSearch: () => void;
    onAddUser: () => void;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    onToggleSelection: (userId: string) => void;
    onSelectAll: () => void;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    applyingPresetUserId: string | null;
}

export function UsersByRoleSection({
    isLoading,
    isError,
    error,
    onRetry,
    filteredUsers,
    usersByRole,
    displayMode,
    searchQuery,
    deferredSearchQuery,
    selectedSite,
    selectedRole,
    selectedUserIds,
    onClearSearch,
    onAddUser,
    onEdit,
    onDelete,
    onResetPassword,
    onToggleSelection,
    onSelectAll,
    presets,
    onApplyPreset,
    applyingPresetUserId,
}: UsersByRoleSectionProps) {
    if (isLoading) {
        return <AgentTableSkeleton />;
    }
    if (isError) {
        return (
            <ErrorState
                message={(error as Error)?.message || 'Failed to load users. Please try again.'}
                onRetry={onRetry}
            />
        );
    }
    if (filteredUsers.length === 0) {
        return (
            <div className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-12 text-center">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Users className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">No Users Found</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                    {searchQuery
                        ? `No users match "${searchQuery}". Try a different search term.`
                        : selectedSite !== 'ALL'
                            ? `No users assigned to ${selectedSite}. Try a different site or add a new user.`
                            : selectedRole !== 'ALL'
                                ? `No ${selectedRole.toLowerCase()}s found. Try a different role filter.`
                                : 'Get started by adding a new user or importing from a CSV file.'}
                </p>
                <div className="flex items-center justify-center gap-3">
                    {searchQuery && (
                        <button
                            onClick={onClearSearch}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear Search
                        </button>
                    )}
                    <button
                        onClick={onAddUser}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add User
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {displayMode === 'unified' ? (
                <UnifiedUserTable
                    users={filteredUsers}
                    searchQuery={deferredSearchQuery}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onResetPassword={onResetPassword}
                    selectedIds={selectedUserIds}
                    onToggleSelection={onToggleSelection}
                    onSelectAll={onSelectAll}
                    presets={presets}
                    onApplyPreset={onApplyPreset}
                    applyingPresetUserId={applyingPresetUserId}
                />
            ) : (
                <div className="space-y-2">
                    <RoleSection
                        role="ADMIN"
                        users={usersByRole.ADMIN}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onResetPassword={onResetPassword}
                        selectedIds={selectedUserIds}
                        onToggleSelection={onToggleSelection}
                        presets={presets}
                        onApplyPreset={onApplyPreset}
                        applyingPresetUserId={applyingPresetUserId}
                    />
                    <RoleSection
                        role="MANAGER"
                        users={usersByRole.MANAGER}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onResetPassword={onResetPassword}
                        selectedIds={selectedUserIds}
                        onToggleSelection={onToggleSelection}
                        presets={presets}
                        onApplyPreset={onApplyPreset}
                        applyingPresetUserId={applyingPresetUserId}
                    />
                    <RoleSection
                        role="AGENT"
                        users={usersByRole.AGENT}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onResetPassword={onResetPassword}
                        selectedIds={selectedUserIds}
                        onToggleSelection={onToggleSelection}
                        presets={presets}
                        onApplyPreset={onApplyPreset}
                        applyingPresetUserId={applyingPresetUserId}
                    />
                    <RoleSection
                        role="USER"
                        users={usersByRole.USER}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onResetPassword={onResetPassword}
                        selectedIds={selectedUserIds}
                        onToggleSelection={onToggleSelection}
                        presets={presets}
                        onApplyPreset={onApplyPreset}
                        applyingPresetUserId={applyingPresetUserId}
                    />
                </div>
            )}
        </>
    );
}
