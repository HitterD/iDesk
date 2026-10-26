import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useSetCsiTeamQuestions } from '../../hooks/useCsi';
import { sameOrder, teamQuestionIds } from '../../lib/teamQuestions';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiDimension, CsiPeriodDetail, CsiQuestionType, CsiScopeParam } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../admin/AdminParts';
import { QuestionTypeChip } from '../admin/questions/QuestionTypeChip';
import { SortableList } from '../common/SortableList';
import { TEAM_COPY } from './wizardCopy';

interface TeamItem { id: string; name: string; type: CsiQuestionType | null }

const ROW = 'flex items-center gap-2 rounded-2xl bg-[hsl(var(--idesk-surface))] px-3 py-2 shadow-[var(--dash-shadow-1)]';

function QuestionChecklist({ questions, value, disabled, onToggle }: {
    questions: readonly CsiDimension[]; value: readonly string[]; disabled: boolean; onToggle: (id: string, on: boolean) => void;
}) {
    if (!questions.length) return <EmptyNote>{TEAM_COPY.emptyPool}</EmptyNote>;
    return (
        <ul aria-label={TEAM_COPY.pick} className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {questions.map((question) => {
                const id = `team-question-${question.id}`;
                return (
                    <li key={question.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-[hsl(var(--muted)/.5)]">
                        <Checkbox id={id} checked={value.includes(question.id)} disabled={disabled}
                            onCheckedChange={(state) => onToggle(question.id, state === true)} />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-[13.5px]">{question.name}</label>
                        <QuestionTypeChip type={question.type} />
                    </li>
                );
            })}
        </ul>
    );
}

function SelectedQuestions({ items, disabled, onReorder, onRemove }: {
    items: readonly TeamItem[]; disabled: boolean; onReorder: (ids: string[]) => void; onRemove: (id: string) => void;
}) {
    if (!items.length) return <EmptyNote>{TEAM_COPY.emptySelected}</EmptyNote>;
    return (
        <section aria-label={TEAM_COPY.selected}>
            <SortableList items={items} getId={(item) => item.id} onReorder={onReorder} disabled={disabled} label={TEAM_COPY.handleNoun} className="gap-2"
                renderItem={(item, handle) => (
                    <div className={ROW}>
                        {handle}
                        <span className="min-w-0 flex-1 text-[13.5px] font-medium">{item.name}</span>
                        {item.type && <QuestionTypeChip type={item.type} />}
                        <Button type="button" variant="subtle" size="icon" disabled={disabled} aria-label={TEAM_COPY.remove(item.name)} onClick={() => onRemove(item.id)}>
                            <X aria-hidden="true" />
                        </Button>
                    </div>
                )} />
        </section>
    );
}

/** Team section: choose the active questions that rate the team, order them by drag, save once. */
export function StepTeam({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data: questions = [] } = useCsiDimensions(scope);
    const save = useSetCsiTeamQuestions(scope, period.id);
    const saved = useMemo(() => teamQuestionIds(period), [period]);
    const [draft, setDraft] = useServerDraft<string[]>(() => saved, JSON.stringify([period.locked, saved]));
    const locked = period.locked;
    const dirty = !sameOrder(draft, saved);
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
    const snapshot = useMemo(() => new Map((period.ratees.find((ratee) => ratee.kind === 'TEAM')?.dimensions ?? [])
        .map((dimension) => [dimension.dimensionId, dimension])), [period]);
    const items: TeamItem[] = draft.map((id) => ({
        id, name: byId.get(id)?.name ?? snapshot.get(id)?.dimensionName ?? TEAM_COPY.inactive, type: byId.get(id)?.type ?? snapshot.get(id)?.type ?? null,
    }));
    const toggle = (id: string, on: boolean) => setDraft((current) => on ? [...current, id] : current.filter((item) => item !== id));

    return (
        <AdminSection title={TEAM_COPY.title} description={TEAM_COPY.description}
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{TEAM_COPY.unsaved}</span> : null}>
            <div className="grid gap-5">
                <div className="grid gap-2">
                    <span className={MUTED_TEXT}>{TEAM_COPY.pick}</span>
                    <QuestionChecklist questions={questions} value={draft} disabled={locked} onToggle={toggle} />
                </div>
                <div className="grid gap-2">
                    <span className={cn(MUTED_TEXT)}>{TEAM_COPY.selected}</span>
                    <SelectedQuestions items={items} disabled={locked} onReorder={setDraft} onRemove={(id) => toggle(id, false)} />
                </div>
                <div className="flex justify-end">
                    <Button variant="primary" loading={save.isPending} disabled={locked || !dirty} onClick={() => save.mutate({ questionIds: draft })}>
                        {TEAM_COPY.save}
                    </Button>
                </div>
            </div>
        </AdminSection>
    );
}
