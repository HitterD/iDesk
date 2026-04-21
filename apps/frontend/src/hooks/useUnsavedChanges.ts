/**
 * useUnsavedChanges Hook
 * 
 * Prevents accidental navigation away from a page with unsaved changes.
 * Uses beforeunload event for browser close/refresh.
 * 
 * Note: For SPA navigation blocking with legacy BrowserRouter,
 * we use a simpler approach with window.confirm since useBlocker
 * requires createBrowserRouter (data router).
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface UseUnsavedChangesOptions {
    /** Whether there are unsaved changes */
    isDirty: boolean;
    /** Custom message for the confirmation dialog */
    message?: string;
    /** Called when user confirms leaving */
    onConfirmLeave?: () => void;
}

interface UseUnsavedChangesReturn {
    /** Whether the blocker is currently active (showing confirmation) */
    isBlocked: boolean;
    /** Confirm navigation and proceed */
    confirmNavigation: () => void;
    /** Cancel navigation and stay on page */
    cancelNavigation: () => void;
    /** Reset the dirty state */
    reset: () => void;
}

export function useUnsavedChanges({
    isDirty,
    message = 'You have unsaved changes. Are you sure you want to leave?',
    onConfirmLeave,
}: UseUnsavedChangesOptions): UseUnsavedChangesReturn {
    const [isBlocked, setIsBlocked] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const isDirtyRef = useRef(isDirty);

    // Keep ref in sync
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    // Handle browser close/refresh with beforeunload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                // Most modern browsers ignore custom messages
                // but setting returnValue triggers the dialog
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, message]);

    // Intercept navigation using history popstate
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (isDirtyRef.current) {
                // Push the current state back to prevent navigation
                window.history.pushState(null, '', window.location.href);

                // Show our custom dialog
                setIsBlocked(true);
                setPendingNavigation('back');
            }
        };

        // Push initial state for popstate to work
        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const confirmNavigation = useCallback(() => {
        setIsBlocked(false);
        onConfirmLeave?.();

        if (pendingNavigation === 'back') {
            // Allow the back navigation
            window.history.back();
        } else if (pendingNavigation) {
            navigate(pendingNavigation);
        }
        setPendingNavigation(null);
    }, [pendingNavigation, navigate, onConfirmLeave]);

    const cancelNavigation = useCallback(() => {
        setIsBlocked(false);
        setPendingNavigation(null);
    }, []);

    const reset = useCallback(() => {
        setIsBlocked(false);
        setPendingNavigation(null);
    }, []);

    return {
        isBlocked,
        confirmNavigation,
        cancelNavigation,
        reset,
    };
}

export default useUnsavedChanges;

