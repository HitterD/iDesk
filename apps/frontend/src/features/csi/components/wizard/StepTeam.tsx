import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useSetCsiTeamQuestions } from '../../hooks/useCsi';
import { sameOrder, siteTeamRatee, teamQuestionIds } from '../../lib/teamQuestions';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiDimension, CsiPeriodDetail, CsiQuestionType, CsiScopeParam, CsiSiteSummary } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../admin/AdminParts';
import { QuestionTypeChip } from '../admin/questions/QuestionTypeChip';
import { SortableList } from '../common/SortableList';
import { TEAM_COPY } from './wizardCopy';

interface TeamItem { id: string; name: string; type: CsiQuestionType | null }

const ROW = 'flex items-center gap-2 rounded-2xl bg-[hsl(var(--idesk-surface))] px-3 py-2 shadow-[var(--dash-shadow-1)]';

function QuestionChecklist({ idPrefix, questions, value, disabled, onToggle }: {
    idPrefix: string; questions: readonly CsiDimension[]; value: readonly string[]; disabled: boolean; onToggle: (id: string, on: boolean) => void;
}) {
    if (!questions.length) return <EmptyNote>{TEAM_COPY.emptyPool}</EmptyNote>;
    return (
        <ul aria-label={TEAM_COPY.pick} className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
            {questions.map((question) => {
                const id = `${idPrefix}-${question.id}`;
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

/** One site's team: choose its active questions, order them by drag, save with the site id. */
function SiteTeam({ scope, period, site, questions, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; site: CsiSiteSummary; questions: readonly CsiDimension[];
    onDirtyChange: (siteId: string, dirty: boolean) => void;
}) {
    const save = useSetCsiTeamQuestions(scope, period.id);
    const saved = useMemo(() => teamQuestionIds(period, site.id), [period, site.id]);
    const [draft, setDraft] = useServerDraft<string[]>(() => saved, JSON.stringify([period.locked, saved]));
    const locked = period.locked;
    const dirty = !sameOrder(draft, saved);
    useEffect(() => { onDirtyChange(site.id, dirty); }, [dirty, onDirtyChange, site.id]);

    const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
    const snapshot = useMemo(() => new Map((siteTeamRatee(period, site.id)?.dimensions ?? [])
        .map((dimension) => [dimension.dimensionId, dimension])), [period, site.id]);
    const items: TeamItem[] = draft.map((id) => ({
        id, name: byId.get(id)?.name ?? snapshot.get(id)?.dimensionName ?? TEAM_COPY.inactive, type: byId.get(id)?.type ?? snapshot.get(id)?.type ?? null,
    }));
    const toggle = (id: string, on: boolean) => setDraft((current) => on ? [...current, id] : current.filter((item) => item !== id));

    return (
        <AdminSection title={TEAM_COPY.siteTeam(site.name ?? site.code ?? '')}
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{TEAM_COPY.unsaved}</span> : null}>
            <div className="grid gap-5">
                <div className="grid gap-2">
                    <span className={MUTED_TEXT}>{TEAM_COPY.pick}</span>
                    <QuestionChecklist idPrefix={`team-${site.id}`} questions={questions} value={draft} disabled={locked} onToggle={toggle} />
                </div>
                <div className="grid gap-2">
                    <span className={cn(MUTED_TEXT)}>{TEAM_COPY.selected}</span>
                    <SelectedQuestions items={items} disabled={locked} onReorder={setDraft} onRemove={(id) => toggle(id, false)} />
                </div>
                <div className="flex justify-end">
                    <Button variant="primary" loading={save.isPending} disabled={locked || !dirty} onClick={() => save.mutate({ siteId: site.id, questionIds: draft })}>
                        {TEAM_COPY.save}
                    </Button>
                </div>
            </div>
        </AdminSection>
    );
}

/** Team section: one team per period site, each with its own question picker (label "Tim <site name>"). */
export function StepTeam({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data: questions = [] } = useCsiDimensions(scope);
    const [dirtySites, setDirtySites] = useState<ReadonlySet<string>>(() => new Set());
    const markDirty = useCallback((siteId: string, dirty: boolean) => setDirtySites((current) => {
        if (current.has(siteId) === dirty) return current;
        const next = new Set(current);
        if (dirty) next.add(siteId); else next.delete(siteId);
        return next;
    }), []);
    const anyDirty = period.sites.some((site) => dirtySites.has(site.id));
    useEffect(() => { onDirtyChange?.(anyDirty); }, [anyDirty, onDirtyChange]);

    return (
        <div className="grid gap-4">
            <p className={MUTED_TEXT}>{TEAM_COPY.description}</p>
            {period.sites.length ? period.sites.map((site) => (
                <SiteTeam key={site.id} scope={scope} period={period} site={site} questions={questions} onDirtyChange={markDirty} />
            )) : <EmptyNote>{TEAM_COPY.noSites}</EmptyNote>}
        </div>
    );
}
