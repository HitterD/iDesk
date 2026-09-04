import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { BentoSidebar } from './BentoSidebar';
import { BentoTopbar } from './BentoTopbar';
import { MobileBottomNav } from './MobileBottomNav';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/hooks/useKeyboardShortcuts';
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette';
import { Logo } from '@/components/ui/Logo';
import { InAppNotificationToast } from '@/components/notifications/InAppNotificationToast';
import { CriticalNotificationBanner } from '@/components/notifications/CriticalNotificationBanner';
import { useAuth } from '@/stores/useAuth';

// Page transition variants - optimized for performance (no blur)
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

export const BentoLayout = () => {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const { isOpen: isCommandOpen, close: closeCommand } = useCommandPalette();
    const justLoggedIn = useAuth((state) => state.justLoggedIn);
    const setJustLoggedIn = useAuth((state) => state.setJustLoggedIn);

    // Reset ephemeral justLoggedIn after entrance animation
    useEffect(() => {
        if (justLoggedIn) {
            const timer = setTimeout(() => {
                setJustLoggedIn(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [justLoggedIn, setJustLoggedIn]);

    // Auto-close mobile drawer when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    // Initialize keyboard shortcuts with custom actions
    useKeyboardShortcuts([
        { key: '?', shift: true, action: () => setShowShortcutsHelp(true), description: 'Show shortcuts help' },
    ]);

    return (
        <>
            {/* Skip Link for Accessibility */}
            <a
                href="#main-content"
                className="skip-link focus:top-4 focus:left-4 rounded-lg"
            >
                Skip to main content
            </a>

            <div className="flex h-screen premium-bg-container text-slate-800 dark:text-slate-100 font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300">
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[55] lg:hidden animate-backdrop-in"
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
                        "fixed lg:relative inset-y-0 left-0 z-[60] transition-transform duration-300 transform lg:translate-x-0",
                        isMobileMenuOpen
                            ? "translate-x-0 w-[84vw] max-w-[320px] shadow-2xl rounded-r-3xl overflow-hidden"
                            : "-translate-x-full lg:translate-x-0 hidden lg:block"
                    )}
                >
                    <div className="h-full bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent flex flex-col">
                        <BentoSidebar onNavigate={() => setIsMobileMenuOpen(false)} />
                    </div>
                    {/* Mobile close button */}
                    <button
                        className="absolute top-4 right-4 p-2 lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-[70] cursor-pointer"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
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

                    <motion.div
                        initial={justLoggedIn ? { y: -16, opacity: 0 } : false}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                        className="hidden lg:block"
                    >
                        <BentoTopbar />
                    </motion.div>

                    {/* Main content area - conditionally remove padding and scroll for full-screen pages */}
                    {(() => {
                        const isKanban = location.pathname === '/kanban';
                        const isZoomCalendar = location.pathname === '/zoom-calendar' || location.pathname === '/manager/zoom-calendar';
                        const isTicketDetail = location.pathname.startsWith('/tickets/') && 
                            !['/tickets/list', '/tickets/create', '/tickets/oracle-k2', '/tickets/web-developer', '/tickets/mobile-developer'].includes(location.pathname);

                        if (isTicketDetail) {
                            // Full-screen detail mode: child controls its own height and scrolling
                            return (
                                <main id="main-content" className="flex-1 overflow-hidden">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={location.pathname}
                                            variants={pageVariants}
                                            initial={justLoggedIn ? { opacity: 0, y: 16, scale: 0.98 } : "initial"}
                                            animate={justLoggedIn ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.08 } } : "animate"}
                                            exit="exit"
                                            className="w-full h-full"
                                        >
                                            <Outlet />
                                        </motion.div>
                                    </AnimatePresence>
                                </main>
                            );
                        }

                        if (isKanban || isZoomCalendar) {
                            // Kanban board & Zoom calendar mode: fit full height so header is sticky and grid scrolls internally
                            return (
                                <main
                                    id="main-content"
                                    className="flex-1 overflow-hidden p-3 lg:px-6 lg:pt-2 lg:pb-3 flex flex-col min-h-0"
                                >
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={location.pathname}
                                            variants={pageVariants}
                                            initial={justLoggedIn ? { opacity: 0, y: 16, scale: 0.98 } : "initial"}
                                            animate={justLoggedIn ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.08 } } : "animate"}
                                            exit="exit"
                                            className="w-full h-full flex flex-col min-h-0"
                                        >
                                            <Outlet />
                                        </motion.div>
                                    </AnimatePresence>
                                </main>
                            );
                        }

                        // Normal mode: padded, scrollable main area
                        return (
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
                        );
                    })()}

                </div>

                {/* Mobile Bottom Navigation */}
                <MobileBottomNav />

                {/* Command Palette */}
                <CommandPalette isOpen={isCommandOpen} onClose={closeCommand} />

                {/* Keyboard Shortcuts Help Modal */}
                <KeyboardShortcutsHelp
                    isOpen={showShortcutsHelp}
                    onClose={() => setShowShortcutsHelp(false)}
                />

                {/* In-App Notification Toasts */}
                <InAppNotificationToast />

                {/* Critical Notification Banner */}
                <CriticalNotificationBanner />
            </div>
        </>
    );
};

export default BentoLayout;
