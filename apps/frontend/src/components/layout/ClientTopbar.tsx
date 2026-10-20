import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Plus, UserRound } from 'lucide-react';
import { NotificationPopover } from '../notifications/NotificationPopover';
import { ActionCommandCenter } from '../notifications/ActionCommandCenter';
import { ThemeToggle } from '../ui/ThemeToggle';
import { UserAvatar } from '../ui/UserAvatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { ShellBrand } from './SidebarNavigation';
import { CREATE_TICKET_LABEL } from './createTicketAction';
import { cn } from '@/lib/utils';

/** Requester portal navigation entry. Items with pageKey are filtered by the preset's pageAccess. */
export interface ClientNavItem {
    path: string;
    label: string;
    /** Compact label for the mobile bottom navigation. */
    shortLabel?: string;
    icon: React.ElementType;
    pageKey?: string;
    exact?: boolean;
}

export interface ClientAccount {
    id?: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string | null;
}

interface ClientTopbarProps {
    /** Already filtered by the preset in ClientLayout. */
    navItems: ClientNavItem[];
    isActive: (item: ClientNavItem) => boolean;
    homePath: string;
    createPath: string;
    profilePath: string;
    user: ClientAccount | null | undefined;
    onLogout: () => void;
}

const ACCOUNT_ROLE_LABEL = 'Pemohon';
const FALLBACK_NAME = 'User';

/** Sapphire top band for the requester portal: brand, navigation segment, utilities, create CTA, account menu. */
export const ClientTopbar: React.FC<ClientTopbarProps> = ({
    navItems, isActive, homePath, createPath, profilePath, user, onLogout,
}) => {
    const name = user?.fullName || FALLBACK_NAME;
    const sectionItems = navItems.filter((item) => item.path !== profilePath);

    return (
        <header className="idesk-topbar portal-topbar h-14 flex items-center gap-3 px-3 sm:px-4 lg:px-5">
            <Link to={homePath} className="shrink-0 rounded-xl" aria-label="iDesk, Tiket Saya">
                <ShellBrand />
            </Link>

            <nav aria-label="Navigasi portal" className="portal-tabs hidden lg:flex mx-auto min-w-0">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            title={item.label}
                            aria-label={item.label}
                            aria-current={active ? 'page' : undefined}
                            className={cn('portal-tab', active && 'is-active')}
                        >
                            <Icon aria-hidden="true" />
                            {/* Inactive labels collapse to icons until there is room for all of them. */}
                            <span className={active ? undefined : 'hidden 2xl:inline'}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="idesk-topbar-actions ml-auto lg:ml-0 flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Below lg the bottom navigation carries the create action. */}
                <Link to={createPath} className="idesk-cta hidden lg:inline-flex mr-1.5">
                    <Plus aria-hidden="true" />
                    <span>{CREATE_TICKET_LABEL}</span>
                </Link>
                <ThemeToggle className="!bg-transparent hover:!bg-white/10 !text-white" />
                <ActionCommandCenter />
                <NotificationPopover />
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="portal-account" aria-label={`Akun ${name}`}>
                        <UserAvatar user={user} size="sm" />
                        <span className="portal-account-text hidden 2xl:grid">
                            <b title={name}>{name}</b>
                            <small>{ACCOUNT_ROLE_LABEL}</small>
                        </span>
                        <ChevronDown className="portal-account-caret hidden sm:block" aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" variant="wide">
                    <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
                        <span className="truncate text-sm font-semibold">{name}</span>
                        {user?.email && <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* No navigation segment below lg: keep every authorised section reachable here. */}
                    <div className="lg:hidden">
                        {sectionItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <DropdownMenuItem key={item.path} asChild>
                                    <Link to={item.path} aria-current={isActive(item) ? 'page' : undefined}>
                                        <Icon aria-hidden="true" />
                                        {item.label}
                                    </Link>
                                </DropdownMenuItem>
                            );
                        })}
                        <DropdownMenuSeparator />
                    </div>
                    <DropdownMenuItem asChild>
                        <Link to={profilePath}>
                            <UserRound aria-hidden="true" />
                            Profil
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                        <LogOut aria-hidden="true" />
                        Keluar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
};

export default ClientTopbar;
