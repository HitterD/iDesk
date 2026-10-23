import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Ticket, Plus, BookOpen, User, Bell, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/useAuth';
import { CREATE_TICKET_LABEL, CREATE_TICKET_SHORT_LABEL, getCreateTicketPath } from './createTicketAction';

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
  const isAgentOracle = user?.role === 'AGENT_ORACLE';
  const createPath = getCreateTicketPath(user?.role);

  // Hide bottom nav on ticket detail pages to allow full-screen dedicated chat without obstruction
  const isTicketDetail = location.pathname.match(/^\/(tickets|client\/tickets)\/[^/]+$/) !== null &&
    !location.pathname.endsWith('/list') &&
    !location.pathname.endsWith('/create') &&
    !location.pathname.endsWith('/oracle-k2') &&
    !location.pathname.endsWith('/web-developer') &&
    !location.pathname.endsWith('/mobile-developer');

  if (isTicketDetail) {
    return null;
  }

  const navItems: NavItem[] = isClient ? [
    { icon: Home, label: 'Home', path: '/client/my-tickets' },
    { icon: BookOpen, label: 'KB', path: '/kb' },
    { icon: Plus, label: CREATE_TICKET_SHORT_LABEL, path: createPath, highlight: true },
    { icon: Bell, label: 'Alerts', path: '/client/notifications' },
    { icon: User, label: 'Profile', path: '/client/profile' },
  ] : isAgentOracle ? [
    { icon: Database, label: 'Oracle K2', path: '/tickets/oracle-k2' },
    { icon: Plus, label: CREATE_TICKET_SHORT_LABEL, path: createPath, highlight: true },
    { icon: Bell, label: 'Alerts', path: '/notifications' },
    { icon: User, label: 'Profile', path: '/settings' },
  ] : [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: Ticket, label: 'Tickets', path: '/tickets/list' },
    { icon: Plus, label: CREATE_TICKET_SHORT_LABEL, path: createPath, highlight: true },
    { icon: BookOpen, label: 'KB', path: '/kb' },
    { icon: User, label: 'Profile', path: '/settings' },
  ];

  return (
    <nav aria-label="Navigasi bawah" className="idesk-bottom-nav !fixed !bottom-0 !left-0 !right-0 print:!hidden px-2 py-1.5 lg:hidden z-50 safe-area-pb shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.18)] rounded-t-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          if (item.highlight) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative -top-3.5 flex flex-col items-center gap-0.5 text-[11px] font-bold text-foreground active:scale-95 transition-transform duration-150 ease-out"
                aria-label={CREATE_TICKET_LABEL}
              >
                <span className="idesk-cta idesk-fab">
                  <item.icon aria-hidden="true" />
                </span>
                <span>{item.label}</span>
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
                  : "text-muted-foreground hover:text-foreground active:bg-muted"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn("w-5 h-5", isActive && "scale-110")} aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
