import { useState, useEffect } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type RequiredField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
};

type Props = {
  value: RequiredField[];
  onChange: (v: RequiredField[]) => void;
};

export function RequiredFieldsBuilder({ value, onChange }: Props) {
  const [draft, setDraft] = useState<RequiredField[]>(value);
  useEffect(() => setDraft(value), [value]);

  const update = (idx: number, patch: Partial<RequiredField>) => {
    const next = draft.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    setDraft(next);
    onChange(next);
  };
  const add = () => {
    const next = [...draft, { key: '', label: '', type: 'text' as const, required: true }];
    setDraft(next);
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = draft.filter((_, i) => i !== idx);
    setDraft(next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {draft.map((f, idx) => (
          <motion.div 
            key={idx} 
            initial={{ opacity: 0, height: 0, y: -10 }} 
            animate={{ opacity: 1, height: 'auto', y: 0 }} 
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-12 gap-3 items-end rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm relative group">
              <label className="col-span-12 sm:col-span-3 text-sm space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Field Key</span>
                <input
                  aria-label="Field key"
                  value={f.key}
                  onChange={(e) => update(idx, { key: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                  placeholder="e.g. ram_size"
                />
              </label>
              <label className="col-span-12 sm:col-span-3 text-sm space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Label</span>
                <input
                  aria-label="Label"
                  value={f.label}
                  onChange={(e) => update(idx, { label: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                  placeholder="e.g. RAM Size"
                />
              </label>
              <label className="col-span-12 sm:col-span-2 text-sm space-y-1">
                <span className="font-medium text-slate-700 dark:text-slate-300">Type</span>
                <select
                  aria-label="Type"
                  value={f.type}
                  onChange={(e) => update(idx, { type: e.target.value as RequiredField['type'] })}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                </select>
              </label>
              <label className="col-span-12 sm:col-span-3 flex items-center gap-2 pb-1.5 cursor-pointer">
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ease-in-out ${f.required ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${f.required ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </div>
                <input type="checkbox" checked={f.required} onChange={(e) => update(idx, { required: e.target.checked })} className="sr-only" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Wajib Diisi</span>
              </label>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                title="Hapus Field"
              >
                <Trash2 className="size-4" />
              </button>
              
              {f.type === 'select' && (
                <label className="col-span-12 text-sm space-y-1 mt-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Options <span className="text-slate-500 font-normal">(pisahkan dengan koma)</span></span>
                  <input
                    aria-label="Options"
                    value={(f.options ?? []).join(', ')}
                    onChange={(e) =>
                      update(idx, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                    placeholder="e.g. 8GB, 16GB, 32GB"
                  />
                </label>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <button
        type="button"
        onClick={add}
        className="flex items-center justify-center gap-2 w-full text-sm font-medium px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all"
      >
        <PlusCircle className="size-4" />
        Tambah Custom Field
      </button>
    </div>
  );
}
