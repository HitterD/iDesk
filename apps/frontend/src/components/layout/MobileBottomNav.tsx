import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Ticket, Plus, BookOpen, User, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  highlight?: boolean;
}

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isClient = user?.role === 'USER';

  const navItems: NavItem[] = isClient ? [
    { icon: Home, label: 'Home', path: '/client/my-tickets' },
    { icon: BookOpen, label: 'KB', path: '/kb' },
    { icon: Plus, label: 'Create', path: '/tickets/create', highlight: true },
    { icon: Bell, label: 'Alerts', path: '/client/notifications' },
    { icon: User, label: 'Profile', path: '/client/profile' },
  ] : [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Ticket, label: 'Tickets', path: '/tickets/list' },
    { icon: Plus, label: 'Create', path: '/tickets/create', highlight: true },
    { icon: BookOpen, label: 'KB', path: '/kb' },
    { icon: User, label: 'Profile', path: '/settings' },
  ];

  return (
    <nav className="!fixed !bottom-0 !left-0 !right-0 glass-card-elevated px-2 py-2 lg:hidden z-50 safe-area-pb shadow-[0_-15px_40px_rgba(0,0,0,0.1)] rounded-t-2xl border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          if (item.highlight) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative -top-5 flex items-center justify-center w-14 h-14 bg-primary rounded-full shadow-lg shadow-primary/30 text-white hover:bg-primary/90 active:scale-95 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out"
                aria-label={item.label}
              >
                <item.icon className="w-6 h-6" />
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors duration-150 touch-target",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white active:bg-slate-100 dark:active:bg-slate-800"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn("w-5 h-5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
