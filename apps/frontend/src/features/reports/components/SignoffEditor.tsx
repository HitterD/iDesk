import React from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
    MAX_SIGNOFF_COLUMNS,
    MAX_SIGNOFF_SLOTS,
    SignoffAlign,
    SignoffLayout,
    SignoffSlot,
    emptySlot,
    moveSlot,
} from '../signoff';

interface SignoffEditorProps {
    value: SignoffLayout;
    onChange: (next: SignoffLayout) => void;
    /** Apply to this preview/download only. */
    onApply: () => void;
    /** Save as the default for this report and site; omitted for users who may not change defaults. */
    onSaveDefault?: () => void;
    onReset?: () => void;
    busy?: boolean;
}

const ALIGN_LABEL: Record<SignoffAlign, string> = { left: 'Kiri', center: 'Tengah', right: 'Kanan' };
const INPUT = 'w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm';
const ICON_BTN = 'p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30';

export const SignoffEditor: React.FC<SignoffEditorProps> = ({ value, onChange, onApply, onSaveDefault, onReset, busy }) => {
    const setSlot = (index: number, patch: Partial<SignoffSlot>) =>
        onChange({ ...value, slots: value.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

    return (
        <div className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-200" aria-label="Editor tanda tangan">
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Tanda tangan ({value.slots.length}/{MAX_SIGNOFF_SLOTS})</h3>
                <label className="flex items-center gap-1 text-xs">
                    Kolom
                    <select
                        aria-label="Jumlah kolom"
                        className={`${INPUT} !w-14`}
                        value={value.columns}
                        onChange={(e) => onChange({ ...value, columns: Number(e.target.value) })}
                    >
                        {Array.from({ length: MAX_SIGNOFF_COLUMNS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                </label>
            </div>

            <ol className="space-y-3">
                {value.slots.map((slot, i) => (
                    <li key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">Penanda tangan {i + 1}</span>
                            <span className="flex">
                                <button type="button" className={ICON_BTN} aria-label={`Naikkan penanda tangan ${i + 1}`} disabled={i === 0} onClick={() => onChange({ ...value, slots: moveSlot(value.slots, i, i - 1) })}><ArrowUp className="w-4 h-4" /></button>
                                <button type="button" className={ICON_BTN} aria-label={`Turunkan penanda tangan ${i + 1}`} disabled={i === value.slots.length - 1} onClick={() => onChange({ ...value, slots: moveSlot(value.slots, i, i + 1) })}><ArrowDown className="w-4 h-4" /></button>
                                <button type="button" className={ICON_BTN} aria-label={`Hapus penanda tangan ${i + 1}`} onClick={() => onChange({ ...value, slots: value.slots.filter((_, j) => j !== i) })}><Trash2 className="w-4 h-4" /></button>
                            </span>
                        </div>
                        <input className={INPUT} aria-label={`Judul ${i + 1}`} placeholder="Judul (mis. Disiapkan oleh)" value={slot.title} maxLength={80} onChange={(e) => setSlot(i, { title: e.target.value })} />
                        <input className={INPUT} aria-label={`Nama ${i + 1}`} placeholder="Nama" value={slot.name} maxLength={80} onChange={(e) => setSlot(i, { name: e.target.value })} />
                        <input className={INPUT} aria-label={`Jabatan ${i + 1}`} placeholder="Jabatan (opsional)" value={slot.role} maxLength={80} onChange={(e) => setSlot(i, { role: e.target.value })} />
                        <div className="flex items-center justify-between gap-2">
                            <select className={`${INPUT} !w-auto`} aria-label={`Rata ${i + 1}`} value={slot.align} onChange={(e) => setSlot(i, { align: e.target.value as SignoffAlign })}>
                                {(Object.keys(ALIGN_LABEL) as SignoffAlign[]).map((a) => <option key={a} value={a}>{ALIGN_LABEL[a]}</option>)}
                            </select>
                            <label className="flex items-center gap-1 text-xs">
                                <input type="checkbox" checked={slot.showDate} onChange={(e) => setSlot(i, { showDate: e.target.checked })} />
                                Baris tanggal
                            </label>
                        </div>
                    </li>
                ))}
            </ol>

            <button
                type="button"
                className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                disabled={value.slots.length >= MAX_SIGNOFF_SLOTS}
                onClick={() => onChange({ ...value, slots: [...value.slots, emptySlot()] })}
            >
                <Plus className="w-4 h-4" /> Tambah penanda tangan
            </button>

            <div className="mt-4 flex flex-col gap-2">
                <button type="button" disabled={busy} onClick={onApply} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                    Terapkan ke PDF ini
                </button>
                {onSaveDefault && (
                    <button type="button" disabled={busy} onClick={onSaveDefault} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50">
                        Simpan sebagai default
                    </button>
                )}
                {onReset && (
                    <button type="button" disabled={busy} onClick={onReset} className="text-xs text-slate-500 hover:underline disabled:opacity-50">
                        Kembalikan ke bawaan
                    </button>
                )}
            </div>
        </div>
    );
};
