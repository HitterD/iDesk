import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

/** All CSI numbers use Indonesian separators ("4,5", "85,0%"). */
const LOCALE = 'id-ID';
const EMPTY = '—';
const AVERAGE_FORMAT = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SCORE_FORMAT = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** One-decimal star average (respondent review screen). */
export const formatAverage = (value: number) => AVERAGE_FORMAT.format(value);

/** Report average as returned by the backend (2 decimals max); null → "—". */
export const formatScore = (value: number | null) => value === null ? EMPTY : SCORE_FORMAT.format(value);

/** Satisfaction index percentage; null → "—". */
export const formatPercent = (value: number | null) => value === null ? EMPTY : `${PERCENT_FORMAT.format(value)}%`;

/** Calendar date "YYYY-MM-DD" → "01 Okt 2026" (parsed as a local date, no timezone shift). */
export const formatDate = (value: string) => format(parseISO(value), 'dd MMM yyyy', { locale: idLocale });

/** Timestamp → "01 Okt 2026, 14.05". */
export const formatDateTime = (value: string) => format(parseISO(value), 'dd MMM yyyy, HH.mm', { locale: idLocale });

export const formatDateRange = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;
