import type { ElementType } from 'react';
import { Columns3, TableProperties, Plus, UserCheck, FilePen } from 'lucide-react';
import { cn } from '@/lib/utils';

type QueueScope = 'all' | 'assigned_to_me' | 'created_by_me';
interface QueueHeaderProps {
    title: string;
    description: string;
    icon: ElementType;
    tone: 'blue' | 'red' | 'teal' | 'teal-deep';
    connected: boolean;
    canEdit: boolean;
    scope: QueueScope;
    onScopeChange: (scope: QueueScope) => void;
    onCreate: () => void;
    onKanban: () => void;
}

/** Presentation only: each queue retains its own filters, permissions and query scope. */
export function QueueHeader({ title, description, icon: Icon, tone, connected, canEdit, scope,
    onScopeChange, onCreate, onKanban }: QueueHeaderProps) {
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
                {canEdit && <div className="portal-seg" role="group" aria-label="Cakupan tiket">
                    <button type="button" className={cn('portal-seg-btn', scope === 'all' && 'is-active')} aria-pressed={scope === 'all'} onClick={() => onScopeChange('all')}>Semua</button>
                    <button type="button" className={cn('portal-seg-btn', scope === 'assigned_to_me' && 'is-active')} aria-pressed={scope === 'assigned_to_me'} onClick={() => onScopeChange(scope === 'assigned_to_me' ? 'all' : 'assigned_to_me')}><UserCheck className="w-3.5 h-3.5" />My Tasks</button>
                    <button type="button" className={cn('portal-seg-btn', scope === 'created_by_me' && 'is-active')} aria-pressed={scope === 'created_by_me'} onClick={() => onScopeChange(scope === 'created_by_me' ? 'all' : 'created_by_me')}><FilePen className="w-3.5 h-3.5" />Tiket yang saya buat</button>
                </div>}
                <div className="portal-seg" role="group" aria-label="Tampilan antrean">
                    <button type="button" className="portal-seg-btn" title="Kanban Board" onClick={onKanban}><Columns3 className="w-3.5 h-3.5" /><span>Kanban</span></button>
                    <button type="button" className="portal-seg-btn is-active" title="Table View" aria-pressed="true"><TableProperties className="w-3.5 h-3.5" /><span>Tabel</span></button>
                </div>
                <button type="button" onClick={onCreate} className="idesk-cta hidden sm:inline-flex"><Plus aria-hidden="true" />Buat Tiket Baru</button>
            </div>
        </header>
    );
}
