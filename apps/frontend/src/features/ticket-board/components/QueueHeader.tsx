import type { ElementType } from 'react';
import { Columns3, TableProperties, UserCheck, FilePen } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';

type QueueScope = 'all' | 'assigned_to_me' | 'created_by_me';
type QueueView = 'kanban' | 'table';
interface QueueHeaderProps {
    title: string;
    description: string;
    icon: ElementType;
    tone: 'blue' | 'red' | 'teal' | 'teal-deep';
    connected: boolean;
    canEdit: boolean;
    scope: QueueScope;
    onScopeChange: (scope: QueueScope) => void;
    onKanban: () => void;
}

const SCOPE_OPTIONS: readonly SegmentedOption<QueueScope>[] = [
    { value: 'all', label: 'Semua' },
    { value: 'assigned_to_me', label: 'My Tasks', icon: UserCheck },
    { value: 'created_by_me', label: 'Tiket yang saya buat', icon: FilePen },
];
const VIEW_OPTIONS: readonly SegmentedOption<QueueView>[] = [
    { value: 'kanban', label: <span>Kanban</span>, icon: Columns3, title: 'Kanban Board' },
    { value: 'table', label: <span>Tabel</span>, icon: TableProperties, title: 'Table View' },
];

/**
 * Presentation only: each queue retains its own filters, permissions and query scope.
 * No create action here: "Buat Tiket Baru" lives only in the topbar and the mobile bottom nav.
 */
export function QueueHeader({ title, description, icon: Icon, tone, connected, canEdit, scope,
    onScopeChange, onKanban }: QueueHeaderProps) {
    // Re-selecting an active personal scope returns to "Semua" (previous toggle behaviour).
    const handleScope = (next: QueueScope) => onScopeChange(next === scope && next !== 'all' ? 'all' : next);
    const handleView = (next: QueueView) => { if (next === 'kanban') onKanban(); };
    return (
        <header className="queue-header">
            <div className="flex items-center gap-3 min-w-0">
                <span className="nav-tile queue-tile" data-tone={tone}><Icon aria-hidden="true" /></span>
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                        {connected && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Live</span>}
                    </div>
                    <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">{description}</p>
                </div>
            </div>
            <div className="queue-header-actions">
                {canEdit && <SegmentedControl aria-label="Cakupan tiket" options={SCOPE_OPTIONS} value={scope} onValueChange={handleScope} />}
                <SegmentedControl aria-label="Tampilan antrean" options={VIEW_OPTIONS} value="table" onValueChange={handleView} />
            </div>
        </header>
    );
}
