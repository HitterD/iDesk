import { useAccessView, useCenterSummary } from './api';

/** How many things on "Perangkat & Akses" wait for IT: hardware not yet scheduled for install, and accesses ending soon. */
export function useDevicesAttention(enabled: boolean): number {
    const summary = useCenterSummary(enabled);
    const soon = useAccessView('soon', enabled);
    if (!enabled) return 0;
    return (summary.data?.waitingInstall ?? 0) + (soon.data?.counts.soon ?? 0);
}
