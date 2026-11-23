import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CatalogApi } from '@/features/hardware-request/api/catalog.api';
import type { HardwareCatalog } from '@/features/hardware-request/types';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { CatalogEditDialog } from './CatalogEditDialog';
import type { CatalogDraft } from '../rules';

const ORDER_STEP = 10;
const KEY = ['devices-access', 'catalog'] as const;

const toDraft = (item: HardwareCatalog): CatalogDraft => ({
    code: item.code, name: item.name, category: item.category, spec: String((item.defaultSpecs as { spec?: string } | undefined)?.spec ?? ''),
    active: item.active, displayOrder: item.displayOrder, fields: ((item.requiredFields ?? []) as CatalogDraft['fields']).map((f) => ({ ...f })),
});
const toPayload = (draft: CatalogDraft) => ({
    code: draft.code, name: draft.name, category: draft.category as HardwareCatalog['category'], active: draft.active, displayOrder: draft.displayOrder,
    defaultSpecs: draft.spec ? { spec: draft.spec } : {}, requiredFields: draft.fields,
});

/** "Katalog Hardware": every item (also the ones hidden from the form), with visibility, order and the fields it asks for. */
export function CatalogTab() {
    const client = useQueryClient();
    const { data: items = [], isLoading, isError } = useQuery({ queryKey: KEY, queryFn: () => CatalogApi.list({ includeInactive: true }), staleTime: 60_000 });
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [editing, setEditing] = useState<{ item?: HardwareCatalog } | null>(null);
    const refresh = () => { void client.invalidateQueries({ queryKey: ['catalog'] }); void client.invalidateQueries({ queryKey: KEY }); };

    const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => CatalogApi.update(id, { active }), onSuccess: refresh });
    const save = useMutation({
        mutationFn: ({ id, draft }: { id?: string; draft: CatalogDraft }) => (id ? CatalogApi.update(id, toPayload(draft)) : CatalogApi.create(toPayload(draft))),
        onSuccess: refresh,
    });

    const shown = useMemo(() => items
        .filter((i) => (status === '' || String(i.active) === status) && (!query || `${i.code} ${i.name}`.toLowerCase().includes(query.toLowerCase())))
        .sort((a, b) => a.displayOrder - b.displayOrder), [items, status, query]);
    const hidden = items.filter((i) => !i.active).length;
    const nextOrder = items.reduce((max, i) => Math.max(max, i.displayOrder), 0) + ORDER_STEP;
    const blank: CatalogDraft = { code: '', name: '', category: 'LAPTOP', spec: '', active: true, displayOrder: nextOrder, fields: [] };

    return (
        <div>
            <div className="da-kpis">
                <div className="da-kpi" aria-label="Total barang"><span className="da-kpi__v">{items.length}</span><span>Total barang</span></div>
                <div className="da-kpi" aria-label="Tampil di form"><span className="da-kpi__v">{items.length - hidden}</span><span>Tampil di form</span></div>
                <div className="da-kpi" aria-label="Disembunyikan"><span className="da-kpi__v">{hidden}</span><span>Disembunyikan</span></div>
                <div className="da-kpi" aria-label="Kategori terisi"><span className="da-kpi__v">{new Set(items.map((i) => i.category)).size}</span><span>Kategori terisi</span></div>
            </div>
            <div className="req-ffoot">
                <input aria-label="Cari barang" placeholder="Cari kode atau nama barang" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Semua status</option><option value="true">Tampil di form</option><option value="false">Disembunyikan</option>
                </select>
                <button type="button" className="req-btn req-btn--primary req-btn--navy" onClick={() => setEditing({})}>Tambah barang</button>
            </div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat katalog.</p>}
            <ul className="da-rows">
                {shown.map((item) => (
                    <li key={item.id} className="da-row">
                        <div><b>{item.name}</b><small>{item.code} · {item.category}{(item.requiredFields ?? []).length ? ` · ${(item.requiredFields ?? []).length} isian` : ''}</small></div>
                        <span>Urutan {item.displayOrder}</span>
                        <button
                            type="button" role="switch" aria-checked={item.active} aria-label={`Tampil di form: ${item.name}`} className={`da-sw ${item.active ? 'is-on' : ''}`}
                            onClick={() => toggle.mutate({ id: item.id, active: !item.active }, { onError: (err) => toast.error(getApiErrorMessage(err, 'Gagal mengubah')) })}
                        ><i /></button>
                        <div className="da-row__acts"><button type="button" className="req-btn" aria-label={`Ubah ${item.name}`} onClick={() => setEditing({ item })}>Ubah</button></div>
                    </li>
                ))}
            </ul>
            {editing && (
                <CatalogEditDialog
                    open onClose={() => setEditing(null)} initial={editing.item ? toDraft(editing.item) : blank} editingId={editing.item?.id}
                    existing={items.map((i) => ({ id: i.id, code: i.code }))}
                    onSubmit={(draft) => save.mutateAsync({ id: editing.item?.id, draft })}
                />
            )}
        </div>
    );
}
