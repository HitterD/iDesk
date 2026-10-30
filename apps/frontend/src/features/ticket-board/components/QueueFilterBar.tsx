import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/** Mockup copy (`queue.js` frame): one search field for every queue. */
export const QUEUE_SEARCH_PLACEHOLDER = 'Cari judul, nomor tiket, atau pemohon';

interface QueueFilterBarProps {
    id: string;
    search: string;
    onSearch: (value: string) => void;
    /** Filter pops (CustomDropdown filterKey, SiteSelector variant="pop") and trailing icon actions. */
    children: ReactNode;
}

/** Mockup `.filters`: search field + `.pop` filter buttons + icon actions on one row. */
export function QueueFilterBar({ id, search, onSearch, children }: QueueFilterBarProps) {
    return (
        <div className="queue-filters" role="search" aria-label="Cari dan filter tiket">
            <label className="queue-field" htmlFor={id}>
                <Search aria-hidden="true" />
                <input id={id} type="search" name="search" value={search} autoComplete="off"
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder={QUEUE_SEARCH_PLACEHOLDER} aria-label="Cari tiket" />
                {search && (
                    <button type="button" className="queue-field-clear" onClick={() => onSearch('')} aria-label="Hapus pencarian">
                        <X aria-hidden="true" />
                    </button>
                )}
            </label>
            {children}
        </div>
    );
}

/** Status / Prioritas filter options in mockup vocabulary; values unchanged. */
export const PRIORITY_FILTER_OPTIONS = [
    { value: 'ALL', label: 'Semua' },
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Normal' },
    { value: 'HIGH', label: 'Urgent' },
    { value: 'CRITICAL', label: 'Blocker' },
];
