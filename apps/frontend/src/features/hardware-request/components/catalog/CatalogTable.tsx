import React from 'react';
import { Pencil, Trash2, Laptop, Monitor, Tv, Headphones, Network, Code2, Box } from 'lucide-react';
import type { HardwareCatalog, ItemCategory } from '../../types';

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
  DESKTOP: { bg: 'bg-cyan-500/10 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-500/30' },
  MONITOR: { bg: 'bg-teal-500/10 dark:bg-teal-500/15', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/30' },
  ACCESSORY: { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30' },
  NETWORK: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30' },
  SOFTWARE: { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-500/30' },
  OTHER: { bg: 'bg-slate-500/10 dark:bg-slate-500/15', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-500/30' },
};

/** Mockup ?tab=catalog rows: Urutan · Kode · Nama · Kategori · Status Form (switch) · Aksi. Rendered inside ResTable. */
export function CatalogTable({ items, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <>
      {items.map((i) => {
        const Icon = CATEGORY_ICONS[i.category] || Box;
        return (
          <div key={i.id} className="res-row">
            <span className="res-cell is-num res-hide-m">{i.displayOrder}</span>
            <span className="res-cell is-mono res-hide-m">{i.code}</span>
            <span className="res-cell"><b className="font-semibold">{i.name}</b><span className="res-muted block text-[11px] md:hidden">{i.code} · {i.category}</span></span>
            <span className="res-cell res-hide-m inline-flex items-center gap-1.5"><Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />{i.category}</span>
            <span className="inline-flex items-center gap-2">
              <button type="button" role="switch" className="res-switch" aria-checked={i.active}
                aria-label={`Status form ${i.name}`} title={i.active ? 'Aktif (Tampil di form)' : 'Nonaktif (Disembunyikan)'}
                onClick={() => onToggleActive(i)} />
              <span className="res-muted text-xs">{i.active ? 'Aktif' : 'Nonaktif'}</span>
            </span>
            <span className="res-acts">
              <button type="button" className="res-icon-btn" onClick={() => onEdit(i)} aria-label={`Edit ${i.name}`} title="Edit item"><Pencil aria-hidden="true" /></button>
              <button type="button" className="res-icon-btn is-danger" onClick={() => onDelete(i)} aria-label={`Hapus ${i.name}`} title="Hapus item"><Trash2 aria-hidden="true" /></button>
            </span>
          </div>
        );
      })}
    </>
  );
}
