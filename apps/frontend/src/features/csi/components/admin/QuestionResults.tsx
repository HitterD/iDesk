import type { CsiReportRatee } from '../../types';
import { formatScore } from '../../lib/format';

/** Explicit counts keep distributions readable without relying on colour or a chart library. */
export function QuestionResults({ ratees }: { ratees: CsiReportRatee[] }) {
    return (
        <div className="mt-5 grid gap-4">
            {ratees.map((ratee) => <details key={ratee.periodRateeId} className="rounded-2xl border border-border p-4">
                <summary className="cursor-pointer font-medium">Rincian pertanyaan — {ratee.displayName}</summary>
                <div className="mt-4 grid gap-5">{ratee.questions.map((question, index) => (
                    <section key={`${index}-${question.name}`}>
                        <h4 className="text-sm font-medium">{question.name}</h4>
                        {question.average !== null && <p className="mt-1 text-xs text-muted-foreground">Rata-rata {formatScore(question.average)} / 5 · {question.count} nilai</p>}
                        {question.distribution.length > 0 && <ul className="mt-2 grid gap-1.5 text-sm" aria-label={`Jawaban ${question.name}`}>
                            {question.distribution.map((entry) => <li key={entry.label} className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2">
                                <span className="whitespace-pre-wrap break-words">{entry.label}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{entry.count} jawaban</span>
                            </li>)}
                        </ul>}
                        {question.average === null && !question.distribution.length && <p className="mt-1 text-xs text-muted-foreground">Belum ada jawaban.</p>}
                    </section>
                ))}</div>
            </details>)}
        </div>
    );
}
