import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { logger } from '@/lib/logger';

const createTicketSchema = z.object({
    requesterName: z.string().min(1, 'Requester name is required'),
    requesterPhone: z.string().optional(),
    title: z.string().min(1, 'Title is required'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK']),
    description: z.string().min(1, 'Description is required'),
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
        reset,
        formState: { errors },
    } = useForm<CreateTicketFormValues>({
        resolver: zodResolver(createTicketSchema),
        defaultValues: {
            priority: 'MEDIUM',
            category: 'SOFTWARE',
        },
    });

    const mutation = useMutation({
        mutationFn: async (data: CreateTicketFormValues) => {
            // Append category and requester info to description as backend might not have these fields yet
            const enhancedDescription = `
Category: ${data.category}
Requester: ${data.requesterName} ${data.requesterPhone ? `(${data.requesterPhone})` : ''}

${data.description}
      `.trim();

            const payload = {
                title: data.title,
                description: enhancedDescription,
                priority: data.priority,
                source: 'WEB', // Explicitly set source
            };

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
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green"
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
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green"
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
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green"
                                placeholder="Brief summary of the issue"
                            />
                            {errors.title && (
                                <p className="text-xs text-red-400 mt-1">{errors.title.message}</p>
                            )}
                        </div>

                        {/* Priority & Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Priority
                                </label>
                                <select
                                    {...register('priority')}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green"
                                >
                                    <option value="LOW">Low</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HIGH">High</option>
                                    <option value="CRITICAL">Critical</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">
                                    Category
                                </label>
                                <select
                                    {...register('category')}
                                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green"
                                >
                                    <option value="SOFTWARE">Software</option>
                                    <option value="HARDWARE">Hardware</option>
                                    <option value="NETWORK">Network</option>
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
                                className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-neon-green resize-none"
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
                                className="px-4 py-2 bg-neon-green text-navy-main font-bold rounded-lg hover:bg-neon-green/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
