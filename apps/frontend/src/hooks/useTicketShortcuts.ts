import { useEffect, useCallback, useState } from 'react';

interface TicketShortcutActions {
    onAssign?: () => void;
    onStatus?: () => void;
    onPriority?: () => void;
    onReply?: () => void;
    onResolve?: () => void;
    onEscape?: () => void;
    onNextTicket?: () => void;
    onPrevTicket?: () => void;
    onCopyTicketNumber?: () => void;
}

interface UseTicketShortcutsOptions {
    enabled?: boolean;
    ticketNumber?: string;
}

export function useTicketShortcuts(
    actions: TicketShortcutActions,
    options: UseTicketShortcutsOptions = {}
) {
    const { enabled = true, ticketNumber } = options;
    const [showShortcutsHint, setShowShortcutsHint] = useState(false);

    const isInputFocused = useCallback(() => {
        const activeElement = document.activeElement;
        if (!activeElement) return false;
        
        const tagName = activeElement.tagName.toUpperCase();
        const isEditable = activeElement.getAttribute('contenteditable') === 'true';
        
        return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || isEditable;
    }, []);

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            if (isInputFocused()) return;

            const { key, ctrlKey, metaKey, shiftKey } = e;
            const modKey = ctrlKey || metaKey;

            // Show shortcuts hint with '?'
            if (key === '?' && shiftKey) {
                e.preventDefault();
                setShowShortcutsHint(prev => !prev);
                return;
            }

            // Ctrl/Cmd + A - Assign ticket
            if (modKey && key.toLowerCase() === 'a' && !shiftKey) {
                e.preventDefault();
                actions.onAssign?.();
                return;
            }

            // Ctrl/Cmd + S - Change status
            if (modKey && key.toLowerCase() === 's' && !shiftKey) {
                e.preventDefault();
                actions.onStatus?.();
                return;
            }

            // Ctrl/Cmd + P - Change priority
            if (modKey && key.toLowerCase() === 'p' && !shiftKey) {
                e.preventDefault();
                actions.onPriority?.();
                return;
            }

            // R - Quick reply (focus reply input)
            if (key.toLowerCase() === 'r' && !modKey && !shiftKey) {
                e.preventDefault();
                actions.onReply?.();
                return;
            }

            // Ctrl/Cmd + Enter - Resolve ticket
            if (modKey && key === 'Enter') {
                e.preventDefault();
                actions.onResolve?.();
                return;
            }

            // Escape - Close modals/panels
            if (key === 'Escape') {
                actions.onEscape?.();
                return;
            }

            // J - Next ticket
            if (key.toLowerCase() === 'j' && !modKey) {
                e.preventDefault();
                actions.onNextTicket?.();
                return;
            }

            // K - Previous ticket
            if (key.toLowerCase() === 'k' && !modKey) {
                e.preventDefault();
                actions.onPrevTicket?.();
                return;
            }

            // Ctrl/Cmd + C - Copy ticket number (when not in input)
            if (modKey && key.toLowerCase() === 'c' && ticketNumber) {
                // Only if nothing is selected
                const selection = window.getSelection();
                if (!selection || selection.toString() === '') {
                    e.preventDefault();
                    copyToClipboard(ticketNumber);
                    actions.onCopyTicketNumber?.();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, actions, isInputFocused, ticketNumber, copyToClipboard]);

    return { showShortcutsHint, setShowShortcutsHint };
}

// Shortcut hints display component data
export const TICKET_SHORTCUTS = [
    { keys: ['Ctrl', 'A'], description: 'Assign ticket' },
    { keys: ['Ctrl', 'S'], description: 'Change status' },
    { keys: ['Ctrl', 'P'], description: 'Change priority' },
    { keys: ['R'], description: 'Quick reply' },
    { keys: ['Ctrl', 'Enter'], description: 'Resolve ticket' },
    { keys: ['J'], description: 'Next ticket' },
    { keys: ['K'], description: 'Previous ticket' },
    { keys: ['Ctrl', 'C'], description: 'Copy ticket number' },
    { keys: ['Esc'], description: 'Close modal/panel' },
    { keys: ['Shift', '?'], description: 'Show shortcuts' },
];

export default useTicketShortcuts;
