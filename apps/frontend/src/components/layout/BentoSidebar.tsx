import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    UserRound,
    Ticket,
    Settings,
    Users,
    BarChart3,
    BookOpen,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Bell,
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
    Trash2,
    Star,
    ClipboardCheck,
    HeartHandshake,
    LucideIcon
} from 'lucide-react';
import { isAgentRole } from '@/lib/roleHome';
import { useAuth, performLogout } from '../../stores/useAuth';
import { cn } from '@/lib/utils';
import { useMyPermissions } from '@/hooks/usePermissions';
import { usePermissions as useIctPermissions } from '@/features/hardware-request/hooks/usePermissions';
import { usePendingApprovals } from '@/features/request-center/api/eform-request.api';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useCsiActive } from '@/features/csi/hooks/useCsi';
import { useCsiOwnerReportAccess } from '@/features/csi/hooks/useCsiHc';
import { CSI_PATHS } from '@/features/csi/lib/useCsiBasePath';
import { csiAdminPath, CSI_ADMIN_PAGE_KEYS } from '@/features/csi/lib/csiAdmin';
import { canAdminCsi } from '@/features/csi/lib/useCsiAdminAccess';
import {
    SidebarNavigation,
    SidebarFooter,
    ShellBrand,
    isGroup,
    type BadgeInfo,
    type NavEntry,
    type NavGroup,
    type NavItem,
    type NavTone,
} from './SidebarNavigation';

/** Icon + tile hue for dynamic ticket modules, keyed by the module's configured icon name. */
const MODULE_ICON_STYLES: Record<string, { icon: LucideIcon; tone: NavTone }> = {
    Database: { icon: Database, tone: 'red' },
    Code2: { icon: Code2, tone: 'teal' },
    Smartphone: { icon: Smartphone, tone: 'teal-deep' },
    Network: { icon: Activity, tone: 'slate' },
    Server: { icon: Activity, tone: 'slate' },
    Shield: { icon: Shield, tone: 'navy' },
    Zap: { icon: Zap, tone: 'orange' },
};
const EXPANDED_GROUPS_STORAGE_KEY = 'sidebar-expanded-groups-v2';
const DEFAULT_MODULE_STYLE:{ icon: LucideIcon; tone: NavTone } = { icon: Ticket, tone: 'blue' };
/** Own-key lookup: module icon names are admin-supplied, so "constructor"/"toString" must not hit Object.prototype. */
const getModuleIconStyle = (iconName: unknown) =>
    typeof iconName === 'string' && Object.prototype.hasOwnProperty.call(MODULE_ICON_STYLES, iconName)
        ? MODULE_ICON_STYLES[iconName]
        : DEFAULT_MODULE_STYLE;

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

    // Any user can be picked as an E-Form approver, so the badge is not role-gated
    const { data: pendingApprovals } = usePendingApprovals();
    const pendingCount = pendingApprovals?.length ?? 0;

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
    // Survey entry exists only while an active survey targets this user (hidden while loading or on error).
    const { data: activeSurveys } = useCsiActive();
    const hasActiveSurvey = (activeSurveys?.length ?? 0) > 0;
    const hasOwnerReport = useCsiOwnerReportAccess();

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
    const isHcAdmin = user?.role === 'HC_ADMIN';

    const NAVIGATION_CONFIG = useMemo(() => [
        // Core items
        { 
            type: 'item', 
            key: 'my_dashboard', 
            icon: UserRound, 
            tone: 'gray',
            label: 'Dashboard Saya', 
            path: '/dashboard/me' 
        },
        { 
            type: 'item', 
            key: 'dashboard', 
            icon: LayoutDashboard, 
            tone: 'navy',
            label: isManager ? 'Dashboard' : 'Dashboard Tim', 
            path: isManager ? '/manager/dashboard' : '/dashboard',
            end: true,
        },

        // Request Center group
        {
            type: 'group',
            id: 'request_center',
            label: 'Request Center',
            icon: PackageSearch,
            tone: 'blue',
            items: [
                { 
                    key: 'tickets', 
                    icon: Ticket, 
                    tone: 'blue',
                    label: 'IT Support Tickets', 
                    path: isManager ? '/manager/tickets' : '/tickets/list' 
                },
                { key: 'oracle_k2_tickets', icon: Database, tone: 'red', label: 'Oracle K2 Request', path: '/tickets/oracle-k2' },
                { key: 'web_dev_tickets', icon: Code2, tone: 'teal', label: 'Web Developer Request', path: '/tickets/web-developer' },
                { key: 'mobile_dev_tickets', icon: Smartphone, tone: 'teal-deep', label: 'Mobile Developer Request', path: '/tickets/mobile-developer' },
                { key: 'hardware_requests', icon: MonitorSmartphone, tone: 'orange', label: 'Hardware Requests', path: '/hardware-requests' },
                { key: 'eform_access', icon: FileText, tone: 'mint', label: 'E-Form Access', path: '/eform-access' },
            ]
        },

        // Resources group
        {
            type: 'group',
            id: 'resources',
            label: 'Resources',
            icon: FolderOpen,
            tone: 'blue',
            quiet: true,
            items: [
                { key: 'zoom_calendar', icon: Video, tone: 'sky', label: 'Zoom Calendar', path: '/zoom-calendar' },
                { key: 'knowledge_base', icon: BookOpen, tone: 'brown', label: 'Knowledge Base', path: '/kb' },
            ]
        },

        // Management group
        {
            type: 'group',
            id: 'management',
            label: 'Management',
            icon: Briefcase,
            tone: 'navy',
            quiet: true,
            items: [
                { 
                    key: 'workloads', 
                    icon: Activity, 
                    tone: 'navy',
                    label: 'Workloads', 
                    path: isManager ? '/manager/workloads' : '/workloads' 
                },
                { 
                    key: 'reports', 
                    icon: BarChart3, 
                    tone: 'green',
                    label: 'Reports', 
                    path: isManager ? '/manager/reports' : '/reports' 
                },
                { key: 'notifications', icon: Bell, tone: 'red', label: 'Notifications', path: '/notifications' },
                { key: 'renewal', icon: CalendarClock, tone: 'orange', label: 'Renewal Hub', path: '/renewal' },
                { key: CSI_ADMIN_PAGE_KEYS.ict, icon: ClipboardCheck, tone: 'teal', label: 'Admin CSI ICT', path: csiAdminPath(isManager ? CSI_PATHS.manager : CSI_PATHS.staff, 'ict') },
            ]
        },

        // Human Capital group: HC administration modules (today only CSI HC); the whole sidebar of an HC_ADMIN.
        {
            type: 'group',
            id: 'human_capital',
            label: 'Human Capital',
            icon: HeartHandshake,
            tone: 'mint',
            items: [
                { key: CSI_ADMIN_PAGE_KEYS.hc, icon: ClipboardCheck, tone: 'mint', label: 'Admin CSI HC', path: csiAdminPath(isManager ? CSI_PATHS.manager : CSI_PATHS.staff, 'hc') },
            ]
        },

        // Administration group (Admin role only)
        {
            type: 'group',
            id: 'administration',
            label: 'Administration',
            icon: ShieldCheck,
            tone: 'slate',
            quiet: true,
            adminOnly: true,
            items: [
                { key: 'agents', icon: Users, tone: 'navy', label: 'Agents', path: '/agents' },
                { key: 'automation', icon: Zap, tone: 'orange', label: 'Automation', path: '/automation' },
                { key: 'audit_logs', icon: Shield, tone: 'slate', label: 'Audit Logs', path: '/audit-logs' },
                { key: 'system_health', icon: Activity, tone: 'green', label: 'System Health', path: '/system-health' },
                { key: 'data_wipe', icon: Trash2, tone: 'red', label: 'Hapus Data', path: '/data-wipe' },
            ]
        },
    ] as const, [isManager]);

    // Page access check - uses pageAccess from applied preset
    const canAccessPage = (pageKey: string): boolean => {
        // CSI admin keys never get the ADMIN bypass: the backend guard requires the explicit page key.
        if (pageKey === CSI_ADMIN_PAGE_KEYS.ict) return canAdminCsi(user?.role, myPermissions?.pageAccess, 'ict');
        if (pageKey === CSI_ADMIN_PAGE_KEYS.hc) return canAdminCsi(user?.role, myPermissions?.pageAccess, 'hc');

        // Personal dashboard exists only for agents (the API rejects everyone else)
        if (pageKey === 'my_dashboard' && !isAgentRole(user?.role)) return false;

        // ADMIN always has full access
        if (user?.role === 'ADMIN') return true;

        // Check pageAccess from backend (applied preset)
        if (myPermissions?.pageAccess) {
            return myPermissions.pageAccess[pageKey] === true;
        }

        // Fallback: role-based defaults
        const roleDefaults: Record<string, string[]> = {
            USER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications'],
            AGENT: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_OPERATIONAL_SUPPORT: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_ADMIN: ['my_dashboard', 'dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads'],
            AGENT_ORACLE: ['my_dashboard', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'notifications', 'reports'],
            AGENT_WEB_DEV: ['my_dashboard', 'web_dev_tickets', 'oracle_k2_tickets', 'mobile_dev_tickets', 'notifications', 'reports'],
            AGENT_MOBILE_DEV: ['my_dashboard', 'mobile_dev_tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'notifications', 'reports'],
            HC_ADMIN: ['notifications'],
            MANAGER: ['dashboard', 'tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'reports', 'knowledge_base', 'renewal', 'workloads', 'notifications'],
            ADMIN: ['dashboard', 'tickets', 'oracle_k2_tickets', 'web_dev_tickets', 'mobile_dev_tickets', 'hardware_requests', 'eform_access', 'zoom_calendar', 'knowledge_base', 'notifications', 'reports', 'renewal', 'workloads', 'agents', 'automation', 'audit_logs', 'system_health', 'data_wipe', 'settings'],
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
                    nav.push({ key: entry.key, icon: entry.icon, tone: entry.tone, label: entry.label, path: entry.path, end: 'end' in entry ? entry.end : undefined });
                }
            } else if (entry.type === 'group') {
                if ('adminOnly' in entry && entry.adminOnly && user?.role !== 'ADMIN') {
                    continue;
                }

                // HC administrators see only HC pages: no ticket queues (dynamic modules have no page key).
                if (entry.id === 'request_center' && isHcAdmin) continue;

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

                        const style = getModuleIconStyle(mod.icon);

                        return {
                            key,
                            icon: style.icon,
                            tone: style.tone,
                            label: mod.name,
                            path,
                        };
                    });

                    // Append static Request Center items
                    const otherRequestCenterItems = entry.items.filter((item) =>
                        ['hardware_requests', 'eform_access'].includes(item.key)
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
                            tone: entry.tone,
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
                        tone: entry.tone,
                        quiet: 'quiet' in entry ? entry.quiet : undefined,
                        items: visibleItems.map(item => ({
                            key: item.key,
                            icon: item.icon,
                            tone: item.tone,
                            label: item.label,
                            path: item.path
                        }))
                    });
                }
            }
        }

        if (hasActiveSurvey) {
            // No pageKey: eligibility is decided by the backend's active-survey list.
            nav.push({ key: 'csi', icon: Star, tone: 'teal', label: 'Survei Kepuasan', path: isManager ? CSI_PATHS.manager : CSI_PATHS.staff });
        } else if (hasOwnerReport) {
            nav.push({ key: 'csi_report', icon: BarChart3, tone: 'teal', label: 'Report CSI', path: `${isManager ? CSI_PATHS.manager : CSI_PATHS.staff}/report` });
        }

        return nav;
    };

    // Settings item (Anchored at bottom for all portal users to access profile & preferences)
    const settingsItem: NavItem = useMemo(() => {
        return { key: 'settings', icon: Settings, tone: 'gray', label: 'Settings', path: '/settings' };
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

    // Group open/closed choices, persisted per group. Groups without a saved value are open;
    // request_center is always open.
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem(EXPANDED_GROUPS_STORAGE_KEY);
        if (!saved) return { request_center: true };
        try {
            const parsed: unknown = JSON.parse(saved);
            const choices = parsed && typeof parsed === 'object' ? parsed as Record<string, boolean> : {};
            return { ...choices, request_center: true };
        } catch {
            return { request_center: true };
        }
    });

    useEffect(() => {
        localStorage.setItem(EXPANDED_GROUPS_STORAGE_KEY, JSON.stringify(expandedGroups));
    }, [expandedGroups]);

    // Re-open the group holding the active route; other groups keep the user's choice.
    useEffect(() => {
        const activeId = getActiveGroupId();
        if (activeId && activeId !== 'request_center') {
            setExpandedGroups(prev => (prev[activeId] === false ? { ...prev, [activeId]: true } : prev));
        }
    }, [location.pathname]);

    const handleLogout = async () => {
        await performLogout();
        navigate('/login', { replace: true });
    };

    // Each secondary group toggles independently; request_center stays open.
    const toggleGroup = (groupId: string) => {
        if (groupId === 'request_center') return;
        setExpandedGroups(prev => ({ ...prev, [groupId]: !(prev[groupId] ?? true) }));
    };

    const navigation = buildNavigation();
    const isNavLoading = permissionsLoading && !myPermissions && user?.role !== 'ADMIN';
    const isGroupExpanded = (groupId: string) =>
        groupId === 'request_center' ? true : (expandedGroups[groupId] ?? true);
    const toggleLabel = isCollapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)';

    return (
        <aside
            className={cn(
                'idesk-sidebar h-full flex flex-col transition-[width,padding] duration-200 ease-out relative z-10 select-none',
                isCollapsed ? 'is-collapsed w-20 py-3 pl-2' : 'w-full lg:w-64 pt-3.5 pb-2.5 pl-2.5'
            )}
        >
            {/* Brand + collapse toggle */}
            <div className={cn('flex items-center gap-1 mb-3 shrink-0 pr-2.5', isCollapsed ? 'flex-col' : 'pl-1.5')}>
                <ShellBrand collapsed={isCollapsed} className="flex-1 min-w-0" />
                <button
                    type="button"
                    onClick={handleToggleCollapse}
                    aria-label={toggleLabel}
                    title={toggleLabel}
                    aria-expanded={!isCollapsed}
                    className="nav-collapse-btn hidden lg:grid"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
                </button>
            </div>

            <SidebarNavigation
                entries={navigation}
                isCollapsed={isCollapsed}
                isLoading={isNavLoading}
                activePath={location.pathname}
                isGroupExpanded={isGroupExpanded}
                onToggleGroup={toggleGroup}
                getItemBadge={getItemBadge}
                getGroupBadge={getGroupBadge}
                onNavigate={onNavigate}
            />

            <SidebarFooter
                settingsItem={settingsItem}
                settingsBadge={getItemBadge('settings')}
                isCollapsed={isCollapsed}
                user={user}
                onLogout={handleLogout}
                onNavigate={onNavigate}
            />
        </aside>
    );
};
