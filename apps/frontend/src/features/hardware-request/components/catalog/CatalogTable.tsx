import { Edit2, Trash2 } from 'lucide-react';
import type { HardwareCatalog } from '../../types';

type Props = {
  items: HardwareCatalog[];
  onEdit: (item: HardwareCatalog) => void;
  onToggleActive: (item: HardwareCatalog) => void;
  onDelete: (item: HardwareCatalog) => void;
};

export function CatalogTable({ items, onEdit, onToggleActive, onDelete }: Props) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-5 py-3.5 text-left font-semibold">Kode</th>
            <th className="px-5 py-3.5 text-left font-semibold">Nama Item</th>
            <th className="px-5 py-3.5 text-left font-semibold">Kategori</th>
            <th className="px-5 py-3.5 text-center font-semibold">Status</th>
            <th className="px-5 py-3.5 text-center font-semibold">Urutan</th>
            <th className="px-5 py-3.5 text-right font-semibold">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((i) => (
            <tr key={i.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-200">
              <td className="px-5 py-3.5 font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-200">{i.code}</td>
              <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">{i.name}</td>
              <td className="px-5 py-3.5">
                <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {i.category}
                </span>
              </td>
              <td className="px-5 py-3.5 text-center">
                <button
                  type="button"
                  onClick={() => onToggleActive(i)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    i.active ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  aria-pressed={i.active}
                  aria-label={`Toggle status for ${i.name}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-300 ease-in-out ${
                      i.active ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </td>
              <td className="px-5 py-3.5 text-center font-mono text-xs text-slate-600 dark:text-slate-400">
                {i.displayOrder}
              </td>
              <td className="px-5 py-3.5 text-right space-x-2">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => onEdit(i)} 
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Edit Item"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button 
                    onClick={() => onDelete(i)} 
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                    title="Hapus Item"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
