import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';

interface KeyboardShortcutsHelpDialogProps {
    open: boolean;
    onClose: () => void;
}

/** Keep in sync with the handler in BentoAdminAgentsPage — a wrong hint is worse than none. */
const SHORTCUTS: Array<{ action: string; keys: string }> = [
    { action: 'Select all users', keys: 'Ctrl + Shift + A' },
    { action: 'Delete selected', keys: 'Ctrl + Delete' },
    { action: 'Show this help', keys: '?' },
    { action: 'Close dialogs', keys: 'Escape' },
];

export function KeyboardShortcutsHelpDialog({ open, onClose }: KeyboardShortcutsHelpDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    useFocusTrap(dialogRef, { enabled: open, onEscape: onClose });

    useEffect(() => {
        if (!open) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="keyboard-shortcuts-title"
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full my-auto animate-in zoom-in-95 z-10 border border-slate-200/50 dark:border-slate-800"
            >
                <h3 id="keyboard-shortcuts-title" className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-primary" aria-hidden="true" />
                    Keyboard Shortcuts
                </h3>
                <dl className="space-y-3">
                    {SHORTCUTS.map(({ action, keys }) => (
                        <div key={action} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                            <dt className="text-slate-600 dark:text-slate-400">{action}</dt>
                            <dd>
                                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">{keys}</kbd>
                            </dd>
                        </div>
                    ))}
                </dl>
                <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 w-full min-h-[44px] py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>,
        document.body
    );
}
