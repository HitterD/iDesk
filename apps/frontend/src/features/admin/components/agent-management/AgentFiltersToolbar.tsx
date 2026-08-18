import { Search, X, Trash2, MapPin, Shield } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import type { PaginationMeta } from '@/types/admin.types';
import { ROLE_ORDER, getRoleConfig, getRoleLabel, type UserRoleKey } from './agent-types';

type RoleFilter = 'ALL' | UserRoleKey;

/** "All Roles" first, then every assignable role, most-privileged first. */
const ROLE_FILTERS: RoleFilter[] = ['ALL', ...[...ROLE_ORDER].reverse()];

interface AgentFiltersToolbarProps {
    searchQuery: string;
    deferredSearchQuery: string;
    onSearchChange: (value: string) => void;
    selectedCount: number;
    onBulkDelete: () => void;
    sites: { code: string; name: string; id: string }[];
    selectedSite: string;
    isAgentRole: boolean;
    onSiteChange: (site: string) => void;
    siteCounts: Record<string, number>;
    selectedRole: RoleFilter;
    onRoleChange: (role: RoleFilter) => void;
    paginationMeta: PaginationMeta | undefined;
}

export function AgentFiltersToolbar({
    searchQuery,
    deferredSearchQuery,
    onSearchChange,
    selectedCount,
    onBulkDelete,
    sites,
    selectedSite,
    isAgentRole,
    onSiteChange,
    siteCounts,
    selectedRole,
    onRoleChange,
    paginationMeta,
}: AgentFiltersToolbarProps) {
    return (
        <div className="flex flex-col gap-4 p-4 bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))]">
            {/* Search Bar & Bulk Actions row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-2xl">
                    <label htmlFor="agent-search" className="sr-only">Search users by name or email</label>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                    <input
                        id="agent-search"
                        type="search"
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-14 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/50 transition-colors duration-150"
                    />
                    {/* Clear button + debounce indicator */}
                    {searchQuery && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {searchQuery !== deferredSearchQuery && (
                                <div role="status" aria-label="Searching" className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                            )}
                            <button
                                type="button"
                                onClick={() => onSearchChange('')}
                                className="p-1 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>

                {selectedCount > 0 && (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-200 pr-2 border-l pl-4 border-slate-200 dark:border-slate-700">
                        <span role="status" className="text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {selectedCount} selected
                        </span>
                        <button
                            type="button"
                            onClick={onBulkDelete}
                            aria-label={`Delete ${selectedCount} selected user${selectedCount === 1 ? '' : 's'}`}
                            className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors duration-150 text-sm border border-red-200 dark:border-red-500/20 whitespace-nowrap"
                        >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Filters row: Sites & Roles */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 pt-4 border-t border-[hsl(var(--border))]">
                {/* Site Tabs */}
                <Tabs.Root
                    value={selectedSite}
                    onValueChange={isAgentRole ? undefined : onSiteChange}
                >
                    <Tabs.List aria-label="Filter by site" className="flex flex-wrap gap-1 p-1 bg-slate-50 dark:bg-slate-800/50 border border-[hsl(var(--border))] rounded-lg w-fit">
                        {sites.map((site) => {
                            const isLocked = isAgentRole && site.code !== selectedSite;
                            return (
                                <Tabs.Trigger
                                    key={site.code}
                                    value={site.code}
                                    disabled={isLocked}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
                                        "data-[state=active]:bg-[hsl(var(--card))] data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:border-[hsl(var(--border))]",
                                        "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white",
                                        isLocked && "opacity-30 cursor-not-allowed pointer-events-none"
                                    )}
                                >
                                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span title={site.name}>{site.code}</span>
                                    <span className="px-1.5 py-0.5 text-xs rounded-sm bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold">
                                        {siteCounts[site.code] || 0}
                                    </span>
                                </Tabs.Trigger>
                            );
                        })}
                    </Tabs.List>
                </Tabs.Root>

                <div className="hidden lg:block w-px h-6 bg-[hsl(var(--border))]" />

                {/* Role Filter Pills */}
                <div className="flex items-center gap-3">
                    <span id="role-filter-label" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                        <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                        Role
                    </span>
                    <div role="group" aria-labelledby="role-filter-label" className="flex flex-wrap items-center gap-1.5">
                        {ROLE_FILTERS.map(role => {
                            const count = role === 'ALL'
                                ? (paginationMeta?.total ?? 0)
                                : (paginationMeta?.roleCounts?.[role as keyof typeof paginationMeta.roleCounts] ?? 0);
                            const RoleIcon = getRoleConfig(role).icon;

                            return (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => onRoleChange(role)}
                                    disabled={count === 0 && role !== 'ALL'}
                                    aria-pressed={selectedRole === role}
                                    className={cn(
                                        "flex items-center gap-1 px-2.5 py-1.5 min-h-[44px] rounded-lg text-xs font-medium transition-colors duration-150 border",
                                        selectedRole === role
                                            ? "bg-primary text-primary-foreground border-transparent shadow-sm"
                                            : count === 0 && role !== 'ALL'
                                                ? "bg-slate-50 dark:bg-slate-800/30 text-slate-400 dark:text-slate-600 border-[hsl(var(--border))] cursor-not-allowed"
                                                : "bg-[hsl(var(--card))] text-slate-600 dark:text-slate-400 border-[hsl(var(--border))] hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                >
                                    {role !== 'ALL' && <RoleIcon className="w-3 h-3" aria-hidden="true" />}
                                    {role === 'ALL' ? 'All Roles' : getRoleLabel(role)}
                                    <span className={cn(
                                        "ml-1 px-1.5 py-0.5 text-xs rounded-sm font-bold",
                                        selectedRole === role
                                            ? "bg-white/20 dark:bg-black/10"
                                            : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
