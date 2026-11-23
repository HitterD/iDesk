import { useCallback, useEffect, useRef, useState } from 'react';

const SAVE_DELAY_MS = 500;

export const draftKey = (userId: string, kind: 'hardware' | 'eform' | 'eform-renew'): string => `idesk:req-draft:${userId}:${kind}`;

function read<T>(key: string, initial: T): T {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return initial;
        const saved = JSON.parse(raw) as T;
        // An older draft may lack fields added since: fill them from the initial value.
        return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...initial, ...saved } : saved;
    } catch {
        return initial;
    }
}

/**
 * A form's values kept in the browser so a reload or an accidental close does not lose them. Saves 500 ms after the
 * last change; storage that is blocked or holds garbage never breaks the form (it just forgets).
 * Returns [value, set, clear].
 */
export function useRequestDraft<T>(key: string, initial: T): [T, (next: T) => void, () => void] {
    const [value, setValue] = useState<T>(() => read(key, initial));
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initialRef = useRef(initial);

    const set = useCallback((next: T) => {
        setValue(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* blocked storage: the draft is simply not kept */ }
        }, SAVE_DELAY_MS);
    }, [key]);

    const clear = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        try { localStorage.removeItem(key); } catch { /* nothing to remove */ }
        setValue(initialRef.current);
    }, [key]);

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
    return [value, set, clear];
}
