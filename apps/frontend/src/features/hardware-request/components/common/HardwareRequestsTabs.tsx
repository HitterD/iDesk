import { NavLink } from 'react-router-dom';
import { List as ListIcon, BarChart2, CalendarDays, BookOpen } from 'lucide-react';
import { useHardwareRequestsCount } from '../../hooks/useHardwareRequestsCount';
import { usePermissions, useHardwareRole } from '../../hooks/usePermissions';
import { cn } from '@/lib/utils';
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
  const { openCount } = useHardwareRequestsCount();
  const { role } = useHardwareRole();
  const { isIctLead } = usePermissions();

  const visibleTabs = TABS.filter((t) => {
    if (t.roles && !t.roles.includes(role)) return false;
    if (t.ictLeadOnly && !isIctLead) return false;
    return true;
  });

  return (
    <nav
      aria-label="Hardware requests navigation"
      className="flex w-fit max-w-full overflow-x-auto gap-1 rounded-2xl border border-border bg-card p-1 shadow-xs"
    >
      {visibleTabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 focus-visible:outline-none shrink-0 cursor-pointer shadow-xs active:scale-[0.98]',
              isActive
                ? 'bg-primary text-primary-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )
          }
        >
          {({ isActive }) => (
            <>
              <tab.icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
              {tab.showBadge && openCount > 0 && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-2 py-0.5 text-xs font-bold transition-colors',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {openCount}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
