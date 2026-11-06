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

/** Same thresholds as the app's score tone (≥ 4.5 green, ≥ 4 amber, below red). */
export const scoreToneClass = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'text-[hsl(var(--idesk-text-secondary))]';
    if (value >= 4.5) return 'text-[hsl(var(--ticket-green-ink))]';
    return value >= 4 ? 'text-[hsl(var(--ticket-amber-ink))]' : 'text-[hsl(var(--ticket-red-ink))]';
};
export const scoreFillClass = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    if (value >= 4.5) return 'bg-[hsl(var(--ticket-green)/.13)]';
    return value >= 4 ? 'bg-[hsl(var(--ticket-amber)/.15)]' : 'bg-[hsl(var(--ticket-red)/.13)]';
};
