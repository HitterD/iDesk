import { useMemo, useState } from 'react';
import { Minus, Plus, Repeat, Search, Trash2 } from 'lucide-react';
import { addCatalog, addManual, basketErrors, replaceLine, setQuantity, type BasketLine, type CatalogEntry } from './basket';

interface CatalogBasketProps {
    catalog: CatalogEntry[];
    lines: BasketLine[];
    onChange: (lines: BasketLine[]) => void;
    /** Ask who each item is for (the request form); IT editing items keeps the recipients as they are. */
    showRecipient?: boolean;
}

/**
 * One picker for the request form and IT's item editor: click an item to add it (again to add a unit), write a
 * manual item, set quantities and extra fields, and swap a line for another item ("Ganti").
 */
export function CatalogBasket({ catalog, lines, onChange, showRecipient = false }: CatalogBasketProps) {
    const [query, setQuery] = useState('');
    const [manual, setManual] = useState('');
    const [swapping, setSwapping] = useState<number | null>(null);
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return catalog.filter((entry) => !q || `${entry.name} ${entry.code} ${entry.category}`.toLowerCase().includes(q));
    }, [catalog, query]);
    // The "pick at least one item" message belongs to the form that sends the basket, not to an empty basket.
    const errors = lines.length > 0 ? basketErrors(lines) : [];
    const patch = (index: number, change: Partial<BasketLine>) => onChange(lines.map((line, i) => (i === index ? { ...line, ...change } : line)));

    return (
        <div className="req-basket">
            <div className="req-basket__catalog">
                <label className="req-basket__search"><Search aria-hidden="true" />
                    <input placeholder="Cari barang (nama atau kode)" value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                <ul role="listbox" aria-label="Katalog">
                    {shown.map((entry) => (
                        <li key={entry.id} role="presentation">
                            {swapping === null
                                ? <button type="button" onClick={() => onChange(addCatalog(lines, entry))}><b>{entry.name}</b><span>{entry.code}</span><Plus aria-hidden="true" /></button>
                                : <button type="button" role="option" aria-selected="false" onClick={() => { onChange(replaceLine(lines, swapping, entry)); setSwapping(null); }}><b>{entry.name}</b><span>{entry.code}</span><Repeat aria-hidden="true" /></button>}
                        </li>
                    ))}
                    {shown.length === 0 && <li className="req-basket__empty">Tidak ada barang yang cocok.</li>}
                </ul>
                <div className="req-basket__manual">
                    <input aria-label="Barang lain" placeholder="Barang lain (tulis sendiri)" value={manual} onChange={(event) => setManual(event.target.value)} />
                    <button type="button" className="req-btn" onClick={() => { onChange(addManual(lines, manual)); setManual(''); }}>Tambah</button>
                </div>
                {swapping !== null && <p className="req-dialog__hint">Pilih barang pengganti di daftar di atas, atau <button type="button" className="req-link" onClick={() => setSwapping(null)}>batal</button>.</p>}
            </div>

            <div className="req-basket__lines">
                {lines.map((line, index) => (
                    <div key={`${line.catalogId ?? 'manual'}-${line.name}-${index}`} className="req-basket__line">
                        <div className="req-basket__name">
                            <b>{line.name}</b>
                            {line.replacesName && <small>Pengganti dari {line.replacesName}</small>}
                        </div>
                        <div className="req-basket__qty">
                            <button type="button" aria-label={`Kurangi ${line.name}`} onClick={() => onChange(setQuantity(lines, index, line.quantity - 1))}><Minus aria-hidden="true" /></button>
                            <input type="number" aria-label={`Jumlah ${line.name}`} value={line.quantity} onChange={(event) => onChange(setQuantity(lines, index, Number(event.target.value)))} />
                            <button type="button" aria-label={`Tambah ${line.name}`} onClick={() => onChange(setQuantity(lines, index, line.quantity + 1))}><Plus aria-hidden="true" /></button>
                        </div>
                        <button type="button" className="req-btn req-btn--ghost" aria-label={`Ganti ${line.name}`} onClick={() => setSwapping(index)}><Repeat aria-hidden="true" />Ganti</button>
                        <button type="button" className="req-btn req-btn--ghost" aria-label={`Hapus ${line.name}`} onClick={() => onChange(lines.filter((_, i) => i !== index))}><Trash2 aria-hidden="true" /></button>
                        {showRecipient && (
                            <input className="req-basket__wide" aria-label={`Untuk siapa ${line.name}`} placeholder="Untuk siapa (nama penerima)" value={line.recipient ?? ''} onChange={(event) => patch(index, { recipient: event.target.value })} />
                        )}
                        {line.requiredFields.map((field) => (
                            <label key={field.key} className="req-basket__wide req-dialog__field">
                                <span>{field.label}{field.required ? ' *' : ''}</span>
                                <input
                                    aria-label={field.label} type={field.type === 'number' ? 'number' : 'text'} value={line.fields[field.key] ?? ''}
                                    onChange={(event) => patch(index, { fields: { ...line.fields, [field.key]: field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value } })}
                                />
                            </label>
                        ))}
                    </div>
                ))}
                {lines.length === 0 && <p className="req-basket__empty">Belum ada barang. Klik barang di katalog untuk menambahkannya.</p>}
                {errors.map((error) => <p key={error} role="alert" className="req-dialog__error">{error}</p>)}
            </div>
        </div>
    );
}
