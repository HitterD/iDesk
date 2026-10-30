import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { SortField, SortOrder } from './SortableHeader';

interface QueueCardToolbarProps {
    sortBy: SortField;
    sortOrder: SortOrder;
    onSort: (field: SortField) => void;
    canEdit: boolean;
    ticketCount: number;
    isAllSelected: boolean;
    isIndeterminate: boolean;
    onSelectAll: (selected: boolean) => void;
}

/** Card counterpart of the table headers: no independent sort or selection state. */
export function QueueCardToolbar({ sortBy, sortOrder, onSort, canEdit, ticketCount,
    isAllSelected, isIndeterminate, onSelectAll }: QueueCardToolbarProps) {
    const checkbox = useRef<HTMLInputElement>(null);
    useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = isIndeterminate; }, [isIndeterminate]);
    return <div className="queue-card-toolbar" role="group" aria-label="Urutan dan pemilihan tiket">
        <label className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
            Urutkan
            <select aria-label="Urutkan tiket" className="min-h-9 rounded-lg border border-border bg-card px-2 text-foreground min-w-0"
                value={sortBy} onChange={(event) => onSort(event.target.value as SortField)}>
                <option value="createdAt">Dibuat</option><option value="title">Tiket</option>
                <option value="priority">Prioritas</option><option value="status">Status</option>
            </select>
        </label>
        <button type="button" className="ticket-pill ticket-tone-neutral picker-trigger min-h-9"
            aria-label={`Ubah arah urutan: ${sortOrder === 'DESC' ? 'menurun' : 'menaik'}`}
            onClick={() => onSort(sortBy)}>
            {sortOrder === 'DESC' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            {sortOrder === 'DESC' ? 'Menurun' : 'Menaik'}
        </button>
        {canEdit && <label className="flex items-center gap-2 min-h-9 px-1 text-xs cursor-pointer sm:ml-auto">
            <input ref={checkbox} type="checkbox" aria-label="Pilih semua tiket di halaman ini"
                className="size-4 accent-primary" checked={isAllSelected} disabled={ticketCount === 0}
                onChange={(event) => onSelectAll(event.target.checked)} />
            Pilih semua
        </label>}
    </div>;
}
