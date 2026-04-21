import { format, formatDistanceToNow } from 'date-fns';
import { id as ID } from 'date-fns/locale';

export const fmtDate = (iso?: string | null) => iso ? format(new Date(iso), 'dd MMM yyyy', { locale: ID }) : '—';
export const fmtDateTime = (iso?: string | null) => iso ? format(new Date(iso), 'dd MMM yyyy · HH:mm', { locale: ID }) : '—';
export const fmtRelative = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ID });
export const fmtIDR = (v?: number | null) => (v == null) ? '—' : 'Rp ' + Number(v).toLocaleString('id-ID');
