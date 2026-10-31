import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneColor, type CsiTone } from '../../../lib/csiTone';

const DEGREES = 360;
const FULL = 100;
const SIZES = { lg: 'h-[124px] w-[124px] p-[10px]', sm: 'h-16 w-16 p-[6px]' } as const;

/** Conic progress ring (0–100 %) in a csiTone colour around free content; callers print the value as text. */
export function ScoreRing({ pct, tone, size = 'lg', children }: { pct: number; tone: CsiTone; size?: keyof typeof SIZES; children: ReactNode }) {
    const clamped = Math.max(0, Math.min(FULL, pct));
    return (
        <span className={cn('grid shrink-0 rounded-full', SIZES[size])}
            style={{ background: `conic-gradient(${toneColor(tone)} ${(clamped / FULL) * DEGREES}deg, hsl(var(--muted)) 0)` }}>
            <span className="grid place-items-center rounded-full bg-[hsl(var(--idesk-surface))] text-center">{children}</span>
        </span>
    );
}
