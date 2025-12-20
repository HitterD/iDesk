import { useState, useEffect } from 'react';
import { Check, ChevronDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
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
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-500',
    SMG: 'bg-green-500',
    KRW: 'bg-orange-500',
    JTB: 'bg-purple-500',
};

export const SiteSelector = ({
    selectedSiteIds,
    onSelectionChange,
    mode = 'multi',
    className,
    disabled = false,
}: SiteSelectorProps) => {
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSites();
    }, []);

    const fetchSites = async () => {
        setLoading(true);
        try {
            setError(null);
            // Use api helper that handles encrypted auth storage
            const response = await api.get('/sites');
            setSites(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            console.error('Failed to fetch sites:', err);

            // Handle specific error codes
            if (err.response?.status === 401) {
                setError('Session expired');
            } else if (err.response?.status === 403) {
                // Try fallback to /sites/active
                try {
                    const activeResponse = await api.get('/sites/active');
                    setSites(Array.isArray(activeResponse.data) ? activeResponse.data : []);
                    return; // Success with fallback
                } catch {
                    setError('Tidak memiliki akses');
                }
            } else if (err.code === 'ERR_NETWORK') {
                setError('Server tidak tersedia');
            } else {
                setError('Gagal memuat sites');
            }
        } finally {
            setLoading(false);
        }
    };

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
            <Button variant="outline" onClick={fetchSites} className={cn('text-red-500', className)}>
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
                <Button variant="outline" className={cn('min-w-[140px] justify-between', className)}>
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{getSelectedLabel()}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Filter Site</span>
                    {mode === 'multi' && (
                        <button
                            onClick={handleSelectAll}
                            className="text-xs text-primary hover:underline"
                        >
                            {selectedSiteIds.length === sites.length ? 'Clear All' : 'Select All'}
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sites.map((site) => (
                    <DropdownMenuCheckboxItem
                        key={site.id}
                        checked={selectedSiteIds.includes(site.id)}
                        onCheckedChange={() => handleSiteToggle(site.id)}
                        className="cursor-pointer"
                    >
                        <div className="flex items-center gap-2 w-full">
                            <div className={cn('w-2 h-2 rounded-full', SITE_COLORS[site.code] || 'bg-gray-500')} />
                            <span className="font-medium">{site.code}</span>
                            <span className="text-muted-foreground text-sm">- {site.name}</span>
                        </div>
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

// Badge component to display site code
interface SiteBadgeProps {
    code: string;
    className?: string;
}

export const SiteBadge = ({ code, className }: SiteBadgeProps) => {
    const colorClass = SITE_COLORS[code] || 'bg-gray-500';

    return (
        <Badge
            variant="secondary"
            className={cn('text-white font-medium', colorClass, className)}
        >
            {code}
        </Badge>
    );
};

export default SiteSelector;
