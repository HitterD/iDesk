import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { useCsiHcRecap } from '../../../hooks/useCsiHc';
import type { CsiScopeParam } from '../../../types';
import type { CsiHcRecap, CsiLocationCells, CsiRecapRow } from '../../../hcTypes';
import { AdminSection, EmptyNote } from '../AdminParts';
import type { CsiScoreBands } from '../../../lib/csiTone';
import { formatScore, scoreBarClass, scoreFillClass, scoreToneClass, titleCase } from './hcFormat';

/**
 * HC recap: averages per layanan → bagian → PIC and per respondent division → department → bagian, in the columns
 * SJA 1..4, Jakarta and ALL SJA; plus every respondent's stars per PIC (admin only).
 */
type View = 'services' | 'respondents' | 'answers';
const VIEWS = [
    { value: 'services', label: 'Layanan · Bagian · PIC' },
    { value: 'respondents', label: 'Per divisi responden' },
    { value: 'answers', label: 'Jawaban per responden' },
] as const;
const TH = 'px-2.5 py-2 text-left text-[11.5px] font-bold uppercase tracking-wide text-[hsl(var(--idesk-text-secondary))]';
const TD = 'px-2.5 py-1.5 text-[13px] tabular-nums';

const MASKED_TITLE = 'Disembunyikan: kurang dari 3 responden';
const cellTitle = (value: number | null, ratings: number) => {
    if (!ratings) return 'Belum ada penilaian';
    return value === null ? MASKED_TITLE : `${ratings} penilaian`;
};

/** A cell with ratings but no average is masked (fewer than 3 respondents): it shows "–" like an empty one. */
function ScoreCell({ value, ratings, strong, bands }: { value: number | null; ratings: number; strong?: boolean; bands: CsiScoreBands }) {
    const scored = ratings > 0 && value !== null;
    return (
        <td className={cn(TD, 'text-right', scored ? scoreFillClass(value, bands) : '')} title={cellTitle(value, ratings)}>
            <span className={cn(scoreToneClass(scored ? value : null, bands), strong && 'font-bold')}>{scored ? formatScore(value) : '–'}</span>
        </td>
    );
}

function LocationCells({ recap, row, strong }: { recap: CsiHcRecap; row: CsiLocationCells; strong?: boolean }) {
    const bands = recap.scoreBands;
    return (
        <>
            {recap.locations.map((location) => <ScoreCell key={location.code} {...row.byLocation[location.code]} value={row.byLocation[location.code].average} strong={strong} bands={bands} />)}
            <ScoreCell value={row.all.average} ratings={row.all.ratings} strong bands={bands} />
            <td className={cn(TD, 'text-right text-[hsl(var(--idesk-text-secondary))]')}>{row.all.ratings}</td>
        </>
    );
}

function LocationHead({ recap, first }: { recap: CsiHcRecap; first: string }) {
    return (
        <thead className="sticky top-0 z-10 bg-[hsl(var(--idesk-surface))]">
            <tr>
                <th />
                <th colSpan={recap.locations.length + 1} className="border-b-2 border-[hsl(var(--idesk-sapphire)/.35)] px-2.5 pt-2 pb-1 text-center text-[11.5px] font-bold text-[hsl(var(--idesk-sapphire))]">
                    Rata-rata bintang (1-5) menurut lokasi responden yang menilai
                </th>
                <th />
            </tr>
            <tr className="border-b border-[hsl(var(--border))]">
                <th className={TH}>{first}</th>
                {recap.locations.map((location) => <th key={location.code} className={cn(TH, 'text-right')}>{location.label}</th>)}
                <th className={cn(TH, 'text-right text-[hsl(var(--idesk-sapphire))]')}>ALL SJA</th>
                <th className={cn(TH, 'text-right')} title="Jumlah penilaian: satu responden menilai satu PIC">Jml penilaian</th>
            </tr>
        </thead>
    );
}

function DimensionChips({ recap, row }: { recap: CsiHcRecap; row: Pick<CsiRecapRow, 'dimensions'> }) {
    return (
        <span className="flex flex-wrap gap-1">
            {recap.dimensions.map((label) => (
                <span key={label} className={cn('rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', scoreFillClass(row.dimensions[label], recap.scoreBands))}>
                    {`${label} `}<b className={scoreToneClass(row.dimensions[label], recap.scoreBands)}>{formatScore(row.dimensions[label])}</b>
                </span>
            ))}
        </span>
    );
}

function ServicesTable({ recap, expandAll }: { recap: CsiHcRecap; expandAll?: boolean }) {
    const [open, setOpen] = useState<Set<string>>(() => new Set(recap.services.filter((row) => row.level === 'service' || (expandAll && row.level === 'bagian')).map((row) => row.key)));
    const [dims, setDims] = useState(false);
    const toggle = (key: string) => setOpen((previous) => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });
    // Parent keys are derived from the row itself (same key format as the backend recap).
    const serviceKey = (row: CsiRecapRow) => `s:${row.serviceCode ?? ''}`;
    const bagianKey = (row: CsiRecapRow) => `b:${row.serviceCode ?? ''}:${row.bagian ?? ''}`;
    return (
        <div className="grid gap-2">
            <label className="flex items-center gap-2 self-end text-[12.5px] font-medium">
                <input type="checkbox" checked={dims} onChange={(event) => setDims(event.target.checked)} />Tampilkan nilai per dimensi
            </label>
            <div className="max-h-[640px] overflow-auto rounded-2xl ring-1 ring-[hsl(var(--border))]">
                <table className="w-full min-w-[860px] border-collapse">
                    <LocationHead recap={recap} first="Layanan / Bagian / PIC" />
                    <tbody>
                        {recap.services.map((row) => {
                            const hidden = (row.level !== 'service' && !open.has(serviceKey(row))) || (row.level === 'pic' && !open.has(bagianKey(row)));
                            if (hidden) return null;
                            const expandable = row.level !== 'pic';
                            return (
                                <Fragment key={row.key}>
                                    <tr className={cn('border-b border-[hsl(var(--border)/.6)]', row.level === 'service' && 'bg-[hsl(var(--idesk-sapphire)/.07)]', row.level === 'bagian' && 'bg-[hsl(var(--muted)/.5)]')}>
                                        <td className={cn(TD, row.level === 'bagian' && 'pl-7', row.level === 'pic' && 'pl-12')}>
                                            <button type="button" disabled={!expandable} onClick={() => toggle(row.key)} className="flex items-center gap-1.5 text-left">
                                                {expandable && (open.has(row.key) ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />)}
                                                <span className={cn(row.level === 'service' ? 'font-bold' : row.level === 'bagian' ? 'font-semibold' : '')}>
                                                    {row.level === 'service' ? row.label : titleCase(row.label)}
                                                </span>
                                                {row.level === 'pic' && row.jobTitle && <span className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">{`· ${titleCase(row.jobTitle)}`}</span>}
                                                {row.level === 'pic' && row.serviceFunction && <span className="rounded-md bg-[hsl(var(--idesk-sapphire)/.09)] px-1.5 text-[11.5px] font-medium text-[hsl(var(--idesk-sapphire))]">{row.serviceFunction}</span>}
                                            </button>
                                        </td>
                                        <LocationCells recap={recap} row={row} strong={row.level !== 'pic'} />
                                    </tr>
                                    {dims && (
                                        <tr className="border-b border-[hsl(var(--border)/.6)]">
                                            <td colSpan={recap.locations.length + 3} className={cn('px-2.5 pb-2', row.level === 'bagian' && 'pl-7', row.level === 'pic' && 'pl-12')}>
                                                <DimensionChips recap={recap} row={row} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RespondentTable({ recap }: { recap: CsiHcRecap }) {
    return (
        <div className="max-h-[640px] overflow-auto rounded-2xl ring-1 ring-[hsl(var(--border))]">
            <table className="w-full min-w-[860px] border-collapse">
                <LocationHead recap={recap} first="Divisi / Departemen / Bagian responden" />
                <tbody>
                    {recap.respondentGroups.map((row) => (
                        <tr key={row.key} className={cn('border-b border-[hsl(var(--border)/.6)]', row.level === 'division' && 'bg-[hsl(var(--idesk-sapphire)/.07)]')}>
                            <td className={cn(TD, row.level === 'department' && 'pl-7', row.level === 'bagian' && 'pl-12', row.level === 'division' && 'font-bold', row.level === 'department' && 'font-semibold')}>
                                {titleCase(row.label)}
                            </td>
                            <LocationCells recap={recap} row={row} strong={row.level === 'division'} />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Stars({ value }: { value: number | undefined }) {
    if (value === undefined) return <span className="text-[hsl(var(--idesk-text-secondary))]">–</span>;
    return (
        <span className="inline-flex items-center gap-0.5" aria-label={`${value} bintang`}>
            {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} className={cn('h-3 w-3', index < value ? 'fill-[hsl(var(--ticket-amber))] text-[hsl(var(--ticket-amber))]' : 'text-[hsl(var(--border))]')} aria-hidden="true" />
            ))}
        </span>
    );
}

function AnswersTable({ recap }: { recap: CsiHcRecap }) {
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const rows = recap.respondents.filter((row) => !needle || [row.name, row.division, row.department, row.bagian].some((value) => (value ?? '').toLowerCase().includes(needle)));
    const locationLabel = (code: string | null) => recap.locations.find((location) => location.code === code)?.label ?? '–';
    return (
        <div className="grid gap-2">
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari responden, divisi atau bagian" aria-label="Cari responden"
                className="h-9 w-full max-w-sm rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--idesk-surface))] px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <div className="max-h-[640px] overflow-auto rounded-2xl ring-1 ring-[hsl(var(--border))]">
                <table className="w-full min-w-[980px] border-collapse">
                    <thead className="sticky top-0 z-10 bg-[hsl(var(--idesk-surface))]">
                        <tr className="border-b border-[hsl(var(--border))]">
                            <th className={TH}>Responden</th><th className={TH}>PIC dinilai</th>
                            {recap.dimensions.map((label) => <th key={label} className={TH}>{label}</th>)}
                            <th className={cn(TH, 'text-right')}>Rata-rata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((respondent) => respondent.pics.map((pic, index) => (
                            <tr key={`${respondent.responseId}-${index}`} className={cn('border-b border-[hsl(var(--border)/.5)]', index === 0 && 'border-t-2 border-t-[hsl(var(--border))]')}>
                                {index === 0 && (
                                    <td rowSpan={respondent.pics.length} className={cn(TD, 'align-top')}>
                                        <p className="font-semibold">{respondent.name}</p>
                                        <p className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">{[respondent.division, respondent.department, respondent.bagian].filter(Boolean).map((value) => titleCase(value!)).join(' · ')}</p>
                                        <p className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">{`${locationLabel(respondent.location)} · rata-rata `}<b className={scoreToneClass(respondent.average, recap.scoreBands)}>{formatScore(respondent.average)}</b></p>
                                    </td>
                                )}
                                <td className={TD}>
                                    <p className="font-medium">{titleCase(pic.name)}</p>
                                    <p className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">{[pic.serviceCode, pic.bagian ? titleCase(pic.bagian) : null].filter(Boolean).join(' · ')}</p>
                                </td>
                                {recap.dimensions.map((label) => <td key={label} className={TD}><Stars value={pic.scores[label]} /></td>)}
                                <td className={cn(TD, 'text-right font-bold', scoreToneClass(pic.average, recap.scoreBands))}>{formatScore(pic.average)}</td>
                            </tr>
                        )))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Overview({ recap }: { recap: CsiHcRecap }) {
    const bands = recap.scoreBands;
    return (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="grid grid-cols-3 gap-2">
                <div role="group" aria-label="ALL SJA" className="rounded-2xl bg-[hsl(var(--idesk-sapphire)/.08)] p-3">
                    <p className="text-[11.5px] font-semibold uppercase text-[hsl(var(--idesk-text-secondary))]">ALL SJA</p>
                    <p className={cn('text-[26px] font-bold tabular-nums', scoreToneClass(recap.overall.all.average, bands))}>{formatScore(recap.overall.all.average)}</p>
                    <p className="text-[11.5px] text-[hsl(var(--idesk-text-secondary))]">dari 5</p>
                </div>
                <div className="rounded-2xl bg-[hsl(var(--muted)/.6)] p-3">
                    <p className="text-[11.5px] font-semibold uppercase text-[hsl(var(--idesk-text-secondary))]">Responden</p>
                    <p className="text-[26px] font-bold tabular-nums">{recap.overall.respondents}</p>
                </div>
                <div className="rounded-2xl bg-[hsl(var(--muted)/.6)] p-3">
                    <p className="text-[11.5px] font-semibold uppercase text-[hsl(var(--idesk-text-secondary))]">Penilaian PIC</p>
                    <p className="text-[26px] font-bold tabular-nums">{recap.overall.all.ratings}</p>
                </div>
            </div>
            <div className="grid gap-1.5 rounded-2xl bg-[hsl(var(--muted)/.45)] p-3">
                {recap.dimensions.map((label) => {
                    const value = recap.overall.dimensions[label];
                    return (
                        <div key={label} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)_44px] items-center gap-2 text-[12.5px]">
                            {/* ICT questions have no short label: long texts are clamped to two lines, full text on hover. */}
                            <span className="line-clamp-2 font-semibold" title={label}>{label}</span>
                            <span className="h-2 overflow-hidden rounded-full bg-[hsl(var(--border))]">
                                <span className={cn('block h-full rounded-full', scoreBarClass(value, bands))}
                                    style={{ width: `${((value ?? 0) / 5) * 100}%` }} />
                            </span>
                            <b className={cn('text-right tabular-nums', scoreToneClass(value, bands))}>{formatScore(value)}</b>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Overview, view switch and the three tables; shared by the admin recap and the service owner report. */
/** `expandAll` also opens every bagian (one-service reports are short enough to show every PIC at once). */
export function HcRecapBody({ recap, expandAll }: { recap: CsiHcRecap; expandAll?: boolean }) {
    const [view, setView] = useState<View>('services');
    return (
        <div className="grid gap-4">
            <Overview recap={recap} />
            <SegmentedControl aria-label="Tampilan rekap HC" className="dash-seg w-fit" options={VIEWS} value={view} onValueChange={setView} />
            {view === 'services' && <ServicesTable recap={recap} expandAll={expandAll} />}
            {view === 'respondents' && <RespondentTable recap={recap} />}
            {view === 'answers' && <AnswersTable recap={recap} />}
        </div>
    );
}

export function HcRecapPanel({ scope, periodId }: { scope: CsiScopeParam; periodId: string }) {
    const { data: recap, isLoading, isError, refetch } = useCsiHcRecap(scope, periodId);
    return (
        <AdminSection title="Rekap HC per layanan, bagian dan PIC"
            description="Angka = rata-rata bintang (skala 1-5) dari semua penilaian, sehingga bisa desimal (mis. 4,35). Kolom SJA 1-4/Jakarta = lokasi responden yang menilai, bukan lokasi PIC. SJA 4 = Semarang.">
            {isLoading && <div className="h-40 animate-pulse rounded-2xl bg-[hsl(var(--muted))]" aria-busy="true" aria-label="Memuat rekap" />}
            {isError && <ErrorState compact message="Gagal memuat rekap HC." onRetry={() => refetch()} />}
            {recap && !recap.services.length && <EmptyNote>Belum ada PIC pada survei ini.</EmptyNote>}
            {recap && recap.services.length > 0 && <HcRecapBody recap={recap} />}
        </AdminSection>
    );
}
