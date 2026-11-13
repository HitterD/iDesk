import { AlertTriangle, Info } from 'lucide-react';
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
const sameTitle = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

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
    title?: string;
    siteIds: readonly string[];
    startDate: string;
    endDate: string;
    /** The period being edited (never clashes with itself). */
    excludeId?: string;
    onUseDates: (range: { startDate: string; endDate: string }) => void;
    onOpenPeriod?: (id: string) => void;
}

/**
 * Live check of the chosen sites and dates against published surveys of the scope.
 * Different titles are allowed and shown as an informational note; identical titles remain blocked on publish.
 */
export function OverlapNotice({ scope, title = '', siteIds, startDate, endDate, excludeId, onUseDates, onOpenPeriod }: OverlapNoticeProps) {
    const query = useDebounce(JSON.stringify({ siteIds, startDate, endDate }), CSI_SEARCH_DEBOUNCE_MS);
    const debounced = JSON.parse(query) as { siteIds: string[]; startDate: string; endDate: string };
    const { data: clashes = [] } = useCsiPeriodOverlaps(scope, { ...debounced, excludeId });
    if (!clashes.length) return null;
    const hasTitle = title.trim().length > 0;
    const blocking = hasTitle ? clashes.filter((clash) => sameTitle(clash.title, title)) : clashes;
    const concurrent = clashes.filter((clash) => !blocking.includes(clash));
    const suggestion = blocking.length ? nextFreeRange(startDate, endDate, blocking) : null;
    const amber = toneClasses('amber');
    const sky = toneClasses('sky');
    return (
        <div className="grid gap-2">
            {blocking.length > 0 && (
                <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]', amber.soft, amber.ink)}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        {blocking.map((clash) => (
                            <p key={clash.id} className="font-semibold">
                                {hasTitle
                                    ? `Judul dan tanggal bertabrakan dengan "${clash.title}" (${clash.sites.map((site) => site.code ?? site.name).join(', ')}, ${formatDateRange(clash.startDate, clash.endDate)}) yang sudah terbit.`
                                    : `Tanggal bertabrakan dengan "${clash.title}" (${clash.sites.map((site) => site.code ?? site.name).join(', ')}, ${formatDateRange(clash.startDate, clash.endDate)}) yang sudah terbit.`}
                            </p>
                        ))}
                        <p className="mt-0.5">
                            {hasTitle
                                ? 'Survei ini tetap bisa disimpan sebagai draft. Ubah judulnya agar bisa jalan bersamaan, atau geser tanggal / keluarkan site yang bentrok.'
                                : 'Survei ini tetap bisa disimpan sebagai draft. Supaya bisa diterbitkan, bedakan judulnya, geser tanggalnya, atau keluarkan site yang bentrok.'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {suggestion && (
                                <Button type="button" size="sm" variant="soft" onClick={() => onUseDates(suggestion)}>
                                    {`Pakai ${formatDateRange(suggestion.startDate, suggestion.endDate)}`}
                                </Button>
                            )}
                            {onOpenPeriod && blocking.length === 1 && (
                                <Button type="button" size="sm" variant="subtle" onClick={() => onOpenPeriod(blocking[0].id)}>{`Buka "${blocking[0].title}"`}</Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {concurrent.length > 0 && (
                <div role="status" className={cn('flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]', sky.soft, sky.ink)}>
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        {concurrent.map((clash) => (
                            <p key={clash.id} className="font-semibold">
                                {`Tanggal bersamaan dengan "${clash.title}" (${clash.sites.map((site) => site.code ?? site.name).join(', ')}, ${formatDateRange(clash.startDate, clash.endDate)}).`}
                            </p>
                        ))}
                        <p className="mt-0.5">Tetap bisa dibuat & diterbitkan karena judulnya berbeda — di menu Survei CSI pengguna, keduanya dibedakan lewat judul masing-masing.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
