import { useState } from 'react';
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
import { CriticalNotificationModal } from '@/components/notifications/CriticalNotificationModal';

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

export const BentoLayout = () => {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const { isOpen: isCommandOpen, close: closeCommand } = useCommandPalette();

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

            <div className="flex h-screen app-background-blobs bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300">
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-backdrop-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Sidebar - Hidden on mobile by default */}
                <aside className={cn(
                    "fixed lg:relative inset-y-0 left-0 z-50 transition-transform duration-300 lg:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <BentoSidebar />
                    {/* Mobile close button */}
                    <button
                        className="absolute top-4 right-4 p-2 lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X className="w-6 h-6" aria-hidden="true" />
                    </button>
                </aside>

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

                    <div className="hidden lg:block">
                        <BentoTopbar />
                    </div>

                    <main
                        id="main-content"
                        className="flex-1 overflow-y-auto p-4 lg:p-8 pt-2 pb-20 lg:pb-8 scroll-smooth scrollbar-custom"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={location.pathname}
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="w-full"
                            >
                                <Outlet />
                            </motion.div>
                        </AnimatePresence>
                    </main>
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

                {/* Critical Notification Modal - Fullscreen blocking for renewals */}
                <CriticalNotificationModal />
            </div>
        </>
    );
};
