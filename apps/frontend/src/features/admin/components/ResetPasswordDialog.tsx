import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/scrollLock';
import { generateSecurePassword } from '@/lib/crypto';

/** Mirrors backend `ResetPasswordDto` (@MinLength(8)). */
const MIN_PASSWORD_LENGTH = 8;
const GENERATED_PASSWORD_LENGTH = 16;

interface ResetPasswordDialogProps {
    isOpen: boolean;
    onClose: () => void;
    user: { id: string; fullName: string; email: string } | null;
}

export const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({ isOpen, onClose, user }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [justGenerated, setJustGenerated] = useState(false);
    const queryClient = useQueryClient();
    const dialogRef = useRef<HTMLDivElement>(null);

    const resetMutation = useMutation({
        mutationFn: async (data: { userId: string; newPassword: string }) => {
            const res = await api.post(`/users/${data.userId}/reset-password`, { newPassword: data.newPassword });
            return res.data;
        },
        onSuccess: () => {
            toast.success('Password reset successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            forceClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to reset password');
        },
    });

    const isPending = resetMutation.isPending;

    /** Clears the form and closes unconditionally (used after a successful reset). */
    const forceClose = useCallback(() => {
        setNewPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setJustGenerated(false);
        onClose();
    }, [onClose]);

    /** User-initiated close: refuses while a reset is in flight. */
    const handleClose = useCallback(() => {
        if (isPending) return;
        forceClose();
    }, [isPending, forceClose]);

    useFocusTrap(dialogRef, { enabled: isOpen && !!user, onEscape: handleClose });

    useEffect(() => {
        if (!isOpen || !user) return;
        lockBodyScroll();
        return unlockBodyScroll;
    }, [isOpen, user]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newPassword) return;

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        resetMutation.mutate({ userId: user.id, newPassword });
    };

    const generatePassword = () => {
        const password = generateSecurePassword(GENERATED_PASSWORD_LENGTH);
        setNewPassword(password);
        setConfirmPassword(password);
        // Reveal only right after generating so the admin can copy it, then re-mask.
        setShowPassword(true);
        setJustGenerated(true);
    };

    if (!isOpen || !user) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reset-password-title"
                className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md my-auto overflow-hidden animate-in zoom-in-95 duration-200 z-10 border border-slate-200/50 dark:border-slate-800"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                            <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <h2 id="reset-password-title" className="text-lg font-bold text-slate-800 dark:text-white">Reset Password</h2>
                            <p className="text-sm text-slate-500">{user.fullName}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isPending}
                        aria-label="Close reset password dialog"
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            You are about to reset the password for <strong>{user.email}</strong>. 
                            The user will need to use the new password to log in.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="reset-new-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            New Password <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <div className="relative">
                            <input
                                id="reset-new-password"
                                type={showPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setJustGenerated(false); }}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                                aria-describedby="reset-password-hint"
                                className="w-full px-4 py-3 pr-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                required
                                minLength={MIN_PASSWORD_LENGTH}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={generatePassword}
                                    aria-label="Generate a secure random password"
                                    className="p-2 text-slate-400 hover:text-primary rounded-lg transition-colors"
                                    title="Generate password"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <p id="reset-password-hint" className="text-xs text-slate-400 mt-1">
                            Minimum {MIN_PASSWORD_LENGTH} characters
                        </p>
                        {justGenerated && showPassword && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Password is visible — copy it now, then hide it before sharing your screen.
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Confirm Password <span className="text-rose-500" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="reset-confirm-password"
                            type={showPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            autoComplete="new-password"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                            required
                            minLength={MIN_PASSWORD_LENGTH}
                        />
                        {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                            <p role="alert" className="text-xs text-rose-500 mt-1">Passwords do not match</p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isPending}
                            className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || newPassword.length < MIN_PASSWORD_LENGTH || newPassword !== confirmPassword}
                            className="flex-1 px-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                            {isPending ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
