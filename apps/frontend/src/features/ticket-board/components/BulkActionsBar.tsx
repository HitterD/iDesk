import React from 'react';
import { Trash2, UserPlus, CheckCircle2, XCircle, MoreHorizontal, Check, GitMerge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStatusTakeover, type TakeoverOptions } from '../hooks/useStatusTakeover';
import { ReassignConfirmDialog } from './ReassignConfirmDialog';

interface BulkActionsBarProps {
    selectedCount: number;
    onAssign: () => void;
    /**
     * Must reject with the API error when the takeover dialog handles it
     * (`isHandledByTakeoverDialog`), so a 409 can open the confirmation.
     */
    onChangeStatus: (status: string, takeover?: TakeoverOptions) => Promise<void>;
    onClear: () => void;
    onMerge?: () => void;
    isLoading?: boolean;
    /** Rendered only when provided — ADMIN-only in practice. */
    onDelete?: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onAssign,
    onChangeStatus,
    onClear,
    onMerge,
    isLoading,
    onDelete,
}) => {
    const statusTakeover = useStatusTakeover();

    if (selectedCount === 0) return null;

    const changeStatus = (status: string) => {
        statusTakeover
            .requestBulk((takeover) => onChangeStatus(status, takeover))
            .catch(() => undefined); // other errors are reported by onChangeStatus
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-700">
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{selectedCount}</span>
                    </div>
                    <span className="text-sm text-slate-300">selected</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {onMerge && selectedCount >= 2 && (
                        <button
                            type="button"
                            onClick={onMerge}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-indigo-300 hover:text-white hover:bg-indigo-950/70 border border-indigo-500/40 rounded-xl transition-all shadow-2xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                            title="Gabungkan tiket terpilih menjadi 1 tiket"
                        >
                            <GitMerge className="w-4 h-4 text-indigo-400" />
                            <span className="hidden sm:inline">Merge Tiket</span>
                        </button>
                    )}

                    <button
                        onClick={onAssign}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Assign</span>
                    </button>

                    <button
                        onClick={() => changeStatus('RESOLVED')}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Resolve</span>
                    </button>

                    <button
                        onClick={() => changeStatus('IN_PROGRESS')}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">In Progress</span>
                    </button>
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Hapus</span>
                        </button>
                    )}
                </div>

                {/* Clear selection */}
                <div className="pl-3 border-l border-slate-700">
                    <button
                        onClick={onClear}
                        className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-slate-400 hover:text-red-400 transition-colors"
                    >
                        <XCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Clear</span>
                    </button>
                </div>
            </div>

            {/* PIC takeover confirmation for tickets handled by other agents */}
            {statusTakeover.dialogProps && <ReassignConfirmDialog {...statusTakeover.dialogProps} />}
        </div>
    );
};

// Custom styled checkbox component for row selection
interface SelectCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    indeterminate?: boolean;
    className?: string;
    /** Accessible name for the input. */
    label?: string;
    /**
     * Render as a whole queue-table cell: the full cell is the hit target and clicks never
     * bubble to the row (which would open the ticket).
     */
    cell?: boolean;
}

const stopRowClick = (event: React.MouseEvent) => event.stopPropagation();

export const SelectCheckbox: React.FC<SelectCheckboxProps> = ({
    checked,
    onChange,
    indeterminate,
    className,
    label,
    cell = false,
}) => {
    const ref = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate || false;
        }
    }, [indeterminate]);

    return (
        <label
            className={cn(
                cell ? "queue-select-cell group" : "relative inline-flex items-center cursor-pointer group",
                className,
            )}
            onClick={cell ? stopRowClick : undefined}
        >
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                aria-label={label}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className={cn(
                "w-5 h-5 rounded-md border-2 transition-[opacity,transform,colors] duration-200 ease-out flex items-center justify-center",
                cell
                    ? "border-slate-300/80 dark:border-slate-600/80 bg-white dark:bg-slate-800"
                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800",
                "peer-checked:bg-primary peer-checked:border-primary",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                "group-hover:border-primary/50",
                indeterminate && "bg-primary/50 border-primary"
            )}>
                {(checked || indeterminate) && (
                    <Check className={cn(
                        "w-3.5 h-3.5 text-white transition-transform duration-200",
                        indeterminate ? "scale-75" : "scale-100"
                    )} />
                )}
            </div>
        </label>
    );
};
