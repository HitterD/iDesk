import { useCenterSummary } from '../api';

const PHASE_LABEL: Record<string, string> = {
    SUBMITTED: 'Menunggu review', UNDER_REVIEW: 'Review / persetujuan', APPROVED: 'Disetujui', PROCUREMENT: 'Pembelian', AWAITING_DELIVERY: 'Menunggu barang',
    INSTALLATION: 'Pemasangan', AWAITING_USER_CONFIRMATION: 'Konfirmasi pemohon',
};
const ACTIVE_PHASES = Object.keys(PHASE_LABEL);

/** "Ringkasan": where the hardware requests of this site stand. */
export function SummaryTab() {
    const { data, isLoading, isError } = useCenterSummary();
    const phases = (data?.byPhase ?? []).filter((p) => ACTIVE_PHASES.includes(p.phase));
    const max = Math.max(1, ...phases.map((p) => p.count));
    const cards: Array<[string, number | undefined]> = [
        ['Request hardware aktif', data?.activeHardware], ['Dalam pembelian', data?.inProcurement], ['Menunggu pemasangan', data?.waitingInstall], ['Selesai bulan ini', data?.doneThisMonth],
    ];
    return (
        <div>
            {isLoading && <p aria-busy="true">Memuat…</p>}
            {isError && <p role="alert" className="req-dialog__error">Gagal memuat ringkasan.</p>}
            <div className="da-kpis">
                {cards.map(([label, value]) => (
                    <div key={label} className="da-kpi" aria-label={label}><span className="da-kpi__v">{value ?? 0}</span><span>{label}</span></div>
                ))}
            </div>
            <section className="req-card" aria-label="Posisi request saat ini">
                <h3>Posisi request saat ini</h3>
                {phases.length === 0 && <p className="req-basket__empty">Belum ada request yang berjalan.</p>}
                {phases.map((p) => (
                    <div key={p.phase} className="da-bar"><span>{PHASE_LABEL[p.phase]}</span><i style={{ width: `${(p.count / max) * 100}%` }} /><b>{p.count}</b></div>
                ))}
            </section>
        </div>
    );
}
