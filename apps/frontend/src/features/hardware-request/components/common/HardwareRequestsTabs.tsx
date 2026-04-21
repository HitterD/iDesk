import { NavLink } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { useHardwareRequestsCount } from '../../hooks/useHardwareRequestsCount';
import { useHardwareRole } from '../../hooks/usePermissions';
import type { HardwareRole } from '../../types';

interface TabDef {
  to: string;
  label: string;
  end: boolean;
  showBadge?: boolean;
  roles?: HardwareRole[];
}

const TABS: TabDef[] = [
  { to: '.', label: 'Daftar Request', end: false, showBadge: true },
  { to: 'dashboard', label: 'Overview', end: true, roles: ['ICT_STAFF'] },
  { to: 'calendar', label: 'Jadwal Instalasi', end: true },
];

export function HardwareRequestsTabs() {
  const reduce = useReducedMotion();
  const { openCount } = useHardwareRequestsCount();
  const { role } = useHardwareRole();
  const visibleTabs = TABS.filter(t => !t.roles || t.roles.includes(role));

  return (
    <nav
      aria-label="Hardware Requests tabs"
      className="sticky top-0 z-10 -mx-4 px-4 py-2 backdrop-blur bg-white/70 dark:bg-[hsl(var(--card))]/80 border-b border-slate-200 dark:border-slate-700"
    >
      <ul className="flex items-center gap-1">
        {visibleTabs.map((tab) => (
          <li key={tab.to}>
            <TabLink tab={tab} reduce={reduce ?? false} openCount={openCount} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ tab, reduce, openCount }: { tab: TabDef; reduce: boolean; openCount: number }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) => [
        'relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
        isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
      ].join(' ')}
    >
      {({ isActive }) => (
        <>
          <span>{tab.label}</span>
          {tab.showBadge && openCount > 0 && (
            <span className="rounded-full bg-slate-900 dark:bg-white px-2 py-0.5 text-xs font-semibold text-white dark:text-slate-900">
              {openCount}
            </span>
          )}
          {isActive && (
            <m.span
              layoutId="hr-tab-underline"
              className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-slate-900 dark:bg-white"
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}
