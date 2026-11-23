import { KeyRound, Laptop, type LucideIcon } from 'lucide-react';

/** What the ticket list's "Tipe" filter and the API's `requestKind` call a ticket: ordinary IT, or one kind of request. */
export type RequestKind = 'HARDWARE' | 'EFORM';
export type RequestKindFilter = '' | 'IT' | RequestKind;

export const REQUEST_KIND_META: Record<RequestKind, { label: 'Hardware' | 'E-Form'; longLabel: 'Hardware Request' | 'E-Form Request'; icon: LucideIcon; tone: 'hw' | 'ef' }> = {
    HARDWARE: { label: 'Hardware', longLabel: 'Hardware Request', icon: Laptop, tone: 'hw' },
    EFORM: { label: 'E-Form', longLabel: 'E-Form Request', icon: KeyRound, tone: 'ef' },
};

const PARAM_TO_KIND: Record<string, RequestKindFilter> = { hardware: 'HARDWARE', eform: 'EFORM', it: 'IT' };
const KIND_TO_PARAM: Record<string, string> = { HARDWARE: 'hardware', EFORM: 'eform', IT: 'it' };

/** `?type=hardware|eform|it` -> the API value; anything else means no filter. */
export const requestKindFromParam = (raw: string | null | undefined): RequestKindFilter => PARAM_TO_KIND[raw ?? ''] ?? '';
export const requestKindToParam = (kind: RequestKindFilter): string => KIND_TO_PARAM[kind] ?? '';
