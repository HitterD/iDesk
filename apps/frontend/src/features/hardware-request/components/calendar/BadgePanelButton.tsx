import type { ReactNode } from 'react';

type Variant = 'green' | 'amber' | 'red';
type Props = { label: string; count: number; variant: Variant; open: boolean; onToggle: () => void; children: ReactNode };

const V: Record<Variant, { pill: string; badge: string; border: string }> = {
  green: { pill: 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100', badge: 'bg-green-500 text-white', border: 'border-t-2 border-green-500' },
  amber: { pill: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100', badge: 'bg-amber-500 text-white', border: 'border-t-2 border-amber-500' },
  red:   { pill: 'border-red-200   bg-red-50   text-red-800   hover:bg-red-100',   badge: 'bg-red-500   text-white', border: 'border-t-2 border-red-500'   },
};

export function BadgePanelButton({ label, count, variant, open, onToggle, children }: Props) {
  const s = V[variant];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${s.pill}`}
      >
        {label}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${s.badge}`}>{count}</span>
      </button>
      {open && (
        <div className={`absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-xl ${s.border}`}>
          {children}
        </div>
      )}
    </div>
  );
}