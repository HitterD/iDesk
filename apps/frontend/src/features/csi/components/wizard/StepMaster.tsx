import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MUTED_TEXT } from '../admin/AdminParts';

/** Shared frame for wizard steps that edit master data: title, guidance note, then the list. */
export function StepMaster({ title, note, children }: { title: string; note: string; children: ReactNode }) {
    return (
        <section aria-label={title} className="grid gap-4">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <p role="note" className={cn(MUTED_TEXT, 'flex items-start gap-2 rounded-2xl bg-[hsl(var(--idesk-sapphire)/.07)] px-4 py-3')}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />{note}
            </p>
            {children}
        </section>
    );
}
