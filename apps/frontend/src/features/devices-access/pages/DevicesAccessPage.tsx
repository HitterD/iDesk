import { Link, useParams } from 'react-router-dom';
import { AccessExpiryTab } from '../tabs/AccessExpiryTab';
import { CatalogTab } from '../tabs/CatalogTab';
import { ScheduleTab } from '../tabs/ScheduleTab';
import { SummaryTab } from '../tabs/SummaryTab';

const TABS = [
    { slug: 'jadwal', label: 'Jadwal Pemasangan' },
    { slug: 'akses', label: 'Masa Berlaku Akses' },
    { slug: 'katalog', label: 'Katalog Hardware' },
    { slug: 'ringkasan', label: 'Ringkasan' },
] as const;
type Slug = (typeof TABS)[number]['slug'];

const wibToday = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** IT's page beside the ticket list: the install schedule, how long each access lasts, the catalog and a summary. */
export function DevicesAccessPage({ today = wibToday() }: { today?: string }) {
    const { tab } = useParams<{ tab?: string }>();
    const current: Slug = TABS.some((t) => t.slug === tab) ? (tab as Slug) : 'jadwal';
    return (
        <div className="ct-page">
            <header className="ct-catalog-head"><div className="min-w-0"><h1>Perangkat & Akses</h1><p>Jadwal pemasangan, masa berlaku akses, katalog hardware dan ringkasan</p></div></header>
            <div role="tablist" aria-label="Perangkat & Akses" className="da-tabs">
                {TABS.map((t) => (
                    <Link key={t.slug} to={`/devices-access/${t.slug}`} role="tab" aria-selected={current === t.slug} className={current === t.slug ? 'is-on' : ''}>{t.label}</Link>
                ))}
            </div>
            <div role="tabpanel">
                {current === 'jadwal' && <ScheduleTab today={today} />}
                {current === 'akses' && <AccessExpiryTab />}
                {current === 'katalog' && <CatalogTab />}
                {current === 'ringkasan' && <SummaryTab />}
            </div>
        </div>
    );
}
