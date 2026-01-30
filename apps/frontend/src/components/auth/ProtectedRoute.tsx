import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/useAuth';
import { useHasPermission, useHasPageAccess } from '@/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    /** Feature permission key (e.g., 'zoom_calendar.view') */
    requiredPermission?: string;
    /** Permission action to check (default: 'view') */
    permissionAction?: 'view' | 'create' | 'edit' | 'delete';
    /** V9: Page access key from preset (e.g., 'renewal', 'reports') */
    requiredPageAccess?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requiredPermission,
    permissionAction = 'view',
    requiredPageAccess,
}) => {
    const { isAuthenticated, user } = useAuth();
    const location = useLocation();

    // Check feature permission if specified
    const { hasPermission, isLoading: permissionLoading } = useHasPermission(
        requiredPermission || '',
        permissionAction
    );

    // V9: Check page access from preset if specified
    const { hasAccess: hasPageAccess, isLoading: pageAccessLoading } = useHasPageAccess(
        requiredPageAccess || ''
    );

    // Not logged in - token is in HttpOnly cookie, we check auth state
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // ADMIN bypasses all checks
    if (user.role === 'ADMIN') {
        return <>{children}</>;
    }

    // V9: Page access check (NEW - takes priority over role check when specified)
    if (requiredPageAccess) {
        // Loading state
        if (pageAccessLoading) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                </div>
            );
        }

        // Page access denied
        if (!hasPageAccess) {
            return <Navigate to="/unauthorized" replace />;
        }

        // Has page access - allow through (skip role check)
        return <>{children}</>;
    }

    // Role-based check (existing behavior - only if no requiredPageAccess)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Feature permission check (existing behavior)
    if (requiredPermission) {
        // Loading state
        if (permissionLoading) {
            return (
                <div className="flex items-center justify-center min-h-screen">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                </div>
            );
        }

        // Permission denied
        if (!hasPermission) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
                    <div className="glass-card rounded-2xl p-12 text-center max-w-md">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShieldAlert className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">
                            Access Denied
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            You don't have permission to access this page. Contact your administrator.
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
                        >
                            Go Back
                        </button>
                    </div>
                </div>
            );
        }
    }

    return <>{children}</>;
};
