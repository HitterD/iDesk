import { formatScore } from '../../lib/format';
import type { CsiReport } from '../../types';

export function ReportSummary({ report }: { report: CsiReport }) {
    return (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div aria-label="Nilai keseluruhan" className="rounded-2xl bg-muted/60 p-5">
                <p className="text-sm text-muted-foreground">Nilai keseluruhan</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{formatScore(report.overall.average)} <span className="text-base text-muted-foreground">/ 5</span></p>
                <p className="mt-2 text-xs text-muted-foreground">Rata-rata nilai responden dari jawaban bintang dan pilihan berskala.</p>
            </div>
            <div className="rounded-2xl border border-border p-5">
                <p className="text-sm text-muted-foreground">Jawaban masuk</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{report.overall.respondentCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">Jawaban tanpa nilai tidak memengaruhi rata-rata.</p>
            </div>
        </div>
    );
}

export function SlaSummary({ sla }: { sla: CsiReport['sla'] }) {
    const entries = [
        { label: sla.mode === 'OPEN' ? 'Pelapor tiket iDesk' : 'Penilai terdaftar', value: sla.basis },
        { label: 'Target responden', value: sla.target },
        { label: 'Jawaban CSI', value: sla.responses },
        { label: 'Pengisi SLA', value: sla.pengisiPct === null ? '—' : `${sla.pengisiPct}%` },
    ];
    return (
        <section aria-label="Ringkasan SLA" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {entries.map(({ label, value }) => <div key={label} aria-label={label} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            </div>)}
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">Target {sla.targetPct}% dari basis responden. Pengisi SLA dibatasi maksimal 100%.</p>
        </section>
    );
}
