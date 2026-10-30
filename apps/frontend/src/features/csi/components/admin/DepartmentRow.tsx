import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TicketPill } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import { CSI_NAME_MAX } from '../../lib/csiAdmin';
import type { CsiDepartment, UpdateCsiDepartment } from '../../types';
import { SaveStatusText } from '../common/SaveStatusText';
import { DEPARTMENT_COPY, QUESTION_COPY } from './questions/questionCopy';
import { useInlineField, useSaveStatus } from './questions/useInlineField';

/** One department: name autosaves on blur/Enter (Escape reverts), plus an activate/deactivate toggle. */
export function DepartmentRow({ department, handle, onSave }: {
    department: CsiDepartment; handle: ReactNode; onSave: (id: string, payload: UpdateCsiDepartment) => Promise<unknown>;
}) {
    const status = useSaveStatus();
    const save = (payload: UpdateCsiDepartment) => status.run(() => onSave(department.id, payload));
    const name = useInlineField({
        value: department.name, onCommit: (next) => save({ name: next }), onInvalid: status.fail,
        validate: (draft) => draft ? null : DEPARTMENT_COPY.nameEmpty,
    });
    return (
        <div className={cn(
            'flex flex-wrap items-center gap-2 rounded-2xl bg-[hsl(var(--idesk-surface))] px-4 py-3 shadow-[var(--dash-shadow-1)]',
            !department.isActive && 'opacity-70',
        )}>
            {handle}
            <Input {...name.inputProps} maxLength={CSI_NAME_MAX} aria-label={DEPARTMENT_COPY.nameLabel(department.name)}
                className="h-10 min-w-0 flex-1 border-transparent bg-transparent text-[14px] font-medium hover:bg-[hsl(var(--muted)/.6)]" />
            {!department.isActive && <TicketPill tone="neutral">{QUESTION_COPY.inactive}</TicketPill>}
            <SaveStatusText status={status.status} error={status.error} />
            <Button type="button" variant={department.isActive ? 'danger' : 'soft'} onClick={() => void save({ isActive: !department.isActive })}>
                {department.isActive ? QUESTION_COPY.deactivate : QUESTION_COPY.activate}
            </Button>
        </div>
    );
}
