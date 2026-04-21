import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { useAuth } from '../../../stores/useAuth';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation';

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
    const { updateUser } = useAuth();
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
        onSuccess: (updatedUser) => {
            toast.success('Profile updated successfully');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            updateUser(updatedUser);
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
            const res = await api.post('/users/avatar', formData);
            return res.data;
        },
        onSuccess: (updatedUser) => {
            toast.success('Avatar updated successfully');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            updateUser(updatedUser);
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
            // Validate file before upload
            const validation = validateImageFile(file, FILE_SIZE_LIMITS.AVATAR);
            if (!validation.valid) {
                toast.error(validation.error);
                e.target.value = ''; // Reset input
                return;
            }
            uploadAvatarMutation.mutate(file);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex items-center gap-6 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[3px] shadow-sm transition-transform duration-300 group-hover:scale-105">
                        <UserAvatar
                            useCurrentUser
                            size="xl"
                            showFallbackIcon
                            className="w-full h-full border-4 border-white dark:border-slate-800"
                        />
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                        <Camera className="w-6 h-6 text-white mb-1" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ubah</span>
                    </div>
                </div>
                <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{user?.fullName}</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{user?.email}</p>
                    <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold leading-none bg-primary/10 text-primary border border-primary/20">
                        {user?.role?.replace(/_/g, ' ')}
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Nama Lengkap</Label>
                        <Input
                            {...register('fullName')}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Alamat Email</Label>
                        <Input
                            {...register('email')}
                            readOnly
                            className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 text-slate-500 cursor-not-allowed"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">ID Pegawai (NIP)</Label>
                        <Input
                            {...register('employeeId')}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="e.g. EMP-2024-001"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Jabatan</Label>
                        <Input
                            {...register('jobTitle')}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="e.g. Senior Developer"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Nomor Telepon</Label>
                        <Input
                            {...register('phoneNumber')}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="+62 812 3456"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Departemen</Label>
                        <select
                            {...register('departmentId')}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 h-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                        >
                            <option value="">Pilih Departemen</option>
                            {departments?.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                    {dept.name} ({dept.code})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <Button
                        type="submit"
                        disabled={mutation.isPending}
                        className="rounded-xl shadow-md h-11 px-6 min-w-[150px]"
                    >
                        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Simpan Perubahan
                    </Button>
                </div>
            </form>
        </div>
    );
};
