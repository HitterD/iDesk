import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface Site {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

interface SiteTabsProps {
    selectedSiteId: string;
    onSelectionChange: (siteId: string) => void;
    className?: string;
}

export const SiteTabs = ({
    selectedSiteId,
    onSelectionChange,
    className,
}: SiteTabsProps) => {
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
            const response = await api.get('/sites');
            const data = Array.isArray(response.data) ? response.data : [];
            setSites(data);
            
            // Auto-select first site if none is selected
            if (!selectedSiteId && data.length > 0) {
                onSelectionChange(data[0].id);
            }
        } catch (err: any) {
            console.error('Failed to fetch sites:', err);
            setError('Gagal memuat sites');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex gap-2">
                <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full"></div>
                <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <Button variant="outline" onClick={fetchSites} className="text-red-500 rounded-full h-9">
                <Building2 className="h-4 w-4 mr-2" />
                {error} ↻
            </Button>
        );
    }

    if (sites.length === 0) return null;

    return (
        <div className={cn("flex items-center p-1 space-x-1 bg-slate-100 dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700/50 overflow-x-auto", className)}>
            {sites.map((site) => {
                const isSelected = selectedSiteId === site.id;
                return (
                    <button
                        key={site.id}
                        onClick={() => onSelectionChange(site.id)}
                        className={cn(
                            "relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ease-in-out whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900",
                            isSelected
                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800"
                        )}
                    >
                        {site.code}
                    </button>
                );
            })}
        </div>
    );
};
