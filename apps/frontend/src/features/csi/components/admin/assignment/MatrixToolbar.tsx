import { ArrowLeftRight, Check, Search, Star, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useCsiUserSearch, useSetCsiRaters } from '../../../hooks/useCsi';
import { CSI_SEARCH_DEBOUNCE_MS } from '../../../lib/csiAdmin';
import { toneClasses } from '../../../lib/csiTone';
import type { CsiScopeParam } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { StatCard } from '../StatCard';
import type { MatrixStats } from './matrixModel';

const MIN_ADD_TERM = 2;
const MAX_SUGGESTIONS = 5;
export const ALL_SITES = 'all';

export function MatrixStatCards({ stats }: { stats: MatrixStats }) {
    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,45%),1fr))] gap-3">
            <StatCard tone="sky" icon={Users} label="Penilai terpilih" value={stats.raters} hint="terdaftar di periode ini" />
            <StatCard tone="teal" icon={Star} label="Subjek" value={stats.subjects} hint={`${stats.teams} tim · ${stats.people} individu`} />
            <StatCard tone="green" icon={Check} label="Pasangan penilaian" value={stats.pairs} hint="≈ jumlah form yang akan diisi" />
            <StatCard tone="amber" icon={ArrowLeftRight} label="Lintas site" value={stats.cross} hint="pengecualian manual" attention />
        </div>
    );
}

export function MatrixLegend() {
    const swatch = 'grid h-[18px] w-[18px] place-items-center rounded-md text-white';
    return (
        <div className="flex flex-wrap items-center gap-3.5 text-[12px]" aria-label="Legenda" role="note">
            <span className="inline-flex items-center gap-1.5"><span className={cn(swatch, toneClasses('green').fill)}><Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" /></span>Sama site</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn(swatch, toneClasses('amber').fill)}><Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" /></span>Lintas site</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn(swatch, toneClasses('neutral').soft, MUTED_TEXT)}>–</span>Diri sendiri</span>
        </div>
    );
}

/** Active users matching the search who are not raters yet; "Tambah" adds them to the period (search = add, spec).
 * Hidden while the matrix is dirty: a member change re-seeds the draft from the server. */
function AddRaterSuggestions({ scope, periodId, term, raterUserIds }: { scope: CsiScopeParam; periodId: string; term: string; raterUserIds: readonly string[] }) {
    const debounced = useDebounce(term, CSI_SEARCH_DEBOUNCE_MS);
    const { data: users = [] } = useCsiUserSearch(scope, debounced.length >= MIN_ADD_TERM ? debounced : '');
    const setRaters = useSetCsiRaters(scope, periodId);
    if (debounced.length < MIN_ADD_TERM) return null;
    const candidates = users.filter((user) => !raterUserIds.includes(user.id)).slice(0, MAX_SUGGESTIONS);
    if (!candidates.length) return null;
    return (
        <ul aria-label="Tambah penilai" className="flex flex-wrap items-center gap-2">
            <li className={cn(MUTED_TEXT, 'text-[12px]')}>Belum jadi penilai:</li>
            {candidates.map((user) => (
                <li key={user.id}>
                    <Button variant="soft" size="sm" loading={setRaters.isPending} aria-label={`Tambah ${user.fullName} sebagai penilai`}
                        onClick={() => setRaters.mutate({ userIds: [...raterUserIds, user.id] })}>
                        <UserPlus aria-hidden="true" />{[user.fullName, user.site?.code].filter(Boolean).join(' · ')}
                    </Button>
                </li>
            ))}
        </ul>
    );
}

export interface MatrixFilterBarProps {
    scope: CsiScopeParam;
    periodId: string;
    search: string;
    onSearch: (value: string) => void;
    site: string;
    onSite: (value: string) => void;
    siteOptions: ReadonlyArray<{ value: string; label: string }>;
    raterUserIds: readonly string[];
    canAdd: boolean;
}

export function MatrixFilterBar({ scope, periodId, search, onSearch, site, onSite, siteOptions, raterUserIds, canAdd }: MatrixFilterBarProps) {
    return (
        <div className="grid gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex h-9 min-w-[min(260px,100%)] items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 focus-within:ring-2 focus-within:ring-ring">
                    <Search className="h-4 w-4 shrink-0 text-[hsl(var(--idesk-text-secondary))]" aria-hidden="true" />
                    <input type="search" aria-label="Cari penilai" placeholder="Cari penilai (nama, dept)…" value={search}
                        onChange={(event) => onSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
                </label>
                {siteOptions.length > 2 && <SegmentedControl aria-label="Filter site penilai" className="dash-seg" options={siteOptions} value={site} onValueChange={onSite} />}
                <span className="ml-auto"><MatrixLegend /></span>
            </div>
            {canAdd && <AddRaterSuggestions scope={scope} periodId={periodId} term={search.trim()} raterUserIds={raterUserIds} />}
        </div>
    );
}
