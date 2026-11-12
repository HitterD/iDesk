import { scoreTone, type CsiScoreBands } from '../../../lib/csiTone';

/**
 * Canonical HC template locations in display order, with the SJA plant name as hint (mirrors the backend
 * CSI_TEMPLATE_LOCATIONS); Jakarta's template/site code is JTB, not JKT.
 */
export const CSI_TEMPLATE_LOCATIONS = [
    { code: 'SPJ', name: 'Sepanjang', hint: 'SJA 1' },
    { code: 'KRW', name: 'Karawang', hint: 'SJA 2' },
    { code: 'SKD', name: 'Sukodono', hint: 'SJA 3' },
    { code: 'SMG', name: 'Semarang', hint: 'SJA Semarang' },
    { code: 'JTB', name: 'Jakarta', hint: 'SJA Jatibaru' },
] as const;

/** SJA hint of a site / template location code, or null for other codes. */
export const locationHint = (code: string | null | undefined): string | null =>
    CSI_TEMPLATE_LOCATIONS.find((row) => row.code === code?.toUpperCase())?.hint ?? null;

/** Acronyms kept upper-case after title-casing (HC, GA, PSW, HSE, SJA, ...). */
const ACRONYMS = new Set(['HC', 'HCC', 'HCD', 'HCS', 'HCBP', 'GA', 'PSW', 'HSE', 'SJA', 'IR', 'TA', 'QC', 'QA', 'PPIC', 'ICT', 'RTD', 'BM', 'ATK', 'PPJP', 'CSV', 'HRIS', 'DAFT', 'R&D', 'S&OE', 'FGW', 'MT']);

/** "PAYROLL & BENEFIT" → "Payroll & Benefit", "HC SERVICES" → "HC Services" (directory data is upper-case). */
export const titleCase = (value: string) => value.split(/(\s+)/).map((word) => {
    const bare = word.replace(/[(),.]/g, '').toUpperCase();
    if (ACRONYMS.has(bare)) return word.toUpperCase();
    return word.toLowerCase().replace(/(^|[&/(.,-])(\p{L})/gu, (_match, lead: string, letter: string) => lead + letter.toUpperCase());
}).join('');

const DASH = '–';
export const formatScore = (value: number | null | undefined) =>
    value === null || value === undefined ? DASH : value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ScoreTone = 'green' | 'amber' | 'red';
const INK_CLASS: Readonly<Record<ScoreTone, string>> = {
    green: 'text-[hsl(var(--ticket-green-ink))]', amber: 'text-[hsl(var(--ticket-amber-ink))]', red: 'text-[hsl(var(--ticket-red-ink))]',
};
const FILL_CLASS: Readonly<Record<ScoreTone, string>> = {
    green: 'bg-[hsl(var(--ticket-green)/.13)]', amber: 'bg-[hsl(var(--ticket-amber)/.15)]', red: 'bg-[hsl(var(--ticket-red)/.13)]',
};
const BAR_CLASS: Readonly<Record<ScoreTone, string>> = {
    green: 'bg-[hsl(var(--ticket-green))]', amber: 'bg-[hsl(var(--ticket-amber))]', red: 'bg-[hsl(var(--ticket-red))]',
};
const toneOf = (value: number | null | undefined, bands: CsiScoreBands) => scoreTone(value ?? null, bands) as ScoreTone | 'neutral';

/** Score text colour with the survey's bands (same rule as scoreTone); no score = secondary text. */
export const scoreToneClass = (value: number | null | undefined, bands: CsiScoreBands) => {
    const tone = toneOf(value, bands);
    return tone === 'neutral' ? 'text-[hsl(var(--idesk-text-secondary))]' : INK_CLASS[tone];
};
export const scoreFillClass = (value: number | null | undefined, bands: CsiScoreBands) => {
    const tone = toneOf(value, bands);
    return tone === 'neutral' ? '' : FILL_CLASS[tone];
};
/** Solid bar colour (dimension bars); no score = red, as an empty bar. */
export const scoreBarClass = (value: number | null | undefined, bands: CsiScoreBands) => {
    const tone = toneOf(value, bands);
    return BAR_CLASS[tone === 'neutral' ? 'red' : tone];
};
