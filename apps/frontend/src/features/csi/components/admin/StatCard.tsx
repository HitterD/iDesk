import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneClasses, type CsiTone } from '../../lib/csiTone';
import { MUTED_TEXT } from './AdminParts';

/** Mockup `.stat`: tone bubble + big value, label, hint; `attention` tints the card and value (`.stat.attn`). */
export function StatCard({ tone, icon: Icon, label, value, hint, attention }: {
    tone: CsiTone; icon: ElementType; label: string; value: ReactNode; hint: ReactNode; attention?: boolean;
}) {
    const classes = toneClasses(tone);
    return (
        <div role="group" aria-label={label} className={cn('min-w-0 rounded-[18px] bg-[hsl(var(--idesk-surface))] px-4 py-3.5 shadow-[var(--dash-shadow-1)]', attention && classes.soft)}>
            <div className="flex items-start justify-between gap-2">
                <span className={cn('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full', classes.soft, classes.ink)}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span className={cn('text-[22px] font-[650] leading-tight tracking-[-.03em] tabular-nums', attention && classes.ink)}>{value}</span>
            </div>
            <div className="mt-1.5 text-[13px] font-semibold">{label}</div>
            <div className={cn(MUTED_TEXT, 'text-[12px]')}>{hint}</div>
        </div>
    );
}
