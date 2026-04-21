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
    Calendar,
    Briefcase,
    Sun,
    Moon,
    X,
    ChevronDown,
    ChevronUp,
    Info,
    Settings2
} from 'lucide-react';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, parseISO } from 'date-fns';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

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

interface BusinessHoursConfig {
    id: string;
    name: string;
    isDefault: boolean;
    workDays: number[];
    startTime: number;
    endTime: number;
    timezone: string;
    holidays: string[];
    startFormatted: string;
    endFormatted: string;
}

const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
];

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
    CRITICAL: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600', dot: 'bg-red-500', border: 'border-red-200 dark:border-red-800' },
    HIGH: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600', dot: 'bg-orange-500', border: 'border-orange-200 dark:border-orange-800' },
    MEDIUM: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600', dot: 'bg-yellow-500', border: 'border-yellow-200 dark:border-yellow-800' },
    LOW: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600', dot: 'bg-blue-500', border: 'border-blue-200 dark:border-blue-800' },
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

// Compact SLA Row Component
interface SlaRowProps {
    config: SlaConfig;
    onUpdate: (id: string, data: { resolutionTimeMinutes: number; responseTimeMinutes: number }) => void;
    onDelete: (id: string) => void;
    isPending: boolean;
}

const SlaRow: React.FC<SlaRowProps> = ({ config, onUpdate, onDelete, isPending }) => {
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
    const isDefault = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(config.priority);

    return (
        <div className={cn("p-4 rounded-xl border transition-[opacity,transform,colors] duration-200 ease-out", colors.bg, colors.border, hasChanges && "ring-2 ring-primary/30")}>
            {/* Priority Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={cn("w-3 h-3 rounded-full", colors.dot)} />
                    <span className={cn("font-bold text-sm", colors.text)}>{config.priority}</span>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="h-7 px-2 text-xs bg-primary text-slate-900">
                            <Save className="w-3 h-3 mr-1" />
                            Save
                        </Button>
                    )}
                    {!isDefault && (
                        <button onClick={() => onDelete(config.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Time Inputs - Compact Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Resolution Time */}
                <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                        <Timer className="w-3 h-3" /> Resolution
                    </label>
                    <div className="flex gap-1">
                        <input
                            type="number" min="0" value={resolutionTime.days}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, days: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="D"
                        />
                        <input
                            type="number" min="0" max="23" value={resolutionTime.hours}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, hours: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="H"
                        />
                        <input
                            type="number" min="0" max="59" value={resolutionTime.minutes}
                            onChange={(e) => setResolutionTime({ ...resolutionTime, minutes: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="M"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDuration(timeInputToMinutes(resolutionTime))}</p>
                </div>

                {/* Response Time */}
                <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Response
                    </label>
                    <div className="flex gap-1">
                        <input
                            type="number" min="0" value={responseTime.days}
                            onChange={(e) => setResponseTime({ ...responseTime, days: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="D"
                        />
                        <input
                            type="number" min="0" max="23" value={responseTime.hours}
                            onChange={(e) => setResponseTime({ ...responseTime, hours: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="H"
                        />
                        <input
                            type="number" min="0" max="59" value={responseTime.minutes}
                            onChange={(e) => setResponseTime({ ...responseTime, minutes: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-center font-mono"
                            placeholder="M"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDuration(timeInputToMinutes(responseTime))}</p>
                </div>
            </div>
        </div>
    );
};

// Collapsible Info Box Component
const InfoBox: React.FC<{ children: React.ReactNode; title: string; icon: React.ReactNode; color: string; defaultOpen?: boolean }> = ({
    children, title, icon, color, defaultOpen = false
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    };

    return (
        <div className={cn("rounded-xl border overflow-hidden", colorClasses[color])}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-bold text-sm">{title}</span>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {isOpen && <div className="px-3 pb-3 text-sm">{children}</div>}
        </div>
    );
};

export const BentoSlaSettingsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('priority');
    const [isAdding, setIsAdding] = useState(false);
    const [newPriority, setNewPriority] = useState('');
    const [newResolutionDays, setNewResolutionDays] = useState(1);
    const [newResponseHours, setNewResponseHours] = useState(4);
    const [newHoliday, setNewHoliday] = useState('');
    const [isAddingHoliday, setIsAddingHoliday] = useState(false);

    const { data: configs = [], isLoading } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
    });

    const { data: businessHours, isLoading: loadingBusinessHours } = useQuery<BusinessHoursConfig>({
        queryKey: ['business-hours'],
        queryFn: async () => {
            const res = await api.get('/business-hours');
            return res.data;
        },
    });

    const updateBusinessHoursMutation = useMutation({
        mutationFn: async (data: Partial<BusinessHoursConfig>) => {
            await api.put('/business-hours', data);
        },
        onSuccess: () => {
            toast.success('Business hours updated');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
        },
        onError: () => toast.error('Failed to update business hours'),
    });

    const addHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            await api.post('/business-hours/holidays', { date });
        },
        onSuccess: () => {
            toast.success('Holiday added');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            setNewHoliday('');
            setIsAddingHoliday(false);
        },
        onError: () => toast.error('Failed to add holiday'),
    });

    const removeHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            await api.delete(`/business-hours/holidays/${date}`);
        },
        onSuccess: () => {
            toast.success('Holiday removed');
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
        },
        onError: () => toast.error('Failed to remove holiday'),
    });

    const updateSlaMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: { resolutionTimeMinutes: number; responseTimeMinutes: number } }) => {
            await api.patch(`/sla-config/${id}`, data);
        },
        onSuccess: () => {
            toast.success('SLA configuration updated');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => toast.error('Failed to update SLA configuration'),
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
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add SLA configuration'),
    });

    const deleteSlaMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/sla-config/${id}`);
        },
        onSuccess: () => {
            toast.success('SLA configuration deleted');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => toast.error('Failed to delete SLA configuration'),
    });

    const resetSlaMutation = useMutation({
        mutationFn: async () => {
            await api.post('/sla-config/reset');
        },
        onSuccess: () => {
            toast.success('SLA configurations reset to defaults');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
        },
        onError: () => toast.error('Failed to reset SLA configurations'),
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
        if (confirm('Delete this SLA configuration?')) {
            deleteSlaMutation.mutate(id);
        }
    };

    const handleReset = () => {
        if (confirm('Reset all SLA configurations to defaults?')) {
            resetSlaMutation.mutate();
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-5xl">
            {/* Header - Compact */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">SLA Configuration</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Service Level Agreement settings</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleReset} variant="outline" size="sm" disabled={resetSlaMutation.isPending}
                        className="border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", resetSlaMutation.isPending && "animate-spin")} />
                        Reset
                    </Button>
                </div>
            </div>

            {/* Info Boxes - Collapsible */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoBox title="How SLA Works" icon={<Info className="w-4 h-4" />} color="blue" defaultOpen={true}>
                    <p className="text-xs leading-relaxed">
                        <strong>Resolution Time:</strong> Max time to fully resolve ticket.{' '}
                        <strong>Response Time:</strong> Max time for first response. Timer pauses on "Waiting Vendor".
                    </p>
                </InfoBox>
                <InfoBox title="Hardware Installation SLA" icon={<Timer className="w-4 h-4" />} color="amber">
                    <ul className="text-xs space-y-1 list-disc list-inside">
                        <li>Target = scheduled date + 1 day</li>
                        <li>Auto-resolved if not completed by H+1</li>
                        <li>No first response SLA</li>
                    </ul>
                </InfoBox>
            </div>

            {/* Tabs */}
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
                <Tabs.List className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full sm:w-fit">
                    <Tabs.Trigger value="priority" className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                        "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm",
                        "text-slate-600 dark:text-slate-400"
                    )}>
                        <Settings2 className="w-4 h-4" />
                        Priority SLA
                    </Tabs.Trigger>
                    <Tabs.Trigger value="hours" className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                        "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm",
                        "text-slate-600 dark:text-slate-400"
                    )}>
                        <Briefcase className="w-4 h-4" />
                        Business Hours
                    </Tabs.Trigger>
                    <Tabs.Trigger value="holidays" className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                        "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm",
                        "text-slate-600 dark:text-slate-400"
                    )}>
                        <Calendar className="w-4 h-4" />
                        Holidays
                        {businessHours?.holidays?.length ? (
                            <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600">
                                {businessHours.holidays.length}
                            </span>
                        ) : null}
                    </Tabs.Trigger>
                </Tabs.List>

                {/* Priority SLA Tab */}
                <Tabs.Content value="priority" className="mt-4 space-y-4 animate-in fade-in-50 duration-200">
                    {/* Add New Button */}
                    <div className="flex justify-end">
                        <Button onClick={() => setIsAdding(!isAdding)} size="sm" className="bg-primary text-slate-900">
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            {isAdding ? 'Cancel' : 'Add Custom'}
                        </Button>
                    </div>

                    {/* Add Form */}
                    {isAdding && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                <input
                                    type="text" placeholder="Priority name (e.g. URGENT)" value={newPriority}
                                    onChange={(e) => setNewPriority(e.target.value)}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                />
                                <input
                                    type="number" min="0" placeholder="Resolution (days)" value={newResolutionDays}
                                    onChange={(e) => setNewResolutionDays(parseInt(e.target.value) || 0)}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                />
                                <input
                                    type="number" min="0" placeholder="Response (hours)" value={newResponseHours}
                                    onChange={(e) => setNewResponseHours(parseInt(e.target.value) || 0)}
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                />
                                <Button onClick={handleAdd} disabled={createSlaMutation.isPending} className="bg-primary text-slate-900">
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Add
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* SLA Grid - 2 columns on desktop */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {configs.map((config) => (
                            <SlaRow
                                key={config.id}
                                config={config}
                                onUpdate={handleUpdate}
                                onDelete={handleDelete}
                                isPending={updateSlaMutation.isPending}
                            />
                        ))}
                    </div>

                    {configs.length === 0 && (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-xl">
                            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm">No SLA configs. Click "Reset" to create defaults.</p>
                        </div>
                    )}
                </Tabs.Content>

                {/* Business Hours Tab */}
                <Tabs.Content value="hours" className="mt-4 animate-in fade-in-50 duration-200">
                    {loadingBusinessHours ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
                        </div>
                    ) : businessHours ? (
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800 space-y-5">
                            {/* Work Days */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">Work Days</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const isSelected = businessHours.workDays?.includes(day.value);
                                        return (
                                            <button
                                                key={day.value}
                                                onClick={() => {
                                                    const newDays = isSelected
                                                        ? businessHours.workDays.filter(d => d !== day.value)
                                                        : [...businessHours.workDays, day.value].sort();
                                                    updateBusinessHoursMutation.mutate({ workDays: newDays });
                                                }}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150",
                                                    isSelected
                                                        ? 'bg-emerald-500 text-white shadow'
                                                        : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                                )}
                                            >
                                                {day.short}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Work Hours */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                        <Sun className="w-4 h-4 text-amber-500" /> Start
                                    </label>
                                    <input
                                        type="time"
                                        value={businessHours.startFormatted || '08:00'}
                                        onChange={(e) => {
                                            const [hours, mins] = e.target.value.split(':').map(Number);
                                            updateBusinessHoursMutation.mutate({ startTime: hours * 60 + mins });
                                        }}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                                        <Moon className="w-4 h-4 text-indigo-500" /> End
                                    </label>
                                    <input
                                        type="time"
                                        value={businessHours.endFormatted || '17:00'}
                                        onChange={(e) => {
                                            const [hours, mins] = e.target.value.split(':').map(Number);
                                            updateBusinessHoursMutation.mutate({ endTime: hours * 60 + mins });
                                        }}
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm"
                                    />
                                </div>
                            </div>

                            {/* Timezone */}
                            <div>
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1 block">Timezone</label>
                                <div className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {businessHours.timezone || 'Asia/Jakarta'}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </Tabs.Content>

                {/* Holidays Tab */}
                <Tabs.Content value="holidays" className="mt-4 animate-in fade-in-50 duration-200">
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl p-5 border border-rose-200 dark:border-rose-800">
                        {/* Add Holiday */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-rose-700 dark:text-rose-400">
                                Public Holidays ({businessHours?.holidays?.length || 0})
                            </h3>
                            <Button onClick={() => setIsAddingHoliday(!isAddingHoliday)} size="sm" variant="outline"
                                className="border-rose-300 text-rose-600 hover:bg-rose-50">
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                            </Button>
                        </div>

                        {isAddingHoliday && (
                            <div className="mb-4 p-3 bg-white dark:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-700 flex items-center gap-2">
                                <ModernDatePicker
                                    value={newHoliday ? parseISO(newHoliday) : undefined}
                                    onChange={(date) => setNewHoliday(format(date, 'yyyy-MM-dd'))}
                                    placeholder="Select date"
                                    minDate={new Date()}
                                    triggerClassName="flex-1"
                                />
                                <Button onClick={() => newHoliday && addHolidayMutation.mutate(newHoliday)} size="sm"
                                    disabled={!newHoliday || addHolidayMutation.isPending}
                                    className="bg-rose-500 text-white hover:bg-rose-600">
                                    Add
                                </Button>
                                <button onClick={() => { setIsAddingHoliday(false); setNewHoliday(''); }}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                                    <X className="w-4 h-4 text-slate-500" />
                                </button>
                            </div>
                        )}

                        {/* Holidays List */}
                        {businessHours?.holidays && businessHours.holidays.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto space-y-1.5 scrollbar-custom">
                                {businessHours.holidays.sort().map((holiday) => {
                                    const date = new Date(holiday + 'T00:00:00');
                                    const isPast = date < new Date();
                                    return (
                                        <div key={holiday} className={cn(
                                            "flex items-center justify-between p-2.5 rounded-lg border transition-colors",
                                            isPast
                                                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-50'
                                                : 'bg-white dark:bg-slate-800 border-rose-100 dark:border-rose-800'
                                        )}>
                                            <div>
                                                <p className="font-medium text-sm text-slate-800 dark:text-white">
                                                    {date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <button onClick={() => confirm(`Remove ${holiday}?`) && removeHolidayMutation.mutate(holiday)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-rose-400">
                                <Calendar className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                <p className="text-sm">No holidays configured</p>
                            </div>
                        )}
                    </div>
                </Tabs.Content>
            </Tabs.Root>
        </div>
    );
};
