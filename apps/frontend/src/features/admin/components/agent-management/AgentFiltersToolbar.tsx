import { Search, X, Trash2, ChevronDown, LayoutGrid, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
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
    viewMode,
    onViewModeChange,
}: AgentFiltersToolbarProps) {
    const siteLabel = sites.find((s) => s.code === selectedSite)?.code ?? selectedSite;
    const siteText = selectedSite === 'ALL' ? 'Semua' : siteLabel;
    const roleText = selectedRole === 'ALL' ? 'Semua' : getRoleLabel(selectedRole);
    const roleCount = (role: RoleFilter) => role === 'ALL'
        ? (paginationMeta?.total ?? 0)
        : (paginationMeta?.roleCounts?.[role as keyof typeof paginationMeta.roleCounts] ?? 0);
    return (
        <div className="res-filters">
            <label className="queue-field" htmlFor="agent-search">
                <Search aria-hidden="true" />
                <input id="agent-search" type="search" placeholder="Cari user berdasarkan nama atau email..." value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)} aria-label="Cari user" />
                {searchQuery && searchQuery !== deferredSearchQuery && (
                    <span role="status" aria-label="Searching" className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
                )}
                {searchQuery && (
                    <button type="button" className="queue-field-clear" onClick={() => onSearchChange('')} aria-label="Clear search" title="Clear search"><X aria-hidden="true" /></button>
                )}
            </label>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="queue-pop" aria-label={`Filter site: ${siteText}`} disabled={isAgentRole}>
                        <span className="queue-pop-k">Site</span><span className="queue-pop-v">{siteText}</span><ChevronDown aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" variant="compact" className="res-pop-menu" aria-label="Filter site">
                    <DropdownMenuRadioGroup value={selectedSite} onValueChange={onSiteChange}>
                        {sites.map((site) => (
                            <DropdownMenuRadioItem key={site.code} value={site.code}>
                                <span title={site.name}>{site.code === 'ALL' ? 'Semua' : site.code}</span>
                                <span className="ml-auto pl-3 res-muted tabular-nums">{siteCounts[site.code] || 0}</span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="queue-pop" aria-label={`Filter role: ${roleText}`}>
                        <span className="queue-pop-k">Role</span><span className="queue-pop-v">{roleText}</span><ChevronDown aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="res-pop-menu" aria-label="Filter role">
                    <DropdownMenuRadioGroup value={selectedRole} onValueChange={(v) => onRoleChange(v as RoleFilter)}>
                        {ROLE_FILTERS.map((role) => {
                            const count = roleCount(role);
                            const RoleIcon = getRoleConfig(role).icon;
                            return (
                                <DropdownMenuRadioItem key={role} value={role} disabled={count === 0 && role !== 'ALL'}>
                                    {role !== 'ALL' && <RoleIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                                    {role === 'ALL' ? 'All Roles' : getRoleLabel(role)}
                                    <span className="ml-auto pl-3 res-muted tabular-nums">{count}</span>
                                </DropdownMenuRadioItem>
                            );
                        })}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <SegmentedControl aria-label="Mode tampilan" className="dash-seg" value={viewMode} onValueChange={onViewModeChange} options={[
                { value: 'table', label: <span className="mg-hide-sm">Tabel</span>, icon: Rows3, ariaLabel: 'Table View' },
                { value: 'grid', label: <span className="mg-hide-sm">Grid</span>, icon: LayoutGrid, ariaLabel: 'Grid View' },
            ]} />
            {selectedCount > 0 && (
                <>
                    <span className="res-spacer" />
                    <span role="status" className="res-muted whitespace-nowrap">{selectedCount} selected</span>
                    <Button variant="danger" onClick={onBulkDelete} aria-label={`Delete ${selectedCount} selected user${selectedCount === 1 ? '' : 's'}`}>
                        <Trash2 aria-hidden="true" />Delete
                    </Button>
                </>
            )}
        </div>
    );
}
