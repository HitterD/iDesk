import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Switch } from '@/components/ui/switch';
import {
    useApplyCsiTemplate, useCreateCsiDimension, useCsiDimensions, useReorderCsiDimensions, useUpdateCsiDimension,
} from '../../../hooks/useCsi';
import type { CsiScopeParam, UpdateCsiDimension } from '../../../types';
import { mergeVisibleOrder } from '../../common/mergeVisibleOrder';
import { SortableList } from '../../common/SortableList';
import { EmptyNote } from '../AdminParts';
import { QuestionCard } from './QuestionCard';
import { QUESTION_COPY } from './questionCopy';

/** Inline question editor: every edit autosaves, order is drag and drop, no dialogs except the template confirm. */
export function QuestionList({ scope }: { scope: CsiScopeParam }) {
    const [showInactive, setShowInactive] = useState(false);
    const [confirmTemplate, setConfirmTemplate] = useState(false);
    const [focusId, setFocusId] = useState<string | null>(null);
    // Ordering needs every id of the scope, so inactive questions are always loaded and only hidden in the UI.
    const list = useCsiDimensions(scope, true);
    const create = useCreateCsiDimension(scope);
    const update = useUpdateCsiDimension(scope);
    const reorder = useReorderCsiDimensions(scope);
    const template = useApplyCsiTemplate(scope);
    const all = list.data ?? [];
    const visible = showInactive ? all : all.filter((question) => question.isActive);

    const add = async () => {
        const created = await create.mutateAsync({ name: QUESTION_COPY.newQuestionName, type: 'STAR', required: true });
        setFocusId(created.id);
    };
    const applyTemplate = () => template.mutate(undefined, { onSettled: () => setConfirmTemplate(false) });
    const save = (id: string, payload: UpdateCsiDimension) => update.mutateAsync({ id, payload });

    return (
        <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2.5">
                    <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label={QUESTION_COPY.showInactive} />
                    <span className="text-[13px]">{QUESTION_COPY.showInactive}</span>
                </label>
                <span className="flex-1" />
                <Button type="button" variant="soft" disabled={template.isPending} onClick={() => setConfirmTemplate(true)}>
                    <Sparkles aria-hidden="true" />{QUESTION_COPY.template}
                </Button>
            </div>
            <section aria-label={QUESTION_COPY.listLabel} className="grid gap-3">
                {list.isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" aria-busy="true" />}
                {list.isError && <ErrorState compact message={QUESTION_COPY.loadFailed} onRetry={() => list.refetch()} />}
                {list.data && !visible.length && <EmptyNote>{QUESTION_COPY.empty}</EmptyNote>}
                <SortableList items={visible} getId={(question) => question.id} label={QUESTION_COPY.handleNoun}
                    onReorder={(ids) => reorder.mutateAsync(mergeVisibleOrder(all.map((question) => question.id), ids))}
                    renderItem={(question, handle) => (
                        <QuestionCard question={question} handle={handle} onSave={save} autoFocusTitle={question.id === focusId} />
                    )} />
                <Button type="button" variant="soft" className="justify-self-start" disabled={create.isPending} onClick={() => void add()}>
                    <Plus aria-hidden="true" />{QUESTION_COPY.add}
                </Button>
            </section>
            <ConfirmationDialog isOpen={confirmTemplate} appearance="ticket" variant="default" title={QUESTION_COPY.templateTitle}
                description={QUESTION_COPY.templateDescription} confirmText={QUESTION_COPY.templateConfirm} cancelText={QUESTION_COPY.cancel}
                isLoading={template.isPending} onCancel={() => setConfirmTemplate(false)} onConfirm={applyTemplate} />
        </div>
    );
}
