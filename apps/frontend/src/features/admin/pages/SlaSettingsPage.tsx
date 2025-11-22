import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, Save } from 'lucide-react';

interface SlaConfig {
    id: string;
    priority: string;
    resolutionTimeMinutes: number;
    responseTimeMinutes: number;
}

export const SlaSettingsPage: React.FC = () => {
    const queryClient = useQueryClient();
    const [edits, setEdits] = useState<{ [key: string]: number }>({});

    const { data: configs = [], isLoading } = useQuery<SlaConfig[]>({
        queryKey: ['sla-configs'],
        queryFn: async () => {
            const res = await api.get('/sla-config');
            return res.data;
        },
    });

    const updateSlaMutation = useMutation({
        mutationFn: async ({ id, resolutionTimeMinutes }: { id: string; resolutionTimeMinutes: number }) => {
            await api.patch(`/sla-config/${id}`, { resolutionTimeMinutes });
        },
        onSuccess: () => {
            toast.success('SLA configuration updated');
            queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
            setEdits({});
        },
        onError: () => {
            toast.error('Failed to update SLA configuration');
        },
    });

    const handleSave = (id: string) => {
        const newValue = edits[id];
        if (newValue !== undefined) {
            updateSlaMutation.mutate({ id, resolutionTimeMinutes: newValue });
        }
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };

    if (isLoading) return <div className="text-white">Loading...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">SLA Configuration</h1>
                <p className="text-slate-400">Manage service level agreement thresholds for ticket priorities.</p>
            </div>

            <div className="bg-navy-light border border-white/10 rounded-xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-slate-400">Priority</TableHead>
                            <TableHead className="text-slate-400">Resolution Time (Minutes)</TableHead>
                            <TableHead className="text-slate-400">Current Setting</TableHead>
                            <TableHead className="text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {configs.map((config) => (
                            <TableRow key={config.id} className="border-white/10 hover:bg-white/5">
                                <TableCell className="font-medium text-white">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${config.priority === 'CRITICAL' ? 'bg-red-500' :
                                                config.priority === 'HIGH' ? 'bg-orange-500' :
                                                    config.priority === 'MEDIUM' ? 'bg-yellow-500' :
                                                        'bg-blue-500'
                                            }`} />
                                        {config.priority}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        defaultValue={config.resolutionTimeMinutes}
                                        onChange={(e) => setEdits({ ...edits, [config.id]: parseInt(e.target.value) })}
                                        className="w-32 bg-navy-main border-white/10 text-white"
                                    />
                                </TableCell>
                                <TableCell className="text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {formatDuration(config.resolutionTimeMinutes)}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {edits[config.id] !== undefined && edits[config.id] !== config.resolutionTimeMinutes && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleSave(config.id)}
                                            className="bg-neon-green text-navy-dark hover:bg-neon-green/90"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            Save
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
