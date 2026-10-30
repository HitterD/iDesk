import { useState } from 'react';
import { Bell, Check, ChevronRight, Clock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { toneClasses } from '../../../lib/csiTone';
import { formatDateTime } from '../../../lib/format';
import { MUTED_TEXT } from '../AdminParts';
import { SiteBadge } from '../report/reportParts';
import { RateeAvatar } from '../../respond/RateeAvatar';
import { countByFilter, filterRows, matchesFilter, type PersonFilter, type PersonRow } from './respondentModel';

const ALL_SITES = 'all';
const PILL = 'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium';
const FILTER_LABELS: Readonly<Record<PersonFilter, string>> = { all: 'Semua', todo: 'Belum', done: 'Sudah' };

export interface PersonListProps {
    rows: readonly PersonRow[];
    sites: ReadonlyArray<{ id: string; code: string | null; name: string | null }>;
    /** False in OPEN mode: there is no rater list to remind. */
    canRemind: boolean;
    reminded: ReadonlySet<string>;
    remindingId: string | null;
    onRemind: (userId: string) => void;
    onOpenResponse: (responseId: string) => void;
}

function Status({ done }: { done: boolean }) {
    const tone = toneClasses(done ? 'green' : 'amber');
    return done
        ? <span className={cn(PILL, tone.soft, tone.ink)}><Check className="h-3 w-3" aria-hidden="true" />Sudah mengisi</span>
        : <span className={cn(PILL, tone.soft, tone.ink)}><Clock className="h-3 w-3" aria-hidden="true" />Belum</span>;
}

function RowAction({ row, canRemind, reminded, busy, onRemind }: {
    row: PersonRow; canRemind: boolean; reminded: boolean; busy: boolean; onRemind: () => void;
}) {
    if (row.done) return <span className={cn(MUTED_TEXT, 'text-[12px]')}>{row.submittedAt ? formatDateTime(row.submittedAt) : ''}</span>;
    if (!canRemind || !row.userId) return null;
    if (reminded) return <span className={cn(PILL, toneClasses('sky').soft, toneClasses('sky').ink)}>Pengingat terkirim</span>;
    return (
        <Button variant="soft" size="sm" onClick={onRemind} loading={busy} aria-label={`Ingatkan ${row.name}`}>
            {!busy && <Bell aria-hidden="true" />}Ingatkan
        </Button>
    );
}

function PersonItem({ row, siteCode, ...action }: { row: PersonRow; siteCode: string | null; canRemind: boolean; reminded: boolean; busy: boolean; onRemind: () => void; onOpen: () => void }) {
    const body = (
        <>
            <RateeAvatar name={row.name} avatarUrl={null} size="sm" />
            <span className="min-w-0">
                <b className="block truncate text-[13.5px] font-semibold">{row.name}</b>
                {row.detail && <span className={cn(MUTED_TEXT, 'block truncate text-[12px]')}>{row.detail}</span>}
            </span>
        </>
    );
    return (
        <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_50px_130px_150px]">
            {row.done && row.responseId ? (
                <button type="button" onClick={action.onOpen} aria-label={`Lihat jawaban ${row.name}`}
                    className="group flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {body}<ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                </button>
            ) : <span className="flex min-w-0 items-center gap-3">{body}</span>}
            <span className="hidden sm:block"><SiteBadge code={siteCode} /></span>
            <span className="hidden sm:block"><Status done={row.done} /></span>
            <span className="justify-self-end"><RowAction row={row} {...action} /></span>
        </li>
    );
}

/** Tabs Semua | Belum | Sudah (with counts), site filter, search; not-yet first; per-row reminder. */
export function PersonList({ rows, sites, canRemind, reminded, remindingId, onRemind, onOpenResponse }: PersonListProps) {
    const [filter, setFilter] = useState<PersonFilter>('all');
    const [site, setSite] = useState<string>(ALL_SITES);
    const [search, setSearch] = useState('');
    const base = filterRows(rows, { site: site === ALL_SITES ? null : site, search });
    const counts = countByFilter(base);
    const visible = base.filter(matchesFilter(filter));
    const codeOf = (siteId: string | null) => sites.find((row) => row.id === siteId)?.code ?? null;
    const filterOptions = (Object.keys(FILTER_LABELS) as PersonFilter[]).map((key) => ({
        value: key, label: <>{FILTER_LABELS[key]} <b className="tabular-nums">{counts[key]}</b></>, ariaLabel: `${FILTER_LABELS[key]} ${counts[key]}`,
    }));
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' }, ...sites.map((row) => ({ value: row.id, label: row.code ?? row.name ?? row.id }))];
    return (
        <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
                <SegmentedControl aria-label="Status pengisian" className="dash-seg" options={filterOptions} value={filter} onValueChange={setFilter} />
                {sites.length > 1 && <SegmentedControl aria-label="Filter site responden" className="dash-seg" options={siteOptions} value={site} onValueChange={setSite} />}
                <label className="flex h-9 min-w-[min(240px,100%)] flex-1 items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 focus-within:ring-2 focus-within:ring-ring">
                    <Search className="h-4 w-4 shrink-0 text-[hsl(var(--idesk-text-secondary))]" aria-hidden="true" />
                    <input type="search" aria-label="Cari responden" placeholder="Cari nama atau departemen…" value={search}
                        onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                </label>
            </div>
            {visible.length ? (
                <ul aria-label="Daftar responden" className="divide-y divide-[hsl(var(--idesk-border)/.5)]">
                    {visible.map((row) => (
                        <PersonItem key={row.key} row={row} siteCode={codeOf(row.siteId)} canRemind={canRemind}
                            reminded={!!row.userId && reminded.has(row.userId)} busy={!!row.userId && remindingId === row.userId}
                            onRemind={() => row.userId && onRemind(row.userId)} onOpen={() => row.responseId && onOpenResponse(row.responseId)} />
                    ))}
                </ul>
            ) : <p className={cn(MUTED_TEXT, 'rounded-2xl bg-[hsl(var(--muted)/.5)] px-4 py-6 text-center')}>{rows.length ? 'Tidak ada yang cocok.' : 'Belum ada jawaban.'}</p>}
        </div>
    );
}
