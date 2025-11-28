import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Lock, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface SecurityFormValues {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export const SecuritySettingsForm: React.FC = () => {
    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SecurityFormValues>();
    const newPassword = watch('newPassword');

    const mutation = useMutation({
        mutationFn: async (data: SecurityFormValues) => {
            const res = await api.post('/auth/change-password', {
                currentPassword: data.currentPassword,
                newPassword: data.newPassword,
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Password changed successfully');
            reset();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to change password');
        },
    });

    const onSubmit = (data: SecurityFormValues) => {
        mutation.mutate(data);
    };

    return (
        <div className="max-w-2xl bg-navy-light border border-white/10 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Change Password</h3>
                    <p className="text-slate-400 text-sm">Update your account password</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Current Password</label>
                        <input
                            type="password"
                            {...register('currentPassword', { required: 'Current password is required' })}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="Enter current password"
                        />
                        {errors.currentPassword && (
                            <p className="text-red-500 text-xs">{errors.currentPassword.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">New Password</label>
                        <input
                            type="password"
                            {...register('newPassword', {
                                required: 'New password is required',
                                minLength: { value: 8, message: 'Password must be at least 8 characters' }
                            })}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="Enter new password"
                        />
                        {errors.newPassword && (
                            <p className="text-red-500 text-xs">{errors.newPassword.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Confirm New Password</label>
                        <input
                            type="password"
                            {...register('confirmPassword', {
                                required: 'Please confirm your password',
                                validate: (val) => val === newPassword || 'Passwords do not match'
                            })}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="Confirm new password"
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-500 text-xs">{errors.confirmPassword.message}</p>
                        )}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update Password
                    </button>
                </div>
            </form>
        </div>
    );
};
