import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Ticket,
    BarChart3,
    BookOpen,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Building2,
    Video,
    Bell,
    CalendarClock,
    Activity,
} from 'lucide-react';
import { useAuth, performLogout } from '../../stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Logo } from '@/components/ui/Logo';
import { useMyPermissions } from '@/hooks/usePermissions';

export const ManagerSidebar = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { data: myPermissions } = useMyPermissions();

    const handleLogout = async () => {
        await performLogout();
        navigate('/login');
    };

    // All possible nav items with their pageAccess key
    const ALL_NAV_ITEMS = [
        { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/manager/dashboard' },
        { key: 'workloads', icon: Activity, label: 'Agent Workloads', path: '/manager/workloads' },
        { key: 'tickets', icon: Ticket, label: 'Tickets', path: '/manager/tickets' },
        { key: 'zoom_calendar', icon: Video, label: 'Zoom Calendar', path: '/manager/zoom-calendar' },
        { key: 'reports', icon: BarChart3, label: 'Reports', path: '/manager/reports' },
        { key: 'knowledge_base', icon: BookOpen, label: 'Knowledge Base', path: '/manager/kb' },
        // Hidden by default (not in MANAGER preset) — shown only if custom preset grants access
        { key: 'notifications', icon: Bell, label: 'Notifications', path: '/manager/notifications' },
        { key: 'renewal', icon: CalendarClock, label: 'Renewal Hub', path: '/manager/renewal' },
    ];

    // Filter nav items based on pageAccess from applied preset
    const navItems = ALL_NAV_ITEMS.filter(item => {
        // While loading, show all items to avoid layout shift
        // Dashboard and workloads are core Manager features
        if (item.key === 'dashboard' || item.key === 'workloads') return true;
        
        // Fix: During logout or loading, myPermissions might be undefined
        if (!myPermissions?.pageAccess) return true;
        
        return myPermissions.pageAccess[item.key] === true;
    });

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
                className="absolute -right-3 top-10 w-6 h-6 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-full flex items-center justify-center text-gray-600 dark:text-slate-400 hover:text-primary transition-colors shadow-md z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden lg:flex"
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

            {/* Role Badge */}
            {!isCollapsed && (
                <div className="px-2 mb-6">
                    <div className="flex items-center gap-2 px-3 py-2 text-xs glass-card rounded-xl bg-gradient-to-r from-gray-100 to-gray-50 dark:from-slate-800 dark:to-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200/50 dark:border-slate-700">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">Manager Portal</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav aria-label="Manager navigation" className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        title={isCollapsed ? item.label : undefined}
                        aria-label={item.label}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-xl transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 glass-hover-scale",
                                isCollapsed ? "justify-center p-3" : "px-4 py-3",
                                isActive
                                    ? 'bg-primary/10 text-primary font-semibold dark:bg-primary/15'
                                    : 'text-slate-600 font-medium dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800/40 dark:hover:text-slate-200 transition-colors'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                        {!isCollapsed && (
                            <span className="font-medium animate-in fade-in duration-300 whitespace-nowrap">
                                {item.label}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer / User Profile */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className={cn("flex items-center gap-3 mb-2", isCollapsed ? "justify-center px-0" : "px-4 py-3")}>
                    <UserAvatar useCurrentUser size="md" />
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.fullName}</p>
                            <p className="text-xs text-primary dark:text-primary truncate font-medium">Manager</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Logout" : undefined}
                    aria-label="Logout"
                    className={cn(
                        "w-full flex items-center gap-3 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
                        isCollapsed ? "justify-center p-3" : "px-4 py-3"
                    )}
                >
                    <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform shrink-0" aria-hidden="true" />
                    {!isCollapsed && <span className="font-medium animate-in fade-in duration-300">Logout</span>}
                </button>
            </div>
        </aside>
    );
};
