import { useState } from 'react';
import { FlowDialog } from '@/features/ticket-board/components/request-flow/dialogs/FlowDialog';
import { catalogCode, catalogErrors, type CatalogDraft, type CatalogField } from '../rules';

const CATEGORIES: Array<[string, string]> = [
    ['LAPTOP', 'Laptop'], ['DESKTOP', 'Desktop'], ['MONITOR', 'Monitor'], ['ACCESSORY', 'Aksesoris'], ['NETWORK', 'Jaringan'], ['SOFTWARE', 'Software'], ['OTHER', 'Lainnya'],
];
const FIELD_TYPES: Array<[CatalogField['type'], string]> = [['text', 'Teks'], ['number', 'Angka'], ['select', 'Pilihan']];
const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '_');

interface CatalogEditDialogProps {
    open: boolean;
    onClose: () => void;
    initial: CatalogDraft;
    editingId?: string;
    existing: Array<{ id: string; code: string }>;
    onSubmit: (draft: CatalogDraft) => Promise<unknown>;
}

/** Add or change one catalog item: name, unique code, category, order, visibility and the extra fields it asks for. */
export function CatalogEditDialog({ open, onClose, initial, editingId, existing, onSubmit }: CatalogEditDialogProps) {
    const [draft, setDraft] = useState<CatalogDraft>(initial);
    const [errors, setErrors] = useState<string[]>([]);
    const set = (change: Partial<CatalogDraft>) => { setErrors([]); setDraft((current) => ({ ...current, ...change })); };
    const setField = (index: number, change: Partial<CatalogField>) => set({ fields: draft.fields.map((f, i) => (i === index ? { ...f, ...change } : f)) });

    const submit = async () => {
        const found = catalogErrors(draft, existing, editingId);
        if (found.length > 0) { setErrors(found); throw new Error(found[0]); }
        await onSubmit({ ...draft, code: draft.code.trim(), name: draft.name.trim() });
    };

    return (
        <FlowDialog open={open} onClose={onClose} title={editingId ? 'Ubah barang' : 'Tambah barang ke katalog'} submitLabel="Simpan" canSubmit onSubmit={submit}>
            <label className="req-dialog__field"><span>Nama barang *</span><input aria-label="Nama barang" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label className="req-dialog__field"><span>Kode *</span><input aria-label="Kode" className="font-mono" value={draft.code} onChange={(e) => set({ code: catalogCode(e.target.value) })} /><small>Otomatis huruf besar · harus unik</small></label>
            <label className="req-dialog__field"><span>Kategori</span>
                <select aria-label="Kategori" value={draft.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="req-dialog__field"><span>Spesifikasi singkat</span><input aria-label="Spesifikasi singkat" value={draft.spec} onChange={(e) => set({ spec: e.target.value })} /></label>
            <label className="req-dialog__field"><span>Urutan tampil</span><input aria-label="Urutan tampil" type="number" value={draft.displayOrder} onChange={(e) => set({ displayOrder: Number(e.target.value) })} /></label>
            <label className="req-dialog__check"><input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} /><span>Tampilkan di form permintaan</span></label>
            <div>
                <b>Isian tambahan saat barang ini dipilih</b>
                {draft.fields.map((field, index) => (
                    <div key={index} className="req-dialog__row">
                        <input aria-label={`Nama isian ${index + 1}`} placeholder="Nama isian" value={field.label} onChange={(e) => setField(index, { label: e.target.value, key: field.key || slug(e.target.value) })} />
                        <select aria-label={`Tipe isian ${index + 1}`} value={field.type} onChange={(e) => setField(index, { type: e.target.value as CatalogField['type'] })}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                        {field.type === 'select' && <input aria-label={`Opsi isian ${index + 1}`} placeholder="Opsi, pisahkan koma" value={(field.options ?? []).join(', ')} onChange={(e) => setField(index, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} />}
                        <label><input type="checkbox" checked={field.required} onChange={(e) => setField(index, { required: e.target.checked })} /> Wajib</label>
                        <button type="button" className="req-btn req-btn--ghost" aria-label={`Hapus isian ${index + 1}`} onClick={() => set({ fields: draft.fields.filter((_, i) => i !== index) })}>×</button>
                    </div>
                ))}
                <button type="button" className="req-btn" onClick={() => set({ fields: [...draft.fields, { key: '', label: '', type: 'text', required: false }] })}>Tambah isian</button>
            </div>
            {errors.map((error) => <p key={error} role="alert" className="req-dialog__error">{error}</p>)}
        </FlowDialog>
    );
}
