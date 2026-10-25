import type { ElementType } from 'react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { usePageTitle } from '@/stores/usePageTitle';
import { QueueViewToggle, type QueueView } from './QueueViewToggle';

type QueueScope = 'all' | 'assigned_to_me' | 'created_by_me';
interface QueueHeaderProps {
    title: string;
    description: string;
    icon: ElementType;
    tone: 'blue' | 'red' | 'teal' | 'teal-deep';
}

interface QueueTogglesProps {
    canEdit: boolean;
    /** Scope segments render only when both are given. */
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
 * Queue title. On desktop it sits in the agent topbar (left, on the batik band) while the page is open;
 * the in-page copy is for small screens, where the agent topbar is hidden.
 */
export function QueueHeader({ title, description, icon: Icon, tone }: QueueHeaderProps) {
    usePageTitle({ title, description, icon: Icon, tone });
    return (
        <header className="queue-header lg:hidden">
            <div className="flex items-center gap-3 min-w-0">
                <span className="nav-tile queue-tile" data-tone={tone}><Icon aria-hidden="true" /></span>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                    <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">{description}</p>
                </div>
            </div>
        </header>
    );
}

/**
 * Scope (Semua / Tugas Saya / Saya Buat) and Kanban | Tabel at the end of the filter row, on a soft
 * sapphire track so they read as pressable. No create action here: "Buat Tiket Baru" lives in the topbar.
 */
export function QueueToggles({ canEdit, scope, onScopeChange, view = 'table', tablePath, scopes }: QueueTogglesProps) {
    const scopeOptions = scopes ? SCOPE_OPTIONS.filter((option) => scopes.includes(option.value)) : SCOPE_OPTIONS;
    // Re-selecting an active personal scope returns to "Semua" (previous toggle behaviour).
    const handleScope = (next: QueueScope) => onScopeChange?.(next === scope && next !== 'all' ? 'all' : next);
    return (
        <div className="queue-toggles">
            {canEdit && scope && onScopeChange && (
                <SegmentedControl aria-label="Cakupan tiket" className="queue-seg" options={scopeOptions} value={scope} onValueChange={handleScope} />
            )}
            <QueueViewToggle view={view} tablePath={tablePath} />
        </div>
    );
}
