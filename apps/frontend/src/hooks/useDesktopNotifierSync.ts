import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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

        const checkPendingRedirect = async () => {
            try {
                const res = await fetch('http://127.0.0.1:19876/pending-redirect?consume=true', {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(1200)
                });

                if (!res.ok || isCancelled) return;

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
                            return;
                        }
                    } catch {
                        // fallback to external href
                    }

                    window.location.href = targetUrl;
                }
            } catch {
                // Silently ignore if desktop app is not active
            }
        };

        const interval = setInterval(checkPendingRedirect, 1000);
        return () => {
            isCancelled = true;
            clearInterval(interval);
        };
    }, [navigate]);
};
