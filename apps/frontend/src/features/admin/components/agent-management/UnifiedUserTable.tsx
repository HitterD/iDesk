import React from 'react';
import { Pencil, KeyRound, Trash2, CheckSquare, Square } from 'lucide-react';
import { User } from '@/types/admin.types';
import { PermissionPreset } from './agent-types';
import { getRoleLabel, highlightText, formatLastActive } from './agent-utils';
import { PresenceDot, PresenceBadge } from '@/components/ui/PresenceDot';
import { DashAvatar } from '@/features/dashboard/components/DashboardParts';
import { ResBub, ResRow, ResTable } from '@/components/resources/ResourceParts';
import '@/components/management/management.css';

/** Mockup agents.html `.table.d` columns: user, role, site, status, presence, preset, actions, select. */
const USER_COLS = 'minmax(220px,1.5fr) 150px 64px 92px 120px 170px 104px 40px';
import { PresetDropdown } from './PresetDropdown';
import { RoleDropdown } from './RoleDropdown';

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
    onApplyRole?: (userId: string, role: string) => void;
    applyingRoleUserId?: string | null;
}> = ({ users, searchQuery, onEdit, onDelete, onResetPassword, selectedIds, onToggleSelection, onSelectAll, presets, onApplyPreset, applyingPresetUserId, onApplyRole, applyingRoleUserId }) => {
    const allSelected = users.length > 0 && users.every(u => selectedIds.has(u.id));

    return (
        <ResTable label="Daftar user" cols={USER_COLS} colsMobile="minmax(0,1fr) auto auto"
            head={(
                <>
                    <span>User</span><span>Role</span><span>Site</span><span>Status</span><span>Presence</span><span>Preset</span>
                    <span className="is-right">Aksi</span>
                    <span className="flex justify-center">
                        <button type="button" onClick={onSelectAll} role="checkbox" aria-checked={allSelected}
                            aria-label={allSelected ? 'Deselect all users' : 'Select all users'} className="res-icon-btn">
                            {allSelected ? <CheckSquare className="text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" /> : <Square aria-hidden="true" />}
                        </button>
                    </span>
                </>
            )}
            foot={<><span>Menampilkan {users.length} user</span><span className="res-muted">Hanya ADMIN yang dapat membuka halaman ini</span></>}>
            {users.map((user) => {
                const active = user.isActive !== false;
                return (
                    <ResRow key={user.id} className="is-static">
                        <div className="queue-person">
                            <span className="relative flex-none">
                                <DashAvatar name={user.fullName || '?'} />
                                {/* The Presence column states this in words for screen readers. */}
                                <PresenceDot userId={user.id} size="sm" ringed decorative className="absolute -bottom-0.5 -right-0.5" />
                            </span>
                            <div className="min-w-0">
                                <b>{highlightText(user.fullName, searchQuery)}</b>
                                <small>{highlightText(user.email, searchQuery)}</small>
                            </div>
                        </div>
                        <span>
                            {onApplyRole ? (
                                <RoleDropdown user={user} onApplyRole={onApplyRole} isApplying={applyingRoleUserId === user.id}
                                    bulkCount={selectedIds.has(user.id) ? selectedIds.size : 0} />
                            ) : (
                                <ResBub color="var(--dash-gray)" plain>{getRoleLabel(user.role)}</ResBub>
                            )}
                        </span>
                        <span className="res-hide-m">{user.site ? <ResBub color="var(--dash-gray)" mono plain>{user.site.code}</ResBub> : <span className="res-muted">—</span>}</span>
                        <span className="res-hide-m">
                            <ResBub color={active ? 'var(--dash-green)' : 'var(--dash-red)'} ink={active ? 'var(--dash-ink-green)' : 'var(--dash-ink-red)'}>{active ? 'Active' : 'Inactive'}</ResBub>
                        </span>
                        <span className="res-hide-m text-xs min-w-0">
                            <PresenceBadge userId={user.id} />
                            <span className="block mt-0.5 res-muted truncate">{formatLastActive(user.lastActiveAt)}</span>
                        </span>
                        <span className="res-hide-m">
                            <PresetDropdown user={user} presets={presets} onApplyPreset={onApplyPreset} isApplying={applyingPresetUserId === user.id}
                                bulkCount={selectedIds.has(user.id) ? selectedIds.size : 0} />
                        </span>
                        <span className="res-acts res-wide-m" role="group" aria-label={`Aksi ${user.fullName}`}>
                            <button type="button" onClick={() => onEdit(user)} className="res-icon-btn" title="Edit" aria-label={`Edit ${user.fullName}`}><Pencil aria-hidden="true" /></button>
                            <button type="button" onClick={() => onResetPassword(user)} className="res-icon-btn" title="Reset Password" aria-label={`Reset password for ${user.fullName}`}><KeyRound aria-hidden="true" /></button>
                            <button type="button" onClick={() => onDelete(user)} className="res-icon-btn is-danger" title="Delete" aria-label={`Delete ${user.fullName}`}><Trash2 aria-hidden="true" /></button>
                        </span>
                        <span className="flex justify-center">
                            <button type="button" onClick={() => onToggleSelection(user.id)} role="checkbox" aria-checked={selectedIds.has(user.id)}
                                aria-label={`Select ${user.fullName}`} className="res-icon-btn">
                                {selectedIds.has(user.id) ? <CheckSquare className="text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" /> : <Square aria-hidden="true" />}
                            </button>
                        </span>
                    </ResRow>
                );
            })}
        </ResTable>
    );
};
