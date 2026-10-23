import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Calendar, Trash2, Plus, Globe } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ModernDatePicker } from '@/components/ui/ModernDatePicker';
import { format, parseISO } from 'date-fns';
import { SetHead } from './SettingsParts';

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

const DAYS = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
];

const TIMEZONES = [
    'Asia/Jakarta',
    'Asia/Makassar',
    'Asia/Jayapura',
    'Asia/Singapore',
    'UTC',
];

// Helper to convert minutes to HH:MM
const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// Helper to convert HH:MM to minutes
const timeToMinutes = (time: string): number => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
};

export const BusinessHoursSettings = () => {
    const queryClient = useQueryClient();
    const [newHoliday, setNewHoliday] = useState('');

    const { data: config, isLoading } = useQuery<BusinessHoursConfig>({
        queryKey: ['business-hours'],
        queryFn: async () => {
            const res = await api.get('/business-hours');
            return res.data;
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<BusinessHoursConfig>) => {
            const res = await api.put('/business-hours', data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            toast.success('Business hours updated');
        },
        onError: () => {
            toast.error('Failed to update business hours');
        },
    });

    const addHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            const res = await api.post('/business-hours/holidays', { date });
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            toast.success('Holiday added');
            setNewHoliday('');
        },
        onError: () => {
            toast.error('Failed to add holiday');
        },
    });

    const removeHolidayMutation = useMutation({
        mutationFn: async (date: string) => {
            await api.delete(`/business-hours/holidays/${date}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['business-hours'] });
            toast.success('Holiday removed');
        },
        onError: () => {
            toast.error('Failed to remove holiday');
        },
    });

    const toggleWorkDay = (day: number) => {
        if (!config) return;
        const newWorkDays = config.workDays.includes(day)
            ? config.workDays.filter(d => d !== day)
            : [...config.workDays, day].sort();
        updateMutation.mutate({ workDays: newWorkDays });
    };

    const updateTimes = (startTime: number, endTime: number) => {
        if (startTime >= endTime) {
            toast.error('Start time must be before end time');
            return;
        }
        updateMutation.mutate({ startTime, endTime });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!config) {
        return <div className="text-bad p-4">Failed to load business hours configuration</div>;
    }

    return (
        <div className="space-y-6">
            <SetHead title="Business Hours" sub="Jam kerja untuk perhitungan SLA." />

            {/* Work Days */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Work Days
                </h3>
                <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                        <button
                            key={day.value}
                            onClick={() => toggleWorkDay(day.value)}
                            disabled={updateMutation.isPending}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150",
                                config.workDays.includes(day.value)
                                    ? "bg-primary text-primary-foreground shadow-md"
                                    : "bg-fill text-ink-2 hover:bg-fill-2"
                            )}
                        >
                            {day.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Work Hours */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Work Hours
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm text-ink-2 mb-1">Start Time</label>
                        <input
                            type="time"
                            value={minutesToTime(config.startTime)}
                            onChange={(e) => updateTimes(timeToMinutes(e.target.value), config.endTime)}
                            className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-ink focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-ink-2 mb-1">End Time</label>
                        <input
                            type="time"
                            value={minutesToTime(config.endTime)}
                            onChange={(e) => updateTimes(config.startTime, timeToMinutes(e.target.value))}
                            className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-ink focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-ink-2 mb-1">Timezone</label>
                        <select
                            value={config.timezone}
                            onChange={(e) => updateMutation.mutate({ timezone: e.target.value })}
                            className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-ink focus:ring-2 focus:ring-primary/50 outline-none"
                        >
                            {TIMEZONES.map(tz => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <p className="text-xs text-ink-3">
                    Current: {config.startFormatted} - {config.endFormatted} ({config.timezone})
                </p>
            </div>

            {/* Holidays */}
            <div className="glass-card p-6 space-y-4">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    Holidays
                    <span className="text-xs text-ink-3 font-normal ml-auto">{config.holidays.length} holidays</span>
                </h3>

                {/* Add Holiday */}
                <div className="flex gap-2">
                    <ModernDatePicker
                        value={newHoliday ? parseISO(newHoliday) : undefined}
                        onChange={(date) => setNewHoliday(format(date, 'yyyy-MM-dd'))}
                        placeholder="Select holiday date"
                        minDate={new Date()}
                        triggerClassName="flex-1"
                    />
                    <button
                        onClick={() => newHoliday && addHolidayMutation.mutate(newHoliday)}
                        disabled={!newHoliday || addHolidayMutation.isPending}
                        className="idesk-btn is-primary"
                    >
                        <Plus className="w-4 h-4" />
                        Add Holiday
                    </button>
                </div>

                {/* Holiday List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                    {config.holidays.length === 0 ? (
                        <p className="text-sm text-ink-3 text-center py-4">No holidays configured</p>
                    ) : (
                        config.holidays.map(date => (
                            <div
                                key={date}
                                className="flex items-center justify-between px-4 py-2 bg-fill rounded-lg"
                            >
                                <span className="text-sm text-ink">
                                    {new Date(date).toLocaleDateString('id-ID', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </span>
                                <button
                                    onClick={() => removeHolidayMutation.mutate(date)}
                                    disabled={removeHolidayMutation.isPending}
                                    className="p-1.5 text-bad hover:bg-bad/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-brand/10 border border-brand/30 rounded-xl p-4">
                <h4 className="font-medium text-brand mb-2">How it works</h4>
                <ul className="text-sm text-brand space-y-1">
                    <li>• SLA timers only count during business hours</li>
                    <li>• Time outside work hours is automatically excluded</li>
                    <li>• Holidays are treated as non-working days</li>
                    <li>• Changes apply to new tickets immediately</li>
                </ul>
            </div>
        </div>
    );
};
