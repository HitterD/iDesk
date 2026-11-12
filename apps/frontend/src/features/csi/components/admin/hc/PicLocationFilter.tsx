import { useMemo, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCsiTemplates } from '../../../hooks/useCsiHc';
import type { CsiPicView, CsiTemplate } from '../../../hcTypes';
import type { CsiPeriodDetail, CsiScopeParam } from '../../../types';
import { MUTED_TEXT } from '../AdminParts';
import { CSI_TEMPLATE_LOCATIONS } from './hcFormat';

export const PIC_FILTER_COPY = {
    group: 'Lokasi template',
    all: 'Semua PIC',
    teamsHint: 'Tim custom diambil lewat Ambil dari template.',
    outside: (count: number) => `Dipilih di luar filter (${count})`,
} as const;

/** Template locations (fixed order) that have a template. */
export const locationsWithTemplate = (templates: readonly CsiTemplate[]) =>
    CSI_TEMPLATE_LOCATIONS.filter(({ code }) => templates.some((template) => template.locationCode === code));

/** Default filter: the survey's site codes that have a template; none → [] ("Semua PIC"). */
export const defaultLocationFilter = (templates: readonly CsiTemplate[], siteCodes: ReadonlyArray<string | null>) => {
    const codes = new Set(siteCodes.map((code) => code?.toUpperCase()));
    return locationsWithTemplate(templates).filter(({ code }) => codes.has(code)).map(({ code }) => code as string);
};

/** PIC master ids named in the templates of the given locations; null = no filter (every PIC). */
export const picIdsOfLocations = (templates: readonly CsiTemplate[], codes: readonly string[]): ReadonlySet<string> | null => {
    if (!codes.length) return null;
    return new Set(templates.filter((template) => codes.includes(template.locationCode))
        .flatMap((template) => template.pics.flatMap((pic) => (pic.picId ? [pic.picId] : []))));
};

/**
 * Location filter state of the "PIC yang dinilai" step: defaults to the survey sites that have a template until the
 * admin picks; counts only the PICs in the filter, and how many selected PICs it hides.
 */
export function usePicLocationFilter(scope: CsiScopeParam, period: Pick<CsiPeriodDetail, 'sites'>, pics: readonly CsiPicView[], selected: ReadonlySet<string>) {
    const { data, isLoading } = useCsiTemplates(scope);
    const templates = useMemo(() => data?.templates ?? [], [data]);
    const [chosen, setLocations] = useState<string[] | null>(null);
    const siteCodes = period.sites.map((site) => site.code ?? '').join('|');
    const defaults = useMemo(() => defaultLocationFilter(templates, siteCodes.split('|')), [templates, siteCodes]);
    // No default before the templates arrive (callers hold the list back while `loading`).
    const locations = chosen ?? (isLoading ? [] : defaults);
    const inFilter = useMemo(() => picIdsOfLocations(templates, locations), [templates, locations]);
    const filtered = inFilter ? pics.filter((pic) => inFilter.has(pic.id)) : [...pics];
    const filteredIds = filtered.map((pic) => pic.id);
    const selectedInFilter = filteredIds.filter((id) => selected.has(id)).length;
    return { templates, locations, setLocations, filtered, filteredIds, selectedInFilter, outsideFilter: selected.size - selectedInFilter, loading: isLoading };
}

function Chip({ pressed, disabled, onClick, children }: { pressed: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" aria-pressed={pressed} disabled={disabled} onClick={onClick}
            className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                pressed ? 'bg-[hsl(var(--idesk-sapphire)/.12)] text-[hsl(var(--idesk-sapphire))] ring-1 ring-[hsl(var(--idesk-sapphire)/.4)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--idesk-text-secondary))]')}>
            {pressed && <Check className="h-3.5 w-3.5" aria-hidden="true" />}{children}
        </button>
    );
}

/** "Semua PIC" plus one chip per template location (multi-select); an empty selection means every PIC. */
export function PicLocationFilter({ templates, value, onChange }: { templates: readonly CsiTemplate[]; value: readonly string[]; onChange: (codes: string[]) => void }) {
    const locations = locationsWithTemplate(templates);
    if (!locations.length) return null;
    const toggle = (code: string) => onChange(value.includes(code) ? value.filter((row) => row !== code)
        : locations.map((row) => row.code as string).filter((row) => row === code || value.includes(row)));
    return (
        <div className="grid gap-1.5">
            <div role="group" aria-label={PIC_FILTER_COPY.group} className="flex flex-wrap items-center gap-2">
                <Chip pressed={!value.length} onClick={() => onChange([])}>{PIC_FILTER_COPY.all}</Chip>
                {locations.map(({ code, name, hint }) => (
                    <Chip key={code} pressed={value.includes(code)} onClick={() => toggle(code)}>
                        {name} <span className="text-[11.5px] font-normal opacity-75">{`(${hint})`}</span>
                    </Chip>
                ))}
            </div>
            <p className={cn(MUTED_TEXT, 'text-[12px]')}>{PIC_FILTER_COPY.teamsHint}</p>
        </div>
    );
}
