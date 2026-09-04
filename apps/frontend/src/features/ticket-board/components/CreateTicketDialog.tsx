import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { logger } from '@/lib/logger';
import { PriorityHoverTip } from '@/components/ui/PriorityHoverTip';

const createTicketSchema = z.object({
    requesterName: z.string().min(1, 'Requester name is required'),
    requesterPhone: z.string().optional(),
    title: z.string().min(1, 'Title is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'ORACLE_REQUEST']),
    criticalReason: z.string().optional(),
    category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'ORACLE_REQUEST']),
    description: z.string().min(1, 'Description is required'),
}).refine(data => {
    if (data.priority === 'CRITICAL' && (!data.criticalReason || data.criticalReason.trim().length === 0)) {
        return false;
    }
    return true;
}, {
    message: 'Justifikasi/alasan wajib diisi untuk tiket berkategori Critical',
    path: ['criticalReason'],
});

type CreateTicketFormValues = z.infer<typeof createTicketSchema>;

interface CreateTicketDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateTicketDialog: React.FC<CreateTicketDialogProps> = ({
    isOpen,
    onClose,
}) => {
    const queryClient = useQueryClient();
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<CreateTicketFormValues>({
        resolver: zodResolver(createTicketSchema),
        defaultValues: {
            priority: 'MEDIUM',
            category: 'SOFTWARE',
        },
    });

    const currentPriority = watch('priority');

    const mutation = useMutation({
        mutationFn: async (data: CreateTicketFormValues) => {
            // Append category and requester info to description as backend might not have these fields yet
            const enhancedDescription = `
Category: ${data.category}
Requester: ${data.requesterName} ${data.requesterPhone ? `(${data.requesterPhone})` : ''}

${data.description}
      `.trim();

            const payload: any = {
                title: data.title,
                description: enhancedDescription,
                priority: data.priority,
                source: 'WEB', // Explicitly set source
            };

            if (data.priority === 'CRITICAL' && data.criticalReason) {
                payload.criticalReason = data.criticalReason;
            }

            const response = await api.post('/tickets', payload);
            return response.data;
        },
        onSuccess: () => {
            toast.success('Ticket created successfully');
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
            reset();
            onClose();
        },
        onError: (error: any) => {
            // Error handling is done globally by api.ts, but we can add specific logic here if needed
            logger.error('Failed to create ticket:', error);
        },
    });

    const onSubmit = (data: CreateTicketFormValues) => {
        mutation.mutate(data);
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
                <Dialog.Content className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-full max-w-lg bg-navy-main border border-white/10 rounded-xl shadow-2xl z-50 p-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <Dialog.Title className="text-xl font-bold text-white">
                            Create New Ticket
                        </Dialog.Title>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Requester Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Requester Name
                                </label>
                                <input
                                    {...register('requesterName')}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    placeholder="John Doe"
                                />
                                {errors.requesterName && (
                                    <p className="text-xs text-red-400 mt-1">
                                        {errors.requesterName.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Phone (Optional)
                                </label>
                                <input
                                    {...register('requesterPhone')}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                    placeholder="+1 234..."
                                />
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Subject
                            </label>
                            <input
                                {...register('title')}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary"
                                placeholder="Brief summary of the issue"
                            />
                            {errors.title && (
                                <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>
                            )}
                        </div>

                        {/* Priority & Category */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Priority
                                </label>
                                <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-900/80 border border-white/10 rounded-xl">
                                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'ORACLE_REQUEST'] as const).map((p) => {
                                        const isSelected = currentPriority === p;
                                        const displayLabel = p === 'ORACLE_REQUEST' ? 'Oracle' : p.charAt(0) + p.slice(1).toLowerCase();
                                        return (
                                            <PriorityHoverTip key={p} priority={p === 'ORACLE_REQUEST' ? 'HIGH' : p} side="top">
                                                <button
                                                    type="button"
                                                    onClick={() => setValue('priority', p, { shouldValidate: true })}
                                                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all text-center ${isSelected
                                                        ? p === 'CRITICAL'
                                                            ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500 shadow-sm'
                                                            : p === 'HIGH'
                                                                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500 shadow-sm'
                                                                : p === 'MEDIUM'
                                                                    ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500 shadow-sm'
                                                                    : p === 'ORACLE_REQUEST'
                                                                        ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500 shadow-sm'
                                                                        : 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500 shadow-sm'
                                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                                        }`}
                                                >
                                                    {displayLabel}
                                                </button>
                                            </PriorityHoverTip>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Critical Reason Input */}
                            {currentPriority === 'CRITICAL' && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-red-400 flex items-center gap-1.5 uppercase tracking-wide">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> Justifikasi Kritis (Wajib) *
                                        </label>
                                        <span className="text-[10px] text-red-400/80">Diteruskan ke Tim Agent</span>
                                    </div>
                                    <textarea
                                        {...register('criticalReason')}
                                        rows={2}
                                        className="w-full bg-slate-950/80 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder:text-red-400/40 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
                                        placeholder="Jelaskan alasan mengapa tiket ini memerlukan penanganan kritis & darurat..."
                                    />
                                    {errors.criticalReason && (
                                        <p className="text-xs text-red-400 mt-0.5">{errors.criticalReason.message}</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Category
                                </label>
                                <select
                                    {...register('category')}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer text-sm"
                                >
                                    <option value="SOFTWARE">Software</option>
                                    <option value="HARDWARE">Hardware</option>
                                    <option value="NETWORK">Network</option>
                                    <option value="ORACLE_REQUEST">Oracle/K2</option>
                                </select>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Description
                            </label>
                            <textarea
                                {...register('description')}
                                rows={4}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary resize-none"
                                placeholder="Detailed description of the problem..."
                            />
                            {errors.description && (
                                <p className="text-xs text-red-400 mt-1">
                                    {errors.description.message}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={mutation.isPending}
                                className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Create Ticket
                            </button>
                        </div>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};
