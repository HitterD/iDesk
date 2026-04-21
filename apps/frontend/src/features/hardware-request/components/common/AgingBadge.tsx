import { daysSince, agingTone } from '../../utils/aging.util';

export function AgingBadge({ updatedAt, terminal }: { updatedAt: string; terminal: boolean }) {
    if (terminal) return null;
    const d = daysSince(updatedAt);
    const tone = agingTone(d);
    if (tone === 'none') return null;
    const cls = tone === 'red'
        ? 'bg-rose-50 text-rose-700 ring-rose-200'
        : 'bg-amber-50 text-amber-800 ring-amber-200';
    return <span className={`inline-flex items-center gap-1 rounded-full ring-1 ${cls} text-[11px] px-2 py-0.5 font-medium`}>
        {d}h
    </span>;
}
