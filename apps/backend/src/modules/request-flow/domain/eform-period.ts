import { EFormType } from '../../eform-request/entities/eform-request.entity';

/** Access that must end, and may last at most `MAX_LIMITED_DAYS` (12 months, leap year included). */
export const LIMITED_FORM_TYPES: ReadonlyArray<EFormType> = [EFormType.VPN, EFormType.NETWORK, EFormType.FLASHDISK];
export const MAX_LIMITED_DAYS = 366;

const DAY_MS = 86_400_000;

/** Validation messages, as the form shows them. */
export const PERIOD_ERROR = {
    endRequired: 'Isi tanggal selesai',
    endBeforeStart: 'Tanggal selesai sebelum mulai',
    tooLong: 'Maksimal 12 bulan',
} as const;

const dayOf = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;

/** Why the access period is not allowed for this type, or null. Dates are `YYYY-MM-DD`; no end date = permanent. */
export function periodError(formType: EFormType, startDate: string, endDate?: string | null): string | null {
    const limited = LIMITED_FORM_TYPES.includes(formType);
    if (!endDate) return limited ? PERIOD_ERROR.endRequired : null;
    const days = dayOf(endDate) - dayOf(startDate);
    if (days < 0) return PERIOD_ERROR.endBeforeStart;
    if (limited && days > MAX_LIMITED_DAYS) return PERIOD_ERROR.tooLong;
    return null;
}
