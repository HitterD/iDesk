import { useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface ItemLite {
  id: string;
  name: string;
  qty: number;
}

interface Props {
  items: readonly ItemLite[];
}

export function ExpandableItemRow({ items }: Props) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  if (items.length === 0) {
    return <p className="text-xs text-slate-400">Belum ada item.</p>;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
        {open ? 'Sembunyikan' : `Lihat ${items.length} item`}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.ul
            key="items"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={reduce ? {} : { height: 'auto', opacity: 1 }}
            exit={reduce ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
            className="mt-2 overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-200 dark:ring-slate-700"
          >
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-0"
              >
                <span className="text-slate-700 dark:text-slate-200">{it.name}</span>
                <span className="text-slate-500 dark:text-slate-400">qty: {it.qty}</span>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
