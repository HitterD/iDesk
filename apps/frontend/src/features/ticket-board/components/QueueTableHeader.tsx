import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectCheckbox } from './BulkActionsBar';
import type { SortField, SortOrder } from './SortableHeader';

interface QueueTableHeaderProps {
    showSiteColumn: boolean;
    canEdit: boolean;
    isAllSelected: boolean;
    isIndeterminate: boolean;
    onSelectAll: (selected: boolean) => void;
    sortBy: SortField;
    sortOrder: SortOrder;
    onSort: (field: SortField) => void;
}

const SORT_LABELS: Partial<Record<SortField, string>> = { title: 'Tiket', priority: 'Prioritas', status: 'Status', createdAt: 'Dibuat' };

function SortHead({ field, label, sortBy, sortOrder, onSort, className }: {
    field: SortField; label: string; sortBy: SortField; sortOrder: SortOrder; onSort: (f: SortField) => void; className?: string;
}) {
    const active = sortBy === field;
    const Icon = !active ? ArrowUpDown : sortOrder === 'ASC' ? ArrowUp : ArrowDown;
    return (
        <button type="button" className={cn('queue-sort', active && 'is-active', className)} onClick={() => onSort(field)}
            aria-label={`Urutkan menurut ${label}${active ? (sortOrder === 'ASC' ? ', menaik' : ', menurun') : ''}`}>
            <span>{label}</span><Icon aria-hidden="true" />
        </button>
    );
}

/**
 * Mockup `.thead`: Tiket · Prioritas · Site · Status · Pemohon · PIC · SLA (sentence case).
 * The Created column is gone (its date lives in the quick preview and export); the "Dibuat" sort
 * stays reachable at the end of the header, as the mockup's `.sort` "Dibuat ↓".
 */
export function QueueTableHeader({ showSiteColumn, canEdit, isAllSelected, isIndeterminate, onSelectAll, sortBy, sortOrder, onSort }: QueueTableHeaderProps) {
    const sort = { sortBy, sortOrder, onSort };
    return (
        <div className={cn('queue-grid queue-thead', showSiteColumn ? 'queue-grid-sites' : 'queue-grid-default')} role="row" aria-label="Kolom tabel">
            {canEdit ? (
                <SelectCheckbox cell label="Pilih semua tiket yang tampil" checked={isAllSelected}
                    indeterminate={isIndeterminate} onChange={onSelectAll} />
            ) : <span aria-hidden="true" />}
            <SortHead field="title" label="Tiket" {...sort} />
            <SortHead field="priority" label="Prioritas" {...sort} />
            {showSiteColumn && <span>Site</span>}
            <SortHead field="status" label="Status" {...sort} />
            <span>Pemohon</span>
            <span>PIC</span>
            <span className="queue-thead-sla">
                <span>SLA</span>
                <SortHead field="createdAt" label={SORT_LABELS.createdAt ?? 'Dibuat'} {...sort} className="queue-sort-created" />
            </span>
        </div>
    );
}
