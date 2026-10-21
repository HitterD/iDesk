import { cssVars } from '@/features/dashboard/components/DashboardParts';
import { cn } from '@/lib/utils';

export interface HBarItem { key: string; label: string; value: number; color?: string }

const PERCENT = 100;

/** Mockup `hbars`: label · track · value. `max` fixes the scale (e.g. technician capacity). */
export function HBars({ items, suffix = '', max, wide }: { items: readonly HBarItem[]; suffix?: string; max?: number; wide?: boolean }) {
  const top = Math.max(max ?? 0, ...items.map((i) => i.value), 1);
  return (
    <div className="dash-hbars">
      {items.map((i) => (
        <div key={i.key} className={cn('dash-hb', wide && 'res-hb-wide')} title={`${i.label}: ${i.value}${suffix}`}>
          <span>{i.label}</span>
          <span className="dash-track"><i style={cssVars({ '--p': `${(i.value / top) * PERCENT}%`, ...(i.color ? { '--c': i.color } : {}) })} /></span>
          <b>{i.value}{suffix}</b>
        </div>
      ))}
    </div>
  );
}
