import React from 'react';
import { Trash2, UserRoundPlus, CircleCheck, CircleDot, X, Check, GitMerge, ChevronDown, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/** Bulk statuses production already supports from the bar (same calls as before, now grouped under "Status"). */
const BULK_STATUSES = [
    { value: 'IN_PROGRESS', label: 'In Progress', icon: PlayCircle },
    { value: 'RESOLVED', label: 'Resolved', icon: CircleCheck },
] as const;
const MIN_MERGE = 2;
/** Escape clears the selection unless a dialog or menu owns the key. */
const OVERLAY_OPEN = '[role="dialog"], [role="alertdialog"], [role="menu"]';

/**
 * Floating bulk bar (mockup `queue-actions.js` BULK_HTML): count badge, Status, PIC, Gabungkan, Hapus,
 * close ✕ (Esc). Slides up with the motion tokens. Operations and confirmations are the production ones.
 */
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
    const visible = selectedCount > 0;

    React.useEffect(() => {
        if (!visible) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector(OVERLAY_OPEN)) onClear();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [visible, onClear]);

    if (!visible) return null;

    const changeStatus = (status: string) => {
        statusTakeover
            .requestBulk((takeover) => onChangeStatus(status, takeover))
            .catch(() => undefined); // other errors are reported by onChangeStatus
    };
    const canMerge = selectedCount >= MIN_MERGE;

    return (
        <>
            <div className="queue-bulk-bar" role="toolbar" aria-label="Aksi massal">
                <span className="queue-bulk-count" aria-live="polite">
                    <b>{selectedCount}</b><span>tiket dipilih</span>
                </span>
                <span className="queue-bulk-sep" aria-hidden="true" />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button type="button" className="queue-bulk-btn" disabled={isLoading} title="Ubah status">
                            <CircleDot aria-hidden="true" /><span>Status</span><ChevronDown className="caret" aria-hidden="true" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" variant="compact" aria-label="Ubah status">
                        {BULK_STATUSES.map(({ value, label, icon: Icon }) => (
                            <DropdownMenuItem key={value} onSelect={() => changeStatus(value)}><Icon />{label}</DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <button type="button" className="queue-bulk-btn" onClick={onAssign} disabled={isLoading} title="Tetapkan PIC">
                    <UserRoundPlus aria-hidden="true" /><span>PIC</span>
                </button>
                {onMerge && (
                    <button type="button" className="queue-bulk-btn" onClick={onMerge} disabled={isLoading || !canMerge}
                        title={canMerge ? 'Gabungkan tiket terpilih menjadi 1 tiket' : 'Pilih minimal 2 tiket untuk digabungkan'}>
                        <GitMerge aria-hidden="true" /><span>Gabungkan</span>
                    </button>
                )}
                {onDelete && (
                    <>
                        <span className="queue-bulk-sep" aria-hidden="true" />
                        <button type="button" className="queue-bulk-btn is-danger" onClick={onDelete} disabled={isLoading} title="Hapus tiket terpilih">
                            <Trash2 aria-hidden="true" /><span>Hapus</span>
                        </button>
                    </>
                )}
                <button type="button" className="queue-bulk-btn is-icon" onClick={onClear} aria-label="Batal pilih" title="Batal pilih (Esc)">
                    <X aria-hidden="true" />
                </button>
            </div>

            {/* PIC takeover confirmation for tickets handled by other agents */}
            {statusTakeover.dialogProps && <ReassignConfirmDialog {...statusTakeover.dialogProps} />}
        </>
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
