import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CsiPendingDepartment } from '../../../hcTypes';
import { titleCase } from './hcFormat';

/** Raters still to answer per department; names are never shown here. */
export function PendingByDepartment({ rows, className }: { rows: CsiPendingDepartment[]; className?: string }) {
    const open = rows.filter((row) => row.pending > 0);
    return (
        <section aria-label="Belum menilai per departemen" className={cn('grid gap-3', className)}>
            <h2 className="flex items-center gap-2 text-[15px] font-bold"><Users className="h-4 w-4" aria-hidden="true" />Belum menilai per departemen</h2>
            {!open.length && <p className="text-[13px] text-muted-foreground">Semua penilai sudah mengisi.</p>}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {open.map((row) => (
                    <li key={row.department} className="grid gap-1 rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2">
                        <span className="text-[13px] font-semibold">{titleCase(row.department)}</span>
                        <span className="text-[12.5px] text-muted-foreground">{`${row.pending} dari ${row.total} belum menilai`}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--border))]">
                            <span className="block h-full rounded-full bg-[hsl(var(--ticket-green))]" style={{ width: `${((row.total - row.pending) / row.total) * 100}%` }} />
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
