import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, BookOpen, Settings, Video, MonitorSmartphone, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth, performLogout } from '../../stores/useAuth';
import { FeatureErrorBoundary } from '../ui/FeatureErrorBoundary';
import { UserGuidebookModal } from '@/features/client/components/UserGuidebookModal';
import { useMyPermissions } from '@/hooks/usePermissions';
import { ClientTopbar, type ClientNavItem } from './ClientTopbar';
import { ClientBottomNav } from './ClientBottomNav';
import { CLIENT_ROUTES } from '@/config/routes';

const CLIENT_HOME_PATH = CLIENT_ROUTES.MY_TICKETS;
const CLIENT_PROFILE_PATH = CLIENT_ROUTES.PROFILE;

// All possible nav items — items with pageKey are filtered by preset pageAccess
const ALL_NAV_ITEMS: ClientNavItem[] = [
    { path: CLIENT_HOME_PATH, label: 'My Tickets', shortLabel: 'Tiket Saya', icon: Ticket },
    { path: '/client/hardware-requests', label: 'Hardware Requests', shortLabel: 'Hardware', icon: MonitorSmartphone, pageKey: 'hardware_requests' },
    { path: '/client/eform-access', label: 'E-Form Access', shortLabel: 'E-Form', icon: FileText, pageKey: 'eform_access' },
    { path: '/client/zoom-calendar', label: 'Zoom Calendar', shortLabel: 'Zoom', icon: Video, pageKey: 'zoom_calendar' },
    { path: '/client/kb', label: 'Help Center', shortLabel: 'Bantuan', icon: BookOpen, pageKey: 'knowledge_base' },
    { path: CLIENT_PROFILE_PATH, label: 'Profile', shortLabel: 'Akun', icon: Settings },
];

const ENTRANCE_EASE = [0.16, 1, 0.3, 1] as const;

export const ClientLayout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, justLoggedIn, setJustLoggedIn } = useAuth();
    const { data: myPermissions } = useMyPermissions();

    useEffect(() => {
        if (justLoggedIn) {
            const timer = setTimeout(() => {
                setJustLoggedIn(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [justLoggedIn, setJustLoggedIn]);

    const handleLogout = async () => {
        await performLogout();
        navigate('/login', { replace: true });
    };

    // Filter nav items by pageAccess:
    // - Items without pageKey are always visible (core features)
    // - Items with pageKey: show only if pageAccess[key] === true
    //   If pageAccess not yet loaded, show all (avoids flash of missing items)
    const navItems = ALL_NAV_ITEMS.filter(item => {
        if (!item.pageKey) return true; // Always visible
        if (!myPermissions?.pageAccess) return true; // Still loading — show all temporarily
        return myPermissions.pageAccess[item.pageKey] === true;
    });

    const isActive = (item: ClientNavItem) =>
        item.exact
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');

    const isTicketDetailPage = location.pathname.startsWith('/client/tickets/');

    const content = (
        <FeatureErrorBoundary featureName="Client Portal">
            <Outlet />
        </FeatureErrorBoundary>
    );

    return (
        <div className="idesk-shell h-screen flex flex-col overflow-hidden font-sans selection:bg-primary/30 transition-colors duration-300 print:h-auto print:overflow-visible print:block">
            {/* Skip Link for Accessibility */}
            <a
                href="#main-content"
                className="skip-link focus:top-4 focus:left-4 rounded-lg"
            >
                Skip to main content
            </a>

            {/* Guidebook Onboarding Modal for USER role */}
            <UserGuidebookModal />

            {/* Sapphire top band: brand, navigation segment, utilities, create CTA, account menu */}
            <motion.div
                initial={justLoggedIn ? { y: -16, opacity: 0 } : false}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.35, ease: ENTRANCE_EASE }}
                className="relative z-50 shrink-0 print:hidden"
            >
                <ClientTopbar
                    navItems={navItems}
                    isActive={isActive}
                    homePath={CLIENT_HOME_PATH}
                    createPath={CLIENT_ROUTES.CREATE_TICKET}
                    profilePath={CLIENT_PROFILE_PATH}
                    user={user}
                    onLogout={handleLogout}
                />
            </motion.div>

            {/* Content on the rounded sheet */}
            <div className="idesk-sheet portal-sheet flex-1 min-h-0 flex flex-col overflow-hidden print:block print:overflow-visible">
                {isTicketDetailPage ? (
                    <main id="main-content" className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <motion.div
                            initial={justLoggedIn ? { opacity: 0, y: 16, scale: 0.98 } : false}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, ease: ENTRANCE_EASE, delay: 0.08 }}
                            className="w-full h-full flex flex-col overflow-hidden"
                        >
                            {content}
                        </motion.div>
                    </main>
                ) : (
                    <div id="main-scroll-container" className="flex-1 min-h-0 overflow-y-auto overflow-x-clip scroll-smooth scrollbar-custom flex flex-col print:h-auto print:overflow-visible print:p-0 print:m-0 print:block">
                        <main id="main-content" className="flex-1 w-full max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1900px] mx-auto px-3.5 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pt-5 pb-28 lg:pt-7 lg:pb-8 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
                            <motion.div
                                initial={justLoggedIn ? { opacity: 0, y: 16, scale: 0.98 } : false}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.4, ease: ENTRANCE_EASE, delay: 0.08 }}
                                className="w-full print:w-full print:block"
                            >
                                {content}
                            </motion.div>
                        </main>

                        {/* Footer (desktop; the bottom nav occupies this space on mobile) */}
                        <footer className="hidden lg:block border-t border-border py-6 mt-auto shrink-0 print:hidden">
                            <div className="max-w-[1400px] xl:max-w-[1700px] 2xl:max-w-[1900px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
                                <p className="text-center text-sm text-muted-foreground">
                                    © {new Date().getFullYear()} iDesk Enterprise Platform. Need help? Contact IT Support.
                                </p>
                            </div>
                        </footer>
                    </div>
                )}
            </div>

            {/* Mobile bottom navigation; ticket detail keeps the full height for its chat */}
            {!isTicketDetailPage && (
                <ClientBottomNav
                    navItems={navItems}
                    isActive={isActive}
                    createPath={CLIENT_ROUTES.CREATE_TICKET}
                    profilePath={CLIENT_PROFILE_PATH}
                />
            )}
        </div>
    );
};

export default ClientLayout;
