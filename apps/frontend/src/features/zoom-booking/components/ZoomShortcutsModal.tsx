import { Keyboard } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';

export interface ZoomShortcutsModalProps {
    open: boolean;
    onClose: () => void;
}

interface Shortcut {
    key: string;
    action: string;
}

const SHORTCUTS: Shortcut[] = [
    { key: '/', action: 'Focus search' },
    { key: 'T', action: 'Jump to today' },
    { key: 'N', action: 'Next period (week/day/month)' },
    { key: 'P', action: 'Previous period' },
    { key: 'M', action: 'Month view' },
    { key: 'W', action: 'Week view' },
    { key: 'D', action: 'Day view' },
    { key: 'B', action: 'Open Book Meeting modal' },
    { key: 'G', action: 'Toggle Gabungan' },
    { key: '?', action: 'Open this shortcuts modal' },
    { key: 'Esc', action: 'Close modal / panel' },
    { key: 'Arrow keys', action: 'Navigate cells in grid' },
    { key: 'Enter', action: 'Open detail of focused cell' },
    { key: 'Cmd/Ctrl + Enter', action: 'Submit current form' },
];

export function ZoomShortcutsModal({ open, onClose }: ZoomShortcutsModalProps) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-[480px] p-0 gap-0">
                <DialogTitle className="sr-only">Keyboard shortcuts</DialogTitle>

                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <Keyboard className="h-5 w-5 text-blue-600" aria-hidden="true" />
                    <h2 className="font-bold text-base">Keyboard Shortcuts</h2>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    <ul className="space-y-1.5">
                        {SHORTCUTS.map((s) => (
                            <li
                                key={s.key}
                                className="flex items-center justify-between gap-3 text-sm py-1"
                            >
                                <kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-mono shrink-0 min-w-[3.5rem] text-center">
                                    {s.key}
                                </kbd>
                                <span className="text-slate-700 dark:text-slate-300 text-right flex-1">
                                    {s.action}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </DialogContent>
        </Dialog>
    );
}
