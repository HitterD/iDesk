import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpDialogProps {
    open: boolean;
    onClose: () => void;
}

export function KeyboardShortcutsHelpDialog({ open, onClose }: KeyboardShortcutsHelpDialogProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-primary" />
                    Keyboard Shortcuts
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Select all users</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Ctrl + Shift + A</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Delete selected</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Delete</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Show this help</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">?</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400">Close dialogs</span>
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-mono">Escape</kbd>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
