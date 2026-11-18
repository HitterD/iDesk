import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCsiDimensions } from '../../../hooks/useCsi';
import { useCsiHcRaters, useCsiPics, useSetCsiPeriodPics } from '../../../hooks/useCsiHc';
import { CSI_ADD_PICS_LOCKED_NOTE, isRaterAdditionOpen } from '../../../lib/csiAdmin';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import type { CsiPicView } from '../../../hcTypes';
import { AdminSection, EmptyNote, LockedNote, MUTED_TEXT } from '../AdminParts';
import { titleCase } from './hcFormat';
import { PIC_FILTER_COPY, PicLocationFilter, usePicLocationFilter } from './PicLocationFilter';
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

const EMPTY_LOCKED_IDS: ReadonlySet<string> = new Set();

export function PicAssignment({ scope, period, onDirtyChange }: { scope: CsiScopeParam; period: CsiPeriodDetail; onDirtyChange?: (dirty: boolean) => void }) {
    const { data: pics = [], isLoading: picsLoading } = useCsiPics(scope);
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
    const filter = usePicLocationFilter(scope, period, pics, selected);
    const { filtered, filteredIds, selectedInFilter, outsideFilter } = filter;
    // The list waits for the templates too, so the default location filter never makes the counter jump.
    const isLoading = picsLoading || filter.loading;
    const addOnlyLocked = period.locked && isRaterAdditionOpen(period);
    const fullyLocked = period.locked && !addOnlyLocked;
    const questionLocked = period.locked;
    const lockedIds = addOnlyLocked ? initialPics : EMPTY_LOCKED_IDS;
    const decided = isHcDecided(scope, period);
    const { data: hcRaters, isLoading: ratersLoading } = useCsiHcRaters(scope, period.id, decided && current.length > 0);
    const unpairedNames = useMemo(() => {
        if (!decided || ratersLoading || !hcRaters) return [];
        const paired = new Set(hcRaters.flatMap((rater) => rater.periodRateeIds));
        return current.filter((ratee) => !paired.has(ratee.id)).map((ratee) => titleCase(ratee.displayName));
    }, [decided, ratersLoading, hcRaters, current]);
    const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));
    const dirty = !sameSet(selected, initialPics) || (chosenQuestions !== null && !sameSet(chosenQuestions, initialQuestions));
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

    const needle = query.trim().toLowerCase();
    const visible = filtered.filter((pic) => !needle || pic.fullName.toLowerCase().includes(needle) || (pic.jobTitle ?? '').toLowerCase().includes(needle)
        || (pic.bagian ?? '').toLowerCase().includes(needle));
    const setMany = (ids: string[], on: boolean) => setSelected((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => {
            if (on) next.add(id);
            else if (!lockedIds.has(id)) next.delete(id);
        });
        return next;
    });
    const toggleQuestion = (id: string) => setChosenQuestions(() => {
        const next = new Set(questionIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const submit = () => save.mutate({
        picIds: [...selected], dimensionIds: questions.filter((question) => questionIds.has(question.id)).map((question) => question.id),
    }, {
        onSuccess: () => {
            setChosenQuestions(null);
            toast.success(decided ? 'PIC tersimpan · Penilai di Template lokasi ikut disinkronkan.' : 'PIC survei tersimpan.');
        },
    });
    const addedCount = Math.max(0, selected.size - initialPics.size);
    const hasMutableFiltered = filteredIds.some((id) => !lockedIds.has(id) && selected.has(id));

    return (
        <AdminSection title={COPY.title} description={decided ? COPY.decidedDescription : COPY.description}
            actions={fullyLocked ? <LockedNote /> : (
                <div className="flex flex-wrap items-center gap-3">
                    {addOnlyLocked && <LockedNote>{CSI_ADD_PICS_LOCKED_NOTE}</LockedNote>}
                    {decided && <TemplatePullButton scope={scope} period={period} />}
                    <span role="status" className={cn('text-[12.5px] font-medium', dirty ? 'text-[hsl(var(--ticket-amber-ink))]' : 'text-[hsl(var(--idesk-text-secondary))]')}>
                        {dirty ? (addOnlyLocked ? `+${addedCount} PIC baru belum disimpan` : COPY.unsaved) : `${initialPics.size} PIC · ${COPY.saved}`}
                    </span>
                    <Button onClick={submit} disabled={!dirty || save.isPending || (selected.size > 0 && !questionIds.size)}>
                        {addOnlyLocked ? 'Simpan tambahan PIC' : COPY.save}
                    </Button>
                </div>
            )}>
            <div className="grid gap-4">
                <div>
                    <h3 className="mb-2 text-[13px] font-semibold">{COPY.questions}</h3>
                    <div className="flex flex-wrap gap-2">
                        {questions.map((question) => (
                            <button key={question.id} type="button" disabled={questionLocked} onClick={() => toggleQuestion(question.id)} aria-pressed={questionIds.has(question.id)}
                                className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                                    questionIds.has(question.id) ? 'bg-[hsl(var(--idesk-sapphire)/.12)] text-[hsl(var(--idesk-sapphire))] ring-1 ring-[hsl(var(--idesk-sapphire)/.4)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))]')}>
                                {questionIds.has(question.id) && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{question.shortLabel || question.name}
                            </button>
                        ))}
                    </div>
                </div>
                {decided && addOnlyLocked && (
                    <p className="rounded-xl bg-[hsl(var(--idesk-sapphire)/.08)] px-3 py-2 text-[12.5px] text-[hsl(var(--idesk-text-secondary))]">
                        Penilai terkonfirmasi di <b>Template lokasi</b> otomatis ikut ditambahkan saat Anda klik <b>Simpan tambahan PIC</b> (jawaban lama tetap aman). Bila Template lokasi diperbarui belakangan, klik <b>Ambil dari template</b>.
                    </p>
                )}
                {unpairedNames.length > 0 && (
                    <p role="status" className="rounded-xl bg-[hsl(var(--ticket-amber)/.14)] px-3 py-2 text-[12.5px] text-[hsl(var(--ticket-amber-ink))]">
                        {`${unpairedNames.length} PIC terpilih belum punya penilai (${unpairedNames.slice(0, 4).join(', ')}${unpairedNames.length > 4 ? `, +${unpairedNames.length - 4} lainnya` : ''}). Klik `}
                        <b>Ambil dari template</b>
                        {' atau atur di tab '}
                        <b>Siapa menilai siapa</b>.
                    </p>
                )}
                {isLoading && <div className="h-32 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" />}
                {!isLoading && !pics.length && <EmptyNote>{COPY.noPics}</EmptyNote>}
                {!isLoading && pics.length > 0 && (
                    <>
                        <PicLocationFilter templates={filter.templates} value={filter.locations} onChange={filter.setLocations} />
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[220px] flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" aria-hidden="true" />
                                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, jabatan atau bagian" aria-label="Cari PIC"
                                    className="h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] pl-9 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                            </div>
                            <Button variant="soft" disabled={fullyLocked} onClick={() => setMany(filteredIds, true)}>{COPY.all}</Button>
                            <Button variant="ghost" disabled={fullyLocked || (addOnlyLocked && !hasMutableFiltered)} onClick={() => setMany(filteredIds, false)}>{COPY.none}</Button>
                            <span className={MUTED_TEXT}>{`${selectedInFilter} dari ${filteredIds.length} PIC dipilih`}</span>
                        </div>
                        {outsideFilter > 0 && <p className={MUTED_TEXT}>{PIC_FILTER_COPY.outside(outsideFilter)}</p>}
                        <div className="grid gap-3 lg:grid-cols-2">
                            {groupBy(visible, (pic) => pic.serviceCode).map(([service, servicePics]) => (
                                <ServiceColumn key={service} service={service} pics={servicePics} selected={selected} locked={fullyLocked} lockedIds={lockedIds} onSet={setMany} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </AdminSection>
    );
}

function ServiceColumn({ service, pics, selected, locked, lockedIds, onSet }: {
    service: string; pics: CsiPicView[]; selected: ReadonlySet<string>; locked: boolean; lockedIds: ReadonlySet<string>; onSet: (ids: string[], on: boolean) => void;
}) {
    const ids = pics.map((pic) => pic.id);
    const mutableIds = ids.filter((id) => !lockedIds.has(id));
    const state = stateOf(ids, selected);
    const allMutableOn = mutableIds.length > 0 && mutableIds.every((id) => selected.has(id));
    return (
        <section className="rounded-2xl bg-[hsl(var(--muted)/.45)] p-3">
            <button type="button" disabled={locked || !mutableIds.length} onClick={() => onSet(mutableIds, !allMutableOn)} className="mb-2 flex w-full items-center gap-2 text-left">
                <Tick state={state} />
                <span className="text-[14px] font-bold">{service}</span>
                <span className="text-[12.5px] text-[hsl(var(--idesk-text-secondary))]">{`· ${pics[0]?.serviceName ?? ''} · ${ids.filter((id) => selected.has(id)).length}/${ids.length}`}</span>
            </button>
            <div className="grid max-h-[460px] gap-2 overflow-auto pr-1">
                {groupBy(pics, (pic) => pic.bagian ?? '-').map(([bagian, people]) => {
                    const bagianIds = people.map((pic) => pic.id);
                    const mutableBagianIds = bagianIds.filter((id) => !lockedIds.has(id));
                    const bagianState = stateOf(bagianIds, selected);
                    const allBagianMutableOn = mutableBagianIds.length > 0 && mutableBagianIds.every((id) => selected.has(id));
                    return (
                        <div key={bagian} className="rounded-xl bg-[hsl(var(--idesk-surface))] p-2">
                            <button type="button" disabled={locked || !mutableBagianIds.length} onClick={() => onSet(mutableBagianIds, !allBagianMutableOn)} className="mb-1 flex w-full items-center gap-2 text-left">
                                <Tick state={bagianState} />
                                <span className="text-[12px] font-bold uppercase tracking-wide text-[hsl(var(--idesk-text-secondary))]">{`${titleCase(bagian)} · ${people.length}`}</span>
                            </button>
                            <ul className="grid gap-0.5">
                                {people.map((pic) => {
                                    const itemLocked = locked || lockedIds.has(pic.id);
                                    return (
                                        <li key={pic.id}>
                                            <button type="button" disabled={itemLocked} onClick={() => onSet([pic.id], !selected.has(pic.id))}
                                                className={cn('flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left',
                                                    itemLocked ? 'cursor-not-allowed opacity-70' : 'hover:bg-[hsl(var(--muted)/.6)]')}>
                                                <Tick state={selected.has(pic.id) ? 'all' : 'none'} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block break-words text-[13px] leading-snug">{titleCase(pic.fullName)}</span>
                                                    <span className="block break-words text-[11.5px] leading-snug text-[hsl(var(--idesk-text-secondary))]">{titleCase(pic.jobTitle ?? '')}</span>
                                                </span>
                                                {!locked && lockedIds.has(pic.id) && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" aria-label="PIC terkunci" />}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
