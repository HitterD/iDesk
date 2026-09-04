import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Lock, Save, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PASSWORD_POLICY, RECOMMENDED_PASSWORD_LENGTH, getPasswordRequirements, translatePasswordPolicyError } from '@/lib/passwordPolicy';

interface SecurityFormValues {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

/**
 * "Kuat" disediakan untuk password yang melewati panjang anjuran, bukan sekadar
 * memenuhi `minLength` — password 8 karakter yang sah tetap dilabeli "Sedang"
 * supaya indikator mendorong ke arah yang lebih aman tanpa menolaknya.
 */
const getPasswordStrength = (pwd: string): { level: number; label: string; colorBar: string; colorText: string } => {
    if (!pwd) return { level: 0, label: '', colorBar: '', colorText: '' };
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const meetsAll = pwd.length >= PASSWORD_POLICY.minLength && hasLower && hasUpper && hasDigit;
    if (pwd.length < PASSWORD_POLICY.minLength) return { level: 1, label: 'Lemah', colorBar: 'bg-red-500', colorText: 'text-red-500' };
    if (!meetsAll || pwd.length < RECOMMENDED_PASSWORD_LENGTH) return { level: 2, label: 'Sedang', colorBar: 'bg-yellow-500', colorText: 'text-yellow-500' };
    return { level: 3, label: 'Kuat', colorBar: 'bg-green-500', colorText: 'text-green-500' };
};

export const SecuritySettingsForm: React.FC = () => {
    const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SecurityFormValues>();
    const newPassword = watch('newPassword');
    const passwordStrength = getPasswordStrength(newPassword || '');

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
            const raw: string = error.response?.data?.message || '';
            const friendly = typeof raw === 'string' ? translatePasswordPolicyError(raw) : null;
            const msg = friendly || (Array.isArray(raw) ? raw[0] : raw) || 'Failed to change password';
            toast.error(msg as string);
        },
    });

    const onSubmit = (data: SecurityFormValues) => {
        mutation.mutate(data);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shadow-inner">
                    <KeyRound className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Ubah Kata Sandi</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pastikan akun Anda menggunakan kata sandi yang kuat dan aman.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-6">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Kata Sandi Saat Ini</Label>
                        <Input
                            type="password"
                            {...register('currentPassword', { required: 'Kata sandi saat ini wajib diisi' })}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="Masukkan kata sandi lama Anda"
                        />
                        {errors.currentPassword && (
                            <p className="text-red-500 text-xs font-medium mt-1">{errors.currentPassword.message as string}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Kata Sandi Baru</Label>
                        <Input
                            type="password"
                            {...register('newPassword', {
                                required: 'Kata sandi baru wajib diisi',
                                minLength: { value: PASSWORD_POLICY.minLength, message: `Kata sandi minimal ${PASSWORD_POLICY.minLength} karakter (disarankan ${RECOMMENDED_PASSWORD_LENGTH}+ agar lebih aman)` },
                                validate: (val: string) => {
                                    if (!/[a-z]/.test(val) || !/[A-Z]/.test(val) || !/\d/.test(val)) return 'Harus mengandung huruf besar, huruf kecil, dan angka.';
                                    return true;
                                }
                            })}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="Masukkan kata sandi baru"
                        />
                        {errors.newPassword && (
                            <p className="text-red-500 text-xs font-medium mt-1">{errors.newPassword.message as string}</p>
                        )}
                        {newPassword && (
                            <div className="space-y-1.5 mt-2">
                                <div className="flex gap-1">
                                    {[1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                                i <= passwordStrength.level
                                                    ? passwordStrength.colorBar
                                                    : 'bg-slate-200 dark:bg-slate-700'
                                            }`}
                                        />
                                    ))}
                                </div>
                                <p className={`text-xs font-medium ${passwordStrength.colorText}`}>
                                    Kekuatan kata sandi: {passwordStrength.label}
                                </p>
                                <ul className="space-y-1 pt-1">
                                    {getPasswordRequirements(newPassword).map((r) => (
                                        <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                            <span aria-hidden="true">{r.met ? '✓' : '○'}</span> {r.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="text-slate-600 dark:text-slate-300">Konfirmasi Kata Sandi Baru</Label>
                        <Input
                            type="password"
                            {...register('confirmPassword', {
                                required: 'Harap konfirmasi kata sandi Anda',
                                validate: (val) => val === newPassword || 'Kata sandi tidak cocok'
                            })}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-11"
                            placeholder="Ulangi kata sandi baru"
                        />
                        {errors.confirmPassword && (
                            <p className="text-red-500 text-xs font-medium mt-1">{errors.confirmPassword.message as string}</p>
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                    <Button
                        type="submit"
                        disabled={mutation.isPending}
                        className="rounded-xl shadow-md h-11 px-6 min-w-[150px]"
                    >
                        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Perbarui Kata Sandi
                    </Button>
                </div>
            </form>
        </div>
    );
};
