import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, X, Check, Loader2, Sparkles } from 'lucide-react';
import type { HardwareCatalog, ItemCategory } from '../../types';
import { CATEGORY_ICONS, CATEGORY_STYLES } from './CatalogTable';
import { cn } from '@/lib/utils';

const categories: ItemCategory[] = [
  'LAPTOP',
  'DESKTOP',
  'MONITOR',
  'ACCESSORY',
  'NETWORK',
  'SOFTWARE',
  'OTHER',
];

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
  const [category, setCategory] = useState<ItemCategory>('LAPTOP');
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
      requiredFields: {},
    });
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Dialog Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-labelledby="cat-title"
          className="relative w-full max-w-xl rounded-3xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Settings2 className="size-5" />
              </div>
              <div>
                <h2 id="cat-title" className="text-base font-bold text-foreground">
                  {initial ? 'Edit Item Katalog' : 'Tambah Item Katalog Baru'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {initial ? `Ubah konfigurasi master item ${initial.code}` : 'Tambahkan jenis hardware baru ke formulir permohonan'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
            {/* Code & Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Kode Item</span>
                  {initial && <span className="text-[10px] text-muted-foreground font-normal">(Tidak dapat diubah)</span>}
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
                  disabled={!!initial}
                  placeholder="Contoh: LAPTOP-01"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-mono font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Nama Perangkat</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Laptop Developer Pro"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground">Pilih Kategori Hardware</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {categories.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  const selected = category === c;
                  const catStyle = CATEGORY_STYLES[c];

                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        'flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer text-left',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50 border-border/80'
                      )}
                    >
                      <div
                        className={cn(
                          'p-1.5 rounded-xl border',
                          selected ? 'bg-primary-foreground/20 border-primary-foreground/30 text-primary-foreground' : cn(catStyle.bg, catStyle.border, catStyle.text)
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <span className="truncate">{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Toggle Card */}
            <div
              onClick={() => setActive(!active)}
              className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/20 hover:bg-muted/30 cursor-pointer transition-all"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">Status Aktif di Katalog</div>
                <div className="text-[11px] text-muted-foreground">
                  Jika aktif, item ini akan langsung muncul sebagai opsi pilihan di formulir request user.
                </div>
              </div>
              <div
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
                  active ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block size-4.5 transform rounded-full bg-white shadow-xs transition duration-200',
                    active ? 'translate-x-5.5' : 'translate-x-1'
                  )}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  <span>{initial ? 'Simpan Perubahan' : 'Tambah ke Katalog'}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
