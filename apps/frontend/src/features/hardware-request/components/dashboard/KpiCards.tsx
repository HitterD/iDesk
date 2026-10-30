import { resVars } from '@/components/resources/ResourceParts';

type KpiData = {
  totalActive: number;
  inProcurement: number;
  pendingInstall: number;
  completedThisMonth: number;
};

const CARDS: { key: keyof KpiData; label: string; sublabel: string; ink?: string }[] = [
  { key: 'totalActive', label: 'Total Request Aktif', sublabel: 'Dalam alur proses berjalan' },
  { key: 'inProcurement', label: 'Dalam Pengadaan', sublabel: 'Menunggu PO / Vendor / Tiba' },
  { key: 'pendingInstall', label: 'Menunggu Instalasi', sublabel: 'Siap & terjadwal ke teknisi' },
  { key: 'completedThisMonth', label: 'Selesai Bulan Ini', sublabel: 'Telah terpasang & dikonfirmasi', ink: 'var(--dash-ink-green)' },
];

/** Mockup `.kpis > .kpi`: label, big number, one context line. */
export function KpiCards({ data, loading }: { data?: KpiData; loading?: boolean }) {
  return (
    <section className="res-kpis" aria-label="KPI hardware">
      {CARDS.map((c) => (
        <div key={c.key} className="res-kpi" style={c.ink ? resVars({ '--ink': c.ink }) : undefined}>
          <span>{c.label}</span>
          {loading || !data ? <i className="dash-sk is-num" aria-hidden="true" /> : <span className="res-kpi-n">{data[c.key].toLocaleString('id-ID')}</span>}
          <p>{c.sublabel}</p>
        </div>
      ))}
    </section>
  );
}
