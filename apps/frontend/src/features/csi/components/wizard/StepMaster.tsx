import { useState, type ReactNode } from 'react';
import { CheckCircle2, Info, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toneClasses } from '../../lib/csiTone';
import { ADMIN_PANEL, MUTED_TEXT } from '../admin/AdminParts';

interface StepMasterProps {
    title: string;
    note: string;
    /**
     * When the shared list is already filled, the step opens as a one-line summary ("12 departemen aktif ✓") and the
     * editor only on request: most surveys reuse the lists as they are.
     */
    summary?: string | null;
    children: ReactNode;
}

/** Shared frame for wizard steps that edit master data: title, guidance note, then the list (or its summary). */
export function StepMaster({ title, note, summary, children }: StepMasterProps) {
    const [editing, setEditing] = useState(false);
    const green = toneClasses('green');
    return (
        <section aria-label={title} className="grid gap-4">
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
            <p role="note" className={cn(MUTED_TEXT, 'flex items-start gap-2 rounded-2xl bg-[hsl(var(--idesk-sapphire)/.07)] px-4 py-3')}>
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />{note}
            </p>
            {summary && !editing ? (
                <div className={cn(ADMIN_PANEL, 'flex flex-wrap items-center gap-3 px-5 py-4')}>
                    <CheckCircle2 className={cn('h-5 w-5', green.ink)} aria-hidden="true" />
                    <span className="flex-1 text-[14px] font-medium">{summary}</span>
                    <Button variant="soft" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Kelola</Button>
                </div>
            ) : children}
        </section>
    );
}
