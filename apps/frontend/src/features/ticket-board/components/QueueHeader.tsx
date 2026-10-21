import type { ElementType } from 'react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { QueueViewToggle, type QueueView } from './QueueViewToggle';

type QueueScope = 'all' | 'assigned_to_me' | 'created_by_me';
interface QueueHeaderProps {
    title: string;
    description: string;
    icon: ElementType;
    tone: 'blue' | 'red' | 'teal' | 'teal-deep';
    connected: boolean;
    canEdit: boolean;
    /** Scope segments render only when both are given (the Kanban view filters scope in its own bar). */
    scope?: QueueScope;
    onScopeChange?: (scope: QueueScope) => void;
    /** Active view; the Kanban | Tabel toggle sits at the same place on both views. */
    view?: QueueView;
    /** Table route when the Kanban is rendered standalone (/kanban). */
    tablePath?: string;
    /** Subset of scopes this view supports (Kanban has no "Saya Buat" query). */
    scopes?: readonly QueueScope[];
}

const SCOPE_OPTIONS: readonly SegmentedOption<QueueScope>[] = [
    { value: 'all', label: 'Semua' },
    { value: 'assigned_to_me', label: 'Tugas Saya' },
    { value: 'created_by_me', label: 'Saya Buat' },
];

/**
 * Presentation only: each queue retains its own filters, permissions and query scope.
 * No create action here: "Buat Tiket Baru" lives only in the topbar and the mobile bottom nav.
 */
export function QueueHeader({ title, description, icon: Icon, tone, connected, canEdit, scope,
    onScopeChange, view = 'table', tablePath, scopes }: QueueHeaderProps) {
    const scopeOptions = scopes ? SCOPE_OPTIONS.filter((option) => scopes.includes(option.value)) : SCOPE_OPTIONS;
    // Re-selecting an active personal scope returns to "Semua" (previous toggle behaviour).
    const handleScope = (next: QueueScope) => onScopeChange?.(next === scope && next !== 'all' ? 'all' : next);
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
                {canEdit && scope && onScopeChange && <SegmentedControl aria-label="Cakupan tiket" options={scopeOptions} value={scope} onValueChange={handleScope} />}
                <QueueViewToggle view={view} tablePath={tablePath} />
            </div>
        </header>
    );
}
