import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Ticket,
    Settings,
    Users,
    BarChart3,
    BookOpen,
    LogOut,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Bell,
    Search,
    Zap,
    Shield,
    Activity,
    Video,
    FolderOpen,
    Briefcase,
    ShieldCheck,
    MonitorSmartphone,
    FileText,
    PackageSearch,
    Database,
    Code2,
    Smartphone,
    LucideIcon
} from 'lucide-react';
import { useAuth, performLogout } from '../../stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Logo } from '@/components/ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { useMyPermissions } from '@/hooks/usePermissions';
import { usePermissions as useIctPermissions } from '@/features/hardware-request/hooks/usePermissions';
import { usePendingApprovals } from '@/features/request-center/api/eform-request.api';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

// Types for navigation structure
interface NavItem {
    key: string;
    icon: LucideIcon;
    label: string;
    path: string;
}

interface NavGroup {
    id: string;
    label: string;
    icon: LucideIcon;
    items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry;

interface BadgeInfo {
    count: number;
    variant?: 'destructive' | 'primary';
}

// Collapsible Nav Group Component
const NavGroupComponent: React.FC<{
    group: NavGroup;
    isExpanded: boolean;
    onToggle: () => void;
    isCollapsed: boolean;
    groupBadge: BadgeInfo | null;
    getItemBadge: (key: string) => BadgeInfo | null;
}> = ({ group, isExpanded, onToggle, isCollapsed, groupBadge, getItemBadge }) => {
    const location = useLocation();
    const hasActiveChild = group.items.some(item => location.pathname.startsWith(item.path));
    const [popoverOpen, setPopoverOpen] = useState(false);
    const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setPopoverOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimeoutRef.current = setTimeout(() => {
            setPopoverOpen(false);
        }, 150);
    };

    // When sidebar is collapsed (icon-only mode) -> Portaled Floating Flyout Menu
    if (isCollapsed) {
        return (
            <div
                className="relative flex justify-center py-0.5"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            onClick={() => setPopoverOpen(prev => !prev)}
                            aria-label={group.label}
                            aria-expanded={popoverOpen}
                            className={cn(
                                "w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-150 relative cursor-pointer",
                                hasActiveChild
                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                            )}
                        >
                            <group.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            {groupBadge && groupBadge.count > 0 ? (
                                <span className={cn(
                                    "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-background shadow-xs pointer-events-none tabular-nums",
                                    groupBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                                )}>
                                    {groupBadge.count > 99 ? '99+' : groupBadge.count}
                                </span>
                            ) : null}
                        </button>
                    </PopoverTrigger>

                    <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={14}
                        className="bg-white/95 dark:bg-slate-900/95 text-popover-foreground rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-2 min-w-[220px] backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 dark:border-slate-800 mb-1">
                            <span>{group.label}</span>
                            {groupBadge && groupBadge.count > 0 ? (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                                    groupBadge.variant === 'destructive' ? 'bg-destructive/15 text-destructive' : 'bg-primary/20 text-primary'
                                )}>
                                    {groupBadge.count}
                                </span>
                            ) : null}
                        </div>
                        <div className="flex flex-col gap-0.5">
                            {group.items.map((item) => {
                                const itemBadge = getItemBadge(item.key);
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setPopoverOpen(false)}
                                        className={({ isActive }) =>
                                            cn(
                                                "flex items-center gap-2.5 px-3 py-2 text-sm rounded-xl transition-all duration-150 relative",
                                                isActive
                                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                                            )
                                        }
                                    >
                                        <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span className="truncate flex-1 font-medium">{item.label}</span>
                                        {itemBadge && itemBadge.count > 0 ? (
                                            <span className={cn(
                                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                                                itemBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'
                                            )}>
                                                {itemBadge.count}
                                            </span>
                                        ) : null}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    }

    // Expanded Sidebar Mode
    return (
        <div className="flex flex-col">
            {/* Group Header Button */}
            <button
                type="button"
                onClick={onToggle}
                className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors duration-150 group relative shrink-0 mt-1 first:mt-0 cursor-pointer",
                    hasActiveChild
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                )}
            >
                <span className={cn(
                    "flex-1 text-left text-xs font-bold uppercase tracking-[0.08em] transition-colors",
                    hasActiveChild ? "text-foreground" : "text-muted-foreground/75"
                )}>
                    {group.label}
                </span>

                {/* If group is collapsed and has items with badges, show summary badge */}
                {!isExpanded && groupBadge && groupBadge.count > 0 ? (
                    <span className={cn(
                        "mr-1.5 px-2 py-0.5 min-w-[20px] rounded-full text-[10px] font-bold text-center tabular-nums shadow-xs",
                        groupBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'
                    )}>
                        {groupBadge.count > 99 ? '99+' : groupBadge.count}
                    </span>
                ) : null}

                <ChevronDown
                    className={cn(
                        "w-4 h-4 transition-transform duration-200 text-muted-foreground/60 shrink-0",
                        isExpanded ? 'rotate-0' : '-rotate-90'
                    )}
                    aria-hidden="true"
                />
            </button>

            {/* Group Items */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="pl-2 flex flex-col gap-0.5 py-1">
                            {group.items.map((item) => {
                                const itemBadge = getItemBadge(item.key);
                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            cn(
                                                "flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 group/item relative text-sm",
                                                isActive
                                                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                                            )
                                        }
                                    >
                                        <item.icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                        <span className="font-medium truncate">{item.label}</span>
                                        {itemBadge && itemBadge.count > 0 ? (
                                            <span className={cn(
                                                "ml-auto px-2 py-0.5 min-w-[20px] rounded-full text-[11px] font-bold text-center tabular-nums shadow-xs",
                                                itemBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'
                                            )}>
                                                {itemBadge.count}
                                            </span>
                                        ) : null}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Standalone Nav Link Component (Used for Dashboard & Settings)
const StandaloneNavLink: React.FC<{
    entry: NavItem;
    isCollapsed: boolean;
    itemBadge: BadgeInfo | null;
}> = ({ entry, isCollapsed, itemBadge }) => {
    if (isCollapsed) {
        return (
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="relative flex justify-center py-0.5">
                            <NavLink
                                to={entry.path}
                                aria-label={entry.label}
                                className={({ isActive }) =>
                                    cn(
                                        "w-11 h-11 mx-auto rounded-xl flex items-center justify-center transition-all duration-150 relative cursor-pointer",
                                        isActive
                                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                                    )
                                }
                            >
                                <entry.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                {itemBadge && itemBadge.count > 0 ? (
                                    <span className={cn(
                                        "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-background shadow-xs pointer-events-none tabular-nums",
                                        itemBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                                    )}>
                                        {itemBadge.count > 99 ? '99+' : itemBadge.count}
                                    </span>
                                ) : null}
                            </NavLink>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={14} className="bg-popover text-popover-foreground rounded-xl shadow-xl border border-border/80 px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex items-center gap-2 z-50">
                        <span>{entry.label}</span>
                        {itemBadge && itemBadge.count > 0 ? (
                            <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                                itemBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'
                            )}>
                                {itemBadge.count}
                            </span>
                        ) : null}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <NavLink
            to={entry.path}
            aria-label={entry.label}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 rounded-xl transition-all duration-150 px-3.5 py-2.5 text-sm",
                    isActive
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground font-medium hover:bg-secondary/60 hover:text-foreground'
                )
            }
        >
            <entry.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="font-medium animate-in fade-in duration-200 whitespace-nowrap">
                {entry.label}
            </span>
            {itemBadge && itemBadge.count > 0 ? (
                <span className={cn(
                    "ml-auto px-2 py-0.5 min-w-[20px] rounded-full text-[11px] font-bold text-center tabular-nums shadow-xs",
                    itemBadge.variant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'
                )}>
                    {itemBadge.count}
                </span>
            ) : null}
        </NavLink>
    );
};

export interface BentoSidebarProps {
    onNavigate?: () => void;
}

export const BentoSidebar: React.FC<BentoSidebarProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // Check if current route is a ticket detail view
    const isTicketDetail = location.pathname.startsWith('/tickets/') && 
        !['/tickets/list', '/tickets/create', '/tickets/oracle-k2', '/tickets/web-developer', '/tickets/mobile-developer'].includes(location.pathname);

    // Track user's global collapsed preference in localStorage
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
        if (isTicketDetail) return true;
        const saved = localStorage.getItem('sidebar-is-collapsed');
        return saved ? JSON.parse(saved) : false;
    });

    // Auto-collapse when entering ticket detail, auto-restore when returning to other pages
    useEffect(() => {
        if (isTicketDetail) {
            setIsCollapsed(true);
        } else {
            const saved = localStorage.getItem('sidebar-is-collapsed');
            setIsCollapsed(saved ? JSON.parse(saved) : false);
        }
    }, [isTicketDetail]);

    // Save collapse state to localStorage only when user explicitly toggles outside of ticket detail
    const handleToggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            if (!isTicketDetail) {
                localStorage.setItem('sidebar-is-collapsed', JSON.stringify(next));
            }
            return next;
        });
    };

    // Global keyboard shortcut (Ctrl+B / Cmd+B) to toggle collapse
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                const target = e.target as HTMLElement;
                if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                    return;
                }
                e.preventDefault();
                handleToggleCollapse();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTicketDetail]);

    // Fetch pending approvals for managers/admins to show badge count
    const isManagerOrAdmin = ['MANAGER', 'ADMIN', 'AGENT', 'AGENT_OPERATIONAL_SUPPORT', 'AGENT_ORACLE'].includes(user?.role || '');
    const { data: pendingApprovals } = usePendingApprovals();
    const pendingCount = isManagerOrAdmin && pendingApprovals ? pendingApprovals.length : 0;

    // Fetch unread notifications count
    const { data: notificationCountData } = useQuery<{ count: number }>({
        queryKey: ['notifications', 'count'],
        queryFn: async () => {
            const res = await api.get('/notifications/count');
            return res.data;
        },
        enabled: !!user,
        staleTime: 30000,
    });
    const unreadNotificationsCount = notificationCountData?.count || 0;

    // Fetch user's feature permissions for sidebar filtering (only if user has custom preset)
    const { data: myPermissions, isLoading: permissionsLoading } = useMyPermissions();
    const { isIctRole, isIctLead } = useIctPermissions();

    // Badge resolution helper for navigation items
    const getItemBadge = (key: string): BadgeInfo | null => {
        if (key === 'eform_access' && pendingCount > 0) {
            return { count: pendingCount, variant: 'destructive' };
        }
        if (key === 'notifications' && unreadNotificationsCount > 0) {
            return { count: unreadNotificationsCount, variant: 'destructive' };
        }
        return null;
    };

    // Group badge resolution helper
    const getGroupBadge = (group: NavGroup): BadgeInfo | null => {
        let total = 0;
        let isDestructive = false;
        for (const item of group.items) {
            const badge = getItemBadge(item.key);
            if (badge && badge.count > 0) {
                total += badge.count;
                if (badge.variant === 'destructive') isDestructive = true;
            }
        }
        if (total > 0) {
            return { count: total, variant: isDestructive ? 'destructive' : 'primary' };
        }
        return null;
    };

    // Navigation configuration - Core items and groups
    const isManager = user?.role === 'MANAGER';

    const NAVIGATION_CONFIG = useMemo(() => [
        // Core items
        { 
            type: 'item', 
            key: 'dashboard', 
            icon: LayoutDashboard, 
            label: 'Dashboard', 
            path: isManager ? '/manager/dashboard' : '/dashboard' 
        },

        // Request Center group
        {
            type: 'group',
            id: 'request_center',
            label: 'Request Center',
            icon: PackageSearch,
            items: [
                { 
                    key: 'tickets', 
                    icon: Ticket, 
                    label: 'IT Support Tickets', 
                    path: isManager ? '/manager/tickets' : '/tickets/list' 
                },
                { key: 'oracle_k2_tickets', icon: Database, label: 'Oracle K2 Request', path: '/tickets/oracle-k2' },
                { key: 'web_dev_tickets', icon: Code2, label: 'Web Developer Request', path: '/tickets/web-developer' },
                { key: 'mobile_dev_tickets', icon: Smartphone, label: 'Mobile Developer Request', path: '/tickets/mobile-developer' },
                { key: 'hardware_requests', icon: MonitorSmartphone, label: 'Hardware Requests', path: '/hardware-requests' },
                { key: 'eform_access', icon: FileText, label: 'E-Form Access', path: '/eform-access' },
                { key: 'lost_items', icon: Search, label: 'Lost Items', path: '/lost-items' },
            ]
        },

        // Resources group
        {
            type: 'group',
            id: 'resources',
            label: 'Resources',
            icon: FolderOpen,
            items: [
                { key: 'zoom_calendar', icon: Video, label: 'Zoom Calendar', path: '/zoom-calendar' },
                { key: 'knowledge_base', icon: BookOpen, label: 'Knowledge Base', path: '/kb' },
            ]
        },

        // Management group
        {
            type: 'group',
            id: 'management',
            label: 'Management',
            icon: Briefcase,
            items: [
                { 
                    key: 'workloads', 
                    icon: Activity, 
                    label: 'Workloads', 
                    path: isManager ? '/manager/workloads' : '/workloads' 
                },
                { 
                    key: 'reports', 
                    icon: BarChart3, 
                    label: 'Reports', 
                    path: isManager ? '/manager/reports' : '/reports' 
                },
                { key: 'notifications', icon: Bell, label: 'Notifications', path: '/notifications' },
                { key: 'renewal', icon: CalendarClock, label: 'Renewal Hub', path: '/renewal' },
            ]
        },

        // Administration group (Admin role only)
        {
            type: 'group',
            id: 'administration',
            label: 'Administration',
            icon: ShieldCheck,
            adminOnly: true,
            items: [
                { key: 'agents', icon: Users, label: 'Agents', path: '/agents' },
                { key: 'automation', icon: Zap, label: 'Automation', path: '/automation' },
                { key: 'audit_logs', icon: Shield, label: 'Audit Logs', path: '/audit-logs' },
                { key: 'system_health', icon: Activity, label: 'System Health', path: '/system-health' },
            ]
        },
    ] as const, [isManager]);

    // Page access check - uses pageAccess from applied preset
    const canAccessPage = (pageKey: string): boolean => {
        // ADMIN always has full access
        if (user?.role === 'ADMIN') return true;

        // Check pageAccess from backend (applied preset)
        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        // Fallback: role-based defaults
        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_OPERATIONAL_SUPPORT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_ADMIN: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_ORACLE: ['oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'notifications'],
            AGENT_WEB_DEV: ['web_dev_tickets', 'oracle_k2_tickets', 'mobile_dev_tickets', 'notifications'],
            AGENT_MOBILE_DEV: ['mobile_dev_tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'notifications'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads', 'notifications'],
            ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'settings'],
        };

        const userRole = (user?.role || 'USER') as string;
        const allowedPages = roleDefaults[userRole] || roleDefaults['USER'];
        return allowedPages.includes(pageKey) || pageKey.startsWith('module_');
    };

    // Query dynamic ticket modules
    const { data: dynamicModules = [] } = useQuery<any[]>({
        queryKey: ['ticket-modules'],
        queryFn: async () => {
            const res = await api.get('/ticket-modules');
            return res.data;
        },
        staleTime: 60_000,
    });

    // Build upper navigation from config + dynamic ticket modules + pageAccess
    const buildNavigation = (): NavEntry[] => {
        const nav: NavEntry[] = [];

        for (const entry of NAVIGATION_CONFIG) {
            if (entry.type === 'item') {
                if (canAccessPage(entry.key)) {
                    nav.push({ key: entry.key, icon: entry.icon, label: entry.label, path: entry.path });
                }
            } else if (entry.type === 'group') {
                if ('adminOnly' in entry && entry.adminOnly && user?.role !== 'ADMIN') {
                    continue;
                }

                if (entry.id === 'request_center' && dynamicModules.length > 0) {
                    // Map dynamic ticket modules
                    const moduleItems: NavItem[] = dynamicModules.map((mod: any) => {
                        let path = `/tickets/queue/${mod.slug}`;
                        let key = `module_${mod.slug}`;

                        if (mod.slug === 'it-support') {
                            path = isManager ? '/manager/tickets' : '/tickets/list';
                            key = 'tickets';
                        } else if (mod.slug === 'oracle-k2') {
                            path = '/tickets/oracle-k2';
                            key = 'oracle_k2_tickets';
                        } else if (mod.slug === 'web-developer') {
                            path = '/tickets/web-developer';
                            key = 'web_dev_tickets';
                        } else if (mod.slug === 'mobile-developer') {
                            path = '/tickets/mobile-developer';
                            key = 'mobile_dev_tickets';
                        }

                        // Determine icon
                        let IconComponent: LucideIcon = Ticket;
                        if (mod.icon === 'Database') IconComponent = Database;
                        else if (mod.icon === 'Code2') IconComponent = Code2;
                        else if (mod.icon === 'Smartphone') IconComponent = Smartphone;
                        else if (mod.icon === 'Network' || mod.icon === 'Server') IconComponent = Activity;
                        else if (mod.icon === 'Shield') IconComponent = Shield;
                        else if (mod.icon === 'Zap') IconComponent = Zap;

                        return {
                            key,
                            icon: IconComponent,
                            label: mod.name,
                            path,
                        };
                    });

                    // Append static Request Center items
                    const otherRequestCenterItems = entry.items.filter((item) =>
                        ['hardware_requests', 'eform_access', 'lost_items'].includes(item.key)
                    );

                    const allItems = [...moduleItems, ...otherRequestCenterItems];
                    const visibleItems = allItems.filter((item) => {
                        if ('ictOnly' in item && (item as any).ictOnly) return isIctRole;
                        if ('ictLeadOnly' in item && (item as any).ictLeadOnly) return isIctLead;
                        return canAccessPage(item.key);
                    });

                    if (visibleItems.length > 0) {
                        nav.push({
                            id: entry.id,
                            label: entry.label,
                            icon: entry.icon,
                            items: visibleItems,
                        });
                    }
                    continue;
                }

                const visibleItems = entry.items.filter(item => {
                    if ('adminOnly' in entry && entry.adminOnly) {
                        return user?.role === 'ADMIN';
                    }
                    if ('ictOnly' in item && item.ictOnly) {
                        return isIctRole;
                    }
                    if ('ictLeadOnly' in item && item.ictLeadOnly) {
                        return isIctLead;
                    }
                    return canAccessPage(item.key);
                });

                if (visibleItems.length > 0) {
                    nav.push({
                        id: entry.id,
                        label: entry.label,
                        icon: entry.icon,
                        items: visibleItems.map(item => ({
                            key: item.key,
                            icon: item.icon,
                            label: item.label,
                            path: item.path
                        }))
                    });
                }
            }
        }

        return nav;
    };

    // Settings item (Anchored at bottom for all portal users to access profile & preferences)
    const settingsItem: NavItem = useMemo(() => {
        return { key: 'settings', icon: Settings, label: 'Settings', path: '/settings' };
    }, []);

    // Find active group based on current route
    const getActiveGroupId = (): string | null => {
        const allGroups = buildNavigation();
        const activeGroup = allGroups.find(
            (entry): entry is NavGroup =>
                isGroup(entry) && entry.items.some(item => location.pathname.startsWith(item.path)),
        );
        return activeGroup ? activeGroup.id : null;
    };

    // Accordion state: remembers which groups are expanded.
    // - request_center is ALWAYS open (true) by default and design requirement.
    // - At most 1 other secondary group (resources, management, administration) can be open at a time (maximum 2 open collapsibles total).
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('sidebar-expanded-groups-v2');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...parsed, request_center: true };
            } catch {
                return { request_center: true };
            }
        }
        return { request_center: true };
    });

    useEffect(() => {
        localStorage.setItem('sidebar-expanded-groups-v2', JSON.stringify(expandedGroups));
    }, [expandedGroups]);

    // Auto-expand group containing active route while preserving request_center open
    useEffect(() => {
        const activeId = getActiveGroupId();
        if (activeId && activeId !== 'request_center') {
            setExpandedGroups({
                request_center: true,
                [activeId]: true,
            });
        }
    }, [location.pathname]);

    const handleLogout = async () => {
        await performLogout();
        navigate('/login', { replace: true });
    };

    // Dynamic 2-collapse accordion:
    // - request_center ALWAYS stays open
    // - Opening another secondary group opens it and closes any other secondary group
    // - Clicking an already open secondary group toggles it closed
    // - Clicking request_center preserves its open state
    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            if (groupId === 'request_center') {
                return { ...prev, request_center: true };
            }

            const isCurrentlyOpen = !!prev[groupId];
            if (isCurrentlyOpen) {
                return {
                    request_center: true,
                    [groupId]: false,
                };
            } else {
                return {
                    request_center: true,
                    [groupId]: true,
                };
            }
        });
    };


    const navigation = buildNavigation();

    return (
        <aside
            className={cn(
                "h-full flex flex-col transition-[width,padding] duration-200 ease-out relative z-10",
                "sidebar-frosted select-none",
                isCollapsed ? "w-20 p-3" : "w-full lg:w-64 px-4 py-5"
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={handleToggleCollapse}
                aria-label={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                aria-expanded={!isCollapsed}
                className="absolute -right-3 top-6 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors shadow-md z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden lg:flex cursor-pointer"
            >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>

            {/* Logo */}
            <div className={cn("flex items-center mb-4 shrink-0", isCollapsed ? "justify-center px-0" : "px-2")}>
                {isCollapsed ? (
                    <Logo size="md" variant="icon" animated />
                ) : (
                    <Logo size="md" variant="full" animated className="animate-in fade-in duration-200" />
                )}
            </div>

            {/* Main Upper Navigation (Scrollable) */}
            <nav aria-label="Main navigation" className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar min-h-0 py-1">
                {/* Loading skeleton while permissions are being fetched */}
                {permissionsLoading && !myPermissions && user?.role !== 'ADMIN' && (
                    <div className="space-y-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div
                                key={i}
                                className={`h-10 bg-muted/70 rounded-xl animate-pulse ${isCollapsed ? 'w-11 mx-auto' : 'w-full'}`}
                                style={{ animationDelay: `${i * 60}ms` }}
                            />
                        ))}
                    </div>
                )}
                {(!permissionsLoading || myPermissions || user?.role === 'ADMIN') && navigation.map((entry) => {
                    if (isGroup(entry)) {
                        return (
                            <NavGroupComponent
                                key={entry.id}
                                group={entry}
                                isExpanded={entry.id === 'request_center' ? true : (expandedGroups[entry.id] ?? false)}
                                onToggle={() => toggleGroup(entry.id)}
                                isCollapsed={isCollapsed}
                                groupBadge={getGroupBadge(entry)}
                                getItemBadge={getItemBadge}
                            />
                        );
                    }

                    // Standalone nav item (e.g. Dashboard)
                    return (
                        <StandaloneNavLink
                            key={entry.path}
                            entry={entry}
                            isCollapsed={isCollapsed}
                            itemBadge={getItemBadge(entry.key)}
                        />
                    );
                })}
            </nav>

            {/* Bottom Section: Settings + User Profile */}
            <div className="pt-2 pb-6 lg:pb-1 mt-auto border-t border-border/70 flex flex-col gap-1 shrink-0 safe-area-pb">
                {/* Settings pinned above user profile */}
                {settingsItem && (
                    <StandaloneNavLink
                        entry={settingsItem}
                        isCollapsed={isCollapsed}
                        itemBadge={getItemBadge('settings')}
                    />
                )}

                {/* User Profile & Logout */}
                {isCollapsed ? (
                    <div className="flex flex-col items-center gap-2 pt-2">
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <NavLink to="/settings" className="relative cursor-pointer flex justify-center py-0.5" aria-label="Profile Settings">
                                        <UserAvatar useCurrentUser size="md" />
                                    </NavLink>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={14} className="bg-popover text-popover-foreground rounded-xl shadow-xl border border-border/80 px-3 py-2 text-xs whitespace-nowrap z-50">
                                    <p className="font-semibold">{user?.fullName}</p>
                                    <p className="text-[10px] text-muted-foreground capitalize">{user?.role?.toLowerCase()?.replace(/_/g, ' ')}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="relative flex justify-center py-0.5">
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            aria-label="Logout"
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                                        >
                                            <LogOut className="w-4 h-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={14} className="bg-popover text-destructive rounded-lg shadow-lg border border-border/80 px-2.5 py-1 text-xs font-semibold whitespace-nowrap z-50">
                                    Logout
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/30 border border-border/40 mt-1">
                        <NavLink to="/settings" className="flex items-center gap-2.5 flex-1 min-w-0 group/user cursor-pointer" title="Settings / Profile">
                            <UserAvatar useCurrentUser size="md" className="group-hover/user:ring-2 group-hover/user:ring-primary/50 transition-all" />
                            <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                                <p className="text-sm font-semibold text-foreground truncate group-hover/user:text-primary transition-colors">{user?.fullName}</p>
                                <p className="text-xs text-muted-foreground font-medium truncate capitalize">{user?.role?.toLowerCase()?.replace(/_/g, ' ')}</p>
                            </div>
                        </NavLink>
                        <button
                            type="button"
                            onClick={handleLogout}
                            title="Logout"
                            aria-label="Logout"
                            className="p-2 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive shrink-0 cursor-pointer"
                        >
                            <LogOut className="w-4 h-4 transition-transform group-hover:scale-110" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

