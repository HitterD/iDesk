import { DEFAULT_TIMEZONE } from '../../sla-config/business-hours.calc';

const LOCATION_SEPARATOR = ' & ';
const TIMESTAMP_SUFFIX = 'GMT+7';
const SORT_LAST = '￿';
const WIB_PARTS = new Intl.DateTimeFormat('en-US', {
    timeZone: DEFAULT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
});

export type CsiSiteSummary = { id?: string; code?: string | null; name?: string | null };

/** Site names ordered by code and joined with ' & ' (shared by Excel and the PDF memo). */
export function formatLocation(sites: CsiSiteSummary[]): string {
    return [...sites]
        .sort((a, b) => (a.code ?? SORT_LAST).localeCompare(b.code ?? SORT_LAST))
        .map((site) => site.name ?? site.code ?? '')
        .filter(Boolean)
        .join(LOCATION_SEPARATOR);
}

/** `YYYY/MM/DD h:mm:ss A GMT+7`, rendered in WIB regardless of the process timezone. */
export function formatTimestampWib(date: Date): string {
    const parts = Object.fromEntries(WIB_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod} ${TIMESTAMP_SUFFIX}`;
}
