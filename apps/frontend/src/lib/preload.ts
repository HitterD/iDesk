/**
 * Route Preloading Utilities
 * Preload critical routes on user interaction to improve perceived performance
 */

// Preloadable route modules
const preloadableRoutes = {
    dashboard: () => import('../features/dashboard/pages/BentoDashboardPage'),
    tickets: () => import('../features/ticket-board/pages/BentoTicketListPage'),
    ticketDetail: () => import('../features/ticket-board/pages/BentoTicketDetailPage'),
    settings: () => import('../features/settings/pages/BentoSettingsPage'),
    kanban: () => import('../features/ticket-board/components/BentoTicketKanban'),
} as const;

type PreloadableRoute = keyof typeof preloadableRoutes;

// Track preloaded routes to avoid duplicate loads
const preloadedRoutes = new Set<PreloadableRoute>();

/**
 * Preload a specific route module
 * Safe to call multiple times - will only load once
 */
export const preloadRoute = (route: PreloadableRoute): void => {
    if (preloadedRoutes.has(route)) return;

    preloadedRoutes.add(route);
    preloadableRoutes[route]().catch(() => {
        // Silently fail - preloading is best effort
        preloadedRoutes.delete(route);
    });
};

/**
 * Preload multiple routes at once
 */
export const preloadRoutes = (routes: PreloadableRoute[]): void => {
    routes.forEach(preloadRoute);
};

/**
 * Preload route on hover (for navigation links)
 * Usage: <Link onMouseEnter={() => handlePreloadOnHover('dashboard')} to="/dashboard">
 */
export const handlePreloadOnHover = (route: PreloadableRoute) => (): void => {
    // Use requestIdleCallback if available, otherwise use setTimeout
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => preloadRoute(route));
    } else {
        setTimeout(() => preloadRoute(route), 100);
    }
};

/**
 * Preload critical routes after initial page load
 * Call this in your App component after authentication
 */
export const preloadCriticalRoutes = (): void => {
    // Wait for network to be idle before preloading
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
            preloadRoutes(['dashboard', 'tickets']);
        }, { timeout: 3000 });
    } else {
        setTimeout(() => {
            preloadRoutes(['dashboard', 'tickets']);
        }, 2000);
    }
};

/**
 * Hook for preloading on route change
 */
export const useRoutePreloader = (): {
    preload: (route: PreloadableRoute) => void;
    preloadOnHover: (route: PreloadableRoute) => () => void;
} => {
    return {
        preload: preloadRoute,
        preloadOnHover: handlePreloadOnHover,
    };
};

export default preloadRoute;
