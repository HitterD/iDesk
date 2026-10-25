import { ChevronRight } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { useCsiRespondents } from '../../hooks/useCsi';
import { formatDateTime } from '../../lib/format';
import type { CsiScopeParam } from '../../types';
import { AdminSection, EmptyNote, MUTED_TEXT } from './AdminParts';

function Total({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' }) {
    return (
        <div className={cn('rounded-2xl px-4 py-3', tone === 'green' ? 'bg-[hsl(var(--ticket-green)/.1)]' : 'bg-[hsl(var(--ticket-amber)/.12)]')}>
            <span className={MUTED_TEXT}>{label}</span>
            <span className="block text-[22px] font-bold tabular-nums tracking-tight">{value}</span>
        </div>
    );
}

export function RespondentStatus({ scope, periodId, onOpenResponse }: {
    scope: CsiScopeParam; periodId: string; onOpenResponse: (responseId: string) => void;
}) {
    const { data, isLoading, isError, refetch } = useCsiRespondents(scope, periodId);
    const listed = data?.mode === 'LISTED';
    return (
        <AdminSection title="Status responden" description={data && !listed ? 'Mode terbuka: semua user aktif di site dapat mengisi' : undefined}>
            {isLoading && <div className="h-24 animate-pulse rounded-2xl bg-[hsl(var(--muted))] motion-reduce:animate-none" aria-busy="true" aria-label="Memuat responden" />}
            {isError && <ErrorState compact message="Gagal memuat status responden." onRetry={() => refetch()} />}
            {data && (
                <div className="grid gap-5">
                    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                        <Total label="Sudah mengisi" value={data.totals.submitted} tone="green" />
                        {listed && <Total label="Belum mengisi" value={data.totals.pending ?? 0} tone="amber" />}
                    </div>
                    <div className={cn('grid gap-5', listed && 'lg:grid-cols-2')}>
                        <div>
                            <h3 className="mb-2 text-[13px] font-semibold">Jawaban</h3>
                            {data.submitted.length ? (
                                <ul className="divide-y divide-[hsl(var(--idesk-border)/.5)] rounded-2xl border border-[hsl(var(--idesk-border)/.7)]" aria-label="Sudah mengisi">
                                    {data.submitted.map((item) => (
                                        <li key={item.responseId}>
                                            <button type="button" onClick={() => onOpenResponse(item.responseId)}
                                                className="group flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[hsl(var(--muted)/.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[13.5px] font-medium">{item.fullName}</span>
                                                    <span className={cn(MUTED_TEXT, 'block text-[12px]')}>{`${item.departmentName} · ${formatDateTime(item.submittedAt)}`}</span>
                                                </span>
                                                <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : <EmptyNote>Belum ada jawaban.</EmptyNote>}
                        </div>
                        {listed && (
                            <div>
                                <h3 className="mb-2 text-[13px] font-semibold">Belum mengisi</h3>
                                {data.pending?.length ? (
                                    <ul className="divide-y divide-[hsl(var(--idesk-border)/.5)] rounded-2xl border border-[hsl(var(--idesk-border)/.7)]" aria-label="Belum mengisi">
                                        {data.pending.map((item) => <li key={item.userId} className="px-4 py-2.5 text-[13.5px]">{item.fullName}</li>)}
                                    </ul>
                                ) : <EmptyNote>Semua penilai sudah mengisi.</EmptyNote>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AdminSection>
    );
}
