import { useRef } from 'react';
import { AlertCircle, Download, Image as ImageIcon, Trash2, X } from 'lucide-react';
import { SearchablePicker, type SearchablePickerOption } from '@/components/ui/searchable-picker';
import { formatFileSize } from '@/lib/file-validation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { TicketFormRow } from './TicketFormSection';
import type { PreviewItem } from './DescriptionComposer';

export type AttributeKind = 'CATEGORY' | 'DEVICE' | 'SOFTWARE';
type ClassificationKey = 'category' | 'device' | 'software';

export interface ClassificationFieldsProps {
    values: Record<ClassificationKey, string>;
    options: Record<ClassificationKey, SearchablePickerOption[]>;
    loadFailed: boolean;
    canAddAttribute: boolean;
    onChange: (key: ClassificationKey, value: string) => void;
    onRetry: () => void;
    onAdd: (kind: AttributeKind) => void;
}

const FIELDS: ReadonlyArray<{ key: ClassificationKey; kind: AttributeKind; label: string; placeholder: string; search: string }> = [
    { key: 'category', kind: 'CATEGORY', label: 'Kategori', placeholder: 'Pilih kategori', search: 'Cari kategori' },
    { key: 'device', kind: 'DEVICE', label: 'Perangkat', placeholder: 'Opsional', search: 'Cari perangkat' },
    { key: 'software', kind: 'SOFTWARE', label: 'Aplikasi', placeholder: 'Opsional', search: 'Cari aplikasi' },
];

/** Service-only category/device/software pickers; option values come from the caller. */
export function ClassificationFields({ values, options, loadFailed, canAddAttribute, onChange, onRetry, onAdd }: ClassificationFieldsProps) {
    return (
        <div className="ct-row">
            {loadFailed && (
                <div role="alert" className="ct-alert">
                    <AlertCircle aria-hidden="true" />
                    <p>Gagal memuat daftar kategori/device/software.{' '}
                        <button type="button" onClick={onRetry} className="underline font-semibold">Coba lagi</button>
                    </p>
                </div>
            )}
            <div className="ct-cols3">
                {FIELDS.map(field => (
                    <TicketFormRow key={field.key} label={field.label} labelId={`label-service-${field.key}`}
                        meta={canAddAttribute ? <button type="button" className="ct-add" aria-label={`Tambah ${field.label}`} onClick={() => onAdd(field.kind)}>+ Add</button> : undefined}>
                        <SearchablePicker label={field.label} value={values[field.key]} options={options[field.key]}
                            placeholder={field.placeholder} searchPlaceholder={field.search}
                            onValueChange={value => onChange(field.key, value)} triggerClassName="ct-picker" />
                    </TicketFormRow>
                ))}
            </div>
        </div>
    );
}

export function AddAttributeModal({ type, value, busy, onChange, onConfirm, onClose }: {
    type: string; value: string; busy: boolean; onChange: (value: string) => void; onConfirm: () => void; onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(ref, { enabled: true, onEscape: onClose });
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="add-attribute-title"
                className="bg-card p-6 md:p-8 rounded-2xl w-full max-w-[400px] border border-border shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 id="add-attribute-title" className="text-lg font-bold text-foreground mb-4">Add New {type}</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="new-attribute-value" className="text-xs font-semibold text-muted-foreground mb-1.5 block">{type} Name</label>
                        <input id="new-attribute-value" type="text" value={value} onChange={e => onChange(e.target.value)}
                            className="ct-input" placeholder={`Enter new ${type.toLowerCase()} name`}
                            onKeyDown={e => e.key === 'Enter' && onConfirm()} />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 text-xs font-bold text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl transition-colors cursor-pointer">Cancel</button>
                        <button type="button" onClick={onConfirm} disabled={!value.trim() || busy}
                            className="flex-1 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer">
                            {busy ? 'Adding…' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function LightboxModal({ item, onClose, onDelete }: { item: PreviewItem; onClose: () => void; onDelete: () => void }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="relative max-w-4xl max-h-[90vh] flex flex-col bg-card rounded-2xl border border-border/80 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3.5 bg-card/90 border-b border-border/80">
                    <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                        <ImageIcon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        <span className="text-sm font-bold text-foreground truncate" title={item.name}>{item.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0 tabular-nums">{formatFileSize(item.size)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={item.url} download={item.name} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Unduh gambar" aria-label="Unduh gambar">
                            <Download className="w-4 h-4" aria-hidden="true" />
                        </a>
                        <button type="button" onClick={() => { onDelete(); onClose(); }} className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer" title="Hapus gambar" aria-label="Hapus gambar">
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button type="button" onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" title="Tutup preview" aria-label="Tutup preview">
                            <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-center bg-black/10 p-4 max-h-[calc(90vh-70px)] overflow-auto">
                    <img src={item.url} alt={item.name} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md select-none" />
                </div>
            </div>
        </div>
    );
}
