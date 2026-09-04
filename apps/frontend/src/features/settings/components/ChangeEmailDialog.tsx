import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '../../../lib/api';
import { useAuth } from '../../../stores/useAuth';

interface ChangeEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentEmail: string;
}

/**
 * Email is a login credential, so the backend requires the current password to
 * change it (PATCH /users/me/email). The password field here is that
 * confirmation, not a second thing to update.
 */
export const ChangeEmailDialog: React.FC<ChangeEmailDialogProps> = ({
    open,
    onOpenChange,
    currentEmail,
}) => {
    const queryClient = useQueryClient();
    const { updateUser } = useAuth();
    const [newEmail, setNewEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');

    // Never leave a typed password sitting in state after the dialog closes.
    useEffect(() => {
        if (!open) {
            setNewEmail('');
            setCurrentPassword('');
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await api.patch('/users/me/email', {
                newEmail: newEmail.trim().toLowerCase(),
                currentPassword,
            });
            return res.data;
        },
        onSuccess: (updatedUser) => {
            toast.success('Email berhasil diubah');
            // Both profile surfaces mount this dialog and they cache the user
            // under different keys, so refresh both.
            queryClient.invalidateQueries({ queryKey: ['auth-user'] });
            queryClient.invalidateQueries({ queryKey: ['my-profile'] });
            updateUser(updatedUser);
            onOpenChange(false);
        },
        onError: (error: any) => {
            const status = error?.response?.status;
            if (status === 409) {
                toast.error('Email ini sudah dipakai akun lain. Gunakan alamat lain.');
            } else if (status === 429) {
                toast.error('Terlalu banyak percobaan. Coba lagi dalam satu menit.');
            } else if (status === 400) {
                toast.error(error?.response?.data?.message ?? 'Password saat ini salah.');
            } else {
                toast.error('Gagal mengubah email. Coba lagi.');
            }
        },
    });

    const trimmedEmail = newEmail.trim().toLowerCase();
    const isUnchanged = trimmedEmail === currentEmail.trim().toLowerCase();
    const canSubmit =
        trimmedEmail.length > 0 && !isUnchanged && currentPassword.length > 0 && !mutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (canSubmit) mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border shadow-2xl rounded-3xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="px-6 pt-6 pb-4 bg-card border-b border-border/80">
                        <DialogTitle className="flex items-center gap-2.5 text-lg font-extrabold text-foreground">
                            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <Mail className="size-4.5" />
                            </div>
                            <span>Ubah Alamat Email</span>
                        </DialogTitle>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            Email dipakai untuk login, jadi masukkan password Anda untuk memastikan
                            perubahan ini benar dari Anda.
                        </p>
                    </DialogHeader>

                    <div className="px-6 py-5 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-foreground">Email Sekarang</Label>
                            <p className="text-sm text-muted-foreground font-medium break-all">
                                {currentEmail}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="new-email" className="text-xs font-bold text-foreground">
                                Email Baru
                            </Label>
                            <Input
                                id="new-email"
                                type="email"
                                autoComplete="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="nama@perusahaan.co.id"
                                className="rounded-xl h-11 bg-card border-border focus-visible:ring-primary"
                            />
                            {isUnchanged && trimmedEmail.length > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                    Email baru masih sama dengan yang sekarang.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="current-password" className="text-xs font-bold text-foreground">
                                Password Saat Ini
                            </Label>
                            <Input
                                id="current-password"
                                type="password"
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Masukkan password Anda"
                                className="rounded-xl h-11 bg-card border-border focus-visible:ring-primary"
                            />
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 bg-muted/20 border-t border-border/80 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl text-xs font-bold"
                            onClick={() => onOpenChange(false)}
                            disabled={mutation.isPending}
                        >
                            Batal
                        </Button>
                        <Button type="submit" className="rounded-xl text-xs font-bold" disabled={!canSubmit}>
                            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Ubah Email
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
