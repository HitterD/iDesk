import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    HardDrive,
    Trash2,
    RefreshCw,
    Save,
    AlertTriangle,
    Image,
    MessageSquare,
    StickyNote,
    Calendar,
    Clock,
    CheckCircle2,
    FileText
} from 'lucide-react';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, parseISO } from 'date-fns';

interface RetentionSettings {
    enabled: boolean;
    retentionDays: number;
    onlyResolvedTickets: boolean;
}

interface StorageSettings {
    autoCleanupEnabled: boolean;
    attachments: RetentionSettings;
    notes: RetentionSettings;
    discussions: RetentionSettings;
}

interface StorageStats {
    total: { count: number; sizeBytes: number };
    attachments: { count: number; sizeBytes: number };
    byFolder: Record<string, { count: number; sizeBytes: number }>;
}

interface CleanupPreview {
    attachments: { count: number; sizeBytes: number; files: string[] };
    notes: { count: number };
    discussions: { count: number };
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const RetentionCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    settings: RetentionSettings;
    onChange: (settings: RetentionSettings) => void;
    color: string;
}> = ({ title, icon, settings, onChange, color }) => {
    return (
        <div className={`p-5 rounded-xl border ${color} backdrop-blur-sm`}>
            <div className="flex items-center gap-3 mb-4">
                {icon}
                <h3 className="font-semibold text-slate-800 dark:text-white">{title}</h3>
                <div className="ml-auto">
                    <Switch
                        checked={settings.enabled}
                        onCheckedChange={(checked) => onChange({ ...settings, enabled: checked })}
                    />
                </div>
            </div>

            {settings.enabled && (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                            Retention Period (days)
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                max={3650}
                                value={settings.retentionDays}
                                onChange={(e) => onChange({ ...settings, retentionDays: parseInt(e.target.value) || 0 })}
                                className="w-24"
                            />
                            <span className="text-sm text-slate-500">
                                {settings.retentionDays === 0 ? 'Never delete' :
                                    settings.retentionDays === 1 ? '1 day' :
                                        settings.retentionDays < 30 ? `${settings.retentionDays} days` :
                                            settings.retentionDays < 365 ? `${Math.floor(settings.retentionDays / 30)} months` :
                                                `${Math.floor(settings.retentionDays / 365)} years`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            checked={settings.onlyResolvedTickets}
                            onCheckedChange={(checked) => onChange({ ...settings, onlyResolvedTickets: checked })}
                        />
                        <label className="text-sm text-slate-600 dark:text-slate-400">
                            Only from resolved tickets
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function FileRetentionSettings() {
    const queryClient = useQueryClient();
    const [settings, setSettings] = useState<StorageSettings | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    // Manual cleanup state
    const [cleanupFromDate, setCleanupFromDate] = useState('');
    const [cleanupToDate, setCleanupToDate] = useState('');
    const [cleanupAttachments, setCleanupAttachments] = useState(true);
    const [cleanupNotes, setCleanupNotes] = useState(true);
    const [cleanupDiscussions, setCleanupDiscussions] = useState(true);
    const [cleanupOnlyResolved, setCleanupOnlyResolved] = useState(true);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);

    // Fetch storage settings
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['storage-settings'],
        queryFn: async () => {
            const res = await api.get('/settings/storage');
            return res.data as { settings: StorageSettings; stats: StorageStats };
        },
    });

    // Initialize settings when data is fetched
    useEffect(() => {
        if (data && !settings) {
            setSettings(data.settings);
        }
    }, [data, settings]);

    // Update settings mutation
    const updateMutation = useMutation({
        mutationFn: async (newSettings: StorageSettings) => {
            const res = await api.patch('/settings/storage', newSettings);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Storage settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
        },
        onError: () => {
            toast.error('Failed to save settings');
        }
    });

    // Preview cleanup mutation
    const previewMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/settings/storage/preview', {
                fromDate: cleanupFromDate,
                toDate: cleanupToDate,
                deleteAttachments: cleanupAttachments,
                deleteNotes: cleanupNotes,
                deleteDiscussions: cleanupDiscussions,
                onlyResolvedTickets: cleanupOnlyResolved
            });
            return res.data as CleanupPreview;
        },
        onSuccess: (data) => {
            setCleanupPreview(data);
            setShowConfirmDialog(true);
        },
        onError: () => {
            toast.error('Failed to preview cleanup');
        }
    });

    // Execute cleanup mutation
    const cleanupMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/settings/storage/cleanup', {
                fromDate: cleanupFromDate,
                toDate: cleanupToDate,
                deleteAttachments: cleanupAttachments,
                deleteNotes: cleanupNotes,
                deleteDiscussions: cleanupDiscussions,
                onlyResolvedTickets: cleanupOnlyResolved
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Cleanup completed: ${data.result.attachments.deleted} attachments, ${data.result.notes.deleted} notes, ${data.result.discussions.deleted} discussions deleted`);
            setShowConfirmDialog(false);
            setCleanupPreview(null);
            queryClient.invalidateQueries({ queryKey: ['storage-settings'] });
        },
        onError: () => {
            toast.error('Cleanup failed');
        }
    });

    const handleSettingsChange = (key: keyof StorageSettings, value: any) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
            setHasChanges(true);
        }
    };

    if (isLoading || !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const { stats } = data;

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
                {hasChanges && settings && (
                    <Button onClick={() => updateMutation.mutate(settings)} disabled={updateMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                    </Button>
                )}
            </div>

            {/* Storage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <HardDrive className="w-4 h-4" />
                        <span className="text-xs font-medium">Total Storage</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatBytes(stats.total.sizeBytes)}</p>
                    <p className="text-xs text-slate-400">{stats.total.count} files</p>
                </div>
                {Object.entries(stats.byFolder).map(([folder, folderStats]: [string, { count: number; sizeBytes: number }]) => (
                    <div key={folder} className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs font-medium capitalize">{folder}</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatBytes(folderStats.sizeBytes)}</p>
                        <p className="text-xs text-slate-400">{folderStats.count} files</p>
                    </div>
                ))}
            </div>

            {/* Auto Cleanup Toggle */}
            {settings && (
                <div className="p-5 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                <Clock className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-800 dark:text-white">Automatic Cleanup</h3>
                                <p className="text-sm text-slate-500">Run cleanup daily at 2:00 AM based on retention settings</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.autoCleanupEnabled}
                            onCheckedChange={(checked) => handleSettingsChange('autoCleanupEnabled', checked)}
                        />
                    </div>
                </div>
            )}

            {/* Retention Settings */}
            {settings && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Retention Policies
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <RetentionCard
                            title="Attachments"
                            icon={<Image className="w-5 h-5 text-blue-500" />}
                            settings={settings.attachments}
                            onChange={(s) => handleSettingsChange('attachments', s)}
                            color="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                        />
                        <RetentionCard
                            title="Internal Notes"
                            icon={<StickyNote className="w-5 h-5 text-amber-500" />}
                            settings={settings.notes}
                            onChange={(s) => handleSettingsChange('notes', s)}
                            color="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                        />
                        <RetentionCard
                            title="Discussions"
                            icon={<MessageSquare className="w-5 h-5 text-green-500" />}
                            settings={settings.discussions}
                            onChange={(s) => handleSettingsChange('discussions', s)}
                            color="bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                        />
                    </div>
                </div>
            )}

            {/* Manual Cleanup */}
            <div className="p-5 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-white">Manual Cleanup</h3>
                        <p className="text-sm text-slate-500">Delete data within a specific date range</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">From Date</label>
                        <ModernDatePicker
                            value={cleanupFromDate ? parseISO(cleanupFromDate) : undefined}
                            onChange={(date) => setCleanupFromDate(format(date, 'yyyy-MM-dd'))}
                            placeholder="Select from date"
                            maxDate={cleanupToDate ? parseISO(cleanupToDate) : undefined}
                            triggerClassName="w-full"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">To Date</label>
                        <ModernDatePicker
                            value={cleanupToDate ? parseISO(cleanupToDate) : undefined}
                            onChange={(date) => setCleanupToDate(format(date, 'yyyy-MM-dd'))}
                            placeholder="Select to date"
                            minDate={cleanupFromDate ? parseISO(cleanupFromDate) : undefined}
                            triggerClassName="w-full"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={cleanupAttachments}
                            onChange={(e) => setCleanupAttachments(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Attachments</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={cleanupNotes}
                            onChange={(e) => setCleanupNotes(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Notes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={cleanupDiscussions}
                            onChange={(e) => setCleanupDiscussions(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Discussions</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={cleanupOnlyResolved}
                            onChange={(e) => setCleanupOnlyResolved(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">Only resolved tickets</span>
                    </label>
                </div>

                <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => previewMutation.mutate()}
                    disabled={!cleanupFromDate || !cleanupToDate || previewMutation.isPending}
                >
                    {previewMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 mr-2" />
                    )}
                    Preview Cleanup
                </Button>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && cleanupPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Confirm Deletion</h3>
                                <p className="text-sm text-slate-500">This action cannot be undone!</p>
                            </div>
                        </div>

                        <div className="space-y-3 mb-6">
                            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Attachments</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {cleanupPreview.attachments.count} files ({formatBytes(cleanupPreview.attachments.sizeBytes)})
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Notes</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {cleanupPreview.notes.count} messages
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">Discussions</span>
                                    <span className="font-semibold text-slate-800 dark:text-white">
                                        {cleanupPreview.discussions.count} messages
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setShowConfirmDialog(false);
                                    setCleanupPreview(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-red-600 hover:bg-red-700"
                                onClick={() => cleanupMutation.mutate()}
                                disabled={cleanupMutation.isPending}
                            >
                                {cleanupMutation.isPending ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                )}
                                Confirm Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
