import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Plus, LayoutGrid } from 'lucide-react';
import { useCatalogAdmin } from '../../hooks/useCatalogAdmin';
import { usePermissions } from '../../hooks/usePermissions';
import { CatalogTable } from './CatalogTable';
import { CatalogEditModal } from './CatalogEditModal';
import { HardwareRequestsBreadcrumb } from '../common/HardwareRequestsBreadcrumb';
import type { HardwareCatalog } from '../../types';
import { toast } from 'sonner';

import { FeatureErrorBoundary } from '../common/FeatureErrorBoundary';

export function CatalogAdminPage() {
  const { isIctStaff } = usePermissions();
  const { items, isLoading, create, update, remove } = useCatalogAdmin();
  const [editing, setEditing] = useState<{ open: boolean; item?: HardwareCatalog }>({ open: false });

  if (!isIctStaff) return <div className="p-8 text-center text-sm text-slate-500">Akses ditolak.</div>;

  return (
    <FeatureErrorBoundary>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in-up">
        <HardwareRequestsBreadcrumb currentLabel="Catalog Admin" />
        
        <motion.header
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl p-4 shadow-sm"
        >
            <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Manajemen Katalog Hardware
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Kelola master data perangkat hardware, kategori, dan spesifikasi.</p>
            </div>
            <button
                onClick={() => setEditing({ open: true })}
                className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold hover:bg-primary/90 transition-all shadow-sm"
            >
                <Plus className="size-4" /> Tambah Item Baru
            </button>
        </motion.header>

        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white dark:bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-sm overflow-hidden"
        >
            {isLoading ? (
                <div className="h-64 animate-pulse bg-slate-50/50 dark:bg-slate-800/30" />
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="size-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <LayoutGrid className="size-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Katalog Kosong</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">Belum ada item hardware yang terdaftar di sistem. Mulai dengan menambahkan item baru.</p>
                </div>
            ) : (
                <CatalogTable
                    items={items}
                    onEdit={(i) => setEditing({ open: true, item: i })}
                    onToggleActive={async (i) => {
                        try {
                            await update.mutateAsync({ id: i.id, payload: { active: !i.active } });
                            toast.success(`${i.name} ${i.active ? 'di-nonaktifkan' : 'diaktifkan'}.`);
                        } catch (err) {
                            toast.error('Gagal update: ' + (err as Error).message);
                        }
                    }}
                    onDelete={async (i) => {
                        if (!confirm(`Hapus "${i.name}"? Item akan dihapus secara permanen (hard delete).`)) return;
                        try {
                            await remove.mutateAsync(i.id);
                            toast.success('Catalog item dihapus permanen.');
                        } catch (err) {
                            toast.error('Gagal hapus: ' + (err as Error).message);
                        }
                    }}
                />
            )}
        </motion.div>

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
      </div>
    </FeatureErrorBoundary>
  );
}
