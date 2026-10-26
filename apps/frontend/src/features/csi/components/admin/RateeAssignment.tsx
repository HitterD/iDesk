import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCsiDimensions, useSetCsiRatees } from '../../hooks/useCsi';
import {
    draftFromPeriod, mergeRatees, orderDimensions, rateesSignature, toRateesPayload, type DraftUser, type RateeDraft,
} from '../../lib/csiAdmin';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RATEE_COPY } from '../wizard/wizardCopy';
import { AdminSection, LockedNote, MUTED_TEXT, UserMultiPicker } from './AdminParts';
import { QuestionChecklist, RateeRows } from './RateeRows';

const reorderRows = (rows: readonly RateeDraft[], userIds: readonly string[]) =>
    userIds.flatMap((id) => rows.filter((row) => row.userId === id));

export function RateeAssignment({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data: questions = [] } = useCsiDimensions(scope);
    const save = useSetCsiRatees(scope, period.id);
    const [draft, setDraft] = useServerDraft<RateeDraft[]>(() => draftFromPeriod(period), rateesSignature(period));
    const [pickedUsers, setPickedUsers] = useState<DraftUser[]>([]);
    const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
    const locked = period.locked;
    const order = useMemo(() => questions.map((question) => question.id), [questions]);
    const payload = toRateesPayload(draft, order);
    const dirty = JSON.stringify(payload) !== JSON.stringify(toRateesPayload(draftFromPeriod(period), order));
    const invalid = draft.some((row) => !row.dimensionIds.length);
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const assign = () => {
        setDraft((current) => mergeRatees(current, pickedUsers, orderDimensions(pickedQuestions, order)));
        setPickedUsers([]);
        setPickedQuestions([]);
    };
    const changeRow = (userId: string, ids: string[]) =>
        setDraft((current) => current.map((row) => row.userId === userId ? { ...row, dimensionIds: orderDimensions(ids, order) } : row));
    const removeRow = (userId: string) => setDraft((current) => current.filter((row) => row.userId !== userId));
    const reorder = (userIds: string[]) => setDraft((current) => reorderRows(current, userIds));

    return (
        <AdminSection title={RATEE_COPY.title} description={RATEE_COPY.description}
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{RATEE_COPY.unsaved}</span> : null}>
            <div className="grid gap-5 rounded-2xl bg-[hsl(var(--muted)/.45)] p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
                <div className="space-y-1.5">
                    <span className={MUTED_TEXT}>{RATEE_COPY.stepPickPeople}</span>
                    <UserMultiPicker scope={scope} label="Pilih orang yang dinilai" selected={pickedUsers} onChange={setPickedUsers} disabled={locked} />
                </div>
                <div className="space-y-2">
                    <span className={MUTED_TEXT}>{RATEE_COPY.stepPickQuestions}</span>
                    {questions.length
                        ? <QuestionChecklist idPrefix="assign" questions={questions} value={pickedQuestions} onChange={setPickedQuestions} disabled={locked} />
                        : <p className={MUTED_TEXT}>{RATEE_COPY.noActiveQuestions}</p>}
                </div>
                <Button variant="soft" className="lg:mt-6" onClick={assign} disabled={locked || !pickedUsers.length || !pickedQuestions.length}>
                    {RATEE_COPY.assign}
                </Button>
            </div>
            <div className="mt-5">
                <RateeRows draft={draft} questions={questions} locked={locked} onChangeRow={changeRow} onRemove={removeRow} onReorder={reorder} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                {invalid && <span className="text-[12.5px] text-[hsl(var(--ticket-red-ink))]">{RATEE_COPY.invalid}</span>}
                <Button variant="primary" onClick={() => save.mutate(payload)} loading={save.isPending} disabled={locked || !dirty || invalid}>
                    {RATEE_COPY.save}
                </Button>
            </div>
        </AdminSection>
    );
}
