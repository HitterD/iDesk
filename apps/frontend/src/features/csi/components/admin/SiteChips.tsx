import { X } from 'lucide-react';
import { SearchablePicker } from '@/components/ui/searchable-picker';
import { useActiveSites } from '@/components/site/useActiveSites';
import { formatSites } from '../../lib/location';
import type { CsiSiteSummary } from '../../types';
import { SITE_COPY } from '../wizard/wizardCopy';
import { FIELD_LABEL, LockedNote, MUTED_TEXT } from './AdminParts';

interface SiteChipsProps {
    value: readonly string[];
    onChange: (siteIds: string[]) => void;
    /** Sites already saved on the period; shown as the read-only list when `locked`. */
    saved?: readonly CsiSiteSummary[];
    locked?: boolean;
}

/** Selected sites as removable chips plus a picker for the remaining ones; at least one is required. */
export function SiteChips({ value, onChange, saved = [], locked }: SiteChipsProps) {
    const { data: sites = [] } = useActiveSites();
    const byId = new Map(sites.map((site) => [site.id, site]));
    const options = sites.filter((site) => !value.includes(site.id))
        .map((site) => ({ value: site.id, label: `${site.code} · ${site.name}` }));

    if (locked) {
        return (
            <div className="grid gap-1.5">
                <span className={FIELD_LABEL}>{SITE_COPY.label}</span>
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[14px] font-medium">{formatSites([...saved])}</p>
                    <LockedNote />
                </div>
            </div>
        );
    }
    return (
        <div className="grid gap-2">
            <span className={FIELD_LABEL}>{SITE_COPY.label}</span>
            <ul aria-label={SITE_COPY.selected} className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
                {value.map((id) => {
                    const site = byId.get(id) ?? saved.find((item) => item.id === id);
                    const name = site?.code ?? site?.name ?? id;
                    return (
                        <li key={id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--idesk-sapphire)/.1)] py-1 pl-3 pr-1 text-[13px] font-medium text-[hsl(var(--idesk-sapphire))]">
                            {name}
                            <button type="button" aria-label={SITE_COPY.remove(name)} onClick={() => onChange(value.filter((item) => item !== id))}
                                className="grid h-5 w-5 place-items-center rounded-full hover:bg-[hsl(var(--idesk-sapphire)/.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <X className="h-3 w-3" aria-hidden="true" />
                            </button>
                        </li>
                    );
                })}
                <li>
                    <SearchablePicker label={SITE_COPY.add} value="" options={options} onValueChange={(id) => onChange([...value, id])}
                        placeholder={value.length ? SITE_COPY.addMore : SITE_COPY.placeholder} searchPlaceholder={SITE_COPY.search}
                        triggerClassName="min-h-8" />
                </li>
            </ul>
            {!value.length && <p role="status" className={MUTED_TEXT}>{SITE_COPY.required}</p>}
        </div>
    );
}
