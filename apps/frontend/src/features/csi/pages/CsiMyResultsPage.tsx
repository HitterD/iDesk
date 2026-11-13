import { Hourglass, MessageSquareQuote, ShieldCheck, Star } from 'lucide-react';
import { ErrorState } from '@/components/ui/ErrorState';
import { cn } from '@/lib/utils';
import { formatScore, scoreToneClass } from '../components/admin/hc/hcFormat';
import { CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { useCsiMyResults } from '../hooks/useCsi';
import { formatDate } from '../lib/format';
import type { CsiSelfResult } from '../types';

const MAX_SCORE = 5;
const STATUS_TEXT = { UPCOMING: 'Belum dimulai', ACTIVE: 'Sedang berjalan', ENDED: 'Selesai' } as const;

function DimensionBars({ result }: { result: CsiSelfResult }) {
    return (
        <ul className="grid gap-2">
            {result.dimensions.map((row) => (
                <li key={row.label} className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)_44px] items-center gap-2 text-[13px]">
                    <span className="line-clamp-2 font-semibold" title={row.label}>{row.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[hsl(var(--border))]">
                        <span className="block h-full rounded-full bg-[hsl(var(--ticket-amber))]" style={{ width: `${(row.average / MAX_SCORE) * 100}%` }} />
                    </span>
                    <b className={cn('text-right tabular-nums', scoreToneClass(row.average, result.scoreBands))}>{formatScore(row.average)}</b>
                </li>
            ))}
        </ul>
    );
}

function ResultCard({ result, index }: { result: CsiSelfResult; index: number }) {
    return (
        <FadeIn index={index} className={cn(CSI_CARD, 'grid gap-4 p-5')}>
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h2 className="text-[16px] font-bold">{result.title}</h2>
                    {result.teamName && <p className="mt-1 text-[13px] font-semibold text-muted-foreground">{`Tim ${result.teamName}`}</p>}
                    <p className="text-[12.5px] text-muted-foreground">{`${formatDate(result.startDate)} – ${formatDate(result.endDate)} · ${STATUS_TEXT[result.status]}`}</p>
                    {result.serviceFunction && <p className="mt-1 text-[13px] text-[hsl(var(--idesk-sapphire))]">{`Fungsi pelayanan: ${result.serviceFunction}`}</p>}
                </div>
            </header>
            {!result.ready && (
                <p className="flex items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 py-3 text-[13.5px]">
                    <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {result.minRaters <= 1
                        ? 'Belum ada penilaian.'
                        : `Hasil tampil setelah minimal ${result.minRaters} penilai mengisi (saat ini ${result.raters}).`}
                </p>
            )}
            {result.ready && (
                <>
                    <div className="grid items-center gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                        <div className="rounded-2xl bg-[hsl(var(--ticket-amber)/.12)] p-3 text-center">
                            <p className="text-[11.5px] font-semibold uppercase text-muted-foreground">Rata-rata</p>
                            <p className={cn('flex items-center justify-center gap-1 text-[30px] font-bold tabular-nums', scoreToneClass(result.average, result.scoreBands))}>
                                <Star className="h-6 w-6 fill-[hsl(var(--ticket-amber))] text-[hsl(var(--ticket-amber))]" aria-hidden="true" />{formatScore(result.average)}
                            </p>
                            <p className="text-[12px] text-muted-foreground">{`dari ${result.raters} penilai`}</p>
                        </div>
                        <DimensionBars result={result} />
                    </div>
                    {result.comments.length > 0 && (
                        <section aria-label="Saran dan apresiasi" className="grid gap-2">
                            <h3 className="flex items-center gap-2 text-[14px] font-bold"><MessageSquareQuote className="h-4 w-4" aria-hidden="true" />Saran & apresiasi</h3>
                            <ul className="grid gap-2">
                                {result.comments.map((text, at) => (
                                    <li key={at} className="rounded-xl bg-[hsl(var(--muted)/.5)] px-3 py-2 text-[13.5px] italic">{`“${text}”`}</li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </FadeIn>
    );
}

/** "Hasil penilaian saya": what colleagues rated about the signed-in account; never shows who rated. */
export function CsiMyResultsPage() {
    const { data: results, isLoading, isError, refetch } = useCsiMyResults();
    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <FadeIn className="space-y-1.5 pt-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Hasil penilaian saya</h1>
                <p className="flex items-start gap-1.5 text-[14px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Nama penilai tidak pernah ditampilkan. Komentar diacak dan tanpa tanggal.
                </p>
            </FadeIn>
            {isLoading && <div className={cn(CSI_CARD, 'h-40 animate-pulse')} aria-busy="true" />}
            {isError && <ErrorState title="Gagal memuat hasil" message="Silakan coba lagi." onRetry={() => refetch()} />}
            {results && !results.length && (
                <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Anda belum menjadi orang yang dinilai pada survei mana pun.</p>
            )}
            {results?.map((result, index) => <ResultCard key={`${result.periodId}-${index}`} result={result} index={index} />)}
        </div>
    );
}

export default CsiMyResultsPage;
