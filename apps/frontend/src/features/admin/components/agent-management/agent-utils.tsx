import React from 'react';
import { Shield, Crown, Users } from 'lucide-react';
import { Ticket } from '@/types/ticket.types';
import { Site } from '@/types/admin.types';

// Extended Ticket interface with site field (backend returns this)
export interface TicketWithSite extends Ticket {
    site?: Site;
}

// Site colors for badges - fallback if site code not found
export const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export const ROLE_CONFIG = {
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
export const getAvatarColor = (name: string): string => {
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
        'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    if (!name) return colors[0];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// M3: Helper function to highlight search matches
export const highlightText = (text: string, query: string): React.ReactNode => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/40 rounded px-0.5">{part}</mark>
        ) : part
    );
};

// Color palette per-preset index — cycles through 6 distinct colors
export const PRESET_COLORS = [
    { dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-200 dark:ring-violet-800', bg: 'bg-violet-50 dark:bg-violet-900/30', hover: 'hover:bg-violet-50 dark:hover:bg-violet-900/20' },
    { dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-200 dark:ring-sky-800', bg: 'bg-sky-50 dark:bg-sky-900/30', hover: 'hover:bg-sky-50 dark:hover:bg-sky-900/20' },
    { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-900/30', hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20' },
    { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-200 dark:ring-amber-800', bg: 'bg-amber-50 dark:bg-amber-900/30', hover: 'hover:bg-amber-50 dark:hover:bg-amber-900/20' },
    { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-200 dark:ring-rose-800', bg: 'bg-rose-50 dark:bg-rose-900/30', hover: 'hover:bg-rose-50 dark:hover:bg-rose-900/20' },
    { dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', ring: 'ring-teal-200 dark:ring-teal-800', bg: 'bg-teal-50 dark:bg-teal-900/30', hover: 'hover:bg-teal-50 dark:hover:bg-teal-900/20' },
];

export const formatLastActive = (date: string | undefined): React.ReactNode => {
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
