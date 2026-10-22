import { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
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

/** Site switch rendered as the round-2 segmented control (mockup `.seg` with sliding thumb). */
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
        return <i className="dash-sk" style={{ width: 180, height: 30, borderRadius: 10 }} aria-hidden="true" />;
    }

    if (error) {
        return (
            <Button variant="soft" onClick={fetchSites} className="text-red-500">
                <Building2 aria-hidden="true" />
                {error} ↻
            </Button>
        );
    }

    if (sites.length === 0) return null;

    return (
        <SegmentedControl
            aria-label="Site"
            className={cn('dash-seg', className)}
            options={sites.map((site) => ({ value: site.id, label: site.code, title: site.name }))}
            value={selectedSiteId || null}
            onValueChange={onSelectionChange}
        />
    );
};
