import { useEffect, useMemo, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useSetCsiRatees } from '../../hooks/useCsi';
import {
    draftFromPeriod, mergeRatees, orderDimensions, rateesSignature, toRateesPayload, type DraftUser, type RateeDraft,
} from '../../lib/csiAdmin';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiPeriodDetail, CsiScopeParam } from '../../types';
import { RATEE_COPY } from '../wizard/wizardCopy';
import { AdminSection, LockedNote, MUTED_TEXT } from './AdminParts';
import { PeoplePicker } from './ratees/PeoplePicker';
import { QuestionPicker } from './ratees/QuestionPicker';
import { RateeRows } from './RateeRows';

const reorderRows = (rows: readonly RateeDraft[], userIds: readonly string[]) =>
    userIds.flatMap((id) => rows.filter((row) => row.userId === id));

const STEP_TITLE = 'mb-2 flex items-center gap-2 text-[13px] font-semibold';
const STEP_NUMBER = 'grid h-5 w-5 place-items-center rounded-full bg-[hsl(var(--idesk-sapphire))] text-[11px] font-bold text-white';

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
    const assignedIds = useMemo(() => new Set(draft.map((row) => row.userId)), [draft]);
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
    const canAssign = !locked && pickedUsers.length > 0 && pickedQuestions.length > 0;

    return (
        <AdminSection title={RATEE_COPY.title} description={RATEE_COPY.description}
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{RATEE_COPY.unsaved}</span> : null}>
            {!locked && (
                <div className="rounded-2xl bg-[hsl(var(--muted)/.45)] p-4">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                        <div className="min-w-0">
                            <h3 className={STEP_TITLE}><span className={STEP_NUMBER}>1</span>{RATEE_COPY.stepPickPeople}</h3>
                            <PeoplePicker scope={scope} selected={pickedUsers} onChange={setPickedUsers} assignedIds={assignedIds} />
                        </div>
                        <div className="min-w-0">
                            <h3 className={STEP_TITLE}><span className={STEP_NUMBER}>2</span>{RATEE_COPY.stepPickQuestions}</h3>
                            {questions.length
                                ? <QuestionPicker scope={scope} questions={questions} value={pickedQuestions} onChange={setPickedQuestions} />
                                : <p className={MUTED_TEXT}>{RATEE_COPY.noActiveQuestions}</p>}
                        </div>
                    </div>
                    <div className="sticky bottom-[84px] z-[5] mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--idesk-border)/.7)] bg-card/95 px-3 py-2.5 backdrop-blur">
                        <span className={cn(MUTED_TEXT, 'text-[12.5px]')}>{RATEE_COPY.assignSummary(pickedUsers.length, pickedQuestions.length)}</span>
                        <Button variant="primary" className="ml-auto" onClick={assign} disabled={!canAssign}>
                            <ArrowDown aria-hidden="true" />{RATEE_COPY.assign}
                        </Button>
                    </div>
                </div>
            )}
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
