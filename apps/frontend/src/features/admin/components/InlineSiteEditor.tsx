import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Site {
    id: string;
    code: string;
    name: string;
}

interface InlineSiteEditorProps {
    userId: string;
    currentSite?: Site | null;
    onUpdate?: () => void;
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export const InlineSiteEditor: React.FC<InlineSiteEditorProps> = ({
    userId,
    currentSite,
    onUpdate
}) => {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch available sites
    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ['sites-active'],
        queryFn: async () => {
            const res = await api.get('/sites/active');
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const mutation = useMutation({
        mutationFn: async (siteId: string | null) => {
            const res = await api.patch(`/users/${userId}`, { siteId });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Site updated');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsOpen(false);
            onUpdate?.();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update site');
        },
    });

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const colorClass = currentSite ? SITE_COLORS[currentSite.code] : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                disabled={mutation.isPending}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-colors duration-150",
                    colorClass,
                    "hover:ring-2 hover:ring-primary/50 cursor-pointer",
                    mutation.isPending && "opacity-50 cursor-wait"
                )}
            >
                {mutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                    <MapPin className="w-3 h-3" />
                )}
                {currentSite?.code || 'No Site'}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px] animate-in fade-in zoom-in-95">
                    {/* No Site option */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            mutation.mutate(null);
                        }}
                        className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                            !currentSite
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        )}
                    >
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="flex-1 text-left">No Site</span>
                        {!currentSite && <Check className="w-4 h-4 text-primary" />}
                    </button>

                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />

                    {sites.map((site) => {
                        const isSelected = currentSite?.id === site.id;
                        const colors = SITE_COLORS[site.code] || 'bg-slate-100 text-slate-600';

                        return (
                            <button
                                key={site.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isSelected) {
                                        mutation.mutate(site.id);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                                    isSelected
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                                )}
                            >
                                <div className={cn("w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold", colors)}>
                                    {site.code.charAt(0)}
                                </div>
                                <span className="flex-1 text-left">{site.code}</span>
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
