import { useState, type SetStateAction } from 'react';

/**
 * Local draft seeded from server data. It is re-seeded only when `signature` changes (saved content or lock
 * changed), so unrelated refetches of the same record (e.g. a new `updatedAt`) keep unsaved edits.
 */
export function useServerDraft<T>(seed: () => T, signature: string): [T, (update: SetStateAction<T>) => void] {
    const [state, setState] = useState(() => ({ signature, draft: seed() }));
    let current = state;
    if (state.signature !== signature) {
        // Adjusting state during render (React-recommended pattern for resetting on prop change).
        current = { signature, draft: seed() };
        setState(current);
    }
    const setDraft = (update: SetStateAction<T>) => setState((previous) => ({
        ...previous,
        draft: typeof update === 'function' ? (update as (value: T) => T)(previous.draft) : update,
    }));
    return [current.draft, setDraft];
}
