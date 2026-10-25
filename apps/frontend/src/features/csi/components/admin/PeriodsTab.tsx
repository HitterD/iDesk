import { useState } from 'react';
import { CalendarRange, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { useActiveSites } from '@/components/site/useActiveSites';
import { cn } from '@/lib/utils';
import { useCsiPeriods } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import type { CsiPeriodListItem, CsiScopeParam } from '../../types';
import { ADMIN_PANEL, CreateButton, EmptyNote, MUTED_TEXT, StatusPill } from './AdminParts';
import { PeriodEditor } from './PeriodEditor';

const ALL_SITES = '';
const SKELETON_ROWS = 3;

function PeriodRow({ period, onOpen }: { period: CsiPeriodListItem; onOpen: () => void }) {
    return (
        <li>
            <button type="button" onClick={onOpen}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-[hsl(var(--muted)/.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_auto]">
                <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{period.title}</span>
                    <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{`${period.site?.code ?? '—'} · ${CSI_MODE_LABELS[period.respondentMode]}`}</span>
                </span>
                <span className={cn(MUTED_TEXT, 'hidden tabular-nums sm:block')}>{formatDateRange(period.startDate, period.endDate)}</span>
                <span className="hidden sm:block"><StatusPill status={period.status} /></span>
                <span className="hidden text-[13px] tabular-nums sm:block">{`${period.responseCount} responden`}</span>
                <ChevronRight className="h-4 w-4 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                <span className={cn(MUTED_TEXT, 'col-span-2 flex flex-wrap items-center gap-2 sm:hidden')}>
                    <StatusPill status={period.status} />{formatDateRange(period.startDate, period.endDate)} · {`${period.responseCount} responden`}
                </span>
            </button>
        </li>
    );
}

export function PeriodsTab({ scope, onOpen }: { scope: CsiScopeParam; onOpen: (id: string) => void }) {
    const [siteId, setSiteId] = useState(ALL_SITES);
    const [creating, setCreating] = useState(false);
    const { data: periods, isLoading, isError, refetch } = useCsiPeriods(scope, siteId || undefined);
    const { data: allPeriods = [] } = useCsiPeriods(scope);
    const { data: sites = [] } = useActiveSites();
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' }, ...sites.map((site) => ({ value: site.id, label: `${site.code} · ${site.name}` }))];

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <SearchablePicker label="Filter site" value={siteId} options={siteOptions} onValueChange={setSiteId}
                    searchPlaceholder="Cari site…" triggerClassName="min-h-9 min-w-[160px]" />
                <span className="flex-1" />
                <CreateButton label="Buat Periode" onClick={() => setCreating(true)} />
            </div>
            <section aria-label="Daftar periode" className={cn(ADMIN_PANEL, 'overflow-hidden')}>
                {isLoading && (
                    <div className="grid gap-px" aria-busy="true" aria-label="Memuat periode">
                        {Array.from({ length: SKELETON_ROWS }, (_, index) => <div key={index} className="h-16 animate-pulse bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" />)}
                    </div>
                )}
                {isError && <div className="p-5"><ErrorState compact message="Gagal memuat periode." onRetry={() => refetch()} /></div>}
                {periods && !periods.length && (
                    <div className="p-5">
                        <EmptyNote>
                            <CalendarRange className="mx-auto mb-2 h-6 w-6 opacity-60" aria-hidden="true" />
                            Belum ada periode. Buat periode untuk mulai mengumpulkan penilaian.
                        </EmptyNote>
                    </div>
                )}
                {periods && periods.length > 0 && (
                    <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)]">
                        {periods.map((period) => <PeriodRow key={period.id} period={period} onOpen={() => onOpen(period.id)} />)}
                    </ul>
                )}
            </section>
            <Dialog open={creating} onOpenChange={setCreating}>
                <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Buat periode</DialogTitle>
                        <DialogDescription>Rentang tanggal untuk site yang sama tidak boleh bertabrakan.</DialogDescription>
                    </DialogHeader>
                    <PeriodEditor scope={scope} periods={allPeriods} onCancel={() => setCreating(false)}
                        onSaved={(period) => { setCreating(false); onOpen(period.id); }} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
