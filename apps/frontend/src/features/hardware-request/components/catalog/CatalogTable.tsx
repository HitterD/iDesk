import React from 'react';
import {
  Edit2,
  Trash2,
  Laptop,
  Monitor,
  Tv,
  Headphones,
  Network,
  Code2,
  Box,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { cn } from '@/lib/utils';

type Props = {
  items: HardwareCatalog[];
  onEdit: (item: HardwareCatalog) => void;
  onToggleActive: (item: HardwareCatalog) => void;
  onDelete: (item: HardwareCatalog) => void;
};

export const CATEGORY_ICONS: Record<ItemCategory, React.ElementType> = {
  LAPTOP: Laptop,
  DESKTOP: Monitor,
  MONITOR: Tv,
  ACCESSORY: Headphones,
  NETWORK: Network,
  SOFTWARE: Code2,
  OTHER: Box,
};

export const CATEGORY_STYLES: Record<ItemCategory, { bg: string; text: string; border: string }> = {
  LAPTOP: { bg: 'bg-blue-500/10 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/30' },
  DESKTOP: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/15', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/30' },
  MONITOR: { bg: 'bg-purple-500/10 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30' },
  ACCESSORY: { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30' },
  NETWORK: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30' },
  SOFTWARE: { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/30' },
  OTHER: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/30' },
};

export function CatalogTable({ items, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <tr>
            <th className="px-5 py-3.5 text-left font-bold">Kode Perangkat</th>
            <th className="px-5 py-3.5 text-left font-bold">Nama Item</th>
            <th className="px-5 py-3.5 text-left font-bold">Kategori</th>
            <th className="px-5 py-3.5 text-center font-bold">Status Form</th>
            <th className="px-5 py-3.5 text-center font-bold">Urutan</th>
            <th className="px-5 py-3.5 text-right font-bold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {items.map((i) => {
            const Icon = CATEGORY_ICONS[i.category] || Box;
            const catStyle = CATEGORY_STYLES[i.category] || CATEGORY_STYLES.OTHER;

            return (
              <tr
                key={i.id}
                className="group hover:bg-muted/30 transition-colors duration-150"
              >
                {/* Kode */}
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs font-bold text-foreground bg-muted/60 px-2 py-1 rounded-lg border border-border/80">
                    {i.code}
                  </span>
                </td>

                {/* Nama Item */}
                <td className="px-5 py-3.5 font-semibold text-foreground">
                  {i.name}
                </td>

                {/* Kategori */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border',
                      catStyle.bg,
                      catStyle.text,
                      catStyle.border
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{i.category}</span>
                  </span>
                </td>

                {/* Status Switch */}
                <td className="px-5 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleActive(i)}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      i.active ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                    aria-pressed={i.active}
                    aria-label={`Toggle status for ${i.name}`}
                    title={i.active ? 'Aktif (Tampil di form)' : 'Nonaktif (Disembunyikan)'}
                  >
                    <span
                      className={cn(
                        'inline-block size-4.5 transform rounded-full bg-white shadow-xs transition duration-200',
                        i.active ? 'translate-x-5.5' : 'translate-x-1'
                      )}
                    />
                  </button>
                </td>

                {/* Urutan */}
                <td className="px-5 py-3.5 text-center font-mono text-xs text-muted-foreground font-semibold">
                  {i.displayOrder}
                </td>

                {/* Aksi */}
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(i)}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-primary/20"
                      title="Edit Item"
                    >
                      <Edit2 className="size-4" />
                    </button>
                    <button
                      onClick={() => onDelete(i)}
                      className="p-1.5 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                      title="Hapus Item"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
