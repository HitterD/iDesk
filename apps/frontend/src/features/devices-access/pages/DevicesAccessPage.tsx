import { Link, useParams } from 'react-router-dom';
import { BarChart3, CalendarDays, KeyRound, Package } from 'lucide-react';
import { QueueHeader } from '@/features/ticket-board/components/QueueHeader';
import { AccessExpiryTab } from '../tabs/AccessExpiryTab';
import { CatalogTab } from '../tabs/CatalogTab';
import { ScheduleTab } from '../tabs/ScheduleTab';
import { SummaryTab } from '../tabs/SummaryTab';

const TABS = [
    { slug: 'jadwal', label: 'Jadwal Pemasangan', icon: CalendarDays },
    { slug: 'akses', label: 'Masa Berlaku Akses', icon: KeyRound },
    { slug: 'katalog', label: 'Katalog Hardware', icon: Package },
    { slug: 'ringkasan', label: 'Ringkasan', icon: BarChart3 },
] as const;
type Slug = (typeof TABS)[number]['slug'];

const wibToday = (): string => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** IT's page beside the ticket list: the install schedule, how long each access lasts, the catalog and a summary. */
export function DevicesAccessPage({ today = wibToday() }: { today?: string }) {
    const { tab } = useParams<{ tab?: string }>();
    const current: Slug = TABS.some((t) => t.slug === tab) ? (tab as Slug) : 'jadwal';
    return (
        <div className="queue-page da-page space-y-4 pb-10 min-w-0">
            <QueueHeader title="Perangkat & Akses" description="Jadwal pemasangan, masa berlaku akses, katalog, ringkasan" icon={Package} tone="red" />
            <div role="tablist" aria-label="Perangkat & Akses" className="da-tabs">
                {TABS.map((t) => (
                    <Link key={t.slug} to={`/devices-access/${t.slug}`} role="tab" aria-selected={current === t.slug} className={current === t.slug ? 'is-on' : ''}><t.icon aria-hidden="true" />{t.label}</Link>
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
