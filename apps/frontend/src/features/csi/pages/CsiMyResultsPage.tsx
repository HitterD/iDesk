import { useState } from 'react';
import { BellRing, CheckCircle2, ChevronDown, ChevronUp, Hourglass, MessageSquareQuote, Search, ShieldCheck, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatScore, scoreToneClass } from '../components/admin/hc/hcFormat';
import { CSI_CARD, FadeIn } from '../components/CsiSurveyParts';
import { useCsiMyResults, useRemindMyResultRaters } from '../hooks/useCsi';
import { formatDate } from '../lib/format';
import type { CsiSelfPendingRater, CsiSelfResult } from '../types';

const MAX_SCORE = 5;
const AUTO_OPEN_PENDING_MAX = 10;
const STATUS_TEXT = { UPCOMING: 'Belum dimulai', ACTIVE: 'Sedang berjalan', ENDED: 'Selesai' } as const;
const REMINDED_MESSAGE = 'Pengingat anonim telah dikirim ke penilai yang belum mengisi.';
const ALREADY_REMINDED_MESSAGE = 'Semua penilai yang belum mengisi sudah diingatkan dalam 24 jam terakhir.';
const REMIND_ERROR_MESSAGE = 'Gagal mengirim pengingat. Silakan coba lagi.';

type RemindState = { kind: 'sent' | 'deduped' | 'error'; message: string } | null;

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

function raterCountLabel(raters: number, expectedRaters: number | null): string {
    return expectedRaters !== null ? `${raters} / ${expectedRaters} penilai sudah mengisi` : `dari ${raters} penilai`;
}

function PendingRatersList({ pending }: { pending: readonly CsiSelfPendingRater[] }) {
    const [open, setOpen] = useState(() => pending.length <= AUTO_OPEN_PENDING_MAX);
    const [search, setSearch] = useState('');
    if (!pending.length) return null;
    const term = search.trim().toLowerCase();
    const visible = term
        ? pending.filter((rater) => `${rater.fullName} ${rater.department ?? ''} ${rater.siteCode ?? ''}`.toLowerCase().includes(term))
        : pending;

    return (
        <div className="grid gap-2 border-t border-border/50 pt-2">
            <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-2 text-left text-[12.5px] font-semibold text-foreground/90 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    {`Belum menilai (${pending.length})`}
                </span>
                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[hsl(var(--idesk-sapphire))]">
                    {open ? 'Tutup daftar' : `Lihat ${pending.length} nama`}
                    {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                </span>
            </button>
            {open && (
                <div className="grid gap-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, departemen, atau site…"
                            aria-label="Cari penilai yang belum menilai" className="h-8 rounded-lg pl-8 text-[12.5px]" />
                    </div>
                    <ul className="max-h-56 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/50 bg-card/70">
                        {visible.length ? visible.map((rater, index) => (
                            <li key={rater.userId ?? `${rater.fullName}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-[12.5px]">
                                <span className="font-medium text-foreground">{rater.fullName}</span>
                                <span className="text-[12px] text-muted-foreground">
                                    {[rater.department, rater.siteCode].filter(Boolean).join(' · ') || '—'}
                                </span>
                            </li>
                        )) : (
                            <li className="px-3 py-3 text-center text-[12px] text-muted-foreground">Tidak ada nama yang cocok.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

function RaterProgressSection({ result }: { result: CsiSelfResult }) {
    const remind = useRemindMyResultRaters();
    const [feedback, setFeedback] = useState<RemindState>(null);
    const expected = result.expectedRaters;
    if (expected === null) return null;

    const complete = expected > 0 && result.raters >= expected;
    const pct = expected > 0 ? Math.min(100, Math.round((result.raters / expected) * 100)) : 100;
    const canRemind = result.status === 'ACTIVE' && expected > 0 && result.raters < expected && feedback?.kind !== 'sent' && feedback?.kind !== 'deduped';
    const pending = (result.status === 'ACTIVE' || result.status === 'ENDED') ? (result.pendingRaters ?? []) : [];

    const sendReminder = () => {
        setFeedback(null);
        remind.mutate(result.periodRateeId, {
            onSuccess: ({ reminded }) => setFeedback({ kind: reminded ? 'sent' : 'deduped', message: reminded ? REMINDED_MESSAGE : ALREADY_REMINDED_MESSAGE }),
            onError: () => setFeedback({ kind: 'error', message: REMIND_ERROR_MESSAGE }),
        });
    };

    return (
        <div className="grid gap-2 rounded-xl border border-border/60 bg-[hsl(var(--muted)/.35)] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[13px]">
                    {complete && <CheckCircle2 className="h-4 w-4 shrink-0 text-[hsl(var(--ticket-green-ink))]" aria-hidden="true" />}
                    <span className="font-semibold tabular-nums">{raterCountLabel(result.raters, expected)}</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">{`(${pct}%)`}</span>
                </div>
                {canRemind && (
                    <Button type="button" variant="soft" size="sm" onClick={sendReminder} loading={remind.isPending}>
                        <BellRing className="h-3.5 w-3.5" aria-hidden="true" />Ingatkan penilai
                    </Button>
                )}
            </div>
            <div role="progressbar" aria-label="Progres pengisian penilai" aria-valuenow={result.raters} aria-valuemin={0} aria-valuemax={expected}
                className="h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
                <div className={cn('h-full rounded-full transition-[width] duration-300',
                    complete ? 'bg-[hsl(var(--ticket-green))]' : 'bg-[hsl(var(--idesk-sapphire))]')}
                style={{ width: `${pct}%` }} />
            </div>
            {feedback && (
                <p role="status" className={cn('text-[12px]',
                    feedback.kind === 'error' ? 'text-[hsl(var(--ticket-red-ink))]' : 'text-[hsl(var(--ticket-green-ink))]')}>
                    {feedback.message}
                </p>
            )}
            <PendingRatersList pending={pending} />
        </div>
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
            <RaterProgressSection result={result} />
            {!result.ready && (
                <p className="flex items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.6)] px-3 py-3 text-[13.5px]">
                    <Hourglass className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {result.minRaters <= 1
                        ? 'Belum ada penilaian.'
                        : result.expectedRaters !== null
                            ? `Hasil tampil setelah minimal ${result.minRaters} penilai mengisi (saat ini ${result.raters} dari ${result.expectedRaters}).`
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
                            <p className="text-[12px] text-muted-foreground tabular-nums">
                                {result.expectedRaters !== null ? `${result.raters} / ${result.expectedRaters} penilai` : `dari ${result.raters} penilai`}
                            </p>
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

/** "Hasil penilaian saya": anonymous scores & comments for the signed-in account, plus pending raters for follow-up. */
export function CsiMyResultsPage() {
    const { data: results, isLoading, isError, refetch } = useCsiMyResults();
    return (
        <div className="mx-auto max-w-3xl space-y-5">
            <FadeIn className="space-y-1.5 pt-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">Hasil penilaian saya</h1>
                <p className="flex items-start gap-1.5 text-[14px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Skor dan komentar tetap anonim (komentar diacak dan tanpa tanggal). Daftar penilai yang belum mengisi ditampilkan untuk kebutuhan follow-up SLA.
                </p>
            </FadeIn>
            {isLoading && <div className={cn(CSI_CARD, 'h-40 animate-pulse')} aria-busy="true" />}
            {isError && <ErrorState title="Gagal memuat hasil" message="Silakan coba lagi." onRetry={() => refetch()} />}
            {results && !results.length && (
                <p className={cn(CSI_CARD, 'p-6 text-[14px] text-muted-foreground')}>Anda belum menjadi orang yang dinilai pada survei mana pun.</p>
            )}
            {results?.map((result, index) => <ResultCard key={`${result.periodRateeId}-${index}`} result={result} index={index} />)}
        </div>
    );
}

export default CsiMyResultsPage;
