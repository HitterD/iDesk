import { UserSearch, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResEmpty } from '@/components/resources/ResourceParts';
import type { User } from '@/types/admin.types';
import { AgentTableSkeleton, ErrorState } from './AgentTableSkeletons';
import { UnifiedUserTable } from './UnifiedUserTable';
import { RoleSection } from './RoleSection';
import { ROLE_ORDER, type PermissionPreset, type UserRoleKey } from './agent-types';
import { SERVICE_SCOPE_LABELS, groupRolesByScope } from '@/lib/constants/service-scope';

interface UsersByRoleSectionProps {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    onRetry: () => void;
    filteredUsers: User[];
    usersByRole: Record<UserRoleKey, User[]>;
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
    onApplyRole?: (userId: string, role: string) => void;
    applyingRoleUserId?: string | null;
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
    onApplyRole,
    applyingRoleUserId,
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
            <div role="status" className="res-table">
                <ResEmpty icon={UserSearch} title="Tidak ada user"
                    cta={(
                        <>
                            {searchQuery && <Button variant="soft" onClick={onClearSearch}><RefreshCw aria-hidden="true" />Clear Search</Button>}
                            <Button variant="primary" onClick={onAddUser} className="ml-2"><Plus aria-hidden="true" />Add User</Button>
                        </>
                    )}>
                    {searchQuery
                        ? `No users match "${searchQuery}". Try a different search term.`
                        : selectedSite !== 'ALL'
                            ? `No users assigned to ${selectedSite}. Try a different site or add a new user.`
                            : selectedRole !== 'ALL'
                                ? `No ${selectedRole.toLowerCase()}s found. Try a different role filter.`
                                : 'Coba ubah filter atau kata kunci.'}
                </ResEmpty>
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
                    onApplyRole={onApplyRole}
                    applyingRoleUserId={applyingRoleUserId}
                />
            ) : (
                <div className="space-y-2">
                    {/* Most-privileged first here; ROLE_ORDER is authored least-first for pickers.
                        Staff roles sit under their department scope header (ICT now, HC later). */}
                    {groupRolesByScope([...ROLE_ORDER].reverse()).map(group => {
                        const sections = group.roles.map(role => (
                            <RoleSection
                                key={role}
                                role={role}
                                users={usersByRole[role] ?? []}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onResetPassword={onResetPassword}
                                selectedIds={selectedUserIds}
                                onToggleSelection={onToggleSelection}
                                presets={presets}
                                onApplyPreset={onApplyPreset}
                                applyingPresetUserId={applyingPresetUserId}
                            />
                        ));
                        const hasUsers = group.roles.some(role => (usersByRole[role]?.length ?? 0) > 0);
                        if (!group.scope || !hasUsers) return sections;
                        return (
                            <section key={`scope-${group.scope}`} aria-label={`Lingkup ${group.scope}`} className="space-y-2">
                                <h3 className="px-1 pt-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Lingkup {SERVICE_SCOPE_LABELS[group.scope]}
                                </h3>
                                {sections}
                            </section>
                        );
                    })}
                </div>
            )}
        </>
    );
}
