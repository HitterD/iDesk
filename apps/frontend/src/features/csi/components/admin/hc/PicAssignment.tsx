import { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiDimensions } from '../../../hooks/useCsi';
import { useCsiPics, useSetCsiPeriodPics } from '../../../hooks/useCsiHc';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import type { CsiPicView } from '../../../hcTypes';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../AdminParts';
import { titleCase } from './hcFormat';
import { TemplatePullButton } from './templates/TemplatePullDialog';
import { isHcDecided } from '../../../lib/hcMode';

/**
 * Wizard step "PIC yang dinilai" (every HC survey): pick whole layanan / bagian or single PICs from the HC PIC master,
 * and the star questions every PIC gets. Either respondents later choose among these PICs, or HC decides who rates
 * which PIC on the Penilai step (then the PICs, raters and pairs can also come from a location template).
 */
const COPY = {
    title: 'PIC yang dinilai',
    description: 'Pilih PIC HC yang bisa dinilai pada survei ini. Responden nanti memilih sendiri PIC yang pernah melayaninya.',
    decidedDescription: 'Pilih PIC HC yang dinilai pada survei ini, atau ambil PIC beserta penilainya dari template lokasi. Siapa menilai siapa diatur di langkah Penilai.',
    questions: 'Pertanyaan untuk setiap PIC',
    save: 'Simpan PIC',
    saved: 'Tersimpan',
    unsaved: 'Belum disimpan',
    all: 'Pilih semua',
    none: 'Kosongkan',
    noPics: 'Belum ada PIC. Impor "Data Hirarki Approver" di Pengaturan → PIC HC.',
} as const;

const groupBy = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>();
    rows.forEach((row) => map.set(key(row), [...(map.get(key(row)) ?? []), row]));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
};

function Tick({ state }: { state: 'all' | 'some' | 'none' }) {
    return (
        <span aria-hidden="true" className={cn('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border',
            state === 'none' ? 'border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))]' : 'border-[hsl(var(--idesk-sapphire))] bg-[hsl(var(--idesk-sapphire))] text-white')}>
            {state === 'all' && <Check className="h-3 w-3" strokeWidth={3} />}
            {state === 'some' && <span className="h-0.5 w-2 rounded bg-white" />}
        </span>
    );
}
const stateOf = (ids: string[], selected: ReadonlySet<string>) => {
    const count = ids.filter((id) => selected.has(id)).length;
    return count === 0 ? 'none' : count === ids.length ? 'all' : 'some';
};

export function PicAssignment({ scope, period, onDirtyChange }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void }) {
    const { data: pics = [], isLoading } = useCsiPics(scope);
    const { data: questions = [] } = useCsiDimensions(scope);
    const save = useSetCsiPeriodPics(scope, period.id);
    const current = useMemo(() => period.ratees.filter((ratee) => ratee.picId), [period.ratees]);
    const initialPics = useMemo(() => new Set(current.map((ratee) => ratee.picId!)), [current]);
    const initialQuestions = useMemo(() => {
        const used = current[0]?.dimensions.map((dimension) => dimension.dimensionId) ?? [];
        return new Set(used.length ? used : questions.filter((question) => question.type === 'STAR').map((question) => question.id));
    }, [current, questions]);
    const [selected, setSelected] = useState<Set<string>>(initialPics);
    // Saved PICs changed elsewhere (e.g. "Ambil dari template"): follow them instead of keeping a stale selection
    // that would look unsaved and, if saved, drop the new PICs.
    const savedKey = [...initialPics].sort().join('|');
    const [syncedKey, setSyncedKey] = useState(savedKey);
    if (syncedKey !== savedKey) {
        setSyncedKey(savedKey);
        setSelected(new Set(initialPics));
    }
    const [chosenQuestions, setChosenQuestions] = useState<Set<string> | null>(null);
    const questionIds = chosenQuestions ?? initialQuestions;
    const [query, setQuery] = useState('');
    const locked = period.locked;
    const decided = isHcDecided(scope, period);
    const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));
    const dirty = !sameSet(selected, initialPics) || (chosenQuestions !== null && !sameSet(chosenQuestions, initialQuestions));
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const needle = query.trim().toLowerCase();
    const visible = pics.filter((pic) => !needle || pic.fullName.toLowerCase().includes(needle) || (pic.jobTitle ?? '').toLowerCase().includes(needle)
        || (pic.bagian ?? '').toLowerCase().includes(needle));
    const setMany = (ids: string[], on: boolean) => setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
        return next;
    });
    const toggleQuestion = (id: string) => setChosenQuestions(() => {
        const next = new Set(questionIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const submit = () => save.mutate({
        picIds: [...selected], dimensionIds: questions.filter((question) => questionIds.has(question.id)).map((question) => question.id),
    }, { onSuccess: () => setChosenQuestions(null) });

    return (
        <AdminSection title={COPY.title} description={decided ? COPY.decidedDescription : COPY.description}
            actions={locked ? <LockedNote /> : (
                <div className="flex flex-wrap items-center gap-3">
                    {decided && <TemplatePullButton scope={scope} period={period} />}
                    <span role="status" className={cn('text-[12.5px] font-medium', dirty ? 'text-[hsl(var(--ticket-amber-ink))]' : 'text-[hsl(var(--idesk-text-secondary))]')}>
                        {dirty ? COPY.unsaved : `${initialPics.size} PIC · ${COPY.saved}`}
                    </span>
                    <Button onClick={submit} disabled={!dirty || save.isPending || (selected.size > 0 && !questionIds.size)}>{COPY.save}</Button>
                </div>
            )}>
            <div className="grid gap-4">
                <div>
                    <h3 className="mb-2 text-[13px] font-semibold">{COPY.questions}</h3>
                    <div className="flex flex-wrap gap-2">
                        {questions.map((question) => (
                            <button key={question.id} type="button" disabled={locked} onClick={() => toggleQuestion(question.id)} aria-pressed={questionIds.has(question.id)}
                                className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                                    questionIds.has(question.id) ? 'bg-[hsl(var(--idesk-sapphire)/.12)] text-[hsl(var(--idesk-sapphire))] ring-1 ring-[hsl(var(--idesk-sapphire)/.4)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))]')}>
                                {questionIds.has(question.id) && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{question.shortLabel || question.name}
                            </button>
                        ))}
                    </div>
                </div>
                {isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                {!isLoading && !pics.length && <EmptyNote>{COPY.noPics}</EmptyNote>}
                {pics.length > 0 && (
                    <>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[220px] flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" aria-hidden="true" />
                                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, jabatan atau bagian" aria-label="Cari PIC"
                                    className="h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                            </div>
                            <Button variant="soft" disabled={locked} onClick={() => setMany(pics.map((pic) => pic.id), true)}>{COPY.all}</Button>
                            <Button variant="ghost" disabled={locked} onClick={() => setSelected(new Set())}>{COPY.none}</Button>
                            <span className={MUTED_TEXT}>{`${selected.size} dari ${pics.length} PIC dipilih`}</span>
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                            {groupBy(visible, (pic) => pic.serviceCode).map(([service, servicePics]) => (
                                <ServiceColumn key={service} service={service} pics={servicePics} selected={selected} locked={locked} onSet={setMany} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AdminSection>
    );
}

function ServiceColumn({ service, pics, selected, locked, onSet }: {
    service: string; pics: CsiPicView[]; selected: ReadonlySet<string>; locked: boolean; onSet: (ids: string[], on: boolean) => void;
}) {
    const ids = pics.map((pic) => pic.id);
    const state = stateOf(ids, selected);
    return (
        <section className="rounded-2xl bg-[hsl(var(--muted)/.45)] p-3">
            <button type="button" disabled={locked} onClick={() => onSet(ids, state !== 'all')} className="mb-2 flex w-full items-center gap-2 text-left">
                <Tick state={state} />
                <span className="text-[14px] font-bold">{service}</span>
                <span className="text-[12.5px] text-[hsl(var(--idesk-text-secondary))]">{`· ${pics[0]?.serviceName ?? ''} · ${ids.filter((id) => selected.has(id)).length}/${ids.length}`}</span>
            </button>
            <div className="grid max-h-[460px] gap-2 overflow-auto pr-1">
                {groupBy(pics, (pic) => pic.bagian ?? '-').map(([bagian, people]) => {
                    const bagianIds = people.map((pic) => pic.id);
                    const bagianState = stateOf(bagianIds, selected);
                    return (
                        <div key={bagian} className="rounded-xl bg-[hsl(var(--idesk-surface))] p-2">
                            <button type="button" disabled={locked} onClick={() => onSet(bagianIds, bagianState !== 'all')} className="mb-1 flex w-full items-center gap-2 text-left">
                                <Tick state={bagianState} />
                                <span className="text-[12px] font-bold uppercase tracking-wide text-[hsl(var(--idesk-text-secondary))]">{`${titleCase(bagian)} · ${people.length}`}</span>
                            </button>
                            <ul className="grid gap-0.5">
                                {people.map((pic) => (
                                    <li key={pic.id}>
                                        <button type="button" disabled={locked} onClick={() => onSet([pic.id], !selected.has(pic.id))}
                                            className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-[hsl(var(--muted)/.6)]">
                                            <Tick state={selected.has(pic.id) ? 'all' : 'none'} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block break-words text-[13px] leading-snug">{titleCase(pic.fullName)}</span>
                                                <span className="block break-words text-[11.5px] leading-snug text-[hsl(var(--idesk-text-secondary))]">{titleCase(pic.jobTitle ?? '')}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
