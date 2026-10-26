import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
// `useRef` stays for the saved-flash timer only (never read during render).

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const SAVED_FLASH_MS = 1800;
const FALLBACK_ERROR = 'Gagal menyimpan';

/** Server message of an axios-style error; the interceptor toast is skipped where inline errors render. */
export function saveErrorMessage(error: unknown, fallback = FALLBACK_ERROR): string {
    const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
    if (typeof message === 'string') return message;
    return Array.isArray(message) && typeof message[0] === 'string' ? message[0] : fallback;
}

export interface SaveTracker {
    status: SaveStatus;
    error: string | null;
    run: (task: () => Promise<unknown>) => Promise<boolean>;
    fail: (message: string) => void;
    clear: () => void;
}

/** Tracks "Menyimpan… / Tersimpan / error" for one card or row. */
export function useSaveStatus(): SaveTracker {
    const [state, setState] = useState<{ status: SaveStatus; error: string | null }>({ status: 'idle', error: null });
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const run = async (task: () => Promise<unknown>) => {
        clearTimeout(timer.current);
        setState({ status: 'saving', error: null });
        try {
            await task();
            setState({ status: 'saved', error: null });
            timer.current = setTimeout(() => setState({ status: 'idle', error: null }), SAVED_FLASH_MS);
            return true;
        } catch (error) {
            setState({ status: 'error', error: saveErrorMessage(error) });
            return false;
        }
    };
    const fail = (message: string) => setState({ status: 'error', error: message });
    const clear = () => setState({ status: 'idle', error: null });
    return { status: state.status, error: state.error, run, fail, clear };
}

interface InlineFieldOptions {
    /** Saved value from the server. */
    value: string;
    /** Returns an error message to block the save (the draft stays), or null when valid. */
    validate?: (draft: string) => string | null;
    onCommit: (draft: string) => Promise<unknown> | void;
    onInvalid?: (message: string) => void;
    /** Textareas keep Enter for new lines (Shift+Enter is not special); Enter commits only single-line fields. */
    multiline?: boolean;
}

/**
 * Draft text that commits on blur or Enter only when it changed and is valid; Escape reverts.
 * A new server value replaces the draft only while the field is not being edited.
 */
export function useInlineField({ value, validate, onCommit, onInvalid, multiline = false }: InlineFieldOptions) {
    const [draft, setDraft] = useState(value);
    const [lastValue, setLastValue] = useState(value);
    const [editing, setEditing] = useState(false);
    if (value !== lastValue) {
        setLastValue(value);
        if (!editing) setDraft(value);
    }

    const commit = () => {
        const next = draft.trim();
        if (next === value) { setDraft(value); return; }
        const problem = validate?.(next) ?? null;
        if (problem) { onInvalid?.(problem); return; }
        setDraft(next);
        void onCommit(next);
    };
    const revert = () => { setDraft(value); };
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') { event.preventDefault(); revert(); }
        if (event.key === 'Enter' && !multiline) {
            event.preventDefault();
            event.currentTarget.blur();
        }
    };
    return {
        draft,
        inputProps: {
            value: draft,
            onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
            onFocus: () => setEditing(true),
            onBlur: () => { setEditing(false); commit(); },
            onKeyDown: handleKeyDown,
        },
    };
}
