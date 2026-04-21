import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    description: string;
}

export const useKeyboardShortcuts = (customShortcuts?: ShortcutConfig[]) => {
    const navigate = useNavigate();

    const defaultShortcuts: ShortcutConfig[] = [
        { key: 'd', ctrl: true, action: () => navigate('/dashboard'), description: 'Go to Dashboard' },
        { key: 't', ctrl: true, action: () => navigate('/tickets/list'), description: 'Go to Tickets' },
        { key: 'k', ctrl: true, action: () => navigate('/kanban'), description: 'Go to Kanban' },
        { key: 'n', ctrl: true, shift: true, action: () => navigate('/tickets/create'), description: 'New Ticket' },
        { key: 's', ctrl: true, action: () => navigate('/settings'), description: 'Go to Settings' },
        { key: 'r', ctrl: true, action: () => navigate('/reports'), description: 'Go to Reports' },
        { key: '/', action: () => {
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
                searchInput.focus();
            }
        }, description: 'Focus Search' },
        { key: 'Escape', action: () => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement) {
                activeElement.blur();
            }
        }, description: 'Clear Focus' },
    ];

    const allShortcuts = [...defaultShortcuts, ...(customShortcuts || [])];

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Don't trigger shortcuts when typing in inputs
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // Allow specific shortcuts even in inputs
        const allowInInput = event.key === 'Escape' || (event.ctrlKey && ['d', 't', 'k', 'n', 's', 'r'].includes(event.key.toLowerCase()));
        
        if (isInput && !allowInInput) return;

        for (const shortcut of allShortcuts) {
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.action();
                return;
            }
        }
    }, [allShortcuts]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return { shortcuts: allShortcuts };
};

export const KeyboardShortcutsHelp: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const shortcuts = [
        { keys: ['Ctrl', 'D'], description: 'Go to Dashboard' },
        { keys: ['Ctrl', 'T'], description: 'Go to Tickets' },
        { keys: ['Ctrl', 'K'], description: 'Go to Kanban' },
        { keys: ['Ctrl', 'Shift', 'N'], description: 'New Ticket' },
        { keys: ['Ctrl', 'S'], description: 'Go to Settings' },
        { keys: ['Ctrl', 'R'], description: 'Go to Reports' },
        { keys: ['/'], description: 'Focus Search' },
        { keys: ['Esc'], description: 'Clear Focus / Close Modal' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div 
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Keyboard Shortcuts</h2>
                <div className="space-y-3">
                    {shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">{shortcut.description}</span>
                            <div className="flex gap-1">
                                {shortcut.keys.map((key, i) => (
                                    <kbd 
                                        key={i}
                                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-slate-700 dark:text-slate-200"
                                    >
                                        {key}
                                    </kbd>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90"
                >
                    Close
                </button>
            </div>
        </div>
    );
};
