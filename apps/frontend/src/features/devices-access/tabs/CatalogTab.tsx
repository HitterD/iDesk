import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CatalogApi } from '@/features/hardware-request/api/catalog.api';
import type { HardwareCatalog } from '@/features/hardware-request/types';
import { getApiErrorMessage } from '@/features/client/components/resolution/resolutionApi';
import { CheckCircle2, EyeOff, LayoutGrid, Package, Plus, Search } from 'lucide-react';
import { Kpi } from '../Kpi';
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
    const [category, setCategory] = useState('');
    const categories = [...new Set(items.map((i) => i.category))].sort();
    const [status, setStatus] = useState('');
    const [editing, setEditing] = useState<{ item?: HardwareCatalog } | null>(null);
    const [deleting, setDeleting] = useState<HardwareCatalog | null>(null);
    const refresh = () => { void client.invalidateQueries({ queryKey: ['catalog'] }); void client.invalidateQueries({ queryKey: KEY }); };

    const remove = useMutation({
        mutationFn: CatalogApi.remove,
        onSuccess: () => { setDeleting(null); refresh(); },
        onError: (err) => toast.error(getApiErrorMessage(err, 'Gagal menghapus barang')),
    });
    const toggle = useMutation({ mutationFn: ({ id, active }: { id: string; active: boolean }) => CatalogApi.update(id, { active }), onSuccess: refresh });
    const save = useMutation({
        mutationFn: ({ id, draft }: { id?: string; draft: CatalogDraft }) => (id ? CatalogApi.update(id, toPayload(draft)) : CatalogApi.create(toPayload(draft))),
        onSuccess: refresh,
    });

    const shown = useMemo(() => items
        .filter((i) => (!category || i.category === category) && (status === '' || String(i.active) === status) && (!query || `${i.code} ${i.name}`.toLowerCase().includes(query.toLowerCase())))
        .sort((a, b) => a.displayOrder - b.displayOrder), [items, status, query, category]);
    const hidden = items.filter((i) => !i.active).length;
    const nextOrder = items.reduce((max, i) => Math.max(max, i.displayOrder), 0) + ORDER_STEP;
    const blank: CatalogDraft = { code: '', name: '', category: 'LAPTOP', spec: '', active: true, displayOrder: nextOrder, fields: [] };

    return (
        <div>
            <div className="da-kpis">
                <Kpi icon={Package} tone="neutral" label="Total barang" value={items.length} />
                <Kpi icon={CheckCircle2} tone="green" label="Tampil di form" value={items.length - hidden} />
                <Kpi icon={EyeOff} tone="neutral" label="Disembunyikan" value={hidden} />
                <Kpi icon={LayoutGrid} tone="navy" label="Kategori terisi" value={new Set(items.map((i) => i.category)).size} />
            </div>
            <div className="da-filters">
                <label className="da-field"><Search aria-hidden="true" /><input aria-label="Cari barang" placeholder="Cari kode atau nama barang" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                <select aria-label="Filter kategori" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">Semua kategori</option>
                    {categories.map((value) => <option key={value}>{value}</option>)}
                </select>
                <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Semua status</option><option value="true">Tampil di form</option><option value="false">Disembunyikan</option>
                </select>
                <button type="button" className="req-btn req-btn--primary req-btn--navy" onClick={() => setEditing({})}><Plus aria-hidden="true" />Tambah barang</button>
            </div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat katalog.</p>}
            <div className="da-card da-ctable">
            <div className="da-crow da-crow--head" aria-hidden="true"><span>Urutan</span><span>Kode</span><span>Nama barang</span><span>Kategori</span><span>Isian tambahan</span><span>Tampil di form</span><span /></div>
            {!isLoading && shown.length === 0 && <p className="da-empty">Tidak ada barang.</p>}
            <ul className="da-crows">
                {shown.map((item) => (
                    <li key={item.id} className="da-crow">
                        <span className="da-mono">{item.displayOrder}</span>
                        <span className="da-mono">{item.code}</span>
                        <div><b>{item.name}</b>{String((item.defaultSpecs as { spec?: string } | undefined)?.spec ?? '') && <small>{String((item.defaultSpecs as { spec?: string }).spec)}</small>}</div>
                        <span className="da-pk-cat">{item.category}</span>
                        <span className="da-small">{(item.requiredFields ?? []).length ? (item.requiredFields ?? []).map((f) => (f as { label?: string }).label ?? '').filter(Boolean).join(', ') : '—'}</span>
                        <button
                            type="button" role="switch" aria-checked={item.active} aria-label={`Tampil di form: ${item.name}`} className={`da-sw ${item.active ? 'is-on' : ''}`}
                            onClick={() => toggle.mutate({ id: item.id, active: !item.active }, { onError: (err) => toast.error(getApiErrorMessage(err, 'Gagal mengubah')) })}
                        ><i /></button>
                        <div className="da-row__acts"><button type="button" className="req-btn" aria-label={`Ubah ${item.name}`} onClick={() => setEditing({ item })}>Ubah</button><button type="button" className="req-btn" aria-label={`Hapus ${item.name}`} onClick={() => setDeleting(item)}>Hapus</button></div>
                    </li>
                ))}
            </ul>
            </div>
            <ConfirmationDialog isOpen={Boolean(deleting)} title="Hapus barang dari katalog?"
                description={`${deleting?.name ?? ''} tidak akan tersedia untuk pengajuan baru.`}
                variant="destructive" appearance="ticket" confirmText="Hapus barang" cancelText="Batal"
                isLoading={remove.isPending} onCancel={() => setDeleting(null)}
                onConfirm={() => { if (deleting) remove.mutate(deleting.id); }} />
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
