import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { Users, Upload, Plus, Mail, Shield, Building, Key, Trash2, Award, CheckCircle, BarChart3, Ticket as TicketIcon, Eye, Search, Download, Edit2, CheckSquare, Square, ChevronDown, ChevronRight, ChevronLeft, MapPin, FileSpreadsheet, AlertCircle, RefreshCw, Crown, Info, LayoutGrid, List, Settings, Keyboard, FileText, HelpCircle } from 'lucide-react';
import { ImportUsersDialog } from '../components/ImportUsersDialog';
import { AddUserDialog } from '../components/AddUserDialog';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { EditUserDialog } from '../components/EditUserDialog';
import { AgentDetailModal } from '../components/AgentDetailModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BulkRoleChangeDialog } from '../components/BulkRoleChangeDialog';
import { BulkPermissionDialog } from '../components/BulkPermissionDialog';

import { PresetManagementDialog } from '../components/PresetManagementDialog';
import { ExportPreviewDialog } from '../components/ExportPreviewDialog';
import { AgentComparisonDialog } from '../components/AgentComparisonDialog';
import { BulkSiteChangeDialog } from '../components/BulkSiteChangeDialog';
import { OnboardingTutorial, shouldShowOnboarding } from '../components/OnboardingTutorial';
import { ExportPdfDialog } from '../components/ExportPdfDialog';
import { VirtualizedAgentGrid } from '../components/VirtualizedAgentGrid';
// P2: Error boundary for agent cards
// C1+C2: Import extracted components to eliminate duplicates
import {
    AgentCardErrorBoundary,
    AgentCard,
    StatCard,
    SITE_COLORS as AGENT_SITE_COLORS,
    ROLE_CONFIG as AGENT_ROLE_CONFIG,
    getAvatarColor as agentGetAvatarColor,
} from '../components/agent-management';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as Tabs from '@radix-ui/react-tabs';
import * as Collapsible from '@radix-ui/react-collapsible';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Ticket } from '@/types/ticket.types';
import { Site, User, AgentStats, PaginatedResponse } from '@/types/admin.types';
import * as Tooltip from '@radix-ui/react-tooltip';

// Extended Ticket interface with site field (backend returns this)
interface TicketWithSite extends Ticket {
    site?: Site;
}

// Site colors for badges - fallback if site code not found
const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

const ROLE_CONFIG = {
    ADMIN: {
        icon: Shield,
        label: 'Administrators',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        badgeColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    },
    MANAGER: {
        icon: Crown,
        label: 'Managers',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        badgeColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    },
    AGENT: {
        icon: Users,
        label: 'Agents',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        badgeColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    },
    USER: {
        icon: Users,
        label: 'Users',
        color: 'text-slate-600',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        badgeColor: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    },
};

// Generate consistent color based on name
const getAvatarColor = (name: string): string => {
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
        'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// M3: Helper function to highlight search matches
const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 rounded px-0.5">{part}</mark>
        ) : part
    );
};

// StatCard is now imported from '../components/agent-management'

// Top Performer Hero Card with gold gradient
const TopPerformerCard: React.FC<{ name: string; tickets: number }> = ({ name, tickets }) => (
    <div className="rounded-2xl p-5 border border-amber-400/30 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all hover:-translate-y-0.5 animate-golden-pulse">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm text-amber-100/90 mb-1 flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    Top Performer
                </p>
                <p className="text-xl font-bold text-white truncate max-w-[140px]">{name}</p>
                <p className="text-xs text-amber-100/80 mt-1">{tickets} tickets this month</p>
            </div>
            <div className="p-3 rounded-xl bg-white/20">
                <Award className="w-5 h-5 text-white" />
            </div>
        </div>
    </div>
);

// AgentCard is now imported from '../components/agent-management'

// B12: Loading Skeleton for Grid View
const AgentGridSkeleton: React.FC = () => (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-4 rounded-2xl animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    </div>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-3" />
                <div className="flex gap-2 mb-3">
                    <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-5 w-14 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((j) => (
                        <div key={j} className="h-12 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// Loading Skeleton for Agent Table





// Loading Skeleton for Agent Table
const AgentTableSkeleton: React.FC = () => (
    <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl p-5 bg-slate-200 dark:bg-slate-700 animate-pulse h-24" />
            ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                        </div>
                        <div className="flex gap-2">
                            {[...Array(5)].map((_, j) => (
                                <div key={j} className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// Error State Component
const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-red-800 dark:text-red-300 mb-2">Failed to Load Data</h3>
        <p className="text-red-600 dark:text-red-400 mb-4 max-w-md mx-auto">{message}</p>
        <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors mx-auto"
        >
            <RefreshCw className="w-4 h-4" />
            Try Again
        </button>
    </div>
);

// Collapsible Role Section Component
const RoleSection: React.FC<{
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER';
    users: User[];
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
}> = ({ role, users, onEdit, onDelete, onResetPassword, selectedIds, onToggleSelection }) => {
    const [isOpen, setIsOpen] = useState(true);
    const config = ROLE_CONFIG[role];
    const Icon = config.icon;

    if (users.length === 0) return null;

    return (
        <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="mb-4">
            <Collapsible.Trigger className="w-full">
                <div className={cn(
                    "flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all",
                    config.bgColor, "hover:opacity-90"
                )}>
                    <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className={cn("w-5 h-5", config.color)} /> : <ChevronRight className={cn("w-5 h-5", config.color)} />}
                        <Icon className={cn("w-5 h-5", config.color)} />
                        <span className={cn("font-bold", config.color)}>{config.label}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", config.badgeColor)}>
                            {users.length}
                        </span>
                    </div>
                </div>
            </Collapsible.Trigger>

            <Collapsible.Content className="mt-2 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Name</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Email</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Site</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Department</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                                <th className="px-2 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center font-bold", config.bgColor, config.color)}>
                                                {user.fullName.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-slate-800 dark:text-white">{user.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                                            <Mail className="w-3.5 h-3.5" />
                                            {user.email}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.site ? (
                                            <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[user.site.code] || 'bg-slate-100 text-slate-600')}>
                                                {user.site.code}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.department ? (
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
                                                <Building className="w-3.5 h-3.5" />
                                                {user.department.name}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm italic">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEdit(user)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onResetPassword(user)}
                                                className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title="Reset Password"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDelete(user)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <button
                                            onClick={() => onToggleSelection(user.id)}
                                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        >
                                            {selectedIds.has(user.id) ? (
                                                <CheckSquare className="w-4 h-4 text-primary" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-400" />
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

// M1: Unified User Table - shows all users in single table with role column
const UnifiedUserTable: React.FC<{
    users: User[];
    searchQuery: string;
    onEdit: (user: User) => void;
    onDelete: (user: User) => void;
    onResetPassword: (user: User) => void;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onSelectAll: () => void;
}> = ({ users, searchQuery, onEdit, onDelete, onResetPassword, selectedIds, onToggleSelection, onSelectAll }) => {
    const allSelected = users.length > 0 && users.every(u => selectedIds.has(u.id));

    // Format relative time for lastActiveAt
    const formatLastActive = (date: string | undefined) => {
        if (!date) return <span className="text-slate-400 italic">Not yet logged in</span>;
        const d = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 5) return <span className="text-green-600 font-medium">Online</span>;
        if (diffMins < 60) return <span className="text-green-500">{diffMins}m ago</span>;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return <span className="text-amber-500">{diffHours}h ago</span>;
        const diffDays = Math.floor(diffHours / 24);
        return <span className="text-slate-500">{diffDays}d ago</span>;
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">User</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Role</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Site</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Last Active</th>
                        <th className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                        <th className="px-2 py-3 w-10">
                            <button onClick={onSelectAll} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-slate-400" />}
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm", getAvatarColor(user.fullName))}>
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 dark:text-white">
                                            {highlightText(user.fullName, searchQuery)}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {highlightText(user.email, searchQuery)}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", ROLE_CONFIG[user.role]?.badgeColor || 'bg-slate-100 text-slate-600')}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {user.site ? (
                                    <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[user.site.code] || 'bg-slate-100 text-slate-600')}>
                                        {user.site.code}
                                    </span>
                                ) : <span className="text-slate-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                                <span className={cn(
                                    "px-2 py-1 rounded-lg text-xs font-bold",
                                    user.isActive !== false
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {user.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-xs">
                                {formatLastActive((user as any).lastActiveAt)}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                    <button onClick={() => onEdit(user)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Edit">
                                        <Edit2 className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button onClick={() => onResetPassword(user)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Reset Password">
                                        <Key className="w-4 h-4 text-slate-500" />
                                    </button>
                                    <button onClick={() => onDelete(user)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
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

export const BentoAdminAgentsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedAgentDetail, setSelectedAgentDetail] = useState<User | null>(null);

    // New state for enhanced features
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSite, setSelectedSite] = useState('ALL');
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
    const [isBulkRoleChangeOpen, setIsBulkRoleChangeOpen] = useState(false);
    const [isPresetManageOpen, setIsPresetManageOpen] = useState(false);
    const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
    const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
    const [isComparisonOpen, setIsComparisonOpen] = useState(false);
    const [isBulkSiteChangeOpen, setIsBulkSiteChangeOpen] = useState(false);
    const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50); // P1-2: Configurable page size
    const PAGE_SIZE_OPTIONS = [20, 50, 100]; // P1-2: Page size options

    // P1-4: View mode toggle (grid vs table)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // P2-2: Role filter
    const [selectedRole, setSelectedRole] = useState<'ALL' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER'>('ALL');

    // P2-3: Stats card filter (click to filter by status)
    const [statsFilter, setStatsFilter] = useState<'all' | 'active' | 'resolved' | 'top'>('all');

    // E3: Sort config for performance table
    type SortKey = 'fullName' | 'openTickets' | 'inProgressTickets' | 'resolvedThisWeek' | 'resolvedThisMonth' | 'slaCompliance';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'resolvedThisMonth', dir: 'desc' });

    // E3: Handle column sort
    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
        }));
    };

    // M1: Unified view toggle - 'unified' shows all users in single table, 'collapsed' shows by role
    const [displayMode, setDisplayMode] = useState<'unified' | 'collapsed'>('unified');

    const handleResetPassword = (user: User) => {
        setSelectedUser(user);
        setIsResetPasswordOpen(true);
    };

    // Debounced search using useDeferredValue (must be defined before query that uses it)
    const deferredSearchQuery = useDeferredValue(searchQuery);

    // Paginated users query with server-side filtering
    interface PaginatedResponse {
        data: User[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasNextPage: boolean;
            hasPrevPage: boolean;
        };
    }

    const { data: usersResponse, isLoading, isError, error, refetch } = useQuery<PaginatedResponse>({
        queryKey: ['users', currentPage, pageSize, selectedSite, deferredSearchQuery],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', currentPage.toString());
            params.set('limit', pageSize.toString());
            if (selectedSite !== 'ALL') params.set('siteCode', selectedSite);
            if (deferredSearchQuery) params.set('search', deferredSearchQuery);
            const res = await api.get(`/users?${params.toString()}`);
            return res.data;
        },
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const users = usersResponse?.data || [];
    const paginationMeta = usersResponse?.meta;

    // Fetch sites from backend API
    const { data: sitesData = [] } = useQuery<Site[]>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Build sites array with "All Sites" prepended
    const SITES = useMemo(() => [
        { code: 'ALL', name: 'All Sites', id: '' },
        ...sitesData.map(s => ({ ...s, code: s.code, name: s.name, id: s.id }))
    ], [sitesData]);

    // Fetch agent stats from backend API (pre-computed on server)
    // Backend returns { summary, agents } - we extract the agents array
    const { data: agentStats = [] } = useQuery<AgentStats[]>({
        queryKey: ['agent-stats'],
        queryFn: async () => {
            const res = await api.get('/users/agents/stats');
            // Backend returns { summary: {...}, agents: [...] }
            return res.data.agents || [];
        },
        staleTime: 30000, // Cache for 30 seconds
    });

    // Users are already filtered by server, just use them directly
    const filteredUsers = users;

    // HIGH: Keyboard shortcuts (must be after filteredUsers is defined)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // ? - Show keyboard help
            if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                setShowKeyboardHelp(true);
            }

            // Ctrl+Shift+A - Select all users (avoids browser Ctrl+A conflict)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                const allIds = filteredUsers.map(u => u.id);
                setSelectedUserIds(new Set(allIds));
            }

            // Delete - Delete selected users
            if (e.key === 'Delete' && selectedUserIds.size > 0) {
                e.preventDefault();
                setIsBulkDeleteOpen(true);
            }

            // Escape - Close any open dialogs
            if (e.key === 'Escape') {
                setShowKeyboardHelp(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredUsers, selectedUserIds]);

    // Reset to page 1 when filters change
    const handleSiteChange = (newSite: string) => {
        setSelectedSite(newSite);
        setCurrentPage(1);
    };

    // Group users by role
    const usersByRole = useMemo(() => ({
        ADMIN: filteredUsers.filter(u => u.role === 'ADMIN'),
        MANAGER: filteredUsers.filter(u => u.role === 'MANAGER'),
        AGENT: filteredUsers.filter(u => u.role === 'AGENT'),
        USER: filteredUsers.filter(u => u.role === 'USER'),
    }), [filteredUsers]);

    // Filtered agent stats for performance table (P2-2: includes role filter)
    const filteredAgentStats = useMemo(() => {
        let result = agentStats;
        if (selectedSite !== 'ALL') {
            result = result.filter(a => a.site?.code === selectedSite);
        }
        if (selectedRole !== 'ALL') {
            result = result.filter(a => a.role === selectedRole);
        }
        return result;
    }, [agentStats, selectedSite, selectedRole]);

    // Dashboard stats - use filteredAgentStats for consistency (H2 fix)
    const dashboardStats = useMemo(() => {
        const totalResolved = filteredAgentStats.reduce((sum, a) => sum + a.resolvedThisMonth, 0);
        const totalActive = filteredAgentStats.filter(a => a.inProgressTickets > 0).length;
        const topPerformer = [...filteredAgentStats].sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth)[0];

        return {
            totalAgents: filteredAgentStats.length,
            totalResolved,
            totalActive,
            topPerformer: topPerformer?.fullName || '-',
            topPerformerTickets: topPerformer?.resolvedThisMonth || 0,
        };
    }, [filteredAgentStats]);

    // P2-3: Displayed agent stats with stats card filter + E3: sorting
    const displayedAgentStats = useMemo(() => {
        let result = filteredAgentStats;

        // Apply stats filter
        if (statsFilter === 'active') result = result.filter(a => a.inProgressTickets > 0);
        if (statsFilter === 'resolved') result = result.filter(a => a.resolvedThisMonth > 0);
        if (statsFilter === 'top') {
            // Show only the top performer
            const sorted = [...result].sort((a, b) => b.resolvedThisMonth - a.resolvedThisMonth);
            return sorted.slice(0, 1);
        }

        // E3: Apply column sorting
        return [...result].sort((a, b) => {
            const aVal = sortConfig.key === 'fullName'
                ? a.fullName.toLowerCase()
                : (a as any)[sortConfig.key] ?? 0;
            const bVal = sortConfig.key === 'fullName'
                ? b.fullName.toLowerCase()
                : (b as any)[sortConfig.key] ?? 0;

            if (sortConfig.key === 'fullName') {
                return sortConfig.dir === 'asc'
                    ? (aVal as string).localeCompare(bVal as string)
                    : (bVal as string).localeCompare(aVal as string);
            }
            return sortConfig.dir === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [filteredAgentStats, statsFilter, sortConfig]);

    // Site counts for tabs - use agentStats for accurate total (C2 fix)
    // Note: Using agentStats instead of paginated users for correct total counts
    const siteCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: agentStats.length };
        sitesData.forEach(site => {
            counts[site.code] = agentStats.filter(a => a.site?.code === site.code).length;
        });
        return counts;
    }, [agentStats, sitesData]);

    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            const res = await api.delete(`/users/${userId}`);
            return res.data;
        },
        onMutate: async (userId: string) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });

            // Snapshot previous data
            const previousData = queryClient.getQueryData(['users', currentPage, pageSize, selectedSite, deferredSearchQuery]);

            // Optimistically update the cache
            queryClient.setQueryData(
                ['users', currentPage, pageSize, selectedSite, deferredSearchQuery],
                (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        data: old.data.filter((u: User) => u.id !== userId),
                        meta: { ...old.meta, total: old.meta.total - 1 },
                    };
                }
            );

            return { previousData };
        },
        onSuccess: (data) => {
            toast.success(data.message || 'User deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsConfirmDeleteOpen(false);
            setUserToDelete(null);
        },
        onError: (error: any, _userId, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['users', currentPage, pageSize, selectedSite, deferredSearchQuery],
                    context.previousData
                );
            }
            toast.error(error.response?.data?.message || 'Failed to delete user');
        },
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (userIds: string[]) => {
            const res = await api.post('/users/bulk-delete', { userIds });
            return res.data;
        },
        onMutate: async (userIds: string[]) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });

            // Snapshot previous data
            const previousData = queryClient.getQueryData(['users', currentPage, pageSize, selectedSite, deferredSearchQuery]);

            // Optimistically update the cache
            queryClient.setQueryData(
                ['users', currentPage, pageSize, selectedSite, deferredSearchQuery],
                (old: any) => {
                    if (!old) return old;
                    const idSet = new Set(userIds);
                    return {
                        ...old,
                        data: old.data.filter((u: User) => !idSet.has(u.id)),
                        meta: { ...old.meta, total: old.meta.total - userIds.length },
                    };
                }
            );

            return { previousData };
        },
        onSuccess: (data) => {
            toast.success(`${data.deleted} users deleted successfully`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUserIds(new Set());
            setIsBulkDeleteOpen(false);
        },
        onError: (error: any, _userIds, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(
                    ['users', currentPage, pageSize, selectedSite, deferredSearchQuery],
                    context.previousData
                );
            }
            toast.error(error.response?.data?.message || 'Failed to delete users');
        },
    });

    const handleDeleteUser = (user: User) => {
        setUserToDelete(user);
        setIsConfirmDeleteOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setIsEditUserOpen(true);
    };

    const handleExportUsers = async (format: 'csv' | 'xlsx' = 'xlsx') => {
        try {
            const res = await api.get(`/users/export?format=${format}&site=${selectedSite}`, {
                responseType: format === 'xlsx' ? 'blob' : 'json'
            });

            if (format === 'xlsx') {
                const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `users_${selectedSite}_${new Date().toISOString().split('T')[0]}.xlsx`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                const { data, filename } = res.data;
                const blob = new Blob([data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                window.URL.revokeObjectURL(url);
            }
            toast.success('Users exported successfully');
        } catch (error) {
            toast.error('Failed to export users');
        }
    };

    const toggleUserSelection = (userId: string) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        setSelectedUserIds(newSet);
    };

    // U2: Toggle active/inactive mutation with optimistic update
    const toggleActiveMutation = useMutation({
        mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
            await api.patch(`/users/${userId}`, { isActive });
            return { userId, isActive };
        },
        onMutate: async ({ userId, isActive }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['users'] });
            await queryClient.cancelQueries({ queryKey: ['agent-stats'] });

            // Optimistic update for users
            const previousUsers = queryClient.getQueryData(['users']);
            queryClient.setQueryData(['users'], (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((u: User) =>
                        u.id === userId ? { ...u, isActive } : u
                    )
                };
            });

            return { previousUsers };
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousUsers) {
                queryClient.setQueryData(['users'], context.previousUsers);
            }
            toast.error('Failed to update user status');
        },
        onSuccess: (data) => {
            toast.success(`User ${data.isActive ? 'activated' : 'deactivated'}`);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
        },
    });

    // Bulk role change mutation
    const bulkRoleChangeMutation = useMutation({
        mutationFn: async ({ userIds, role }: { userIds: string[]; role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' }) => {
            // Update each user's role individually
            const promises = userIds.map(id => api.patch(`/users/${id}/role`, { role }));
            await Promise.all(promises);
            return { count: userIds.length, role };
        },
        onSuccess: (data) => {
            toast.success(`${data.count} user(s) updated to ${data.role}`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUserIds(new Set());
            setIsBulkRoleChangeOpen(false);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update roles');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Agent Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage your support team by site and role</p>
                </div>
                <div className="flex gap-3">
                    {/* Bulk Actions - show when users selected */}
                    {selectedUserIds.size > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    {selectedUserIds.size} Selected
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setIsBulkRoleChangeOpen(true)}>
                                    <Shield className="w-4 h-4" />
                                    Change Role
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsBulkSiteChangeOpen(true)}>
                                    <MapPin className="w-4 h-4" />
                                    Change Site
                                </DropdownMenuItem>
                                {selectedUserIds.size === 2 && (
                                    <DropdownMenuItem onClick={() => setIsComparisonOpen(true)}>
                                        <BarChart3 className="w-4 h-4" />
                                        Compare Agents
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => setIsBulkDeleteOpen(true)}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Selected
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* P1-4: View Mode Toggle */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'grid'
                                    ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'table'
                                    ? "bg-white dark:bg-slate-700 shadow-sm text-primary"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                            title="Table View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {/* P3-3: Secondary Actions Group */}
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setIsExportPreviewOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">Import</span>
                        </button>
                    </div>

                    {/* Manage Presets Button */}
                    <button
                        onClick={() => setIsPresetManageOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all text-sm shadow-lg shadow-violet-500/25"
                        title="Manage Permission Presets"
                    >
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">Manage Presets</span>
                    </button>

                    {/* P3-3: Primary Action */}
                    <button
                        onClick={() => setIsAddUserModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add User
                    </button>
                </div>
            </div>

            {/* Site Tabs */}
            <Tabs.Root value={selectedSite} onValueChange={handleSiteChange}>
                <Tabs.List className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                    {SITES.map((site) => (
                        <Tabs.Trigger
                            key={site.code}
                            value={site.code}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700",
                                "data-[state=active]:text-primary data-[state=active]:shadow-sm",
                                "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            )}
                        >
                            <MapPin className="w-4 h-4" />
                            {site.code}
                            <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                                {siteCounts[site.code] || 0}
                            </span>
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>
            </Tabs.Root>

            {/* P2-2: Role Filter Pills - Redesigned for clarity */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    Role:
                </span>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['ALL', 'ADMIN', 'MANAGER', 'AGENT', 'USER'] as const).map(role => {
                        // Fix: Use 'users' array which includes all roles, not just agentStats (ADMIN+AGENT)
                        const count = role === 'ALL'
                            ? users.length
                            : users.filter(u => u.role === role).length;

                        // Don't hide roles with 0 count - show them greyed out
                        const roleConfig = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
                        const RoleIcon = roleConfig?.icon || Users;

                        return (
                            <button
                                key={role}
                                onClick={() => { setSelectedRole(role); setCurrentPage(1); }}
                                disabled={count === 0 && role !== 'ALL'}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                    selectedRole === role
                                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                        : count === 0 && role !== 'ALL'
                                            ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                )}
                            >
                                {role !== 'ALL' && <RoleIcon className="w-3.5 h-3.5" />}
                                {role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}
                                <span className={cn(
                                    "px-1.5 py-0.5 text-xs rounded-full",
                                    selectedRole === role
                                        ? "bg-primary/20 text-primary"
                                        : "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-4 p-1 bg-slate-900/5 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800 backdrop-blur-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-0"
                    />
                </div>

                {selectedUserIds.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200 pr-2">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {selectedUserIds.size} selected
                        </span>
                        <button
                            onClick={() => setIsBulkDeleteOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-500/20 transition-all text-sm border border-red-500/20"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* P2-3: Clickable Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    title="Total Agents"
                    value={dashboardStats.totalAgents}
                    icon={Users}
                    variant="blue"
                    onClick={() => setStatsFilter('all')}
                    isActive={statsFilter === 'all'}
                />
                <StatCard
                    title="Active (In Progress)"
                    value={dashboardStats.totalActive}
                    subtitle="Click to filter"
                    icon={BarChart3}
                    variant="purple"
                    onClick={() => setStatsFilter(statsFilter === 'active' ? 'all' : 'active')}
                    isActive={statsFilter === 'active'}
                />
                <StatCard
                    title="Resolved (Month)"
                    value={dashboardStats.totalResolved}
                    subtitle="Click to filter"
                    icon={CheckCircle}
                    variant="green"
                    onClick={() => setStatsFilter(statsFilter === 'resolved' ? 'all' : 'resolved')}
                    isActive={statsFilter === 'resolved'}
                />
                <div
                    onClick={() => setStatsFilter(statsFilter === 'top' ? 'all' : 'top')}
                    className={cn("cursor-pointer transition-all", statsFilter === 'top' && "ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 rounded-2xl")}
                >
                    <TopPerformerCard
                        name={dashboardStats.topPerformer}
                        tickets={dashboardStats.topPerformerTickets}
                    />
                </div>
            </div>

            {/* P2-3: Active filter indicator */}
            {statsFilter !== 'all' && (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Filtering by:</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium capitalize">
                        {statsFilter === 'top' ? 'Top Performer' : statsFilter}
                    </span>
                    <button
                        onClick={() => setStatsFilter('all')}
                        className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    >
                        Clear filter
                    </button>
                </div>
            )}

            {/* P1-1 + P3-1: Agent Performance - Conditional Grid/Table View */}
            {displayedAgentStats.length > 0 && (
                <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-primary" />
                            {viewMode === 'grid' ? 'Agent Cards' : 'Agent Performance'}
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                                ({displayedAgentStats.length}{statsFilter !== 'all' ? ` of ${filteredAgentStats.length}` : ''} agents)
                            </span>
                            {selectedSite !== 'ALL' && (
                                <span className={cn("text-sm px-2 py-0.5 rounded-lg font-normal", SITE_COLORS[selectedSite])}>
                                    {selectedSite}
                                </span>
                            )}
                            {selectedRole !== 'ALL' && ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG] && (
                                <span className={cn("text-sm px-2 py-0.5 rounded-lg font-normal", ROLE_CONFIG[selectedRole as keyof typeof ROLE_CONFIG]?.badgeColor || 'bg-slate-100 text-slate-600')}>
                                    {selectedRole}
                                </span>
                            )}
                        </h3>
                    </div>

                    {/* P1-1: Grid View - B1: Now using VirtualizedAgentGrid for performance */}
                    {viewMode === 'grid' ? (
                        displayedAgentStats.length > 50 ? (
                            /* B1: Virtualized grid for 50+ agents - only renders visible cards */
                            <div className="h-[600px]">
                                <VirtualizedAgentGrid
                                    users={displayedAgentStats.map(agent => ({
                                        id: agent.id,
                                        fullName: agent.fullName,
                                        email: agent.email,
                                        role: agent.role as 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER',
                                        site: agent.site,
                                        isActive: users.find(u => u.id === agent.id)?.isActive,
                                        openTickets: agent.openTickets,
                                        inProgressTickets: agent.inProgressTickets,
                                        resolvedThisMonth: agent.resolvedThisMonth,
                                        slaCompliance: agent.slaCompliance,
                                    }))}
                                    selectedIds={selectedUserIds}
                                    onSelect={toggleUserSelection}
                                    onViewDetails={(user) => setSelectedAgentDetail({
                                        id: user.id,
                                        fullName: user.fullName,
                                        email: user.email,
                                        role: user.role,
                                        site: user.site,
                                        createdAt: '',
                                    })}
                                    onEdit={(user) => {
                                        const fullUser = users.find(u => u.id === user.id);
                                        if (fullUser) handleEditUser(fullUser);
                                    }}
                                    renderCard={(user, isSelected) => (
                                        <AgentCardErrorBoundary>
                                            <AgentCard
                                                agent={{
                                                    id: user.id,
                                                    fullName: user.fullName,
                                                    email: user.email,
                                                    role: user.role,
                                                    site: user.site,
                                                    openTickets: user.openTickets || 0,
                                                    inProgressTickets: user.inProgressTickets || 0,
                                                    resolvedThisWeek: user.resolvedThisWeek || 0,
                                                    resolvedThisMonth: user.resolvedThisMonth || 0,
                                                    resolvedTotal: 0,
                                                    slaCompliance: user.slaCompliance || 100,
                                                }}
                                                onView={() => setSelectedAgentDetail({
                                                    id: user.id,
                                                    fullName: user.fullName,
                                                    email: user.email,
                                                    role: user.role,
                                                    site: user.site,
                                                    createdAt: '',
                                                })}
                                                onSelect={() => toggleUserSelection(user.id)}
                                                isSelected={isSelected}
                                                onEdit={() => {
                                                    const fullUser = users.find(u => u.id === user.id);
                                                    if (fullUser) handleEditUser(fullUser);
                                                }}
                                                onToggleActive={() => {
                                                    const fullUser = users.find(u => u.id === user.id);
                                                    if (fullUser) {
                                                        toggleActiveMutation.mutate({ userId: user.id, isActive: !fullUser.isActive });
                                                    }
                                                }}
                                                isActive={user.isActive ?? true}
                                            />
                                        </AgentCardErrorBoundary>
                                    )}
                                />
                            </div>
                        ) : (
                            /* Standard grid for <50 agents - keeps animations */
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                {displayedAgentStats.map((agent, index) => (
                                    <div key={agent.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 30}ms` }}>
                                        <AgentCardErrorBoundary>
                                            <AgentCard
                                                agent={agent}
                                                onView={() => setSelectedAgentDetail({
                                                    id: agent.id,
                                                    fullName: agent.fullName,
                                                    email: agent.email,
                                                    role: agent.role as 'ADMIN' | 'AGENT' | 'USER',
                                                    site: agent.site,
                                                    createdAt: '',
                                                })}
                                                onSelect={() => toggleUserSelection(agent.id)}
                                                isSelected={selectedUserIds.has(agent.id)}
                                                onEdit={() => {
                                                    const user = users.find(u => u.id === agent.id);
                                                    if (user) handleEditUser(user);
                                                }}
                                                onToggleActive={() => {
                                                    const user = users.find(u => u.id === agent.id);
                                                    if (user) {
                                                        toggleActiveMutation.mutate({ userId: agent.id, isActive: !user.isActive });
                                                    }
                                                }}
                                                isActive={users.find(u => u.id === agent.id)?.isActive ?? true}
                                            />
                                        </AgentCardErrorBoundary>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                {/* P2-3: Sticky headers for better scroll experience */}
                                <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                                    <tr>
                                        <th
                                            onClick={() => handleSort('fullName')}
                                            className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Agent {sortConfig.key === 'fullName' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Site</th>
                                        <th
                                            onClick={() => handleSort('openTickets')}
                                            className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Open {sortConfig.key === 'openTickets' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('inProgressTickets')}
                                            className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            In Progress {sortConfig.key === 'inProgressTickets' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('resolvedThisWeek')}
                                            className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Week {sortConfig.key === 'resolvedThisWeek' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('resolvedThisMonth')}
                                            className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Month {sortConfig.key === 'resolvedThisMonth' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th
                                            onClick={() => handleSort('slaCompliance')}
                                            className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            SLA % {sortConfig.key === 'slaCompliance' && (sortConfig.dir === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {displayedAgentStats.map((agent) => (
                                        <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                        {agent.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-800 dark:text-white">{agent.fullName}</p>
                                                        <p className="text-xs text-slate-500">{agent.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {agent.site ? (
                                                    <span className={cn("px-2 py-1 rounded-lg text-xs font-bold", SITE_COLORS[agent.site.code])}>
                                                        {agent.site.code}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300">
                                                    {agent.openTickets}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400">
                                                    {agent.inProgressTickets}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                                    {agent.resolvedThisWeek}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm font-medium text-green-600 dark:text-green-400">
                                                    {agent.resolvedThisMonth}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <Tooltip.Provider>
                                                    <Tooltip.Root delayDuration={200}>
                                                        <Tooltip.Trigger asChild>
                                                            <span className={cn(
                                                                "px-2 py-1 rounded-lg text-sm font-medium cursor-help inline-flex items-center gap-1",
                                                                agent.slaCompliance >= 90 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                                                    agent.slaCompliance >= 70 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                                                                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                            )}>
                                                                {agent.slaCompliance}%
                                                                <Info className="w-3 h-3 opacity-60" />
                                                            </span>
                                                        </Tooltip.Trigger>
                                                        <Tooltip.Portal>
                                                            <Tooltip.Content
                                                                side="top"
                                                                className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-[200px] z-50"
                                                                sideOffset={5}
                                                            >
                                                                <p className="font-semibold mb-1">SLA Compliance</p>
                                                                <p className="text-slate-300">
                                                                    = (Total - Overdue) / Total × 100
                                                                </p>
                                                                <Tooltip.Arrow className="fill-slate-900" />
                                                            </Tooltip.Content>
                                                        </Tooltip.Portal>
                                                    </Tooltip.Root>
                                                </Tooltip.Provider>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <button
                                                    onClick={() => setSelectedAgentDetail(users.find(u => u.id === agent.id) || null)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 text-slate-500" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Users by Role - Collapsible Sections (shows all users from paginated API) */}
            {isLoading ? (
                <AgentTableSkeleton />
            ) : isError ? (
                <ErrorState
                    message={(error as Error)?.message || 'Failed to load users. Please try again.'}
                    onRetry={() => refetch()}
                />
            ) : filteredUsers.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Users className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">No Users Found</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                        {selectedSite !== 'ALL' ? `No users assigned to ${selectedSite}. ` : ''}
                        Get started by adding a new user or importing from a CSV file.
                    </p>
                </div>
            ) : (
                <>
                    {displayMode === 'unified' ? (
                        <UnifiedUserTable
                            users={filteredUsers}
                            searchQuery={deferredSearchQuery}
                            onEdit={handleEditUser}
                            onDelete={handleDeleteUser}
                            onResetPassword={handleResetPassword}
                            selectedIds={selectedUserIds}
                            onToggleSelection={toggleUserSelection}
                            onSelectAll={() => {
                                const allIds = filteredUsers.map(u => u.id);
                                const allSelected = filteredUsers.every(u => selectedUserIds.has(u.id));
                                if (allSelected) {
                                    setSelectedUserIds(new Set());
                                } else {
                                    setSelectedUserIds(new Set(allIds));
                                }
                            }}
                        />
                    ) : (
                        <div className="space-y-2">
                            <RoleSection
                                role="ADMIN"
                                users={usersByRole.ADMIN}
                                onEdit={handleEditUser}
                                onDelete={handleDeleteUser}
                                onResetPassword={handleResetPassword}
                                selectedIds={selectedUserIds}
                                onToggleSelection={toggleUserSelection}
                            />
                            <RoleSection
                                role="AGENT"
                                users={usersByRole.AGENT}
                                onEdit={handleEditUser}
                                onDelete={handleDeleteUser}
                                onResetPassword={handleResetPassword}
                                selectedIds={selectedUserIds}
                                onToggleSelection={toggleUserSelection}
                            />
                            <RoleSection
                                role="USER"
                                users={usersByRole.USER}
                                onEdit={handleEditUser}
                                onDelete={handleDeleteUser}
                                onResetPassword={handleResetPassword}
                                selectedIds={selectedUserIds}
                                onToggleSelection={toggleUserSelection}
                            />
                        </div>
                    )}
                </>
            )}

            {/* P1-2 + P1-3: Sticky Pagination with Page Size Selector */}
            {paginationMeta && paginationMeta.totalPages > 1 && (
                <div className="sticky bottom-4 z-10 flex items-center justify-between glass-card rounded-xl px-4 py-3 shadow-lg">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Showing {((paginationMeta.page - 1) * paginationMeta.limit) + 1} - {Math.min(paginationMeta.page * paginationMeta.limit, paginationMeta.total)} of {paginationMeta.total}
                    </div>
                    <div className="flex items-center gap-4">
                        {/* P1-2: Page Size Selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Show:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                            >
                                {PAGE_SIZE_OPTIONS.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-600" />
                        {/* Page Navigation */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={!paginationMeta.hasPrevPage}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">
                                Page {paginationMeta.page} of {paginationMeta.totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={!paginationMeta.hasNextPage}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ImportUsersDialog
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
            <AddUserDialog
                isOpen={isAddUserModalOpen}
                onClose={() => setIsAddUserModalOpen(false)}
            />
            <ResetPasswordDialog
                isOpen={isResetPasswordOpen}
                onClose={() => {
                    setIsResetPasswordOpen(false);
                    setSelectedUser(null);
                }}
                user={selectedUser}
            />
            <EditUserDialog
                isOpen={isEditUserOpen}
                onClose={() => {
                    setIsEditUserOpen(false);
                    setEditingUser(null);
                }}
                user={editingUser}
            />
            <AgentDetailModal
                isOpen={!!selectedAgentDetail}
                onClose={() => setSelectedAgentDetail(null)}
                agent={selectedAgentDetail ? {
                    id: selectedAgentDetail.id,
                    fullName: selectedAgentDetail.fullName,
                    email: selectedAgentDetail.email,
                    role: selectedAgentDetail.role,
                    department: selectedAgentDetail.department,
                    isActive: selectedAgentDetail.isActive,
                    openTickets: agentStats.find(a => a.id === selectedAgentDetail.id)?.openTickets,
                    inProgressTickets: agentStats.find(a => a.id === selectedAgentDetail.id)?.inProgressTickets,
                    resolvedThisWeek: agentStats.find(a => a.id === selectedAgentDetail.id)?.resolvedThisWeek,
                    resolvedThisMonth: agentStats.find(a => a.id === selectedAgentDetail.id)?.resolvedThisMonth,
                    slaCompliance: agentStats.find(a => a.id === selectedAgentDetail.id)?.slaCompliance,
                } : null}
            />
            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
                onClose={() => {
                    setIsConfirmDeleteOpen(false);
                    setUserToDelete(null);
                }}
                onConfirm={() => userToDelete && deleteMutation.mutate(userToDelete.id)}
                title="Delete User"
                message={`Are you sure you want to delete ${userToDelete?.fullName}? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={deleteMutation.isPending}
            />
            <ConfirmDialog
                isOpen={isBulkDeleteOpen}
                onClose={() => setIsBulkDeleteOpen(false)}
                onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedUserIds))}
                title="Delete Selected Users"
                message={`Are you sure you want to delete ${selectedUserIds.size} users? This action cannot be undone.`}
                confirmText="Delete All"
                variant="danger"
                isLoading={bulkDeleteMutation.isPending}
            />
            <BulkRoleChangeDialog
                isOpen={isBulkRoleChangeOpen}
                onClose={() => setIsBulkRoleChangeOpen(false)}
                onConfirm={(role) => bulkRoleChangeMutation.mutate({
                    userIds: Array.from(selectedUserIds),
                    role
                })}
                selectedCount={selectedUserIds.size}
                isLoading={bulkRoleChangeMutation.isPending}
            />

            {/* Preset Management Dialog */}
            <PresetManagementDialog
                isOpen={isPresetManageOpen}
                onClose={() => setIsPresetManageOpen(false)}
            />

            {/* Export Preview Dialog */}
            <ExportPreviewDialog
                isOpen={isExportPreviewOpen}
                onClose={() => setIsExportPreviewOpen(false)}
                siteFilter={selectedSite}
                roleFilter={selectedRole}
            />

            {/* Agent Comparison Dialog */}
            <AgentComparisonDialog
                isOpen={isComparisonOpen}
                onClose={() => setIsComparisonOpen(false)}
                agents={Array.from(selectedUserIds).slice(0, 2).map(id => {
                    const user = users.find(u => u.id === id);
                    const stats = agentStats?.find((s: any) => s.id === id);
                    return {
                        id: id,
                        fullName: user?.fullName || '',
                        email: user?.email || '',
                        role: user?.role || 'USER',
                        site: user?.site,
                        openTickets: stats?.openTickets || 0,
                        inProgressTickets: stats?.inProgressTickets || 0,
                        resolvedThisWeek: stats?.resolvedThisWeek || 0,
                        resolvedThisMonth: stats?.resolvedThisMonth || 0,
                        resolvedTotal: stats?.resolvedTotal || 0,
                        slaCompliance: stats?.slaCompliance || 100
                    };
                })}
            />

            {/* Bulk Site Change Dialog */}
            <BulkSiteChangeDialog
                isOpen={isBulkSiteChangeOpen}
                onClose={() => setIsBulkSiteChangeOpen(false)}
                selectedCount={selectedUserIds.size}
                selectedUserIds={Array.from(selectedUserIds)}
            />

            {/* Keyboard Shortcuts Help */}
            {showKeyboardHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowKeyboardHelp(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                            <Keyboard className="w-5 h-5 text-primary" />
                            Keyboard Shortcuts
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-600 dark:text-slate-400">Select all users</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Ctrl + A</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-600 dark:text-slate-400">Delete selected</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Delete</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-600 dark:text-slate-400">Show this help</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">?</kbd>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-slate-600 dark:text-slate-400">Close dialogs</span>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Escape</kbd>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowKeyboardHelp(false)}
                            className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* PDF Export Dialog */}
            <ExportPdfDialog
                isOpen={isPdfExportOpen}
                onClose={() => setIsPdfExportOpen(false)}
                siteFilter={selectedSite}
                totalUsers={users.length}
            />

            {/* Onboarding Tutorial */}
            {showOnboarding && (
                <OnboardingTutorial onComplete={() => setShowOnboarding(false)} />
            )}
        </div>
    );
};

export default BentoAdminAgentsPage;
