// Agent Management Types
// Shared types for agent management components
import { Shield, Crown, Users, ShieldAlert, Eye, LifeBuoy, type LucideIcon } from 'lucide-react';

export interface Site {
    id: string;
    code: string;
    name: string;
}

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'AGENT' | 'USER' | 'AGENT_ORACLE' | 'AGENT_ADMIN' | 'AGENT_OPERATIONAL_SUPPORT';
    department?: { id: string; name: string };
    site?: Site;
    siteId?: string;
    createdAt: string;
    isActive?: boolean;
    employeeId?: string;
    jobTitle?: string;
    phoneNumber?: string;
}

export interface AgentStats {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    department?: string;
    site?: Site;
    openTickets: number;
    inProgressTickets: number;
    resolvedThisWeek: number;
    resolvedThisMonth: number;
    resolvedTotal: number;
    slaCompliance: number;
    appraisalPoints?: number;
    activeWorkloadPoints?: number;
}

// Site colors for badges
export const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export type UserRoleKey =
    | 'ADMIN'
    | 'MANAGER'
    | 'AGENT'
    | 'AGENT_ADMIN'
    | 'AGENT_ORACLE'
    | 'AGENT_OPERATIONAL_SUPPORT'
    | 'USER';

export interface RoleConfigEntry {
    icon: LucideIcon;
    /** Singular, for badges and pickers. */
    label: string;
    /** Plural, for section headers grouping many users. */
    pluralLabel: string;
    /** One-line explanation shown in role pickers. */
    description: string;
    color: string;
    bgColor: string;
    badgeColor: string;
}

/**
 * The single source of truth for role presentation. Every badge, section header,
 * filter pill and role picker reads from here — divergent copies previously made
 * the same role look like different roles depending on the screen.
 */
export const ROLE_CONFIG: Record<UserRoleKey, RoleConfigEntry> = {
    ADMIN: {
        icon: Shield,
        label: 'Admin',
        pluralLabel: 'Administrators',
        description: 'Akses penuh sistem',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        badgeColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    },
    MANAGER: {
        icon: Crown,
        label: 'Manager',
        pluralLabel: 'Managers',
        description: 'Supervisi & laporan tim',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        badgeColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    },
    AGENT: {
        icon: Users,
        label: 'Agent',
        pluralLabel: 'Agents',
        description: 'Petugas penanganan tiket',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        badgeColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    },
    AGENT_ADMIN: {
        icon: ShieldAlert,
        label: 'Agent Admin',
        pluralLabel: 'Agent Admins',
        description: 'Petugas admin operasional',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        badgeColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    AGENT_ORACLE: {
        icon: Eye,
        label: 'Agent Oracle',
        pluralLabel: 'Agent Oracles',
        description: 'Petugas riset/knowledge',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        badgeColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    },
    AGENT_OPERATIONAL_SUPPORT: {
        icon: LifeBuoy,
        label: 'Ops Support',
        pluralLabel: 'Ops Support',
        description: 'Dukungan operasional',
        color: 'text-teal-600',
        bgColor: 'bg-teal-100 dark:bg-teal-900/30',
        badgeColor: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    },
    USER: {
        icon: Users,
        label: 'User',
        pluralLabel: 'Users',
        description: 'Akses standar pengguna',
        color: 'text-slate-600',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        badgeColor: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    },
};

/** Assignable roles, ordered least- to most-privileged for pickers. */
export const ROLE_ORDER: UserRoleKey[] = [
    'USER',
    'AGENT',
    'AGENT_ADMIN',
    'AGENT_ORACLE',
    'AGENT_OPERATIONAL_SUPPORT',
    'MANAGER',
    'ADMIN',
];

/** Role config for an arbitrary string from the API, falling back to USER. */
export const getRoleConfig = (role: string | undefined): RoleConfigEntry =>
    ROLE_CONFIG[role as UserRoleKey] ?? ROLE_CONFIG.USER;

/** Human label for a role, tolerating unknown values from the API. */
export const getRoleLabel = (role: string | undefined): string => {
    if (!role) return '';
    return ROLE_CONFIG[role as UserRoleKey]?.label ?? role.replace(/_/g, ' ');
};

// Generate consistent color based on name
export const getAvatarColor = (name: string): string => {
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
        'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    if (!name) return colors[0];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export interface PermissionPreset {
    id: string;
    name: string;
    isDefault?: boolean;
}
