import { AlertTriangle } from 'lucide-react';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useCsiPeriodOverlaps } from '../../hooks/useCsi';
import { CSI_SEARCH_DEBOUNCE_MS } from '../../lib/csiAdmin';
import { toneClasses } from '../../lib/csiTone';
import { formatDateRange } from '../../lib/format';
import type { CsiPeriodOverlap, CsiScopeParam } from '../../types';

const ISO = 'yyyy-MM-dd';

/** Same length as the chosen range, starting the day after the last clashing survey ends. */
export function nextFreeRange(startDate: string, endDate: string, clashes: readonly CsiPeriodOverlap[]): { startDate: string; endDate: string } | null {
    if (!clashes.length || !startDate || !endDate) return null;
    const length = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
    const lastEnd = clashes.map((clash) => clash.endDate).sort().at(-1)!;
    const start = addDays(parseISO(lastEnd), 1);
    return { startDate: format(start, ISO), endDate: format(addDays(start, Math.max(0, length)), ISO) };
}

interface OverlapNoticeProps {
    scope: CsiScopeParam;
    siteIds: readonly string[];
    startDate: string;
    endDate: string;
    /** The period being edited (never clashes with itself). */
    excludeId?: string;
    onUseDates: (range: { startDate: string; endDate: string }) => void;
    onOpenPeriod?: (id: string) => void;
}

/**
 * Live check of the chosen sites and dates against published surveys of the scope. Saving as draft stays allowed;
 * publishing is refused by the server while the clash remains, so the admin sees it here first with a one-click fix.
 */
export function OverlapNotice({ scope, siteIds, startDate, endDate, excludeId, onUseDates, onOpenPeriod }: OverlapNoticeProps) {
    const query = useDebounce(JSON.stringify({ siteIds, startDate, endDate }), CSI_SEARCH_DEBOUNCE_MS);
    const debounced = JSON.parse(query) as { siteIds: string[]; startDate: string; endDate: string };
    const { data: clashes = [] } = useCsiPeriodOverlaps(scope, { ...debounced, excludeId });
    if (!clashes.length) return null;
    const suggestion = nextFreeRange(startDate, endDate, clashes);
    const amber = toneClasses('amber');
    return (
        <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]', amber.soft, amber.ink)}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
                {clashes.map((clash) => (
                    <p key={clash.id} className="font-semibold">
                        {`Tanggal bertabrakan dengan "${clash.title}" (${clash.sites.map((site) => site.code ?? site.name).join(', ')}, ${formatDateRange(clash.startDate, clash.endDate)}) yang sudah terbit.`}
                    </p>
                ))}
                <p className="mt-0.5">Survei ini tetap bisa disimpan sebagai draft. Supaya bisa diterbitkan, geser tanggalnya atau keluarkan site yang bentrok.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {suggestion && (
                        <Button type="button" size="sm" variant="soft" onClick={() => onUseDates(suggestion)}>
                            {`Pakai ${formatDateRange(suggestion.startDate, suggestion.endDate)}`}
                        </Button>
                    )}
                    {onOpenPeriod && clashes.length === 1 && (
                        <Button type="button" size="sm" variant="subtle" onClick={() => onOpenPeriod(clashes[0].id)}>{`Buka "${clashes[0].title}"`}</Button>
                    )}
                </div>
            </div>
        </div>
    );
}
