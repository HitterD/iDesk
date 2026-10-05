import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isUpdatePending } from '@/lib/appUpdate';

/**
 * Applies a deployed update on the next route change, so a form being filled in is
 * never wiped by a sudden reload, while the new page loads from the new build.
 */
export function useReloadOnAppUpdate(): void {
    const { pathname } = useLocation();
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        if (isUpdatePending()) window.location.reload();
    }, [pathname]);
}
