import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, PlusCircle, LogOut, BookOpen, Settings, Menu, X, Home } from 'lucide-react';
import { useAuth } from '../../stores/useAuth';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { ThemeToggle } from '../ui/ThemeToggle';

export const ClientLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/client/my-tickets', label: 'My Tickets', icon: Ticket },
        { path: '/client/create', label: 'New Ticket', icon: PlusCircle },
        { path: '/client/kb', label: 'Help Center', icon: BookOpen },
        { path: '/client/profile', label: 'Profile', icon: Settings },
    ];

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Navbar */}
            <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/client" className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                    <Home className="w-5 h-5 text-slate-900" />
                                </div>
                                <span className="text-xl font-bold text-slate-900 dark:text-white">
                                    Help<span className="text-primary">Desk</span>
                                </span>
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
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                            isActive(item.path)
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
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                        {user?.fullName?.charAt(0) || 'U'}
                                    </div>
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
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                            isActive(item.path)
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
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-6 mt-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                        © {new Date().getFullYear()} HelpDesk Portal. Need help? Contact IT Support.
                    </p>
                </div>
            </footer>
        </div>
    );
};
