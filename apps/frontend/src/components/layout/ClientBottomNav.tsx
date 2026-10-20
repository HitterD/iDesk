import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CREATE_TICKET_LABEL, CREATE_TICKET_SHORT_LABEL } from './createTicketAction';
import type { ClientNavItem } from './ClientTopbar';

interface ClientBottomNavProps {
    /** Already filtered by the preset in ClientLayout. */
    navItems: ClientNavItem[];
    isActive: (item: ClientNavItem) => boolean;
    createPath: string;
    profilePath: string;
}

/** Sections shown beside the raised create action; the rest stay reachable from the account menu. */
const MAX_SECTION_TABS = 3;
/** Sections placed before the create action so it sits in the middle of the bar. */
const TABS_BEFORE_CREATE = 2;

/** Requester mobile navigation: authorised sections plus a raised, labelled amber create action. */
export const ClientBottomNav: React.FC<ClientBottomNavProps> = ({ navItems, isActive, createPath, profilePath }) => {
    const profile = navItems.find((item) => item.path === profilePath);
    const sections = navItems.filter((item) => item.path !== profilePath).slice(0, MAX_SECTION_TABS);
    const before = sections.slice(0, TABS_BEFORE_CREATE);
    const after = [...sections.slice(TABS_BEFORE_CREATE), ...(profile ? [profile] : [])];

    const renderTab = (item: ClientNavItem) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
            <Link
                key={item.path}
                to={item.path}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl transition-colors duration-150 touch-target',
                    active ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground active:bg-muted',
                )}
            >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate text-[11px] font-medium">{item.shortLabel ?? item.label}</span>
            </Link>
        );
    };

    return (
        <nav
            aria-label="Navigasi bawah"
            className="idesk-bottom-nav fixed bottom-0 inset-x-0 z-50 lg:hidden print:hidden px-2 py-1.5 safe-area-pb rounded-t-2xl shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.18)]"
        >
            <div className="flex items-center justify-between gap-1 max-w-md mx-auto">
                {before.map(renderTab)}
                <Link
                    to={createPath}
                    aria-label={CREATE_TICKET_LABEL}
                    className="relative -top-3.5 flex flex-1 flex-col items-center gap-0.5 text-[11px] font-bold text-foreground active:scale-95 transition-transform duration-150 ease-out"
                >
                    <span className="idesk-cta idesk-fab">
                        <Plus aria-hidden="true" />
                    </span>
                    <span className="whitespace-nowrap">{CREATE_TICKET_SHORT_LABEL}</span>
                </Link>
                {after.map(renderTab)}
            </div>
        </nav>
    );
};

export default ClientBottomNav;
