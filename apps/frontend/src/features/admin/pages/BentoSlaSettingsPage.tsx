import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { 
    Clock, 
    Save, 
    RefreshCw, 
    Plus, 
    Trash2, 
    AlertTriangle,
    CheckCircle2,
    Timer,
    Calendar
} from 'lucide-react';

interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
}

interface TimeInput {
    days: number;
    hours: number;
    minutes: number;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
    CRITICAL: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600', dot: 'bg-red-500' },
    HIGH: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600', dot: 'bg-orange-500' },
    MEDIUM: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600', dot: 'bg-yellow-500' },
    LOW: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600', dot: 'bg-blue-500' },
};

const minutesToTimeInput = (totalMinutes: number): TimeInput => {
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    return { days, hours, minutes };
};

const timeInputToMinutes = (time: TimeInput): number => {
    return (time.days * 1440) + (time.hours * 60) + time.minutes;
};

const formatDuration = (totalMinutes: number): string => {
    const { days, hours, minutes } = minutesToTimeInput(totalMinutes);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(' ');
};

interface SlaCardProps {
    config: SlaConfig;
    onUpdate: (id: string, data: { resolutionTimeMinutes: number; responseTimeMinutes: number }) => void;
    onDelete: (id: string) => void;
    isPending: boolean;
}

const SlaCard: React.FC<SlaCardProps> = ({ config, onUpdate, onDelete, isPending }) => {
    const [resolutionTime, setResolutionTime] = useState<TimeInput>(minutesToTimeInput(config.resolutionTimeMinutes));
    const [responseTime, setResponseTime] = useState<TimeInput>(minutesToTimeInput(config.responseTimeMinutes));
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const newResolution = timeInputToMinutes(resolutionTime);
        const newResponse = timeInputToMinutes(responseTime);
        setHasChanges(
            newResolution !== config.resolutionTimeMinutes || 
            newResponse !== config.responseTimeMinutes
        );
    }, [resolutionTime, responseTime, config]);

    const handleSave = () => {
        onUpdate(config.id, {
            resolutionTimeMinutes: timeInputToMinutes(resolutionTime),
            responseTimeMinutes: timeInputToMinutes(responseTime),
        });
    };

    const colors = PRIORITY_COLORS[config.priority] || PRIORITY_COLORS.LOW;

    return (
        <div className={`${colors.bg} rounded-2xl p-6 border border-slate-200 dark:border-slate-700`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${colors.dot}`}></div>
                    <h3 className={`text-xl font-bold ${colors.text}`}>{config.priority}</h3>
                </div>
                {!['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(config.priority) && (
                    <button
                        onClick={() => onDelete(config.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Resolution Time */}
            <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">
                    <Timer className="w-4 h-4" />
                    Resolution Time (Target)
                </label>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Days</label>
                        <input
                            type="number"
                            min="0"
                            value={resolutionTime.days}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, days: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Hours</label>
                        <input
                            type="number"
                            min="0"
                            max="23"
                            value={resolutionTime.hours}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, hours: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Minutes</label>
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={resolutionTime.minutes}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, minutes: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Current: {formatDuration(config.resolutionTimeMinutes)}
                    {hasChanges && <span className="text-primary ml-2">→ {formatDuration(timeInputToMinutes(resolutionTime))}</span>}
                </p>
            </div>

            {/* Response Time */}
            <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    First Response Time
                </label>
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Days</label>
                        <input
                            type="number"
                            min="0"
                            value={responseTime.days}
                            onChange={(e) => setResponseTime({ ...responseTime, days: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Hours</label>
                        <input
                            type="number"
                            min="0"
                            max="23"
                            value={responseTime.hours}
                            onChange={(e) => setResponseTime({ ...responseTime, hours: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Minutes</label>
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={responseTime.minutes}
                            onChange={(e) => setResponseTime({ ...responseTime, minutes: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Current: {formatDuration(config.responseTimeMinutes)}
                    {hasChanges && <span className="text-primary ml-2">→ {formatDuration(timeInputToMinutes(responseTime))}</span>}
                </p>
            </div>

            {/* Save Button */}
            {hasChanges && (
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="w-full bg-primary text-slate-900 font-bold hover:bg-primary/90"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {isPending ? 'Saving...' : 'Apply Changes'}
                </Button>
            )}
        </div>
    );
};

export const BentoSlaSettingsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [newPriority, setNewPriority] = useState('');
    const [newResolutionDays, setNewResolutionDays] = useState(1);
    const [newResponseHours, setNewResponseHours] = useState(4);

    const { data: configs = [], isLoading } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
    });

    const updateSlaMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: { resolutionTimeMinutes: number; responseTimeMinutes: number } }) => {
            await api.patch(`/sla-config/${id}`, data);
        },
        onSuccess: () => {
            toast.success('SLA configuration updated');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => {
            toast.error('Failed to update SLA configuration');
        },
    });

    const createSlaMutation = useMutation({
        mutationFn: async (data: { priority: string; resolutionTimeMinutes: number; responseTimeMinutes: number }) => {
            await api.post('/sla-config', data);
        },
        onSuccess: () => {
            toast.success('New SLA configuration added');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            setIsAdding(false);
            setNewPriority('');
            setNewResolutionDays(1);
            setNewResponseHours(4);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Failed to add SLA configuration');
        },
    });

    const deleteSlaMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/sla-config/${id}`);
        },
        onSuccess: () => {
            toast.success('SLA configuration deleted');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => {
            toast.error('Failed to delete SLA configuration');
        },
    });

    const resetSlaMutation = useMutation({
        mutationFn: async () => {
            await api.post('/sla-config/reset');
        },
        onSuccess: () => {
            toast.success('SLA configurations reset to defaults');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => {
            toast.error('Failed to reset SLA configurations');
        },
    });

    const handleAdd = () => {
        if (!newPriority.trim()) {
            toast.error('Priority name is required');
            return;
        }
        createSlaMutation.mutate({ 
            priority: newPriority.toUpperCase(), 
            resolutionTimeMinutes: newResolutionDays * 1440,
            responseTimeMinutes: newResponseHours * 60,
        });
    };

    const handleUpdate = (id: string, data: { resolutionTimeMinutes: number; responseTimeMinutes: number }) => {
        updateSlaMutation.mutate({ id, data });
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this SLA configuration?')) {
            deleteSlaMutation.mutate(id);
        }
    };

    const handleReset = () => {
        if (confirm('Are you sure you want to reset all SLA configurations to defaults? This will overwrite existing settings.')) {
            resetSlaMutation.mutate();
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">SLA Configuration</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Configure Service Level Agreement thresholds for different priority levels
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleReset}
                        variant="outline"
                        disabled={resetSlaMutation.isPending}
                        className="border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${resetSlaMutation.isPending ? 'animate-spin' : ''}`} />
                        Reset Defaults
                    </Button>
                    <Button 
                        onClick={() => setIsAdding(!isAdding)} 
                        className="bg-primary text-slate-900 hover:bg-primary/90"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {isAdding ? 'Cancel' : 'Add Custom SLA'}
                    </Button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                    <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-1">How SLA Works</h4>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                        <strong>Resolution Time:</strong> Maximum time to fully resolve the ticket. 
                        <strong className="ml-2">Response Time:</strong> Maximum time to provide first response to the requester.
                        SLA timer pauses when ticket status is "Waiting Vendor".
                    </p>
                </div>
            </div>

            {/* Add New SLA Form */}
            {isAdding && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Add Custom SLA</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-2 block">Priority Name</label>
                            <input
                                type="text"
                                placeholder="e.g. URGENT"
                                value={newPriority}
                                onChange={(e) => setNewPriority(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-2 block">Resolution Time (Days)</label>
                            <input
                                type="number"
                                min="0"
                                value={newResolutionDays}
                                onChange={(e) => setNewResolutionDays(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-slate-500 mb-2 block">Response Time (Hours)</label>
                            <input
                                type="number"
                                min="0"
                                value={newResponseHours}
                                onChange={(e) => setNewResponseHours(parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button 
                            onClick={handleAdd} 
                            disabled={createSlaMutation.isPending}
                            className="bg-primary text-slate-900 font-bold hover:bg-primary/90"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {createSlaMutation.isPending ? 'Adding...' : 'Add SLA'}
                        </Button>
                    </div>
                </div>
            )}

            {/* SLA Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config) => (
                    <SlaCard
                        key={config.id}
                        config={config}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        isPending={updateSlaMutation.isPending}
                    />
                ))}
            </div>

            {configs.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <Clock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-slate-400">No SLA configurations found. Click "Reset Defaults" to create default configurations.</p>
                </div>
            )}
        </div>
    );
};
