import { useState } from 'react';
import { CalendarRange, ChevronRight } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { useActiveSites } from '@/components/site/useActiveSites';
import { cn } from '@/lib/utils';
import { useCsiPeriods } from '../../hooks/useCsi';
import { CSI_MODE_LABELS } from '../../lib/csiAdmin';
import { formatDateRange } from '../../lib/format';
import { formatSites } from '../../lib/location';
import type { CsiPeriodListItem, CsiScopeParam } from '../../types';
import { WIZARD_COPY } from '../wizard/wizardCopy';
import { ADMIN_PANEL, CreateButton, EmptyNote, MUTED_TEXT, PublishPill, StatusPill } from './AdminParts';
import { Button } from '@/components/ui/button';
import { MemoExportDialog } from './MemoExportDialog';

const ALL_SITES = '';
const SKELETON_ROWS = 3;

function Pills({ period }: { period: CsiPeriodListItem }) {
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            <PublishPill status={period.publishStatus} />
            <StatusPill status={period.status} />
        </span>
    );
}

function PeriodRow({ period, onOpen }: { period: CsiPeriodListItem; onOpen: () => void }) {
    return (
        <li>
            <button type="button" onClick={onOpen}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 text-left hover:bg-[hsl(var(--muted)/.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_auto]">
                <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{period.title}</span>
                    <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{`${formatSites(period.sites)} · ${CSI_MODE_LABELS[period.respondentMode]}`}</span>
                </span>
                <span className={cn(MUTED_TEXT, 'hidden tabular-nums sm:block')}>{formatDateRange(period.startDate, period.endDate)}</span>
                <span className="hidden sm:block"><Pills period={period} /></span>
                <span className="hidden text-[13px] tabular-nums sm:block">{`${period.responseCount} responden`}</span>
                <ChevronRight className="h-4 w-4 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                <span className={cn(MUTED_TEXT, 'col-span-2 flex flex-wrap items-center gap-2 sm:hidden')}>
                    <Pills period={period} />{formatDateRange(period.startDate, period.endDate)} · {`${period.responseCount} responden`}
                </span>
            </button>
        </li>
    );
}

interface PeriodsTabProps {
    scope: CsiScopeParam;
    /** Drafts resume in the wizard, published surveys open the detail. */
    onOpen: (period: CsiPeriodListItem) => void;
    onCreate: () => void;
}

export function PeriodsTab({ scope, onOpen, onCreate }: PeriodsTabProps) {
    const [siteId, setSiteId] = useState(ALL_SITES);
    const [memoOpen, setMemoOpen] = useState(false);
    const { data: periods, isLoading, isError, refetch } = useCsiPeriods(scope, siteId || undefined);
    const { data: sites = [] } = useActiveSites();
    const siteOptions = [{ value: ALL_SITES, label: 'Semua site' }, ...sites.map((site) => ({ value: site.id, label: `${site.code} · ${site.name}` }))];

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <SearchablePicker label="Filter site" value={siteId} options={siteOptions} onValueChange={setSiteId}
                    searchPlaceholder="Cari site…" triggerClassName="min-h-9 min-w-[160px]" />
                <span className="flex-1" />
                <Button variant="soft" onClick={() => setMemoOpen(true)}>Export memo PDF</Button>
                <CreateButton label={WIZARD_COPY.create} onClick={onCreate} />
            </div>
            <section aria-label="Daftar survei" className={cn(ADMIN_PANEL, 'overflow-hidden')}>
                {isLoading && (
                    <div className="grid gap-px" aria-busy="true" aria-label="Memuat survei">
                        {Array.from({ length: SKELETON_ROWS }, (_, index) => <div key={index} className="h-16 animate-pulse bg-[hsl(var(--muted)/.5)] motion-reduce:animate-none" />)}
                    </div>
                )}
                {isError && <div className="p-5"><ErrorState compact message="Gagal memuat survei." onRetry={() => refetch()} /></div>}
                {periods && !periods.length && (
                    <div className="p-5">
                        <EmptyNote>
                            <CalendarRange className="mx-auto mb-2 h-6 w-6 opacity-60" aria-hidden="true" />
                            {`Belum ada survei. Pilih "${WIZARD_COPY.create}" untuk mulai mengumpulkan penilaian.`}
                        </EmptyNote>
                    </div>
                )}
                {periods && periods.length > 0 && (
                    <ul className="divide-y divide-[hsl(var(--idesk-border)/.55)]">
                        {periods.map((period) => <PeriodRow key={period.id} period={period} onOpen={() => onOpen(period)} />)}
                    </ul>
                )}
            </section>
            {memoOpen && <MemoExportDialog scope={scope} open onOpenChange={setMemoOpen} />}
        </div>
    );
}
