import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, PlusCircle, LogOut, BookOpen, Settings, Menu, X, Video, MonitorSmartphone, FileText, PackageSearch } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAuth, performLogout } from '../../stores/useAuth';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Logo } from '../ui/Logo';
import { UserAvatar } from '../ui/UserAvatar';
import { FeatureErrorBoundary } from '../ui/FeatureErrorBoundary';
import { useMyPermissions } from '@/hooks/usePermissions';

// Page transition variants - optimized for performance (no blur)
const pageVariants: Variants = {
    initial: {
        opacity: 0,
    },
    animate: {
        opacity: 1,
        transition: {
            duration: 0.15,
            ease: 'easeOut'
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.1,
            ease: 'easeIn'
        }
    }
};

// Nav item definition with optional pageAccess key
interface ClientNavItem {
    path: string;
    label: string;
    icon: React.ElementType;
    pageKey?: string; // If set, item is filtered by pageAccess from preset
}

export const ClientLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const { data: myPermissions } = useMyPermissions();

    const handleLogout = async () => {
        await performLogout();
        navigate('/login');
    };

    // All possible nav items — items with pageKey are filtered by preset pageAccess
    const ALL_NAV_ITEMS: ClientNavItem[] = [
        { path: '/client/my-tickets', label: 'My Tickets', icon: Ticket },
        { path: '/client/hardware-requests', label: 'Hardware Requests', icon: MonitorSmartphone, pageKey: 'hardware_requests' },
        { path: '/client/eform-access', label: 'E-Form Access', icon: FileText, pageKey: 'eform_access' },
        { path: '/client/lost-items', label: 'Lost Items', icon: PackageSearch, pageKey: 'lost_items' },
        { path: '/client/zoom-calendar', label: 'Zoom Calendar', icon: Video, pageKey: 'zoom_calendar' },
        { path: '/client/kb', label: 'Help Center', icon: BookOpen, pageKey: 'knowledge_base' },
        { path: '/client/profile', label: 'Profile', icon: Settings },
    ];

    // Filter nav items by pageAccess:
    // - Items without pageKey are always visible (core features)
    // - Items with pageKey: show only if pageAccess[key] === true
    //   If pageAccess not yet loaded, show all (avoids flash of missing items)
    const navItems = ALL_NAV_ITEMS.filter(item => {
        if (!item.pageKey) return true; // Always visible
        if (!myPermissions?.pageAccess) return true; // Still loading — show all temporarily
        return myPermissions.pageAccess[item.pageKey] === true;
    });

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="min-h-screen app-background-blobs bg-slate-50 dark:bg-slate-900">
            {/* Navbar */}
            <nav className="glass-card-elevated sticky top-0 z-50">
                <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/client" className="flex items-center gap-2">
                                <Logo size="sm" variant="full" />
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex md:items-center md:space-x-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 ${isActive(item.path)
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Right Side */}
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <NotificationPopover />

                            {/* User Menu */}
                            <div className="hidden md:flex items-center gap-3 ml-2">
                                <div className="flex items-center gap-2">
                                    <UserAvatar
                                        user={user}
                                        size="sm"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {user?.fullName || 'User'}
                                    </span>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                    title="Logout"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                            >
                                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="px-4 py-3 space-y-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${isActive(item.path)
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
                            >
                                <LogOut className="w-5 h-5" />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-8">
                <FeatureErrorBoundary featureName="Client Portal">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            variants={pageVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </FeatureErrorBoundary>
            </main>


            {/* Footer */}
            <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-6 mt-auto">
                <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                        © {new Date().getFullYear()} iDesk Enterprise Platform. Need help? Contact IT Support.
                    </p>
                </div>
            </footer>
        </div>
    );
};
