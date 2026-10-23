import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { TicketPill, type TicketPillTone } from '@/components/ui/ticket-pill';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

interface SiteSelectorProps {
    selectedSiteIds: string[];
    onSelectionChange: (siteIds: string[]) => void;
    mode?: 'single' | 'multi';
    className?: string;
    disabled?: boolean;
    /** Mockup filter pop ("Site Semua"): no icon, key + value. Empty selection reads "Semua". */
    variant?: 'default' | 'pop';
}

const SITE_TONES: Record<string, TicketPillTone> = {
    SPJ: 'blue', SMG: 'green', KRW: 'amber', JTB: 'teal',
};

export const SiteSelector = ({
    selectedSiteIds,
    onSelectionChange,
    mode = 'multi',
    className,
    disabled = false,
    variant = 'default',
}: SiteSelectorProps) => {
    const [open, setOpen] = useState(false);
    const {
        data: sites = [],
        isLoading: loading,
        isError,
        refetch,
    } = useQuery<Site[]>({
        queryKey: ['sites', 'active'],
        queryFn: async () => {
            try {
                const res = await api.get('/sites/active');
                return Array.isArray(res.data) ? res.data : [];
            } catch (err: any) {
                if (err.response?.status === 403 || err.response?.status === 404) {
                    const fallbackRes = await api.get('/sites');
                    return Array.isArray(fallbackRes.data) ? fallbackRes.data : [];
                }
                throw err;
            }
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const error = isError ? 'Gagal memuat sites' : null;

    const handleSiteToggle = (siteId: string) => {
        if (mode === 'single') {
            onSelectionChange([siteId]);
        } else {
            if (selectedSiteIds.includes(siteId)) {
                onSelectionChange(selectedSiteIds.filter(id => id !== siteId));
            } else {
                onSelectionChange([...selectedSiteIds, siteId]);
            }
        }
    };

    const handleSelectAll = () => {
        if (selectedSiteIds.length === sites.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(sites.map(s => s.id));
        }
    };

    const getSelectedLabel = () => {
        if (selectedSiteIds.length === 0) return 'Pilih Site';
        if (selectedSiteIds.length === sites.length) return 'Semua Site';

        const selectedCodes = sites
            .filter(s => selectedSiteIds.includes(s.id))
            .map(s => s.code);

        if (selectedCodes.length <= 2) {
            return selectedCodes.join(', ');
        }
        return `${selectedCodes.length} Sites`;
    };

    if (loading) {
        return (
            <Button variant="outline" disabled className={className}>
                <Building2 className="h-4 w-4 mr-2 animate-pulse" />
                Loading...
            </Button>
        );
    }

    if (error) {
        return (
            <Button variant="outline" onClick={() => refetch()} className={cn('text-red-500', className)}>
                <Building2 className="h-4 w-4 mr-2" />
                {error} ↻
            </Button>
        );
    }

    if (sites.length === 0) {
        return (
            <Button variant="outline" disabled className={className}>
                <Building2 className="h-4 w-4 mr-2" />
                No Sites
            </Button>
        );
    }

    return (
        <Popover open={open && !disabled} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" disabled={disabled} aria-label={`Filter Site: ${getSelectedLabel()}`}
                    className={cn(variant === 'pop' ? 'ticket-pill ticket-tone-neutral picker-trigger queue-pop'
                        : 'ticket-pill ticket-tone-neutral picker-trigger min-h-9 min-w-[140px]', className)}
                    onKeyDown={event => {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
                    }}>
                    {variant === 'pop' ? <>
                        <span className="queue-pop-k">Site</span>
                        <span className="queue-pop-v">{selectedSiteIds.length === 0 ? 'Semua' : getSelectedLabel()}</span>
                    </> : <>
                        <Building2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">{getSelectedLabel()}</span>
                    </>}
                    <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" collisionPadding={12} sideOffset={8} className="picker-panel p-1.5" aria-label="Filter Site">
                <div className="flex items-center justify-between gap-3 px-2 py-2 text-xs">
                    <span>Filter Site</span>
                    {mode === 'multi' && <button type="button" onClick={handleSelectAll}
                        className="text-[hsl(var(--idesk-sapphire))] hover:underline">
                        {selectedSiteIds.length === sites.length ? 'Clear All' : 'Select All'}
                    </button>}
                </div>
                <Command label="Cari site…" className="picker-command" loop>
                    <CommandInput placeholder="Cari site…" aria-label="Cari site…" autoFocus />
                    <CommandList className="picker-list" aria-multiselectable={mode === 'multi'}>
                        <CommandEmpty>Tidak ditemukan. Coba kata lain.</CommandEmpty>
                        {sites.map(site => <CommandItem key={site.id} value={site.id} keywords={[site.code, site.name]}
                            data-checked={selectedSiteIds.includes(site.id)} aria-checked={selectedSiteIds.includes(site.id)} className="picker-option"
                            onSelect={() => handleSiteToggle(site.id)}>
                            <SiteBadge code={site.code} />
                            <span className="min-w-0 flex-1 break-words">{site.name}</span>
                            {selectedSiteIds.includes(site.id) && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                        </CommandItem>)}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

// Badge component to display site code
interface SiteBadgeProps {
    code: string;
    className?: string;
}

export const SiteBadge = ({ code, className }: SiteBadgeProps) => {
    return <TicketPill tone={SITE_TONES[code] || 'neutral'} className={className}>{code}</TicketPill>;
};

export default SiteSelector;
