import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';

interface Department {
    id: string;
    name: string;
    code: string;
}

interface ProfileFormValues {
    fullName: string;
    email: string;
    employeeId: string;
    jobTitle: string;
    phoneNumber: string;
    departmentId: string;
}

export const ProfileSettingsForm: React.FC<{ user: any }> = ({ user }) => {
    const queryClient = useQueryClient();
    const { register, handleSubmit, reset } = useForm<ProfileFormValues>({
        defaultValues: {
            fullName: user?.fullName || '',
            email: user?.email || '',
            employeeId: user?.employeeId || '',
            jobTitle: user?.jobTitle || '',
            phoneNumber: user?.phoneNumber || '',
            departmentId: user?.departmentId || '',
        },
    });

    useEffect(() => {
        if (user) {
            reset({
                fullName: user.fullName || '',
                email: user.email || '',
                employeeId: user.employeeId || '',
                jobTitle: user.jobTitle || '',
                phoneNumber: user.phoneNumber || '',
                departmentId: user.departmentId || '',
            });
        }
    }, [user, reset]);

    const { data: departments } = useQuery<Department[]>({
        queryKey: ['departments'],
        queryFn: async () => {
            const res = await api.get('/departments');
            return res.data;
        },
    });

    const mutation = useMutation({
        mutationFn: async (data: ProfileFormValues) => {
            const res = await api.patch('/users/me', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Profile updated successfully');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
        },
        onError: () => {
            toast.error('Failed to update profile');
        },
    });

    const onSubmit = (data: ProfileFormValues) => {
        mutation.mutate(data);
    };

    const avatarInputRef = React.useRef<HTMLInputElement>(null);

    const uploadAvatarMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/users/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Avatar updated successfully');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            // Force reload to update avatar everywhere immediately if needed, 
            // but invalidateQueries should handle it if components use useAuth or react-query
        },
        onError: () => {
            toast.error('Failed to upload avatar');
        },
    });

    const handleAvatarClick = () => {
        avatarInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadAvatarMutation.mutate(file);
        }
    };

    return (
        <div className="max-w-2xl bg-navy-light border border-white/10 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-6">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-[2px]">
                        <div className="w-full h-full rounded-full bg-navy-main flex items-center justify-center overflow-hidden">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-white" />
                            )}
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold text-white">Edit</span>
                    </div>
                </div>
                <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <div>
                    <h3 className="text-lg font-bold text-white">{user?.fullName}</h3>
                    <p className="text-slate-400 text-sm">{user?.email}</p>
                    <button
                        type="button"
                        onClick={handleAvatarClick}
                        className="mt-2 text-xs text-neon-green hover:text-neon-green/80 font-medium"
                    >
                        Change Avatar
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Full Name</label>
                        <input
                            {...register('fullName')}
                            className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Email Address</label>
                        <input
                            {...register('email')}
                            readOnly
                            className="w-full bg-navy-main/50 border border-white/10 rounded-lg px-4 py-2 text-slate-400 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Employee ID (NIP)</label>
                        <input
                            {...register('employeeId')}
                            className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                            placeholder="e.g. EMP-2024-001"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Job Title</label>
                        <input
                            {...register('jobTitle')}
                            className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                            placeholder="e.g. Senior Developer"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Phone Number</label>
                        <input
                            {...register('phoneNumber')}
                            className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                            placeholder="+1 234 567 890"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Department</label>
                        <select
                            {...register('departmentId')}
                            className="w-full bg-navy-main border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-green transition-colors"
                        >
                            <option value="">Select Department</option>
                            {departments?.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.code})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="flex items-center gap-2 px-6 py-2 bg-neon-green text-navy-main font-bold rounded-lg hover:bg-neon-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
};
