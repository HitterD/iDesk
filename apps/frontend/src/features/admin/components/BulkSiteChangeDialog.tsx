import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, MapPin, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface BulkSiteChangeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    selectedUserIds: string[];
}

interface Site {
    id: string;
    code: string;
    name: string;
}

const SITE_COLORS: Record<string, string> = {
    SPJ: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-700',
    SMG: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700',
    KRW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-700',
    JTB: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-700',
};

export const BulkSiteChangeDialog: React.FC<BulkSiteChangeDialogProps> = ({
    isOpen,
    onClose,
    selectedCount,
    selectedUserIds
}) => {
    const queryClient = useQueryClient();
    const [selectedSiteId, setSelectedSiteId] = useState<string>('');

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
        mutationFn: async ({ userIds, siteId }: { userIds: string[]; siteId: string }) => {
            // Update each user's site individually
            const promises = userIds.map(id => api.patch(`/users/${id}`, { siteId }));
            await Promise.all(promises);
            return { count: userIds.length };
        },
        onSuccess: (data) => {
            const site = sites.find(s => s.id === selectedSiteId);
            toast.success(`${data.count} user(s) assigned to ${site?.code || 'site'}`);
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['agent-stats'] });
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update sites');
        },
    });

    const handleConfirm = () => {
        if (!selectedSiteId) {
            toast.error('Please select a site');
            return;
        }
        mutation.mutate({ userIds: selectedUserIds, siteId: selectedSiteId });
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <Dialog.Title className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary" />
                            Assign to Site
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Assign <span className="font-bold text-slate-700 dark:text-white">{selectedCount}</span> selected user(s) to a site.
                    </p>

                    {/* Site Selection */}
                    <div className="space-y-2">
                        {sites.map((site) => (
                            <button
                                key={site.id}
                                onClick={() => setSelectedSiteId(site.id)}
                                className={cn(
                                    "w-full p-4 rounded-xl border-2 transition-colors duration-150 text-left flex items-center gap-3",
                                    selectedSiteId === site.id
                                        ? SITE_COLORS[site.code] || 'border-primary bg-primary/10'
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold",
                                    SITE_COLORS[site.code]?.split(' ')[0] || 'bg-slate-100'
                                )}>
                                    {site.code.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{site.code}</p>
                                    <p className="text-sm text-slate-500">{site.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedSiteId || mutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Assign to Site
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
