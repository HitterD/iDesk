import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { BentoSidebar } from './BentoSidebar';
import { ShellBrand } from './SidebarNavigation';
import { BentoTopbar } from './BentoTopbar';
import { MobileBottomNav } from './MobileBottomNav';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '@/hooks/useKeyboardShortcuts';
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette';
import { InAppNotificationToast } from '@/components/notifications/InAppNotificationToast';
import { CriticalNotificationBanner } from '@/components/notifications/CriticalNotificationBanner';
import { useAuth } from '@/stores/useAuth';

/** One-off entrance right after login; route changes use the CSS `.idesk-page-enter` (token-timed). */
const LOGIN_FROM = { opacity: 0, y: 16, scale: 0.98 } as const;
const LOGIN_TO = { opacity: 1, y: 0, scale: 1 } as const;
const LOGIN_TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.08 } as const;

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

    // The scroll container outlives routes: start every page at the top, instantly (not scroll-smooth).
    const mainRef = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        mainRef.current?.scrollTo?.({ top: 0, behavior: 'instant' });
    }, [location.pathname]);

    // Keyed on the path so each page gets the CSS entrance without waiting for the previous one to exit
    // (an exiting wrapper would re-render the *new* Outlet and mount the page twice).
    const renderPage = (className: string) => (
        <motion.div initial={justLoggedIn ? LOGIN_FROM : false} animate={LOGIN_TO} transition={LOGIN_TRANSITION} className={className}>
            <div key={location.pathname} className={cn('idesk-page-enter print:animate-none', className)}>
                <Outlet />
            </div>
        </motion.div>
    );

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

            <div className="idesk-shell flex h-screen font-sans overflow-hidden selection:bg-primary/30 transition-colors duration-300 print:h-auto print:overflow-visible print:block">
                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[55] lg:hidden animate-backdrop-in print:hidden"
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
                        "fixed lg:relative inset-y-0 left-0 z-[60] transition-transform duration-300 transform lg:translate-x-0 print:hidden",
                        isMobileMenuOpen
                            ? "idesk-shell translate-x-0 w-[84vw] max-w-[320px] shadow-2xl rounded-r-3xl overflow-hidden"
                            : "-translate-x-full lg:translate-x-0 hidden lg:block"
                    )}
                >
                    <div className="h-full flex flex-col">
                        <BentoSidebar onNavigate={() => setIsMobileMenuOpen(false)} />
                    </div>
                    {/* Mobile close button */}
                    <button
                        className="absolute top-4 right-3 p-2 lg:hidden text-[hsl(var(--idesk-chrome-muted))] hover:text-white rounded-xl hover:bg-white/10 transition-colors z-[70] cursor-pointer"
                        onClick={() => setIsMobileMenuOpen(false)}
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </motion.aside>

                <div className="flex-1 flex flex-col min-w-0 print:block print:w-full">
                    {/* Mobile header */}
                    <div className="idesk-shell-chrome lg:hidden flex items-center justify-between px-3 py-2.5 print:hidden">
                        <button
                            className="p-2 text-white rounded-lg hover:bg-white/10 transition-colors touch-target"
                            onClick={() => setIsMobileMenuOpen(true)}
                            aria-label="Open menu"
                            aria-expanded={isMobileMenuOpen}
                        >
                            <Menu className="w-6 h-6" aria-hidden="true" />
                        </button>
                        <ShellBrand />
                        <div className="w-10" aria-hidden="true" /> {/* Spacer for centering */}
                    </div>

                    <motion.div
                        initial={justLoggedIn ? { y: -16, opacity: 0 } : false}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                        className="hidden lg:block print:hidden"
                    >
                        <BentoTopbar />
                    </motion.div>

                    {/* Main content area on the rounded sheet - conditionally remove padding and scroll for full-screen pages */}
                    <div className="idesk-sheet flex-1 flex flex-col min-h-0 overflow-hidden print:block print:overflow-visible">
                    {(() => {
                        const isKanban = location.pathname === '/kanban';
                        const isZoomCalendar = location.pathname === '/zoom-calendar' || location.pathname === '/manager/zoom-calendar';
                        const isTicketDetail = location.pathname.startsWith('/tickets/') && 
                            !['/tickets/list', '/tickets/create', '/tickets/oracle-k2', '/tickets/web-developer', '/tickets/mobile-developer'].includes(location.pathname);

                        if (isTicketDetail) {
                            // Full-screen detail mode: child controls its own height and scrolling
                            return (
                                <main ref={mainRef} id="main-content" className="flex-1 overflow-hidden">
                                    {renderPage('w-full h-full')}
                                </main>
                            );
                        }

                        if (isKanban || isZoomCalendar) {
                            // Kanban board & Zoom calendar mode: fit full height so header is sticky and grid scrolls internally
                            return (
                                <main
                                    ref={mainRef}
                                    id="main-content"
                                    className="flex-1 overflow-hidden p-3 lg:px-3.5 lg:pt-3 lg:pb-3 flex flex-col min-h-0"
                                >
                                    {renderPage('w-full h-full flex flex-col min-h-0')}
                                </main>
                            );
                        }

                        // Normal mode: padded, scrollable main area
                        return (
                            <main
                                ref={mainRef}
                                id="main-content"
                                className="flex-1 overflow-y-auto px-3 [--flow-gutter:0.75rem] pt-3 pb-24 lg:px-3.5 lg:pt-3.5 lg:pb-6 scroll-smooth scrollbar-custom print:h-auto print:overflow-visible print:p-0 print:m-0 print:block"
                            >
                                {renderPage('w-full print:w-full print:block')}
                            </main>
                        );
                    })()}
                    </div>
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="print:hidden">
                    <MobileBottomNav />
                </div>

                {/* Command Palette */}
                <div className="print:hidden">
                    <CommandPalette isOpen={isCommandOpen} onClose={closeCommand} />
                </div>

                {/* Keyboard Shortcuts Help Modal */}
                <div className="print:hidden">
                    <KeyboardShortcutsHelp
                        isOpen={showShortcutsHelp}
                        onClose={() => setShowShortcutsHelp(false)}
                    />
                </div>

                {/* In-App Notification Toasts */}
                <div className="print:hidden">
                    <InAppNotificationToast />
                </div>

                {/* Critical Notification Banner */}
                <div className="print:hidden">
                    <CriticalNotificationBanner />
                </div>
            </div>
        </>
    );
};

export default BentoLayout;
