import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Columns3, Rows3 } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

export type QueueView = 'kanban' | 'table';

const VIEW_PARAM = 'view';
/** The thumb arrives (`--dur-2`) before the page switches; reduced motion zeroes the token. */
const THUMB_TOKEN = '--dur-2';

const thumbDelayMs = () =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue(THUMB_TOKEN)) || 0;

interface QueueViewToggleProps {
    view: QueueView;
    /**
     * Table route for the standalone /kanban page. Queue pages render both views on their own
     * route, switched by `?view=kanban`, so they omit it.
     */
    tablePath?: string;
}

/**
 * Kanban | Tabel segmented links (mockup `queue.js` viewToggle): same position on both views,
 * keeps the queue's other query params (scope, filters). Icon-only on small screens.
 */
export function QueueViewToggle({ view, tablePath }: QueueViewToggleProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const [pending, setPending] = useState<QueueView | null>(null);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const kanbanParams = new URLSearchParams(location.search);
    kanbanParams.set(VIEW_PARAM, 'kanban');
    const tableParams = new URLSearchParams(location.search);
    tableParams.delete(VIEW_PARAM);
    const tableQuery = tableParams.toString();
    const hrefs: Record<QueueView, string> = {
        kanban: `${location.pathname}?${kanbanParams.toString()}`,
        table: tablePath ?? `${location.pathname}${tableQuery ? `?${tableQuery}` : ''}`,
    };

    const options: readonly SegmentedOption<QueueView>[] = [
        { value: 'kanban', label: <span>Kanban</span>, icon: Columns3, title: 'Kanban Board', ariaLabel: 'Tampilan Kanban', href: hrefs.kanban },
        { value: 'table', label: <span>Tabel</span>, icon: Rows3, title: 'Table View', ariaLabel: 'Tampilan Tabel', href: hrefs.table },
    ];

    const handleChange = (next: QueueView) => {
        if (next === (pending ?? view)) return;
        setPending(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => navigate(hrefs[next]), thumbDelayMs());
    };

    return (
        <SegmentedControl aria-label="Tampilan" className="queue-view-toggle" options={options}
            value={pending ?? view} onValueChange={handleChange} />
    );
}
