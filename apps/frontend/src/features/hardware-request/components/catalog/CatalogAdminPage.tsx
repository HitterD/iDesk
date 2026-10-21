import { useState, useMemo } from 'react';
import { Box, ChevronDown, CircleCheck, CircleSlash, Folder, LayoutGrid, List, Package, PackageSearch, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ResEmpty, ResSearch, ResSkeletonRows, ResStat, ResTable } from '@/components/resources/ResourceParts';
import { useCatalogAdmin } from '../../hooks/useCatalogAdmin';
import { usePermissions } from '../../hooks/usePermissions';
import { CatalogTable, CATEGORY_ICONS } from './CatalogTable';
import { CatalogEditModal } from './CatalogEditModal';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';

const ALL_CATEGORIES: ItemCategory[] = [
  'LAPTOP',
  'DESKTOP',
  'MONITOR',
  'ACCESSORY',
  'NETWORK',
  'SOFTWARE',
  'OTHER',
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
const STATUS_LABELS: Record<StatusFilter, string> = { ALL: 'Semua', ACTIVE: 'Aktif', INACTIVE: 'Nonaktif' };
/** Mockup catalog columns: Urutan · Kode · Nama · Kategori · Status Form · Aksi. */
const CATALOG_COLS = '60px 120px minmax(180px,1.5fr) minmax(120px,1fr) 130px 84px';

export function CatalogAdminPage() {
  const { isIctStaff } = usePermissions();
  const { items, isLoading, create, update, remove } = useCatalogAdmin();
  const [editing, setEditing] = useState<{ open: boolean; item?: HardwareCatalog }>({ open: false });
  const [deletingItem, setDeletingItem] = useState<HardwareCatalog | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Stats calculation
  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.active).length;
    const inactive = total - active;
    const categoriesCount = new Set(items.map((i) => i.category)).size;
    return { total, active, inactive, categoriesCount };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        search.trim() === '' ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase());

      const matchCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory;

      const matchStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'ACTIVE' && item.active) ||
        (selectedStatus === 'INACTIVE' && !item.active);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, search, selectedCategory, selectedStatus]);

  if (!isIctStaff) return <div className="p-8 text-center text-sm text-muted-foreground">Akses ditolak.</div>;

  const toggleActive = async (i: HardwareCatalog) => {
    try {
      await update.mutateAsync({ id: i.id, payload: { active: !i.active } });
      toast.success(`${i.name} ${i.active ? 'di-nonaktifkan' : 'diaktifkan'}.`);
    } catch (err) {
      toast.error('Gagal update: ' + (err as Error).message);
    }
  };
  const categoryLabel = selectedCategory === 'ALL' ? 'Semua' : selectedCategory;
  const statusLabel = STATUS_LABELS[selectedStatus];

  return (
    <FeatureErrorBoundary>
      <div>
        <section className="res-stats is-four" aria-label="Ringkasan katalog">
          <ResStat icon={Package} tone="neutral" label="Total Item" value={stats.total} />
          <ResStat icon={CircleCheck} tone="green" label="Item Aktif" value={stats.active}
            active={selectedStatus === 'ACTIVE'} onClick={() => setSelectedStatus(selectedStatus === 'ACTIVE' ? 'ALL' : 'ACTIVE')} />
          <ResStat icon={CircleSlash} tone="neutral" label="Item Nonaktif" value={stats.inactive} zero={stats.inactive === 0}
            active={selectedStatus === 'INACTIVE'} onClick={() => setSelectedStatus(selectedStatus === 'INACTIVE' ? 'ALL' : 'INACTIVE')} />
          <ResStat icon={Folder} tone="navy" label="Kategori Terisi" value={stats.categoriesCount} />
        </section>

        <ResTable label="Katalog hardware" cols={CATALOG_COLS} colsMobile="minmax(0,1fr) auto auto"
          tools={(
            <>
              <ResSearch id="catalog-search" value={search} onChange={setSearch} placeholder="Cari kode atau nama item hardware..." label="Cari item katalog" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="queue-pop" aria-label={`Kategori: ${categoryLabel}`}>
                    <span className="queue-pop-k">Kategori</span><span className="queue-pop-v">{categoryLabel}</span><ChevronDown aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label="Filter kategori">
                  <DropdownMenuRadioGroup value={selectedCategory} onValueChange={setSelectedCategory}>
                    <DropdownMenuRadioItem value="ALL">Semua ({items.length})</DropdownMenuRadioItem>
                    {ALL_CATEGORIES.map((cat) => (
                      <DropdownMenuRadioItem key={cat} value={cat}>{cat} ({items.filter((i) => i.category === cat).length})</DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="queue-pop" aria-label={`Status: ${statusLabel}`}>
                    <span className="queue-pop-k">Status</span><span className="queue-pop-v">{statusLabel}</span><ChevronDown aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label="Filter status">
                  <DropdownMenuRadioGroup value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as StatusFilter)}>
                    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => <DropdownMenuRadioItem key={k} value={k}>{STATUS_LABELS[k]}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="hidden md:inline-flex gap-1">
                <button type="button" className={cn('queue-pop queue-pop-icon', viewMode === 'table' && 'zm-mine is-on')} onClick={() => setViewMode('table')} aria-label="Tampilan tabel" aria-pressed={viewMode === 'table'}><List aria-hidden="true" /></button>
                <button type="button" className={cn('queue-pop queue-pop-icon', viewMode === 'grid' && 'zm-mine is-on')} onClick={() => setViewMode('grid')} aria-label="Tampilan grid" aria-pressed={viewMode === 'grid'}><LayoutGrid aria-hidden="true" /></button>
              </span>
              <Button variant="soft" onClick={() => setEditing({ open: true })}><Plus aria-hidden="true" />Tambah Item Baru</Button>
            </>
          )}
          head={viewMode === 'table' && filteredItems.length > 0 ? <><span>Urutan</span><span>Kode Perangkat</span><span>Nama Item</span><span>Kategori</span><span>Status Form</span><span className="is-right">Aksi</span></> : undefined}
          foot={<><span>{filteredItems.length} dari {items.length} item</span><span className="res-muted">Tab ini hanya untuk ICT Lead</span></>}>
          {isLoading ? <ResSkeletonRows rows={5} /> : filteredItems.length === 0 ? (
            <ResEmpty icon={PackageSearch} title={items.length === 0 ? 'Katalog kosong' : 'Tidak ada item yang cocok'}>
              {items.length === 0 ? 'Belum ada item hardware. Mulai dengan menambahkan item baru.' : 'Coba ubah kata kunci atau filter kategori.'}
            </ResEmpty>
          ) : viewMode === 'table' ? (
            <CatalogTable items={filteredItems} onEdit={(i) => setEditing({ open: true, item: i })} onToggleActive={toggleActive} onDelete={(i) => setDeletingItem(i)} />
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredItems.map((i) => {
                const Icon = CATEGORY_ICONS[i.category] || Box;
                return (
                  <div key={i.id} className="dash-panel gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{i.category}</span>
                      <span className="res-tag is-mono">{i.code}</span>
                    </div>
                    <b className="text-sm font-semibold truncate">{i.name}</b>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2">
                        <button type="button" role="switch" className="res-switch" aria-checked={i.active} aria-label={`Status form ${i.name}`} onClick={() => toggleActive(i)} />
                        <span className="res-muted text-xs">{i.active ? 'Aktif' : 'Nonaktif'}</span>
                      </span>
                      <span className="res-acts">
                        <button type="button" className="res-icon-btn" onClick={() => setEditing({ open: true, item: i })} aria-label={`Edit ${i.name}`}><Pencil aria-hidden="true" /></button>
                        <button type="button" className="res-icon-btn is-danger" onClick={() => setDeletingItem(i)} aria-label={`Hapus ${i.name}`}><Trash2 aria-hidden="true" /></button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ResTable>

        {/* Edit/Create Modal */}
        <CatalogEditModal
          open={editing.open}
          initial={editing.item}
          isSubmitting={create.isPending || update.isPending}
          onClose={() => setEditing({ open: false })}
          onSubmit={async (payload) => {
            try {
              if (editing.item) {
                await update.mutateAsync({ id: editing.item.id, payload });
                toast.success('Katalog berhasil diperbarui.');
              } else {
                await create.mutateAsync(payload as HardwareCatalog);
                toast.success('Item katalog berhasil ditambahkan.');
              }
              setEditing({ open: false });
            } catch (err: any) {
              const resData = err?.response?.data;
              let detailedMsg = '';
              if (resData?.errors && typeof resData.errors === 'object') {
                  const errorValues = Object.values(resData.errors).flat();
                  if (errorValues.length > 0) {
                      detailedMsg = errorValues.join(', ');
                  }
              }
              const resMsg = detailedMsg || resData?.message || err?.message;
              const formattedMsg = Array.isArray(resMsg) ? resMsg.join(', ') : resMsg;
              toast.error('Gagal simpan: ' + (formattedMsg || 'Terjadi kesalahan sistem'));
            }
          }}
        />

        <ConfirmationDialog
          isOpen={!!deletingItem}
          title="Hapus item katalog?"
          description={deletingItem ? `Item ${deletingItem.name} (${deletingItem.code}) dihapus permanen. Tindakan ini tidak dapat dibatalkan.` : ''}
          confirmText="Ya, hapus permanen"
          cancelText="Batal"
          variant="destructive"
          isLoading={remove.isPending}
          onCancel={() => setDeletingItem(null)}
          onConfirm={async () => {
            if (!deletingItem) return;
            try {
              await remove.mutateAsync(deletingItem.id);
              toast.success('Item katalog berhasil dihapus.');
              setDeletingItem(null);
            } catch (err) {
              toast.error('Gagal hapus: ' + (err as Error).message);
            }
          }}
        />
      </div>
    </FeatureErrorBoundary>
  );
}
