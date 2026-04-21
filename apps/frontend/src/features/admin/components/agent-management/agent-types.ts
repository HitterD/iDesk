// Agent Management Types
// Shared types for agent management components

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

// Role configuration
export const ROLE_CONFIG = {
    ADMIN: {
        icon: 'Shield',
        label: 'Administrators',
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        badgeColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    },
    MANAGER: {
        icon: 'Crown',
        label: 'Managers',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        badgeColor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    },
    AGENT: {
        icon: 'Users',
        label: 'Agents',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        badgeColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    },
    AGENT_ADMIN: {
        icon: 'ShieldAlert',
        label: 'Agent Admins',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
        badgeColor: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
    AGENT_ORACLE: {
        icon: 'Eye',
        label: 'Agent Oracles',
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        badgeColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    },
    AGENT_OPERATIONAL_SUPPORT: {
        icon: 'LifeBuoy',
        label: 'Ops Support',
        color: 'text-teal-600',
        bgColor: 'bg-teal-100 dark:bg-teal-900/30',
        badgeColor: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    },
    USER: {
        icon: 'Users',
        label: 'Users',
        color: 'text-slate-600',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        badgeColor: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    },
};

// Generate consistent color based on name
export const getAvatarColor = (name: string): string => {
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
        'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

export interface PermissionPreset {
    id: string;
    name: string;
    isDefault?: boolean;
}
