import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Phone, Building, Lock, Save, Camera, MessageCircle, Palette, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useAuth } from '@/stores/useAuth';
import { TelegramSettingsForm } from '../../settings/components/TelegramSettingsForm';
import { useTheme } from '@/components/theme-provider';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface UserProfile {
    id: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    jobTitle?: string;
    department?: { id: string; name: string };
    avatarUrl?: string;
}

export const ClientProfilePage: React.FC = () => {
    const { user, updateUser } = useAuth();
    const queryClient = useQueryClient();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'telegram' | 'appearance'>('profile');
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    // Profile form
    const [profileForm, setProfileForm] = useState({
        fullName: '',
        phoneNumber: '',
        jobTitle: '',
    });

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    // Fetch profile
    const { data: profile } = useQuery<UserProfile>({
        queryKey: ['my-profile'],
        queryFn: async () => {
            const res = await api.get('/users/me');
            return res.data;
        },
    });

    useEffect(() => {
        if (profile) {
            setProfileForm({
                fullName: profile.fullName || '',
                phoneNumber: profile.phoneNumber || '',
                jobTitle: profile.jobTitle || '',
            });
        }
    }, [profile]);

    // Update profile mutation
    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof profileForm) => {
            const res = await api.patch('/users/me', data);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success('Profile updated successfully');
            queryClient.invalidateQueries({ queryKey: ['my-profile'] });
            updateUser(data);
        },
        onError: () => {
            toast.error('Failed to update profile');
        },
    });

    // Upload avatar mutation
    const uploadAvatarMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/users/avatar', formData);
            return res.data;
        },
        onSuccess: (data) => {
            toast.success('Avatar updated successfully');
            queryClient.invalidateQueries({ queryKey: ['my-profile'] });
            updateUser(data);
        },
        onError: () => {
            toast.error('Failed to upload avatar');
        },
    });

    const handleAvatarClick = () => {
        avatarInputRef.current?.click();
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadAvatarMutation.mutate(file);
        }
    };

    // Change password mutation
    const changePasswordMutation = useMutation({
        mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
            const res = await api.post('/users/change-password', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Password changed successfully');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to change password');
        },
    });

    const handleProfileSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(profileForm);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        changePasswordMutation.mutate({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Profile Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your account settings</p>
            </div>

            {/* Profile Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                        <UserAvatar useCurrentUser size="xl" showFallbackIcon />
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                        <input
                            type="file"
                            ref={avatarInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAvatarChange}
                        />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{profile?.fullName}</h2>
                        <p className="text-slate-500">{profile?.email}</p>
                        {profile?.department && (
                            <p className="text-sm text-slate-400">{profile.department.name}</p>
                        )}
                        <button
                            type="button"
                            onClick={handleAvatarClick}
                            className="text-xs text-primary hover:text-primary/80 font-medium mt-1"
                        >
                            Change Avatar
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'profile'
                                ? 'bg-primary text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Profile
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('password')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'password'
                                ? 'bg-primary text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            Password
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('telegram')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'telegram'
                                ? 'bg-primary text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            Telegram
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            activeTab === 'appearance'
                                ? 'bg-primary text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Appearance
                        </span>
                    </button>
                </div>

                {/* Profile Form */}
                {activeTab === 'profile' && (
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <span className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Full Name
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.fullName}
                                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <span className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email
                                </span>
                            </label>
                            <input
                                type="email"
                                value={profile?.email || ''}
                                disabled
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                            />
                            <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <span className="flex items-center gap-2">
                                    <Phone className="w-4 h-4" />
                                    Phone Number
                                </span>
                            </label>
                            <input
                                type="tel"
                                value={profileForm.phoneNumber}
                                onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                placeholder="+62 xxx xxxx xxxx"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <span className="flex items-center gap-2">
                                    <Building className="w-4 h-4" />
                                    Job Title
                                </span>
                            </label>
                            <input
                                type="text"
                                value={profileForm.jobTitle}
                                onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                placeholder="e.g. Software Engineer"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={updateProfileMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {updateProfileMutation.isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Password Form */}
                {activeTab === 'password' && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Current Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                required
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/50 outline-none text-slate-800 dark:text-white"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={changePasswordMutation.isPending}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-slate-900 font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {changePasswordMutation.isPending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin"></div>
                                    Changing...
                                </>
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    Change Password
                                </>
                            )}
                        </button>
                    </form>
                )}

                {/* Telegram Settings */}
                {activeTab === 'telegram' && (
                    <TelegramSettingsForm />
                )}

                {/* Appearance Settings */}
                {activeTab === 'appearance' && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Choose your preferred theme for the application
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-5 rounded-2xl border-2 transition-all text-left space-y-3 group ${
                                    theme === 'dark'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                    <Moon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">High contrast theme</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-5 rounded-2xl border-2 transition-all text-left space-y-3 group ${
                                    theme === 'light'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-yellow-500 shadow-sm border border-slate-200">
                                    <Sun className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">Light Mode</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clean, bright interface</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
