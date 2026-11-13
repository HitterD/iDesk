import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, CopyCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useCsiDimensions, useCsiQuestionSets, useSetCsiTeamQuestions } from '../../hooks/useCsi';
import { sameIds } from '../../lib/csiAdmin';
import { toneClasses } from '../../lib/csiTone';
import { mergedTeamSites, type MergedTeamSite } from '../../lib/siteHandlers';
import { sameOrder, siteTeamRatee, teamQuestionIds } from '../../lib/teamQuestions';
import { useServerDraft } from '../../lib/useServerDraft';
import type { CsiDimension, CsiPeriodDetail, CsiQuestionSet, CsiQuestionType, CsiScopeParam, CsiSiteSummary } from '../../types';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../admin/AdminParts';
import { QuestionTypeChip } from '../admin/questions/QuestionTypeChip';
import { TemplateApplyButton } from '../admin/questions/TemplateApplyButton';
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

/** One site's team: template/set presets or checkboxes, drag order, save per site or apply to all teams. */
function SiteTeam({ scope, period, entry, allSites, questions, sets, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; entry: MergedTeamSite; allSites: readonly CsiSiteSummary[];
    questions: readonly CsiDimension[]; sets: readonly CsiQuestionSet[];
    onDirtyChange: (siteId: string, dirty: boolean) => void;
}) {
    const { site, handledSites } = entry;
    const save = useSetCsiTeamQuestions(scope, period.id);
    const [applyingAll, setApplyingAll] = useState(false);
    const saved = useMemo(() => teamQuestionIds(period, site.id), [period, site.id]);
    const [draft, setDraft] = useServerDraft<string[]>(() => saved, JSON.stringify([period.locked, saved]));
    const locked = period.locked;
    const dirty = !sameOrder(draft, saved);
    useEffect(() => { onDirtyChange(site.id, dirty); }, [dirty, onDirtyChange, site.id]);

    const activeIds = useMemo(() => new Set(questions.map((question) => question.id)), [questions]);
    const usableSets = useMemo(() => sets
        .map((set) => ({ ...set, dimensionIds: set.dimensionIds.filter((id) => activeIds.has(id)) }))
        .filter((set) => set.dimensionIds.length > 0), [sets, activeIds]);
    const byId = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);
    const snapshot = useMemo(() => new Map((siteTeamRatee(period, site.id)?.dimensions ?? [])
        .map((dimension) => [dimension.dimensionId, dimension])), [period, site.id]);
    const items: TeamItem[] = draft.map((id) => ({
        id, name: byId.get(id)?.name ?? snapshot.get(id)?.dimensionName ?? TEAM_COPY.inactive, type: byId.get(id)?.type ?? snapshot.get(id)?.type ?? null,
    }));
    const toggle = (id: string, on: boolean) => setDraft((current) => on ? [...current, id] : current.filter((item) => item !== id));
    const allOn = questions.length > 0 && questions.every((question) => draft.includes(question.id));
    const handledLabel = handledSites.map((child) => child.code ? `${child.name ?? child.code} (${child.code})` : (child.name ?? '')).filter(Boolean).join(', ');

    const applyToAll = async () => {
        if (!draft.length || allSites.length < 2) return;
        setApplyingAll(true);
        try {
            for (const target of allSites) {
                await save.mutateAsync({ siteId: target.id, questionIds: draft });
            }
            toast.success(TEAM_COPY.appliedAllTeams(allSites.length));
        } finally {
            setApplyingAll(false);
        }
    };

    return (
        <AdminSection title={TEAM_COPY.siteTeam(site.name ?? site.code ?? '')}
            actions={locked ? <LockedNote /> : dirty ? <span role="status" className="text-[12.5px] font-medium text-[hsl(var(--ticket-amber-ink))]">{TEAM_COPY.unsaved}</span> : null}>
            <div className="grid gap-5">
                <div className="grid gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={MUTED_TEXT}>{TEAM_COPY.pick}</span>
                        <div className="ml-auto flex flex-wrap items-center gap-1.5">
                            <TemplateApplyButton scope={scope} questions={questions} value={draft} disabled={locked} onApply={setDraft} />
                            {usableSets.map((set) => {
                                const on = sameIds(set.dimensionIds, draft);
                                return (
                                    <button key={set.id} type="button" disabled={locked} aria-pressed={on}
                                        onClick={() => setDraft([...set.dimensionIds])}
                                        className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            on ? 'border-transparent bg-[hsl(var(--idesk-sapphire))] text-white' : 'border-[hsl(var(--idesk-border))] bg-card hover:bg-[hsl(var(--muted)/.5)]')}>
                                        <Bookmark className="h-3 w-3" aria-hidden="true" />
                                        {set.name}
                                        <span className="opacity-70">{`· ${set.dimensionIds.length}`}</span>
                                    </button>
                                );
                            })}
                            <Button type="button" size="sm" variant="subtle" disabled={locked || !questions.length}
                                onClick={() => setDraft(allOn ? [] : questions.map((question) => question.id))}>
                                {allOn ? TEAM_COPY.clearAll : TEAM_COPY.pickAll}
                            </Button>
                        </div>
                    </div>
                    {handledLabel && (
                        <p className={cn('w-fit rounded-full px-2.5 py-0.5 text-[11.5px] font-medium', toneClasses('sky').soft, toneClasses('sky').ink)}>
                            {TEAM_COPY.handledSites(handledLabel)}
                        </p>
                    )}
                    <QuestionChecklist idPrefix={`team-${site.id}`} questions={questions} value={draft} disabled={locked} onToggle={toggle} />
                </div>
                <div className="grid gap-2">
                    <span className={cn(MUTED_TEXT)}>{TEAM_COPY.selected}</span>
                    <SelectedQuestions items={items} disabled={locked} onReorder={setDraft} onRemove={(id) => toggle(id, false)} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {!locked && allSites.length > 1 && (
                        <Button type="button" variant="soft" loading={applyingAll} disabled={!draft.length || save.isPending} onClick={applyToAll}>
                            <CopyCheck className="h-4 w-4" aria-hidden="true" />
                            {TEAM_COPY.applyAllTeams(allSites.length)}
                        </Button>
                    )}
                    <Button variant="primary" loading={save.isPending && !applyingAll} disabled={locked || !dirty || applyingAll}
                        onClick={() => save.mutate({ siteId: site.id, questionIds: draft })}>
                        {TEAM_COPY.save}
                    </Button>
                </div>
            </div>
        </AdminSection>
    );
}

/** Team section: one team per effective period site (delegated sites like SKD -> SPJ merged), with template & bulk options. */
export function StepTeam({ scope, period, onDirtyChange }: {
    scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void;
}) {
    const { data: questions = [] } = useCsiDimensions(scope);
    const { data: sets = [] } = useCsiQuestionSets(scope);
    const entries = useMemo(() => mergedTeamSites(scope, period.sites), [scope, period.sites]);
    const teamSites = useMemo(() => entries.map((entry) => entry.site), [entries]);
    const [dirtySites, setDirtySites] = useState<ReadonlySet<string>>(() => new Set());
    const markDirty = useCallback((siteId: string, dirty: boolean) => setDirtySites((current) => {
        if (current.has(siteId) === dirty) return current;
        const next = new Set(current);
        if (dirty) next.add(siteId); else next.delete(siteId);
        return next;
    }), []);
    const anyDirty = teamSites.some((site) => dirtySites.has(site.id));
    useEffect(() => { onDirtyChange?.(anyDirty); }, [anyDirty, onDirtyChange]);

    return (
        <div className="grid gap-4">
            <p className={MUTED_TEXT}>{TEAM_COPY.description}</p>
            {entries.length ? entries.map((entry) => (
                <SiteTeam key={entry.site.id} scope={scope} period={period} entry={entry} allSites={teamSites}
                    questions={questions} sets={sets} onDirtyChange={markDirty} />
            )) : <EmptyNote>{TEAM_COPY.noSites}</EmptyNote>}
        </div>
    );
}
