import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { List as ListIcon, ChartColumn, CalendarDays, BookOpen } from 'lucide-react';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { useHardwareRequestsCount } from '../../hooks/useHardwareRequestsCount';
import { usePermissions, useHardwareRole } from '../../hooks/usePermissions';
import { useHardwareBasePath } from '../../hooks/useHardwareBasePath';
import type { HardwareRole } from '../../types';

export type HardwareTab = 'list' | 'dashboard' | 'calendar' | 'catalog';

interface TabDef {
  value: HardwareTab;
  /** Path segment after the base path ('' = index). */
  segment: string;
  label: string;
  icon: React.ElementType;
  showBadge?: boolean;
  roles?: HardwareRole[];
  ictLeadOnly?: boolean;
}

export const HARDWARE_TABS: readonly TabDef[] = [
  { value: 'list', segment: '', label: 'Daftar Request', icon: ListIcon, showBadge: true },
  { value: 'dashboard', segment: 'dashboard', label: 'Overview', icon: ChartColumn, roles: ['ICT_STAFF'] },
  { value: 'calendar', segment: 'calendar', label: 'Jadwal Instalasi', icon: CalendarDays },
  { value: 'catalog', segment: 'catalog', label: 'HR Catalog', icon: BookOpen, ictLeadOnly: true },
];

/** The thumb arrives (`--dur-2`) before the route switches; reduced motion zeroes the token. */
const THUMB_TOKEN = '--dur-2';
const thumbDelayMs = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(THUMB_TOKEN)) || 0;

/** Active tab from the path; deep routes (/:id, /new) select none. */
export function activeHardwareTab(pathname: string, basePath: string): HardwareTab | null {
  const rest = pathname.slice(basePath.length).replace(/^\/+|\/+$/g, '');
  const head = rest.split('/')[0] ?? '';
  const tab = HARDWARE_TABS.find((t) => t.segment === head);
  if (!tab) return null;
  return tab.segment === '' && rest !== '' ? null : tab.value;
}

/** Mockup `.seg.page-tabs` (hardware.html): segmented route links with a sliding thumb. */
export function HardwareRequestsTabs() {
  const { openCount } = useHardwareRequestsCount();
  const { role } = useHardwareRole();
  const { isIctLead } = usePermissions();
  const basePath = useHardwareBasePath();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const timer = useRef<number | undefined>(undefined);
  const [pending, setPending] = useState<HardwareTab | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => setPending(null), [pathname]);

  const visible = HARDWARE_TABS.filter((t) => {
    if (t.roles && !t.roles.includes(role)) return false;
    if (t.ictLeadOnly && !isIctLead) return false;
    return true;
  });
  const hrefOf = (t: TabDef) => (t.segment ? `${basePath}/${t.segment}` : basePath);
  const options: SegmentedOption<HardwareTab>[] = visible.map((t) => ({
    value: t.value,
    icon: t.icon,
    href: hrefOf(t),
    label: (
      <>
        {t.label}
        {t.showBadge && openCount > 0 && <span className="res-tab-count">{openCount}</span>}
      </>
    ),
  }));
  const current = activeHardwareTab(pathname, basePath);

  const go = (value: HardwareTab) => {
    const tab = visible.find((t) => t.value === value);
    if (!tab || value === (pending ?? current)) return;
    setPending(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => navigate(hrefOf(tab)), thumbDelayMs());
  };

  return (
    <nav aria-label="Navigasi hardware request">
      <SegmentedControl aria-label="Tab hardware request" className="dash-seg res-tabs" options={options} value={pending ?? current} onValueChange={go} />
    </nav>
  );
}
