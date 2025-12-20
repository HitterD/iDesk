import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../stores/useAuth';
import { useHasPermission } from '@/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    /** Feature permission key (e.g., 'zoom_calendar.view') */
    requiredPermission?: string;
    /** Permission action to check (default: 'view') */
    permissionAction?: 'view' | 'create' | 'edit' | 'delete';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requiredPermission,
    permissionAction = 'view',
}) => {
    const { token, user } = useAuth();
    const location = useLocation();

    // Check feature permission if specified
    const { hasPermission, isLoading } = useHasPermission(
        requiredPermission || '',
        permissionAction
    );

    // Not logged in
    if (!token || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role-based check (existing behavior)
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }


    // Feature permission check (new behavior)
    if (requiredPermission) {
        // ADMIN bypass permission checks (full access)
        if (user.role === 'ADMIN') {
            return <>{children}</>;
        }

        // Loading state
        if (isLoading) {
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
