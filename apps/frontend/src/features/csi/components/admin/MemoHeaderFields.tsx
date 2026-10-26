import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MEMO_PARAGRAPH_MAX, MEMO_TEXT_MAX } from '../../lib/memo';
import type { CsiMemoHeader } from '../../types';

interface Props { value: CsiMemoHeader; onChange: (value: CsiMemoHeader) => void }
const FIELDS = [{ key: 'to', label: 'Kepada' }, { key: 'cc', label: 'CC' }, { key: 'number', label: 'Nomor' }, { key: 'from', label: 'Dari' }, { key: 'subject', label: 'Perihal' }, { key: 'date', label: 'Tanggal' }] as const;

export function MemoHeaderFields({ value, onChange }: Props) {
    return (
        <div className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">{FIELDS.map(({ key, label }) => (
                <label key={key} className="grid gap-1.5 text-sm">{label}
                    <Input type={key === 'date' ? 'date' : 'text'} value={value[key]} maxLength={MEMO_TEXT_MAX} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />
                </label>
            ))}</div>
            <label className="grid gap-1.5 text-sm">Paragraf pembuka<Textarea rows={5} value={value.opening} maxLength={MEMO_PARAGRAPH_MAX} onChange={(event) => onChange({ ...value, opening: event.target.value })} /></label>
            <label className="grid gap-1.5 text-sm">Paragraf penutup<Textarea rows={3} value={value.closing} maxLength={MEMO_PARAGRAPH_MAX} onChange={(event) => onChange({ ...value, closing: event.target.value })} /></label>
            <div className="grid gap-5 sm:grid-cols-2">{(['signerLeft', 'signerRight'] as const).map((key) => (
                <fieldset key={key} className="grid gap-3 rounded-xl border border-border p-4">
                    <legend className="px-1 text-sm font-medium">{key === 'signerLeft' ? 'Hormat kami' : 'Mengetahui'}</legend>
                    <label className="grid gap-1.5 text-sm">Nama ({key === 'signerLeft' ? 'pengirim' : 'mengetahui'})<Input value={value[key].name} maxLength={MEMO_TEXT_MAX} onChange={(event) => onChange({ ...value, [key]: { ...value[key], name: event.target.value } })} /></label>
                    <label className="grid gap-1.5 text-sm">Jabatan ({key === 'signerLeft' ? 'pengirim' : 'mengetahui'})<Input value={value[key].title} maxLength={MEMO_TEXT_MAX} onChange={(event) => onChange({ ...value, [key]: { ...value[key], title: event.target.value } })} /></label>
                </fieldset>
            ))}</div>
        </div>
    );
}
