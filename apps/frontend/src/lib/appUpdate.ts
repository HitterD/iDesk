/**
 * Recovers tabs left open across a deploy. Each build renames its chunks, so an old tab
 * that lazily imports a page asks for files that no longer exist and the page crashes
 * until the user hard-refreshes. We reload once on such errors, and poll the deployed
 * build id so a stale tab reloads on its next navigation.
 */

export const RELOAD_GUARD_KEY = 'idesk:stale-chunk-reload-at';
/** A second stale-chunk error within this window means the chunk is really broken. */
const RELOAD_GUARD_MS = 30_000;
const VERSION_CHECK_INTERVAL_MS = 5 * 60_000;
export const VERSION_FILE = '/version.json';

const STALE_CHUNK_PATTERNS = [
    /Failed to fetch dynamically imported module/i,
    /error loading dynamically imported module/i,
    /Importing a module script failed/i,
    /Unable to preload CSS/i,
    /Loading chunk [\w-]+ failed/i,
];

export const isStaleChunkError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    if (error.name === 'ChunkLoadError') return true;
    return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(error.message));
};

/** Reloads unless we already did so moments ago; returns whether a reload was triggered. */
export const reloadOnce = (reload: () => void = () => window.location.reload(), now = Date.now()): boolean => {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (last && now - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(now));
    reload();
    return true;
};

export const isNewerBuild = (currentBuildId: string, deployed: { buildId?: string } | null): boolean =>
    Boolean(currentBuildId && deployed?.buildId && deployed.buildId !== currentBuildId);

const fetchDeployedBuild = async (): Promise<{ buildId?: string } | null> => {
    try {
        const res = await fetch(`${VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store' });
        return res.ok ? await res.json() : null;
    } catch {
        // Offline or mid-deploy: try again on the next tick.
        return null;
    }
};

let updatePending = false;

/** True once a newer build is deployed; the router reloads on the next navigation. */
export const isUpdatePending = (): boolean => updatePending;

export const installAppUpdateRecovery = (): void => {
    // Vite fires this when a lazy route's chunk or CSS fails to load.
    window.addEventListener('vite:preloadError', (event) => {
        event.preventDefault();
        reloadOnce();
    });

    const currentBuildId = import.meta.env.VITE_BUILD_ID || '';
    if (!currentBuildId) return; // dev server: chunks are never renamed under the tab

    const check = async () => {
        if (updatePending) return;
        updatePending = isNewerBuild(currentBuildId, await fetchDeployedBuild());
    };
    window.setInterval(check, VERSION_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void check();
    });
};
