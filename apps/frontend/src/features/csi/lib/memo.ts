import type { CsiMemoHeader, CsiPeriodListItem } from '../types';

export const MEMO_TEXT_MAX = 300;
export const MEMO_PARAGRAPH_MAX = 2000;
export const MEMO_PERIOD_MAX = 20;
export const MEMO_CLOSING = 'Demikian informasi dari kami.\nAtas perhatian dan kerja samanya kami mengucapkan terima kasih.';

export function defaultOpening(periods: readonly CsiPeriodListItem[]): string {
    if (!periods.length) return '';
    const latest = periods.map((period) => period.endDate).sort().at(-1)!;
    const date = new Date(`${latest}T12:00:00+07:00`);
    const month = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date);
    const sites = [...new Map(periods.flatMap((period) => period.sites).map((site) => [site.id, site.name])).values()];
    return `Sehubungan dengan telah berakhirnya penilaian Customer Satisfaction Index (CSI) yang dilakukan secara online pada bulan ${month}, maka berikut adalah Nilai CSI ${latest.slice(0, 4)} untuk masing-masing personil ${periods[0].teamLabel} dari site ${sites.join(', ')}.`;
}

export function todayWib(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Only the standing header (recipients, number, sender, closing, signers) is reused from the last memo.
 * Date, subject and opening describe THIS memo, so they always start fresh — a saved value would silently
 * put last year's date or sites into an official document.
 */
export function memoDefaults(saved: Partial<CsiMemoHeader> | undefined, periods: readonly CsiPeriodListItem[], today = todayWib()): CsiMemoHeader {
    return {
        to: saved?.to ?? '', cc: saved?.cc ?? '', number: saved?.number ?? '', from: saved?.from ?? '',
        subject: `Nilai CSI ${today.slice(0, 4)}`, date: today,
        opening: defaultOpening(periods), closing: saved?.closing || MEMO_CLOSING,
        signerLeft: saved?.signerLeft ?? { name: '', title: '' }, signerRight: saved?.signerRight ?? { name: '', title: '' },
    };
}

export function validMemo(header: CsiMemoHeader): boolean {
    const fields = [header.to, header.number, header.from, header.subject, header.signerLeft.name, header.signerLeft.title, header.signerRight.name, header.signerRight.title];
    const bounded = [...fields, header.cc].every((field) => field.trim().length <= MEMO_TEXT_MAX);
    return fields.every((field) => field.trim().length > 0) && bounded && /^\d{4}-\d{2}-\d{2}$/.test(header.date)
        && header.opening.length <= MEMO_PARAGRAPH_MAX && header.closing.length <= MEMO_PARAGRAPH_MAX;
}
