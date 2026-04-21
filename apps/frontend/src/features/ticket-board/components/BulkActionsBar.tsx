import React from 'react';
import { Trash2, UserPlus, CheckCircle2, XCircle, MoreHorizontal, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionsBarProps {
    selectedCount: number;
    onAssign: () => void;
    onChangeStatus: (status: string) => void;
    onClear: () => void;
    isLoading?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onAssign,
    onChangeStatus,
    onClear,
    isLoading,
}) => {
    if (selectedCount === 0) return null;

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
                    <button
                        onClick={onAssign}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Assign</span>
                    </button>

                    <button
                        onClick={() => onChangeStatus('RESOLVED')}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Resolve</span>
                    </button>

                    <button
                        onClick={() => onChangeStatus('IN_PROGRESS')}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="hidden sm:inline">In Progress</span>
                    </button>
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
        </div>
    );
};

// Custom styled checkbox component for row selection
interface SelectCheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    indeterminate?: boolean;
    className?: string;
}

export const SelectCheckbox: React.FC<SelectCheckboxProps> = ({
    checked,
    onChange,
    indeterminate,
    className,
}) => {
    const ref = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (ref.current) {
            ref.current.indeterminate = indeterminate || false;
        }
    }, [indeterminate]);

    return (
        <label className={cn("relative inline-flex items-center cursor-pointer group", className)}>
            <input
                ref={ref}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className={cn(
                "w-5 h-5 rounded-md border-2 transition-[opacity,transform,colors] duration-200 ease-out flex items-center justify-center",
                "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800",
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
