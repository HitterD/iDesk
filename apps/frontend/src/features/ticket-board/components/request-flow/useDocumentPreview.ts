import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface DocumentPreview { url: string | null; error: boolean }

/** Loads the latest version's PDF as an object URL for an inline preview; revoked when the version changes or the tab closes. */
export function useDocumentPreview(ticketId: string, version: number | undefined, enabled: boolean): DocumentPreview {
    const key = enabled && version !== undefined ? `${ticketId}:${version}` : null;
    // The result is stored with the key it belongs to: a stale result (other version) reads as "still loading".
    const [loaded, setLoaded] = useState<{ key: string; url: string | null; error: boolean } | null>(null);
    useEffect(() => {
        if (!key) return undefined;
        let url: string | null = null;
        let cancelled = false;
        api.get(`/request-flow/${ticketId}/document.pdf`, { params: { v: version }, responseType: 'blob' })
            .then((response) => {
                if (cancelled) return;
                url = URL.createObjectURL(response.data as Blob);
                setLoaded({ key, url, error: false });
            })
            .catch(() => { if (!cancelled) setLoaded({ key, url: null, error: true }); });
        return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    }, [key, ticketId, version]);
    return loaded && loaded.key === key ? { url: loaded.url, error: loaded.error } : { url: null, error: false };
}

/** Prints the PDF already shown in the preview, without opening a new tab. */
export function printPreview(): void {
    const frame = document.querySelector<HTMLIFrameElement>('.req-docpane__frame');
    frame?.contentWindow?.print();
}
