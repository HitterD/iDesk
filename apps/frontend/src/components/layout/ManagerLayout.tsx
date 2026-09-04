import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ManagerSidebar } from './ManagerSidebar';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { InAppNotificationToast } from '@/components/notifications/InAppNotificationToast';
import { CriticalNotificationBanner } from '@/components/notifications/CriticalNotificationBanner';
import { useAuth } from '@/stores/useAuth';

// Page transition variants
const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 8,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.2,
            ease: [0.23, 1, 0.32, 1]
        }
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.12,
            ease: [0.23, 1, 0.32, 1]
        }
    }
};

export const ManagerLayout = () => {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const justLoggedIn = useAuth((state) => state.justLoggedIn);
    const setJustLoggedIn = useAuth((state) => state.setJustLoggedIn);

    useEffect(() => {
        if (justLoggedIn) {
            const timer = setTimeout(() => {
                setJustLoggedIn(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [justLoggedIn, setJustLoggedIn]);

    return (
        <>
            {/* Skip Link for Accessibility */}
            <a
                href="#main-content"
                className="skip-link focus:top-4 focus:left-4 rounded-lg"
            >
                Skip to main content
            </a>

            <div className="flex h-screen app-background-blobs bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300">
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-backdrop-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar - Animated on first login entrance */}
                <motion.aside
                    initial={justLoggedIn ? { x: -28, opacity: 0 } : false}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                        "fixed lg:relative inset-y-0 left-0 z-50 transition-transform duration-300 lg:translate-x-0",
                        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                >
                    <ManagerSidebar />
                    {/* Mobile close button */}
                    <button
                        className="absolute top-4 right-4 p-2 lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X className="w-6 h-6" aria-hidden="true" />
                    </button>
                </motion.aside>

                <div className="flex-1 flex flex-col min-w-0">
                    {/* Mobile header */}
                    <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button
                            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-target"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Open menu"
                            aria-expanded={isMobileMenuOpen}
                        >
                            <Menu className="w-6 h-6" aria-hidden="true" />
                        </button>
                        <Logo size="sm" variant="full" />
                        <div className="w-10" /> {/* Spacer for centering */}
                    </div>

                    {/* Manager Topbar */}
                    <motion.div
                        initial={justLoggedIn ? { y: -16, opacity: 0 } : false}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                        className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm"
                    >
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-white">Manager Portal</h1>
                            <p className="text-sm text-slate-500">Overview semua site</p>
                        </div>
                    </motion.div>

                    <main
                        id="main-content"
                        className="flex-1 overflow-y-auto p-4 lg:p-8 pt-2 pb-20 lg:pb-8 scroll-smooth scrollbar-custom"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                variants={pageVariants}
                                initial={justLoggedIn ? { opacity: 0, y: 16, scale: 0.98 } : "initial"}
                                animate={justLoggedIn ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.08 } } : "animate"}
                                exit="exit"
                                className="w-full"
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>

                {/* In-App Notification Toasts */}
                <InAppNotificationToast />

                {/* Critical Notification Banner */}
                <CriticalNotificationBanner />
            </div>
        </>
    );
};

export default ManagerLayout;
