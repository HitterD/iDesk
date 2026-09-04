import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Plus,
  LayoutGrid,
  List,
  Search,
  CheckCircle2,
  XCircle,
  Layers,
  Box,
  Trash2,
  Edit2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCatalogAdmin } from '../../hooks/useCatalogAdmin';
import { usePermissions } from '../../hooks/usePermissions';
import { CatalogTable, CATEGORY_ICONS, CATEGORY_STYLES } from './CatalogTable';
import { CatalogEditModal } from './CatalogEditModal';
import { HardwareRequestsBreadcrumb } from '../common/HardwareRequestsBreadcrumb';
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

export function CatalogAdminPage() {
  const { isIctStaff } = usePermissions();
  const { items, isLoading, create, update, remove } = useCatalogAdmin();
  const [editing, setEditing] = useState<{ open: boolean; item?: HardwareCatalog }>({ open: false });
  const [deletingItem, setDeletingItem] = useState<HardwareCatalog | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
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

  if (!isIctStaff) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <FeatureErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in-up">
        <HardwareRequestsBreadcrumb currentLabel="Catalog Admin" />

        {/* Top Header Card */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-3xl p-5 sm:p-6 shadow-2xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="size-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Settings className="size-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                Manajemen Katalog Hardware
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Kelola master data spesifikasi perangkat, kategori, dan ketersediaan opsi formulir.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditing({ open: true })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-5 py-2.5 text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span>Tambah Item Baru</span>
          </button>
        </motion.header>

        {/* Bento Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Item</span>
              <div className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Box className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black font-mono tracking-tight text-foreground">
              {stats.total}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Item Aktif</span>
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.active}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Item Nonaktif</span>
              <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <XCircle className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-amber-400">
              {stats.inactive}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Kategori Terisi</span>
              <div className="p-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Layers className="size-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-black font-mono tracking-tight text-purple-600 dark:text-purple-400">
              {stats.categoriesCount}
            </div>
          </div>
        </div>

        {/* Filter Toolbar & View Toggle */}
        <div className="bg-card border border-border rounded-3xl p-4 shadow-2xs space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kode atau nama item hardware..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-muted/40 border border-border rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter & View Mode Toggle */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ALL')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    selectedStatus === 'ALL'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('ACTIVE')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    selectedStatus === 'ACTIVE'
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('INACTIVE')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    selectedStatus === 'INACTIVE'
                      ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Nonaktif
                </button>
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  aria-label="Table View"
                  className={cn(
                    'p-1.5 rounded-lg transition-all cursor-pointer',
                    viewMode === 'table' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <List className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid View"
                  className={cn(
                    'p-1.5 rounded-lg transition-all cursor-pointer',
                    viewMode === 'grid' ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer',
                selectedCategory === 'ALL'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted/50'
              )}
            >
              Semua ({items.length})
            </button>
            {ALL_CATEGORIES.map((cat) => {
              const count = items.filter((i) => i.category === cat).length;
              const Icon = CATEGORY_ICONS[cat];
              const selected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer',
                    selected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted/50'
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{cat}</span>
                  <span
                    className={cn(
                      'ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                      selected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section (Table or Grid) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-card border border-border rounded-3xl shadow-2xs overflow-hidden"
        >
          {isLoading ? (
            <div className="h-64 animate-pulse bg-muted/30" />
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="size-16 rounded-3xl bg-muted/60 flex items-center justify-center mb-4 text-muted-foreground">
                <LayoutGrid className="size-8" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                {items.length === 0 ? 'Katalog Kosong' : 'Tidak Ada Item yang Cocok'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {items.length === 0
                  ? 'Belum ada item hardware yang terdaftar di sistem. Mulai dengan menambahkan item baru.'
                  : 'Coba ubah kata kunci pencarian atau filter kategori untuk menemukan item.'}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <CatalogTable
              items={filteredItems}
              onEdit={(i) => setEditing({ open: true, item: i })}
              onToggleActive={async (i) => {
                try {
                  await update.mutateAsync({ id: i.id, payload: { active: !i.active } });
                  toast.success(`${i.name} ${i.active ? 'di-nonaktifkan' : 'diaktifkan'}.`);
                } catch (err) {
                  toast.error('Gagal update: ' + (err as Error).message);
                }
              }}
              onDelete={(i) => setDeletingItem(i)}
            />
          ) : (
            /* Grid View Mode */
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((i) => {
                const Icon = CATEGORY_ICONS[i.category] || Box;
                const catStyle = CATEGORY_STYLES[i.category] || CATEGORY_STYLES.OTHER;
                return (
                  <div
                    key={i.id}
                    className="flex flex-col justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-xs transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border',
                            catStyle.bg,
                            catStyle.text,
                            catStyle.border
                          )}
                        >
                          <Icon className="size-3.5" />
                          <span>{i.category}</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg border border-border">
                          {i.code}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-foreground line-clamp-1">{i.name}</h4>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await update.mutateAsync({ id: i.id, payload: { active: !i.active } });
                              toast.success(`${i.name} ${i.active ? 'di-nonaktifkan' : 'diaktifkan'}.`);
                            } catch (err) {
                              toast.error('Gagal update: ' + (err as Error).message);
                            }
                          }}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer',
                            i.active ? 'bg-primary' : 'bg-muted-foreground/30'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block size-3.5 transform rounded-full bg-white shadow-xs transition duration-200',
                              i.active ? 'translate-x-4.5' : 'translate-x-0.5'
                            )}
                          />
                        </button>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {i.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditing({ open: true, item: i })}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeletingItem(i)}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

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
                toast.success('Katalog diperbarui.');
              } else {
                await create.mutateAsync(payload as HardwareCatalog);
                toast.success('Katalog dibuat.');
              }
              setEditing({ open: false });
            } catch (err) {
              toast.error('Gagal simpan: ' + (err as Error).message);
            }
          }}
        />

        {/* Custom Delete Confirmation Modal */}
        {deletingItem && typeof document !== 'undefined' &&
          createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-background/80 backdrop-blur-md"
                onClick={() => setDeletingItem(null)}
              />
              <div className="relative w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl z-10 space-y-4">
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                  <div className="size-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Hapus Item Katalog?</h3>
                    <p className="text-xs text-muted-foreground font-mono">{deletingItem.code}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus item <strong className="text-foreground">{deletingItem.name}</strong> secara permanen? Tindakan ini tidak dapat dibatalkan.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setDeletingItem(null)}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(deletingItem.id);
                        toast.success('Item katalog berhasil dihapus.');
                        setDeletingItem(null);
                      } catch (err) {
                        toast.error('Gagal hapus: ' + (err as Error).message);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Ya, Hapus Permanen</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </FeatureErrorBoundary>
  );
}
