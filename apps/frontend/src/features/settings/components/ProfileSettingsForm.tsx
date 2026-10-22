import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Camera, Mail } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { useAuth } from '../../../stores/useAuth';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { SetField, SetHead, SetSubmit } from './SettingsParts';
import { Button } from '@/components/ui/button';
import { validateImageFile, FILE_SIZE_LIMITS } from '@/lib/file-validation';
import { ChangeEmailDialog } from './ChangeEmailDialog';

interface Department {
    id: string;
    name: string;
    code: string;
}

/**
 * Only the fields PATCH /users/me accepts (UpdateProfileDto). Email is changed
 * through its own endpoint via ChangeEmailDialog, and employeeId is the HRIS
 * matching key — both are shown read-only here, never submitted.
 */
interface ProfileFormValues {
    fullName: string;
    jobTitle: string;
    phoneNumber: string;
    departmentId: string;
}

export const ProfileSettingsForm: React.FC<{ user: any }> = ({ user }) => {
    const queryClient = useQueryClient();
    const { updateUser } = useAuth();
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const { register, handleSubmit, reset } = useForm<ProfileFormValues>({
        defaultValues: {
            fullName: user?.fullName || '',
            jobTitle: user?.jobTitle || '',
            phoneNumber: user?.phoneNumber || '',
            departmentId: user?.departmentId || '',
        },
    });

    useEffect(() => {
        if (user) {
            reset({
                fullName: user.fullName || '',
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
            toast.success('Profil berhasil diperbarui');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            updateUser(updatedUser);
        },
        onError: () => {
            toast.error('Gagal memperbarui profil');
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
            toast.success('Foto profil diperbarui');
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            updateUser(updatedUser);
        },
        onError: () => {
            toast.error('Gagal mengunggah foto profil');
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
        <div>
            <SetHead title="Profile Information" sub="Data dikelola HRIS. Hubungi admin bila keliru." />
            <div className="set-ident">
                <button type="button" className="set-avatar" onClick={handleAvatarClick} aria-label="Ubah foto profil" disabled={uploadAvatarMutation.isPending}>
                    <UserAvatar useCurrentUser size="lg" showFallbackIcon />
                    <span className="set-avatar-ov" aria-hidden="true">{uploadAvatarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}</span>
                </button>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <div className="min-w-0">
                    <b className="truncate">{user?.fullName}</b>
                    <small className="truncate">{user?.email} · {user?.role?.replace(/_/g, ' ')}</small>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="mg-formgrid">
                    <SetField label="Nama Lengkap" htmlFor="pName">
                        <input id="pName" className="mg-input" {...register('fullName')} />
                    </SetField>
                    <SetField label="ID Pegawai (NIP)" htmlFor="pNip" hint="Dikelola HRIS. Hubungi admin bila keliru.">
                        <input id="pNip" className="mg-input mono" value={user?.employeeId || ''} readOnly placeholder="Belum terdaftar" />
                    </SetField>
                    <SetField label="Alamat Email" htmlFor="pMail">
                        <div className="set-inline">
                            <input id="pMail" className="mg-input" value={user?.email || ''} readOnly />
                            <Button type="button" variant="soft" onClick={() => setEmailDialogOpen(true)}><Mail aria-hidden="true" />Ubah</Button>
                        </div>
                    </SetField>
                    <SetField label="Nomor Telepon" htmlFor="pPhone">
                        <input id="pPhone" className="mg-input" {...register('phoneNumber')} placeholder="+62 812 3456" />
                    </SetField>
                    <SetField label="Departemen" htmlFor="pDept">
                        <select id="pDept" className="mg-input" {...register('departmentId')}>
                            <option value="">Pilih Departemen</option>
                            {departments?.map((dept) => (
                                <option key={dept.id} value={dept.id}>{dept.name} ({dept.code})</option>
                            ))}
                        </select>
                    </SetField>
                    <SetField label="Jabatan" htmlFor="pTitle">
                        <input id="pTitle" className="mg-input" {...register('jobTitle')} placeholder="mis. Senior Developer" />
                    </SetField>
                </div>
                <SetSubmit>
                    <Button type="submit" variant="primary" disabled={mutation.isPending} loading={mutation.isPending}>Simpan perubahan</Button>
                </SetSubmit>
            </form>

            <ChangeEmailDialog
                open={emailDialogOpen}
                onOpenChange={setEmailDialogOpen}
                currentEmail={user?.email || ''}
            />
        </div>
    );
};
