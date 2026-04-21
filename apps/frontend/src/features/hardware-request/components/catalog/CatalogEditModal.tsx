import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, X } from 'lucide-react';
import type { HardwareCatalog } from '../../types';

const categories = ['LAPTOP', 'DESKTOP', 'MONITOR', 'ACCESSORY', 'NETWORK', 'SOFTWARE', 'OTHER'] as const;

type Props = {
  open: boolean;
  initial?: HardwareCatalog;
  onClose: () => void;
  onSubmit: (payload: Partial<HardwareCatalog>) => Promise<void>;
  isSubmitting?: boolean;
};

export function CatalogEditModal({ open, initial, onClose, onSubmit, isSubmitting }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HardwareCatalog['category']>('LAPTOP');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initial) {
      setCode(initial.code);
      setName(initial.name);
      setCategory(initial.category);
      setActive(initial.active);
    } else {
      setCode('');
      setName('');
      setCategory('LAPTOP');
      setActive(true);
    }
  }, [initial, open]);

  if (!open) return null;

  const canSubmit = code.trim().length >= 2 && name.trim().length >= 2;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      code: code.trim(),
      name: name.trim(),
      category,
      active,
      displayOrder: initial?.displayOrder ?? 0,
      requiredFields: [], // Fix validation error, must be array
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            onClick={onClose} 
        />
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2 }}
            role="dialog" aria-labelledby="cat-title" 
            className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h2 id="cat-title" className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 className="size-5 text-primary" />
              {initial ? 'Edit Catalog Item' : 'Tambah Catalog Item'}
            </h2>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="size-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm space-y-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">Code</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                  disabled={!!initial}
                  placeholder="Ex: LAPTOP-001"
                />
              </label>
              <label className="text-sm space-y-1.5">
                <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                  placeholder="Nama Perangkat"
                />
              </label>
              <label className="text-sm space-y-1.5 col-span-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as HardwareCatalog['category'])}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out ${active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-300 ease-in-out ${active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="sr-only" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Status Aktif (Tampil di form request)</span>
              </label>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-6 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors shadow-sm"
            >
              {isSubmitting ? 'Menyimpan…' : 'Simpan Item'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
