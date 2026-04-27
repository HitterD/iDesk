import { NavLink } from 'react-router-dom';
import { m, useReducedMotion } from 'framer-motion';
import { List as ListIcon, BarChart2, CalendarDays, BookOpen } from 'lucide-react';
import { useHardwareRequestsCount } from '../../hooks/useHardwareRequestsCount';
import { usePermissions, useHardwareRole } from '../../hooks/usePermissions';
import type { HardwareRole } from '../../types';

interface TabDef {
  to: string;
  label: string;
  icon: React.ElementType;
  end: boolean;
  showBadge?: boolean;
  roles?: HardwareRole[];
  ictLeadOnly?: boolean;
}

const TABS: TabDef[] = [
  { to: '.', label: 'Daftar Request', icon: ListIcon, end: true, showBadge: true },
  { to: 'dashboard', label: 'Overview', icon: BarChart2, end: true, roles: ['ICT_STAFF'] },
  { to: 'calendar', label: 'Jadwal Instalasi', icon: CalendarDays, end: true },
  { to: 'catalog', label: 'HR Catalog', icon: BookOpen, end: false, ictLeadOnly: true },
];

export function HardwareRequestsTabs() {
  const reduce = useReducedMotion();
  const { openCount } = useHardwareRequestsCount();
  const { role } = useHardwareRole();
  const { isIctLead } = usePermissions();
  
  const visibleTabs = TABS.filter(t => {
    if (t.roles && !t.roles.includes(role)) return false;
    if (t.ictLeadOnly && !isIctLead) return false;
    return true;
  });

  return (
    <nav
      aria-label="Hardware requests navigation"
      className="sticky top-0 z-10 bg-[hsl(var(--background))]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/80 -mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center gap-0"
    >
      {visibleTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `relative flex items-center gap-1.5 px-3.5 py-3 text-[12px] font-bold transition-colors duration-150 focus-visible:outline-none ${
            isActive
              ? 'text-primary'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          {({ isActive }) => (
            <>
              <tab.icon className="size-3.5" />
              <span>{tab.label}</span>
              {tab.showBadge && openCount > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  {openCount}
                </span>
              )}
              {isActive && (
                <m.span
                  layoutId="hr-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
