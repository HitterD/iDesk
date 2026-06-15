import { ImportUsersDialog } from '../ImportUsersDialog';
import { AddUserDialog } from '../AddUserDialog';
import { ResetPasswordDialog } from '../ResetPasswordDialog';
import { EditUserDialog } from '../EditUserDialog';
import { AgentDetailModal } from '../AgentDetailModal';
import { ConfirmDialog } from '../ConfirmDialog';
import { BulkRoleChangeDialog } from '../BulkRoleChangeDialog';
import { PresetDrawer } from '../PresetDrawer';
import { ExportPreviewDialog } from '../ExportPreviewDialog';
import { AgentComparisonDialog } from '../AgentComparisonDialog';
import { BulkSiteChangeDialog } from '../BulkSiteChangeDialog';
import { OnboardingTutorial } from '../OnboardingTutorial';
import { ExportPdfDialog } from '../ExportPdfDialog';
import type { AgentStats, User } from '@/types/admin.types';

interface AgentManagementDialogsProps {
    importOpen: boolean;
    onImportClose: () => void;
    addUserOpen: boolean;
    onAddUserClose: () => void;
    resetPasswordOpen: boolean;
    onResetPasswordClose: () => void;
    selectedUser: User | null;
    editUserOpen: boolean;
    onEditUserClose: () => void;
    editingUser: User | null;
    selectedAgentDetail: User | null;
    onAgentDetailClose: () => void;
    agentStats: AgentStats[];
    confirmDeleteOpen: boolean;
    onConfirmDeleteClose: () => void;
    onConfirmDelete: () => void;
    userToDelete: User | null;
    isDeleting: boolean;
    bulkDeleteOpen: boolean;
    onBulkDeleteClose: () => void;
    onConfirmBulkDelete: () => void;
    selectedCount: number;
    isBulkDeleting: boolean;
    bulkRoleOpen: boolean;
    onBulkRoleClose: () => void;
    onConfirmBulkRole: (role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT') => void;
    isBulkRolePending: boolean;
    presetManageOpen: boolean;
    onPresetManageClose: () => void;
    exportPreviewOpen: boolean;
    onExportPreviewClose: () => void;
    selectedSite: string;
    selectedRole: string;
    comparisonOpen: boolean;
    onComparisonClose: () => void;
    comparisonAgents: Array<{
        id: string;
        fullName: string;
        email: string;
        role: string;
        site: User['site'];
        openTickets: number;
        inProgressTickets: number;
        resolvedThisWeek: number;
        resolvedThisMonth: number;
        resolvedTotal: number;
        slaCompliance: number;
    }>;
    bulkSiteOpen: boolean;
    onBulkSiteClose: () => void;
    selectedUserIds: Set<string>;
    pdfExportOpen: boolean;
    onPdfExportClose: () => void;
    totalUsers: number;
    showOnboarding: boolean;
    onOnboardingComplete: () => void;
}

export function AgentManagementDialogs({
    importOpen,
    onImportClose,
    addUserOpen,
    onAddUserClose,
    resetPasswordOpen,
    onResetPasswordClose,
    selectedUser,
    editUserOpen,
    onEditUserClose,
    editingUser,
    selectedAgentDetail,
    onAgentDetailClose,
    agentStats,
    confirmDeleteOpen,
    onConfirmDeleteClose,
    onConfirmDelete,
    userToDelete,
    isDeleting,
    bulkDeleteOpen,
    onBulkDeleteClose,
    onConfirmBulkDelete,
    selectedCount,
    isBulkDeleting,
    bulkRoleOpen,
    onBulkRoleClose,
    onConfirmBulkRole,
    isBulkRolePending,
    presetManageOpen,
    onPresetManageClose,
    exportPreviewOpen,
    onExportPreviewClose,
    selectedSite,
    selectedRole,
    comparisonOpen,
    onComparisonClose,
    comparisonAgents,
    bulkSiteOpen,
    onBulkSiteClose,
    selectedUserIds,
    pdfExportOpen,
    onPdfExportClose,
    totalUsers,
    showOnboarding,
    onOnboardingComplete,
}: AgentManagementDialogsProps) {
    return (
        <>
            <ImportUsersDialog
                isOpen={importOpen}
                onClose={onImportClose}
            />
            <AddUserDialog
                isOpen={addUserOpen}
                onClose={onAddUserClose}
            />
            <ResetPasswordDialog
                isOpen={resetPasswordOpen}
                onClose={onResetPasswordClose}
                user={selectedUser}
            />
            <EditUserDialog
                isOpen={editUserOpen}
                onClose={onEditUserClose}
                user={editingUser}
            />
            <AgentDetailModal
                isOpen={!!selectedAgentDetail}
                onClose={onAgentDetailClose}
                agent={selectedAgentDetail ? (() => {
                    // Compute once — avoids 5 separate .find() calls per render
                    const stat = agentStats.find(a => a.id === selectedAgentDetail.id);
                    return {
                        id: selectedAgentDetail.id,
                        fullName: selectedAgentDetail.fullName,
                        email: selectedAgentDetail.email,
                        role: selectedAgentDetail.role,
                        department: selectedAgentDetail.department,
                        isActive: selectedAgentDetail.isActive,
                        openTickets: stat?.openTickets,
                        inProgressTickets: stat?.inProgressTickets,
                        resolvedThisWeek: stat?.resolvedThisWeek,
                        resolvedThisMonth: stat?.resolvedThisMonth,
                        slaCompliance: stat?.slaCompliance,
                    };
                })() : null}
            />
            <ConfirmDialog
                isOpen={confirmDeleteOpen}
                onClose={onConfirmDeleteClose}
                onConfirm={onConfirmDelete}
                title="Delete User"
                message={`Are you sure you want to delete ${userToDelete?.fullName}? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isDeleting}
            />
            <ConfirmDialog
                isOpen={bulkDeleteOpen}
                onClose={onBulkDeleteClose}
                onConfirm={onConfirmBulkDelete}
                title="Delete Selected Users"
                message={`Are you sure you want to delete ${selectedCount} users? This action cannot be undone.`}
                confirmText="Delete All"
                variant="danger"
                isLoading={isBulkDeleting}
            />
            <BulkRoleChangeDialog
                isOpen={bulkRoleOpen}
                onClose={onBulkRoleClose}
                onConfirm={onConfirmBulkRole}
                selectedCount={selectedCount}
                isLoading={isBulkRolePending}
            />

            {/* Preset Drawer */}
            <PresetDrawer
                isOpen={presetManageOpen}
                onClose={onPresetManageClose}
            />

            {/* Export Preview Dialog */}
            <ExportPreviewDialog
                isOpen={exportPreviewOpen}
                onClose={onExportPreviewClose}
                siteFilter={selectedSite}
                roleFilter={selectedRole}
            />

            {/* Agent Comparison Dialog */}
            <AgentComparisonDialog
                isOpen={comparisonOpen}
                onClose={onComparisonClose}
                agents={comparisonAgents}
            />

            {/* Bulk Site Change Dialog */}
            <BulkSiteChangeDialog
                isOpen={bulkSiteOpen}
                onClose={onBulkSiteClose}
                selectedCount={selectedCount}
                selectedUserIds={Array.from(selectedUserIds)}
            />

            {/* PDF Export Dialog */}
            <ExportPdfDialog
                isOpen={pdfExportOpen}
                onClose={onPdfExportClose}
                siteFilter={selectedSite}
                totalUsers={totalUsers}
            />

            {/* Onboarding Tutorial */}
            {showOnboarding && (
                <OnboardingTutorial onComplete={onOnboardingComplete} />
            )}
        </>
    );
}
