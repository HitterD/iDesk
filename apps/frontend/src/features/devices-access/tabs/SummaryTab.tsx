import { CheckCircle2, Laptop, Package, Wrench } from 'lucide-react';
import { useCenterSummary, useScheduleWeek } from '../api';
import { Kpi } from '../Kpi';
import { mondayOf, techLoadClass } from '../rules';

const PHASE_LABEL: Record<string, string> = {
    SUBMITTED: 'Menunggu review', UNDER_REVIEW: 'Review / persetujuan', APPROVED: 'Disetujui', PROCUREMENT: 'Pembelian', AWAITING_DELIVERY: 'Menunggu barang',
    INSTALLATION: 'Pemasangan', AWAITING_USER_CONFIRMATION: 'Konfirmasi pemohon',
};
const PHASE_TONE: Record<string, string> = { PROCUREMENT: 'c-amber', AWAITING_DELIVERY: 'c-amber', INSTALLATION: 'c-sky', AWAITING_USER_CONFIRMATION: 'c-green' };
const ACTIVE_PHASES = Object.keys(PHASE_LABEL);
const BAR_PERCENT_PER_INSTALL = 25;
const first = (name: string): string => name.split(' ')[0];
const wibToday = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

function Bars({ rows, empty }: { rows: Array<{ key: string; label: string; value: number; tone?: string }>; empty: string }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    if (rows.length === 0) return <p className="da-muted">{empty}</p>;
    return <>{rows.map((r) => (
        <div key={r.key} className="da-bar"><span>{r.label}</span><i className={r.tone ?? ''} style={{ ['--w' as string]: `${(r.value / max) * 100}%` }} /><b>{r.value}</b></div>
    ))}</>;
}

/** "Ringkasan" (mockup ticket-unify `centerSummary`): where the hardware requests of this site stand, what is asked most, who is busy, how old. */
export function SummaryTab() {
    const { data, isLoading, isError } = useCenterSummary();
    const { data: week } = useScheduleWeek(mondayOf(wibToday()));
    const phases = (data?.byPhase ?? []).filter((p) => ACTIVE_PHASES.includes(p.phase));
    const age = data?.age ?? { fresh: 0, week: 0, old: 0 };

    return (
        <div>
            {isLoading && <p aria-busy="true" className="da-muted">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat ringkasan.</p>}
            <div className="da-kpis">
                <Kpi icon={Laptop} tone="navy" label="Request hardware aktif" value={data?.activeHardware ?? 0} />
                <Kpi icon={Package} tone="amber" label="Dalam pembelian" value={data?.inProcurement ?? 0} />
                <Kpi icon={Wrench} tone="sky" label="Menunggu pemasangan" value={data?.waitingInstall ?? 0} />
                <Kpi icon={CheckCircle2} tone="green" label="Selesai bulan ini" value={data?.doneThisMonth ?? 0} />
            </div>
            <div className="da-sgrid">
                <section className="da-card da-cpad" aria-label="Posisi request saat ini">
                    <b className="da-cs-h">Posisi request saat ini</b>
                    <Bars empty="Belum ada request yang berjalan." rows={phases.map((p) => ({ key: p.phase, label: PHASE_LABEL[p.phase], value: p.count, tone: PHASE_TONE[p.phase] }))} />
                </section>
                <section className="da-card da-cpad" aria-label="Barang paling banyak diminta">
                    <b className="da-cs-h">Barang paling banyak diminta (30 hari)</b>
                    <Bars empty="Belum ada permintaan 30 hari terakhir." rows={(data?.topItems ?? []).map((i) => ({ key: i.name, label: i.name, value: i.count }))} />
                </section>
                <section className="da-card da-cpad" aria-label="Beban teknisi">
                    <b className="da-cs-h">Beban teknisi</b>
                    {(week?.load ?? []).length === 0 ? <p className="da-muted">Belum ada pemasangan minggu ini.</p> : (week?.load ?? []).map((t) => (
                        <div key={t.technicianId} className="da-bar"><span>{first(t.technicianName)}</span><i className={techLoadClass(t.count)} style={{ ['--w' as string]: `${Math.min(100, t.count * BAR_PERCENT_PER_INSTALL)}%` }} /><b>{t.count}</b></div>
                    ))}
                    <p className="da-muted">Teknisi tersibuk sebaiknya tidak diberi tugas baru dulu.</p>
                </section>
                <section className="da-card da-cpad" aria-label="Umur request belum selesai">
                    <b className="da-cs-h">Umur request belum selesai</b>
                    <Bars empty="Tidak ada request yang berjalan." rows={[
                        { key: 'fresh', label: '0–3 hari', value: age.fresh },
                        { key: 'week', label: '3–7 hari', value: age.week, tone: 'c-amber' },
                        { key: 'old', label: '> 7 hari', value: age.old, tone: 'hot' },
                    ]} />
                </section>
            </div>
        </div>
    );
}
