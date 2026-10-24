import React, { useLayoutEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Logo } from '@/components/ui/Logo';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

/*
 * Presentation-only sidebar renderer for the sapphire agent shell.
 * BentoSidebar owns permissions, module mapping, badges, collapse persistence
 * and logout; this module only renders the authorised entries it receives.
 */

/** Tile hues; the palette is defined in index.css (`.nav-tile[data-tone]`). No purple by design. */
export type NavTone =
    | 'gray' | 'navy' | 'blue' | 'red' | 'teal' | 'teal-deep'
    | 'orange' | 'mint' | 'brown' | 'green' | 'slate';

export interface NavItem {
    key: string;
    icon: LucideIcon;
    label: string;
    path: string;
    tone: NavTone;
    /** Match the path exactly, so `/dashboard` is not active on `/dashboard/me`. */
    end?: boolean;
}

export interface NavGroup {
    id: string;
    label: string;
    icon: LucideIcon;
    tone: NavTone;
    /** Secondary groups (Resources, Management, ...) render quieter. */
    quiet?: boolean;
    items: NavItem[];
}

export type NavEntry = NavItem | NavGroup;

export const isGroup = (entry: NavEntry): entry is NavGroup => 'items' in entry;

export interface BadgeInfo {
    count: number;
    variant?: 'destructive' | 'primary';
}

const MAX_BADGE = 99;
const FLYOUT_CLOSE_DELAY_MS = 150;
const TOOLTIP_DELAY_MS = 100;
const TOOLTIP_OFFSET = 14;
const SKELETON_ROWS = [1, 2, 3, 4, 5];
/** sessionStorage key holding the previous active tab's offset (mockup motion.js). */
const TAB_FROM_KEY = 'idesk-sidebar-tab-from';
const DESKTOP_QUERY = '(min-width: 1024px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** Safety net if transitionend never fires (tab hidden, element removed). */
const TAB_SLIDE_FALLBACK_MS = 600;

const matches = (query: string) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
const offsetIn = (nav: HTMLElement, el: Element) => el.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;

/**
 * Desktop only: the sheet-coloured active tab slides from the previously active item to the new one.
 * The click records where the old tab was; the next render with a new active item animates a ghost there.
 */
function useActiveTabSlide(navRef: React.RefObject<HTMLElement | null>, activePath: string, disabled: boolean) {
    useLayoutEffect(() => {
        const nav = navRef.current;
        if (!nav || disabled) return undefined;
        const remember = (event: MouseEvent) => {
            const target = (event.target as Element | null)?.closest('a.nav-item');
            const current = nav.querySelector('.nav-item.is-active');
            if (!target || !current || target === current) return;
            try { sessionStorage.setItem(TAB_FROM_KEY, String(offsetIn(nav, current))); } catch { /* storage unavailable: no slide */ }
        };
        nav.addEventListener('click', remember);
        return () => nav.removeEventListener('click', remember);
    }, [navRef, disabled]);

    useLayoutEffect(() => {
        const nav = navRef.current;
        let from: string | null = null;
        try { from = sessionStorage.getItem(TAB_FROM_KEY); sessionStorage.removeItem(TAB_FROM_KEY); } catch { from = null; }
        const active = nav?.querySelector<HTMLElement>('.nav-item.is-active');
        if (!nav || !active || from === null || disabled || matches(REDUCED_MOTION_QUERY) || !matches(DESKTOP_QUERY)) return undefined;
        const to = offsetIn(nav, active);
        if (Math.abs(to - Number(from)) < 1) return undefined;
        const ghost = document.createElement('span');
        ghost.className = 'nav-tab-ghost';
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.height = `${active.offsetHeight}px`;
        ghost.style.transform = `translateY(${from}px)`;
        nav.prepend(ghost);
        active.classList.add('is-arriving');
        let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { ghost.style.transform = `translateY(${to}px)`; }); });
        const done = () => { ghost.remove(); active.classList.remove('is-arriving'); };
        ghost.addEventListener('transitionend', done, { once: true });
        const timer = window.setTimeout(done, TAB_SLIDE_FALLBACK_MS);
        return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); done(); };
    }, [navRef, activePath, disabled]);
}

type TileSize = 'primary' | 'default' | 'quiet' | 'collapsed' | 'flyout';

const NavTile: React.FC<{ icon: LucideIcon; tone: NavTone; size?: TileSize }> = ({ icon: Icon, tone, size = 'default' }) => (
    <span className="nav-tile" data-tone={tone} data-size={size} aria-hidden="true">
        <Icon />
    </span>
);

const NavBadge: React.FC<{ badge: BadgeInfo | null; placement?: 'inline' | 'corner' | 'flyout'; cap?: boolean }> = ({
    badge,
    placement = 'inline',
    cap = false,
}) => {
    if (!badge || badge.count <= 0) return null;
    const text = cap && badge.count > MAX_BADGE ? `${MAX_BADGE}+` : badge.count;
    return (
        <span key={text} className="nav-badge mi-badge" data-variant={badge.variant ?? 'primary'} data-placement={placement}>
            {text}
        </span>
    );
};

const itemClass = (isActive: boolean, extra?: string) => cn('nav-item', isActive && 'is-active', extra);

export const ShellBrand: React.FC<{ collapsed?: boolean; className?: string }> = ({ collapsed = false, className }) => (
    <span className={cn('nav-brand', className)}>
        <span className="nav-brand-plate">
            <Logo size="sm" variant="icon" className="h-8 w-8" />
        </span>
        {!collapsed && (
            <span className="nav-brand-text">
                <b>iDesk</b>
                <small>IT Helpdesk</small>
            </span>
        )}
    </span>
);

interface GroupProps {
    group: NavGroup;
    hasActiveChild: boolean;
    groupBadge: BadgeInfo | null;
    getItemBadge: (key: string) => BadgeInfo | null;
    onNavigate?: () => void;
}

const CollapsedGroup: React.FC<GroupProps> = ({ group, hasActiveChild, groupBadge, getItemBadge, onNavigate }) => {
    const [open, setOpen] = useState(false);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
        setOpen(true);
    };
    const handleMouseLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setOpen(false), FLYOUT_CLOSE_DELAY_MS);
    };

    return (
        <div className="relative flex justify-center py-0.5" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        onClick={() => setOpen(prev => !prev)}
                        aria-label={group.label}
                        aria-expanded={open}
                        className={itemClass(hasActiveChild, 'nav-item-icon')}
                    >
                        <NavTile icon={group.icon} tone={group.tone} size="collapsed" />
                        <NavBadge badge={groupBadge} placement="corner" cap />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={TOOLTIP_OFFSET}
                    className="bg-popover text-popover-foreground rounded-2xl shadow-2xl border border-border p-2 min-w-[220px] z-50 animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="px-3 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border mb-1">
                        <span>{group.label}</span>
                        <NavBadge badge={groupBadge} placement="flyout" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {group.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                onClick={() => { setOpen(false); onNavigate?.(); }}
                                className={({ isActive }) => cn('nav-flyout-item', isActive && 'is-active')}
                            >
                                <NavTile icon={item.icon} tone={item.tone} size="flyout" />
                                <span className="truncate flex-1 font-medium">{item.label}</span>
                                <NavBadge badge={getItemBadge(item.key)} placement="flyout" />
                            </NavLink>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

const ExpandedGroup: React.FC<GroupProps & { isExpanded: boolean; onToggle: () => void }> = ({
    group, hasActiveChild, groupBadge, getItemBadge, onNavigate, isExpanded, onToggle,
}) => (
    <div className={cn('nav-group', group.quiet && 'is-quiet')}>
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            className={cn('nav-group-label', hasActiveChild && 'has-active')}
        >
            <span className="flex-1 text-left">{group.label}</span>
            {!isExpanded && <NavBadge badge={groupBadge} cap />}
            <ChevronDown
                className={cn('w-4 h-4 shrink-0 transition-transform duration-200', isExpanded ? 'rotate-0' : '-rotate-90')}
                aria-hidden="true"
            />
        </button>
        <AnimatePresence initial={false}>
            {isExpanded && (
                <motion.div
                    // Clip only while height animates; once open the active tab's joining curves must overflow.
                    initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    animate={{ height: 'auto', opacity: 1, overflow: 'hidden', transitionEnd: { overflow: 'visible' } }}
                    exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className="nav-group-items"
                    data-testid={`nav-group-items-${group.id}`}
                >
                    {group.items.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onClick={onNavigate}
                            className={({ isActive }) => itemClass(isActive)}
                        >
                            <NavTile icon={item.icon} tone={item.tone} size={group.quiet ? 'quiet' : 'default'} />
                            <span className="nav-label">{item.label}</span>
                            <NavBadge badge={getItemBadge(item.key)} />
                        </NavLink>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

interface StandaloneProps {
    entry: NavItem;
    isCollapsed: boolean;
    itemBadge: BadgeInfo | null;
    onNavigate?: () => void;
    size?: TileSize;
}

const StandaloneNavLink: React.FC<StandaloneProps> = ({ entry, isCollapsed, itemBadge, onNavigate, size = 'primary' }) => {
    if (!isCollapsed) {
        return (
            <NavLink
                to={entry.path}
                end={entry.end}
                aria-label={entry.label}
                onClick={onNavigate}
                className={({ isActive }) => itemClass(isActive, size === 'primary' ? 'is-primary' : undefined)}
            >
                <NavTile icon={entry.icon} tone={entry.tone} size={size} />
                <span className="nav-label">{entry.label}</span>
                <NavBadge badge={itemBadge} />
            </NavLink>
        );
    }

    return (
        <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="relative flex justify-center py-0.5">
                        <NavLink
                            to={entry.path}
                            end={entry.end}
                            aria-label={entry.label}
                            onClick={onNavigate}
                            className={({ isActive }) => itemClass(isActive, 'nav-item-icon')}
                        >
                            <NavTile icon={entry.icon} tone={entry.tone} size="collapsed" />
                            <NavBadge badge={itemBadge} placement="corner" cap />
                        </NavLink>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={TOOLTIP_OFFSET} className="bg-popover text-popover-foreground rounded-xl shadow-xl border border-border/80 px-3 py-1.5 text-xs font-semibold whitespace-nowrap flex items-center gap-2 z-50">
                    <span>{entry.label}</span>
                    <NavBadge badge={itemBadge} placement="flyout" />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export interface SidebarNavigationProps {
    /** Entries already filtered by BentoSidebar's permission/module logic. */
    entries: NavEntry[];
    isCollapsed: boolean;
    /** Show the skeleton while permissions resolve. */
    isLoading: boolean;
    /** Current pathname; used to mark groups containing the active route. */
    activePath: string;
    isGroupExpanded: (groupId: string) => boolean;
    onToggleGroup: (groupId: string) => void;
    getItemBadge: (key: string) => BadgeInfo | null;
    getGroupBadge: (group: NavGroup) => BadgeInfo | null;
    onNavigate?: () => void;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
    entries, isCollapsed, isLoading, activePath, isGroupExpanded, onToggleGroup, getItemBadge, getGroupBadge, onNavigate,
}) => {
    const navRef = useRef<HTMLElement>(null);
    useActiveTabSlide(navRef, activePath, isCollapsed || isLoading);
    return (
    <nav ref={navRef} aria-label="Main navigation" className="nav-scroll flex-1 flex flex-col gap-0.5 min-h-0">
        {isLoading ? (
            <div className="space-y-1" aria-hidden="true">
                {SKELETON_ROWS.map(i => (
                    <div
                        key={i}
                        className={cn('h-10 bg-white/10 rounded-xl animate-pulse', isCollapsed ? 'w-11 mx-auto' : 'mr-2.5')}
                        style={{ animationDelay: `${i * 60}ms` }}
                    />
                ))}
            </div>
        ) : entries.map((entry) => {
            if (!isGroup(entry)) {
                return (
                    <StandaloneNavLink
                        key={entry.path}
                        entry={entry}
                        isCollapsed={isCollapsed}
                        itemBadge={getItemBadge(entry.key)}
                        onNavigate={onNavigate}
                    />
                );
            }
            const groupProps: GroupProps = {
                group: entry,
                hasActiveChild: entry.items.some(item => activePath.startsWith(item.path)),
                groupBadge: getGroupBadge(entry),
                getItemBadge,
                onNavigate,
            };
            return isCollapsed
                ? <CollapsedGroup key={entry.id} {...groupProps} />
                : <ExpandedGroup key={entry.id} {...groupProps} isExpanded={isGroupExpanded(entry.id)} onToggle={() => onToggleGroup(entry.id)} />;
        })}
    </nav>
    );
};

export interface SidebarFooterProps {
    settingsItem: NavItem;
    settingsBadge: BadgeInfo | null;
    isCollapsed: boolean;
    user: { fullName?: string; role?: string } | null | undefined;
    onLogout: () => void;
    onNavigate?: () => void;
}

const formatRole = (role?: string) => role?.toLowerCase().replace(/_/g, ' ') ?? '';

const LogoutButton: React.FC<{ onLogout: () => void; compact: boolean }> = ({ onLogout, compact }) => (
    <button
        type="button"
        onClick={onLogout}
        title="Logout"
        aria-label="Logout"
        className={cn('nav-logout', compact && 'is-compact')}
    >
        <LogOut className="w-4 h-4" aria-hidden="true" />
    </button>
);

/** Settings plus the agent profile and logout, anchored bottom-left. */
export const SidebarFooter: React.FC<SidebarFooterProps> = ({ settingsItem, settingsBadge, isCollapsed, user, onLogout, onNavigate }) => {
    const profileLabel = `Profil ${user?.fullName ?? ''}`.trim();
    return (
        <div className="nav-foot pt-2 pb-6 lg:pb-1 mt-auto flex flex-col gap-1 shrink-0 safe-area-pb">
            <StandaloneNavLink entry={settingsItem} isCollapsed={isCollapsed} itemBadge={settingsBadge} onNavigate={onNavigate} size="default" />
            {isCollapsed ? (
                <div className="flex flex-col items-center gap-2 pt-2">
                    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <NavLink to="/settings" onClick={onNavigate} className="nav-profile-avatar" aria-label={profileLabel}>
                                    <UserAvatar useCurrentUser size="md" />
                                </NavLink>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={TOOLTIP_OFFSET} className="bg-popover text-popover-foreground rounded-xl shadow-xl border border-border/80 px-3 py-2 text-xs max-w-[16rem] z-50">
                                <p className="font-semibold break-words">{user?.fullName}</p>
                                <p className="text-[10px] text-muted-foreground capitalize">{formatRole(user?.role)}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <LogoutButton onLogout={onLogout} compact />
                </div>
            ) : (
                <div className="nav-profile">
                    <NavLink to="/settings" onClick={onNavigate} className="nav-profile-link" title="Settings / Profile">
                        <UserAvatar useCurrentUser size="md" />
                        <span className="flex-1 min-w-0">
                            <span className="nav-profile-name">{user?.fullName}</span>
                            <span className="nav-profile-role">{formatRole(user?.role)}</span>
                        </span>
                    </NavLink>
                    <LogoutButton onLogout={onLogout} compact={false} />
                </div>
            )}
        </div>
    );
};
