import React from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import api from '../../../lib/api';
import { SetField, SetHead, SetSubmit } from './SettingsParts';
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
const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '', color: '' };
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    const meetsAll = pwd.length >= PASSWORD_POLICY.minLength && hasLower && hasUpper && hasDigit;
    if (pwd.length < PASSWORD_POLICY.minLength) return { level: 1, label: 'Lemah', color: 'var(--dash-red)' };
    if (!meetsAll || pwd.length < RECOMMENDED_PASSWORD_LENGTH) return { level: 2, label: 'Sedang', color: 'var(--dash-orange)' };
    return { level: 3, label: 'Kuat', color: 'var(--dash-green)' };
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
            toast.success('Kata sandi berhasil diubah');
            reset();
        },
        onError: (error: any) => {
            const raw: string = error.response?.data?.message || '';
            const friendly = typeof raw === 'string' ? translatePasswordPolicyError(raw) : null;
            const msg = friendly || (Array.isArray(raw) ? raw[0] : raw) || 'Gagal mengubah kata sandi';
            toast.error(msg as string);
        },
    });

    const onSubmit = (data: SecurityFormValues) => {
        mutation.mutate(data);
    };

    return (
        <div>
            <SetHead title="Security Settings" sub="Pastikan akun Anda menggunakan kata sandi yang kuat dan aman." />
            <form onSubmit={handleSubmit(onSubmit)} className="set-narrow">
                <div className="mg-formgrid is-one">
                    <SetField label="Kata Sandi Saat Ini" htmlFor="sOld" error={errors.currentPassword?.message as string | undefined}>
                        <input id="sOld" type="password" autoComplete="current-password" className={cn('mg-input', errors.currentPassword && 'is-invalid')}
                            {...register('currentPassword', { required: 'Kata sandi saat ini wajib diisi' })} placeholder="Masukkan kata sandi lama Anda" />
                    </SetField>
                    <SetField label="Kata Sandi Baru" htmlFor="sNew" error={errors.newPassword?.message as string | undefined}
                        hint={newPassword ? `Kekuatan kata sandi: ${passwordStrength.label}` : `Minimal ${PASSWORD_POLICY.minLength} karakter, kombinasi huruf besar, huruf kecil, dan angka.`}>
                        <input id="sNew" type="password" autoComplete="new-password" className={cn('mg-input', errors.newPassword && 'is-invalid')}
                            {...register('newPassword', {
                                required: 'Kata sandi baru wajib diisi',
                                minLength: { value: PASSWORD_POLICY.minLength, message: `Kata sandi minimal ${PASSWORD_POLICY.minLength} karakter (disarankan ${RECOMMENDED_PASSWORD_LENGTH}+ agar lebih aman)` },
                                validate: (val: string) => {
                                    if (!/[a-z]/.test(val) || !/[A-Z]/.test(val) || !/\d/.test(val)) return 'Harus mengandung huruf besar, huruf kecil, dan angka.';
                                    return true;
                                }
                            })}
                            placeholder="Masukkan kata sandi baru" />
                        <div className="mg-strength" aria-hidden="true">
                            {[1, 2, 3].map((i) => <i key={i} style={i <= passwordStrength.level ? { background: passwordStrength.color } : undefined} />)}
                        </div>
                        {newPassword && (
                            <ul className="set-reqs">
                                {getPasswordRequirements(newPassword).map((r) => (
                                    <li key={r.label} className={r.met ? 'is-met' : undefined}><span aria-hidden="true">{r.met ? '✓' : '○'}</span> {r.label}</li>
                                ))}
                            </ul>
                        )}
                    </SetField>
                    <SetField label="Konfirmasi Kata Sandi Baru" htmlFor="sNew2" error={errors.confirmPassword?.message as string | undefined}>
                        <input id="sNew2" type="password" autoComplete="new-password" className={cn('mg-input', errors.confirmPassword && 'is-invalid')}
                            {...register('confirmPassword', {
                                required: 'Harap konfirmasi kata sandi Anda',
                                validate: (val) => val === newPassword || 'Kata sandi tidak cocok'
                            })}
                            placeholder="Ulangi kata sandi baru" />
                    </SetField>
                </div>
                <SetSubmit>
                    <Button type="submit" variant="primary" disabled={mutation.isPending} loading={mutation.isPending}>Ubah Kata Sandi</Button>
                </SetSubmit>
            </form>
        </div>
    );
};
