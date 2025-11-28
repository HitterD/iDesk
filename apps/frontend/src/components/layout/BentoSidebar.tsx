import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Ticket,
    Settings,
    Users,
    BarChart3,
    BookOpen,
    LogOut,
    Shield,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    Bell
} from 'lucide-react';
import { useAuth } from '../../stores/useAuth';
import { cn } from '@/lib/utils';

export const BentoSidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Ticket, label: 'Tickets', path: '/tickets/list' },
        { icon: BookOpen, label: 'Knowledge Base', path: '/kb' },
    ];

    if (user?.role === 'ADMIN' || user?.role === 'AGENT') {
        navItems.push(
            { icon: Bell, label: 'Notifications', path: '/notifications' }
        );
        if (user?.role === 'ADMIN') {
            navItems.push(
                { icon: Users, label: 'Agents', path: '/agents' },
                { icon: BarChart3, label: 'Reports', path: '/reports' },
                { icon: CalendarClock, label: 'Renewal', path: '/renewal' },
                { icon: Settings, label: 'Settings', path: '/settings' }
            );
        }
        navItems.push(
            { icon: Shield, label: 'SLA', path: '/sla' }
        );
    }

    return (
        <aside
            className={cn(
                "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-white/20 dark:border-slate-800 h-screen flex flex-col shadow-soft transition-all duration-300 relative",
                isCollapsed ? "w-20 p-4" : "w-64 p-6"
            )}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-10 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-primary transition-colors shadow-sm z-50"
            >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Logo */}
            <div className={cn("flex items-center gap-3 mb-10", isCollapsed ? "justify-center px-0" : "px-2")}>
                <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                    <span className="text-white font-bold text-xl">iD</span>
                </div>
                {!isCollapsed && (
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight animate-in fade-in duration-300">
                        iDesk
                    </h1>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        title={isCollapsed ? item.label : undefined}
                        className={({ isActive }) =>
                            cn(
                                "flex items-center gap-3 rounded-2xl transition-all duration-300 group",
                                isCollapsed ? "justify-center p-3" : "px-4 py-3",
                                isActive
                                    ? 'bg-muted text-blue-600 dark:text-blue-400 shadow-md shadow-blue-100 dark:shadow-none scale-105'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white hover:scale-105'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {!isCollapsed && (
                            <span className="font-medium animate-in fade-in duration-300 whitespace-nowrap">
                                {item.label}
                            </span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer / User Profile */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className={cn("flex items-center gap-3 mb-2", isCollapsed ? "justify-center px-0" : "px-4 py-3")}>
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-yellow-700 font-bold shrink-0">
                        {user?.fullName?.charAt(0) || 'U'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-in fade-in duration-300">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{user?.fullName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate capitalize">{user?.role?.toLowerCase()}</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={handleLogout}
                    title={isCollapsed ? "Logout" : undefined}
                    className={cn(
                        "w-full flex items-center gap-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-300 group",
                        isCollapsed ? "justify-center p-3" : "px-4 py-3"
                    )}
                >
                    <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform shrink-0" />
                    {!isCollapsed && <span className="font-medium animate-in fade-in duration-300">Logout</span>}
                </button>
            </div>
        </aside>
    );
};
