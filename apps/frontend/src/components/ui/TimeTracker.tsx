import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Play, Square, Plus, Trash2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface TimeEntry {
    id: string;
    ticketId: string;
    userId: string;
    user: { id: string; fullName: string };
    startTime: string;
    endTime: string | null;
    durationMinutes: number;
    description: string | null;
    isRunning: boolean;
    createdAt: string;
}

interface TimeTrackerProps {
    ticketId: string;
    disabled?: boolean;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ ticketId, disabled = false }) => {
    const queryClient = useQueryClient();
    const [showAddForm, setShowAddForm] = useState(false);
    const [manualDuration, setManualDuration] = useState('');
    const [manualDescription, setManualDescription] = useState('');
    const [runningDuration, setRunningDuration] = useState(0);

    // Fetch time entries
    const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
        queryKey: ['time-entries', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/time-entries`);
            return res.data;
        },
    });

    // Get total time
    const { data: totalData } = useQuery<{ totalMinutes: number }>({
        queryKey: ['time-entries-total', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/time-entries/total`);
            return res.data;
        },
    });

    // Get running timer
    const { data: runningTimer } = useQuery<TimeEntry | null>({
        queryKey: ['time-entries-running', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/${ticketId}/time-entries/running`);
            return res.data;
        },
        refetchInterval: runningDuration > 0 ? 1000 : false,
    });

    // Update running duration every second
    useEffect(() => {
        if (runningTimer?.isRunning) {
            const interval = setInterval(() => {
                const startTime = new Date(runningTimer.startTime).getTime();
                const duration = Math.floor((Date.now() - startTime) / 1000);
                setRunningDuration(duration);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setRunningDuration(0);
        }
    }, [runningTimer]);

    // Start timer mutation
    const startMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/tickets/${ticketId}/time-entries/start`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['time-entries-running', ticketId] });
            toast.success('Timer dimulai');
        },
        onError: () => toast.error('Gagal memulai timer'),
    });

    // Stop timer mutation
    const stopMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post(`/tickets/${ticketId}/time-entries/stop`);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['time-entries-total', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['time-entries-running', ticketId] });
            toast.success('Timer dihentikan');
        },
        onError: () => toast.error('Gagal menghentikan timer'),
    });

    // Add manual entry mutation
    const addMutation = useMutation({
        mutationFn: async (data: { durationMinutes: number; description?: string }) => {
            const res = await api.post(`/tickets/${ticketId}/time-entries`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['time-entries-total', ticketId] });
            setShowAddForm(false);
            setManualDuration('');
            setManualDescription('');
            toast.success('Waktu ditambahkan');
        },
        onError: () => toast.error('Gagal menambahkan waktu'),
    });

    // Delete entry mutation
    const deleteMutation = useMutation({
        mutationFn: async (entryId: string) => {
            await api.delete(`/tickets/${ticketId}/time-entries/${entryId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-entries', ticketId] });
            queryClient.invalidateQueries({ queryKey: ['time-entries-total', ticketId] });
            toast.success('Dihapus');
        },
        onError: () => toast.error('Gagal menghapus'),
    });

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h > 0) return `${h}j ${m}m`;
        return `${m}m`;
    };

    const formatSeconds = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleAddManual = () => {
        const minutes = parseInt(manualDuration);
        if (isNaN(minutes) || minutes <= 0) {
            toast.error('Masukkan durasi yang valid');
            return;
        }
        addMutation.mutate({ durationMinutes: minutes, description: manualDescription || undefined });
    };

    const totalMinutes = totalData?.totalMinutes || 0;
    const isRunning = runningTimer?.isRunning || false;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-slate-700 dark:text-white text-sm">
                            Time Tracking
                        </span>
                    </div>
                    <div className="text-sm font-mono font-bold text-primary">
                        {formatDuration(totalMinutes)}
                    </div>
                </div>
            </div>

            {/* Timer Controls */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                    {isRunning ? (
                        <>
                            <div className="flex-1 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-xl">
                                <Timer className="w-4 h-4 text-green-500 animate-pulse" />
                                <span className="font-mono text-lg font-bold text-green-600 dark:text-green-400">
                                    {formatSeconds(runningDuration)}
                                </span>
                            </div>
                            <button
                                onClick={() => stopMutation.mutate()}
                                disabled={disabled || stopMutation.isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                                <Square className="w-4 h-4" />
                                Stop
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => startMutation.mutate()}
                                disabled={disabled || startMutation.isPending}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-slate-900 rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <Play className="w-4 h-4" />
                                Mulai Timer
                            </button>
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                disabled={disabled}
                                className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>

                {/* Manual Add Form */}
                {showAddForm && !isRunning && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2 animate-in slide-in-from-top-2">
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Menit"
                                value={manualDuration}
                                onChange={(e) => setManualDuration(e.target.value)}
                                className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Deskripsi (opsional)"
                                value={manualDescription}
                                onChange={(e) => setManualDescription(e.target.value)}
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleAddManual}
                                disabled={addMutation.isPending}
                                className="px-3 py-1.5 bg-primary text-slate-900 rounded-lg text-sm font-medium"
                            >
                                Tambah
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Time Entries List */}
            <div className="max-h-48 overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                ) : entries.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">
                        Belum ada waktu tercatat
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className={cn(
                                    "px-4 py-2.5 flex items-center justify-between group",
                                    entry.isRunning && "bg-green-50/50 dark:bg-green-900/10"
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-medium text-slate-700 dark:text-white">
                                            {entry.isRunning ? 'Running...' : formatDuration(entry.durationMinutes)}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {entry.user?.fullName}
                                        </span>
                                    </div>
                                    {entry.description && (
                                        <p className="text-xs text-slate-500 truncate">{entry.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">
                                        {formatDistanceToNow(new Date(entry.createdAt), {
                                            addSuffix: true,
                                            locale: localeId,
                                        })}
                                    </span>
                                    {!entry.isRunning && (
                                        <button
                                            onClick={() => deleteMutation.mutate(entry.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-colors duration-150"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimeTracker;
