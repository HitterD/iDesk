import { useRef, useState, type KeyboardEvent } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    useCreateCsiDepartment, useCsiDepartments, useReorderCsiDepartments, useUpdateCsiDepartment,
} from '../../hooks/useCsi';
import { CSI_NAME_MAX } from '../../lib/csiAdmin';
import type { CsiScopeParam, UpdateCsiDepartment } from '../../types';
import { mergeVisibleOrder } from '../common/mergeVisibleOrder';
import { SaveStatusText } from '../common/SaveStatusText';
import { SortableList } from '../common/SortableList';
import { EmptyNote } from './AdminParts';
import { DepartmentRow } from './DepartmentRow';
import { DEPARTMENT_COPY, QUESTION_COPY } from './questions/questionCopy';
import { saveErrorMessage, useSaveStatus } from './questions/useInlineField';

/** Always-visible add row at the bottom: Enter creates and keeps focus for the next department. */
function AddDepartmentRow({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
    const [name, setName] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const status = useSaveStatus();
    const submit = async (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const value = name.trim();
        if (!value) return;
        const ok = await status.run(() => onCreate(value));
        if (!ok) return;
        setName('');
        input.current?.focus();
    };
    return (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[hsl(var(--idesk-border))] px-4 py-3">
            <Input ref={input} value={name} maxLength={CSI_NAME_MAX} placeholder={DEPARTMENT_COPY.addPlaceholder}
                aria-label={DEPARTMENT_COPY.addLabel} className="h-10 flex-1 bg-transparent"
                onChange={(event) => setName(event.target.value)} onKeyDown={(event) => void submit(event)} />
            <SaveStatusText status={status.status} error={status.error} />
        </div>
    );
}

export function InlineMasterList({ scope }: { scope: CsiScopeParam }) {
    const [showInactive, setShowInactive] = useState(false);
    // Ordering needs every id of the scope, so inactive departments are always loaded and only hidden in the UI.
    const list = useCsiDepartments(scope, true);
    const create = useCreateCsiDepartment(scope);
    const update = useUpdateCsiDepartment(scope);
    const reorder = useReorderCsiDepartments(scope);
    const all = list.data ?? [];
    const visible = showInactive ? all : all.filter((department) => department.isActive);
    const save = (id: string, payload: UpdateCsiDepartment) => update.mutateAsync({ id, payload });
    const createNamed = (name: string) => create.mutateAsync({ name }).catch((error: unknown) => {
        throw new Error(saveErrorMessage(error, DEPARTMENT_COPY.createFailed));
    });

    return (
        <div className="grid gap-5">
            <label className="flex items-center gap-2.5">
                <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={QUESTION_COPY.showInactive} />
                <span className="text-[13px]">{QUESTION_COPY.showInactive}</span>
            </label>
            <section aria-label={DEPARTMENT_COPY.listLabel} className="grid gap-3">
                {list.isLoading && <div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" />}
                {list.isError && <ErrorState compact message={DEPARTMENT_COPY.loadFailed} onRetry={() => list.refetch()} />}
                {list.data && !visible.length && <EmptyNote>{DEPARTMENT_COPY.empty}</EmptyNote>}
                <SortableList items={visible} getId={(department) => department.id} label={DEPARTMENT_COPY.handleNoun}
                    onReorder={(ids) => reorder.mutateAsync(mergeVisibleOrder(all.map((department) => department.id), ids))}
                    renderItem={(department, handle) => <DepartmentRow department={department} handle={handle} onSave={save} />} />
                <AddDepartmentRow onCreate={createNamed} />
            </section>
        </div>
    );
}
