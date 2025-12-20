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
} from 'lucide-react';
import { useAuth } from '../../stores/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Logo } from '@/components/ui/Logo';

export const ManagerSidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/manager/dashboard' },
        { icon: Ticket, label: 'Tickets', path: '/manager/tickets' },
        { icon: Video, label: 'Zoom Calendar', path: '/manager/zoom-calendar' },
        { icon: BarChart3, label: 'Reports', path: '/manager/reports' },
        { icon: BookOpen, label: 'Knowledge Base', path: '/manager/kb' },
    ];

    return (
        <aside
            className={cn(
                "glass-card-subtle h-screen flex flex-col transition-all duration-300 relative",
                isCollapsed ? "w-20 p-4" : "w-64 p-6"
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
                className="absolute -right-3 top-10 w-6 h-6 glass-card border border-white/40 dark:border-white/10 rounded-full flex items-center justify-center text-slate-500 hover:text-primary transition-colors shadow-sm z-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary hidden lg:flex"
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
                    <div className="flex items-center gap-2 px-3 py-2 text-xs glass-card rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
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
                                "flex items-center gap-3 rounded-2xl transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 glass-hover-scale",
                                isCollapsed ? "justify-center p-3" : "px-4 py-3",
                                isActive
                                    ? 'bg-white/80 dark:bg-slate-800/80 text-primary shadow-sm backdrop-blur-sm border border-white/50 dark:border-slate-700/50'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-white/40 dark:hover:bg-slate-800/40 hover:text-slate-800 dark:hover:text-white'
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
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user?.fullName}</p>
                            <p className="text-xs text-primary dark:text-primary truncate font-medium">Manager</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Logout" : undefined}
                    aria-label="Logout"
                    className={cn(
                        "w-full flex items-center gap-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2",
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
