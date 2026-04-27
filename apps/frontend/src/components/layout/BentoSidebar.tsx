import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
    DollarSign,
    KeyRound,
    MonitorSmartphone,
    FileText,
    PackageSearch,
    PackageCheck,
    LucideIcon,
    Wrench
} from 'lucide-react';
import { useAuth, performLogout } from '../../stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Logo } from '@/components/ui/Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { useMyPermissions } from '@/hooks/usePermissions';
import { usePermissions as useIctPermissions } from '@/features/hardware-request/hooks/usePermissions';
import { usePendingApprovals } from '@/features/request-center/api/eform-request.api';

// Detect if user is on Mac
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

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

// Collapsible Nav Group Component
const NavGroupComponent: React.FC<{
    group: NavGroup;
    isExpanded: boolean;
    onToggle: () => void;
    isCollapsed: boolean;
    pendingCount?: number;
}> = ({ group, isExpanded, onToggle, isCollapsed, pendingCount }) => {
    const location = useLocation();
    const hasActiveChild = group.items.some(item => location.pathname.startsWith(item.path));

    // When sidebar is collapsed, show only first item's icon as group representative
    if (isCollapsed) {
        return (
            <div className="relative group/nav">
                <button
                    onClick={onToggle}
                    title={group.label}
                    className={cn(
                        "w-full flex items-center justify-center p-3 rounded-lg transition-[opacity,transform,colors] duration-200 ease-out relative",
                        hasActiveChild
                            ? 'bg-primary text-white font-semibold shadow-md dark:bg-primary/90'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/40 dark:hover:text-slate-200 hover:translate-x-0.5'
                    )}
                >
                    <group.icon className="w-5 h-5" />
                    {pendingCount && pendingCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
                    )}
                </button>
                {/* Tooltip with group items */}
                <div className="absolute left-full ml-2 top-0 hidden group-hover/nav:block z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 min-w-[180px]">
                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {group.label}
                        </div>
                        {group.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-lg relative",
                                        isActive
                                            ? 'bg-primary text-white font-medium shadow-sm'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:translate-x-0.5'
                                    )
                                }
                            >
                                <item.icon className="w-4 h-4" />
                                {item.label}
                                {item.key === 'eform_access' && pendingCount && pendingCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {pendingCount}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {/* Group Header */}
            <button
                onClick={onToggle}
                className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-150 group relative",
                    hasActiveChild
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                )}
            >
                <div className={cn("w-0.5 h-3 rounded-full mr-1 transition-colors", hasActiveChild ? "bg-primary" : "bg-primary/40")} />
                <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                    {group.label}
                </span>
                {!isExpanded && pendingCount && pendingCount > 0 && (
                    <span className="mr-2 w-2 h-2 bg-red-500 rounded-full" />
                )}
                <ChevronDown
                    className={cn(
                        "w-4 h-4 transition-transform duration-200 text-slate-400",
                        isExpanded ? 'rotate-0' : '-rotate-90'
                    )}
                />
            </button>

            {/* Group Items */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="pl-4 space-y-1">
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        cn(
                                            "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-150 group/item relative",
                                            isActive
                                                ? 'bg-primary text-white font-semibold shadow-md dark:bg-primary/90'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/40 dark:hover:text-slate-200 hover:translate-x-0.5'
                                        )
                                    }
                                >
                                    <item.icon className="w-4 h-4 shrink-0" />
                                    <span className="font-medium text-sm">{item.label}</span>
                                    {item.key === 'eform_access' && pendingCount && pendingCount > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                            {pendingCount}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const BentoSidebar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Fetch pending approvals for managers/admins to show badge count
    const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN' || user?.role === 'AGENT';
    const { data: pendingApprovals } = usePendingApprovals();
    const pendingCount = isManagerOrAdmin ? pendingApprovals?.length : 0;

    // Fetch user's feature permissions for sidebar filtering (only if user has custom preset)
    const { data: myPermissions, isLoading: permissionsLoading } = useMyPermissions();
    const { isIctRole, isIctLead } = useIctPermissions();

    // ============================================
    // DATA-DRIVEN NAVIGATION FROM pageAccess
    // ============================================

    // Navigation configuration - ALL menu items defined here
    const NAVIGATION_CONFIG = [
        // Core items
        { type: 'item', key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },

        // Request Center group
        {
            type: 'group',
            id: 'request_center',
            label: 'Request Center',
            icon: PackageSearch,
            items: [
                { key: 'tickets', icon: Ticket, label: 'Tickets', path: '/tickets/list' },
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
                { key: 'notifications', icon: Bell, label: 'Notifications', path: '/notifications' },
                { key: 'reports', icon: BarChart3, label: 'Reports', path: '/reports' },
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
                { key: 'workloads', icon: Activity, label: 'Workloads', path: '/workloads' },
                { key: 'automation', icon: Zap, label: 'Automation', path: '/automation' },
                { key: 'audit_logs', icon: Shield, label: 'Audit Logs', path: '/audit-logs' },
                { key: 'system_health', icon: Activity, label: 'System Health', path: '/system-health' },
            ]
        },

        // Settings (Admin only, standalone item)
        { type: 'item', key: 'settings', icon: Settings, label: 'Settings', path: '/settings', adminOnly: true },
    ] as const;

    // Page access check - uses pageAccess from applied preset
    const canAccessPage = (pageKey: string): boolean => {
        // ADMIN always has full access
        if (user?.role === 'ADMIN') return true;

        // Check pageAccess from backend (applied preset)
        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        // Fallback: role-based defaults (minimal access - preset overrides this)
        // MUST match permissions.service.ts page definitions (USER_PAGES, AGENT_PAGES, MANAGER_PAGES)
        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'lost_items', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads'],
        };

        const userRole = (user?.role || 'USER') as string;
        const allowedPages = roleDefaults[userRole] || roleDefaults['USER'];
        return allowedPages.includes(pageKey);
    };

    // Build navigation from config + pageAccess (fully dynamic)
    const buildNavigation = (): NavEntry[] => {
        const nav: NavEntry[] = [];

        for (const entry of NAVIGATION_CONFIG) {
            if (entry.type === 'item') {
                // Admin-only items
                if ('adminOnly' in entry && entry.adminOnly && user?.role !== 'ADMIN') {
                    continue;
                }
                // Check page access
                if (canAccessPage(entry.key)) {
                    nav.push({ key: entry.key, icon: entry.icon, label: entry.label, path: entry.path });
                }
            } else if (entry.type === 'group') {
                // Admin-only groups
                if ('adminOnly' in entry && entry.adminOnly && user?.role !== 'ADMIN') {
                    continue;
                }

                // Filter group items by pageAccess
                const visibleItems = entry.items.filter(item => {
                    if ('adminOnly' in entry && entry.adminOnly) {
                        // Admin group - all items visible for admin
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

    // Load expanded groups from localStorage
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('sidebar-expanded-groups');
        return saved ? JSON.parse(saved) : { resources: true, management: true, administration: true };
    });

    // Save expanded groups to localStorage
    useEffect(() => {
        localStorage.setItem('sidebar-expanded-groups', JSON.stringify(expandedGroups));
    }, [expandedGroups]);

    // Auto-expand group containing active route
    useEffect(() => {
        const allGroups = buildNavigation();
        allGroups.forEach(entry => {
            if (isGroup(entry)) {
                const hasActiveChild = entry.items.some(item => location.pathname.startsWith(item.path));
                if (hasActiveChild && !expandedGroups[entry.id]) {
                    setExpandedGroups(prev => ({ ...prev, [entry.id]: true }));
                }
            }
        });
    }, [location.pathname]);

    const handleLogout = async () => {
        await performLogout();
        navigate('/login');
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const navigation = buildNavigation();

    return (
        <aside
            className={cn(
                "h-screen flex flex-col transition-[opacity,transform,colors] duration-200 ease-out relative z-10",
                "sidebar-frosted",
                isCollapsed ? "w-20 p-4" : "w-64 p-6"
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
                className="absolute -right-3 top-10 w-7 h-7 bg-card dark:bg-slate-800 border-2 border-primary/20 rounded-lg flex items-center justify-center text-gray-600 dark:text-slate-400 hover:text-primary transition-colors shadow-sm z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden lg:flex"
            >
                {isCollapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
            </button>

            {/* Logo */}
            <div className={cn("flex items-center gap-3 mb-6", isCollapsed ? "justify-center px-0" : "px-2")}>
                {isCollapsed ? (
                    <Logo size="md" variant="icon" animated />
                ) : (
                    <Logo size="md" variant="full" animated className="animate-in fade-in duration-300" />
                )}
            </div>

            {/* Command Palette Hint */}
            {!isCollapsed && (
                <div className="px-2 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-slate-500 bg-muted/50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                        <Search className="w-3 h-3" />
                        <span>Press</span>
                        <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded text-[10px] font-mono shadow-sm">
                            {isMac() ? '⌘' : 'Ctrl'}+K
                        </kbd>
                        <span>to search</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
                {/* Loading skeleton while permissions are being fetched */}
                {permissionsLoading && !myPermissions && user?.role !== 'ADMIN' && (
                    <div className="space-y-1" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div
                                key={i}
                                className={`h-11 bg-slate-200 dark:bg-slate-700/50 rounded-2xl animate-pulse ${isCollapsed ? 'w-11 mx-auto' : 'w-full'
                                    }`}
                                style={{ animationDelay: `${i * 60}ms` }}
                            />
                        ))}
                    </div>
                )}
                {(!permissionsLoading || myPermissions || user?.role === 'ADMIN') && navigation.map((entry, index) => {
                    if (isGroup(entry)) {
                        return (
                            <NavGroupComponent
                                key={entry.id}
                                group={entry}
                                isExpanded={expandedGroups[entry.id] ?? true}
                                onToggle={() => toggleGroup(entry.id)}
                                isCollapsed={isCollapsed}
                                pendingCount={entry.id === 'request_center' ? pendingCount : undefined}
                            />
                        );
                    }

                    // Regular nav item (ungrouped)
                    return (
                        <NavLink
                            key={entry.path}
                            to={entry.path}
                            title={isCollapsed ? entry.label : undefined}
                            aria-label={entry.label}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-lg transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 glass-hover-scale",
                                    isCollapsed ? "justify-center p-3" : "px-4 py-3",
                                    isActive
                                        ? 'bg-primary text-white font-semibold shadow-md dark:bg-primary/90'
                                        : 'text-slate-600 font-medium dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/40 dark:hover:text-slate-200 transition-colors hover:translate-x-0.5'
                                )
                            }
                        >
                            <entry.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                            {!isCollapsed && (
                                <span className="font-medium animate-in fade-in duration-300 whitespace-nowrap">
                                    {entry.label}
                                </span>
                            )}
                            {!isCollapsed && entry.key === 'eform_access' && pendingCount && pendingCount > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                    {pendingCount}
                                </span>
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Footer / User Profile */}
            <div className="pt-4 pb-2 mt-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center px-0" : "px-4 py-2")}>
                    <UserAvatar useCurrentUser size="md" />
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.fullName}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate capitalize">{user?.role?.toLowerCase()}</p>
                        </div>
                    )}
                    {/* Logout Button - Inline with profile */}
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        aria-label="Logout"
                        className={cn(
                            "p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shrink-0",
                            isCollapsed && "mt-2"
                        )}
                    >
                        <LogOut className="w-5 h-5 transition-transform" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
