import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const POLL_CONNECTED_MS = 1_000;
const POLL_MAX_BACKOFF_MS = 60_000;
const PROBE_TIMEOUT_MS = 1_200;

/** Next delay: fast while the notifier answers, doubling up to a cap while it does not. */
export function nextPollDelay(currentMs: number, reachable: boolean): number {
    return reachable ? POLL_CONNECTED_MS : Math.min(currentMs * 2, POLL_MAX_BACKOFF_MS);
}

/**
 * Hook to automatically synchronize and direct the currently open iDesk web page
 * when the user clicks "Buka & Tindak Lanjuti di iDesk Web" from the SJA Notifier
 * desktop popup or Windows toast notification.
 */
export const useDesktopNotifierSync = () => {
    const navigate = useNavigate();
    const lastTimestampRef = useRef<number>(0);

    useEffect(() => {
        let isCancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let delay = POLL_CONNECTED_MS;

        // Most users never run the desktop notifier: back off instead of a refused request every second.
        const schedule = (reachable: boolean) => {
            if (isCancelled) return;
            delay = nextPollDelay(delay, reachable);
            if (document.hidden) return; // resumed by visibilitychange
            timer = setTimeout(tick, delay);
        };

        const tick = async () => {
            schedule(await checkPendingRedirect());
        };

        const checkPendingRedirect = async (): Promise<boolean> => {
            try {
                const res = await fetch('http://127.0.0.1:19876/pending-redirect?consume=true', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
                });

                if (!res.ok || isCancelled) return true;

                const data = await res.json();
                if (data?.hasRedirect && data?.redirectUrl && data.timestamp > lastTimestampRef.current) {
                    lastTimestampRef.current = data.timestamp;
                    const targetUrl: string = data.redirectUrl;

                    try {
                        const parsed = new URL(targetUrl, window.location.origin);
                        const isInternal = parsed.origin === window.location.origin || 
                                           targetUrl.includes('/tickets/') || 
                                           targetUrl.includes('/hardware-requests/') ||
                                           targetUrl.includes('/eform-access/');

                        if (isInternal) {
                            const internalPath = parsed.pathname + parsed.search + parsed.hash;
                            toast.success('Mengarahkan ke halaman tindak lanjut...', {
                                description: `Membuka ${internalPath}`,
                                duration: 3500
                            });
                            navigate(internalPath);
                            return true;
                        }
                    } catch {
                        // fallback to external href
                    }

                    window.location.href = targetUrl;
                }
                return true;
            } catch {
                // Desktop app not running (or not reachable)
                return false;
            }
        };

        const onVisibilityChange = () => {
            if (document.hidden || isCancelled) return;
            clearTimeout(timer);
            void tick();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        void tick();
        return () => {
            isCancelled = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [navigate]);
};
