import React, { lazy, Suspense } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../../../stores/useAuth';
import { ProfileSettingsForm } from '../components/ProfileSettingsForm';
import { SecuritySettingsForm } from '../components/SecuritySettingsForm';
import { TelegramSettingsForm } from '../components/TelegramSettingsForm';
import { NotificationSettings } from '../components/NotificationSettings';
import { useTheme } from '../../../components/theme-provider';

// Lazy load SLA settings (admin only)
const SlaSettingsTab = lazy(() => import('../../admin/pages/BentoSlaSettingsPage').then(m => ({ default: m.BentoSlaSettingsPage })));

export const BentoSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();

    return (
        <div className="space-y-8">
            {/* ... header ... */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your account preferences</p>
            </div>

            <Tabs.Root defaultValue="profile" className="flex flex-col md:flex-row gap-8">
                <Tabs.List className="flex flex-col w-full md:w-64 gap-2">
                    {[
                        { value: 'profile', icon: User, label: 'Profile' },
                        { value: 'security', icon: Lock, label: 'Security' },
                        { value: 'notifications', icon: Bell, label: 'Notifications' },
                        { value: 'telegram', icon: MessageCircle, label: 'Telegram' },
                        { value: 'appearance', icon: Palette, label: 'Appearance' },
                        ...(user?.role === 'ADMIN' ? [{ value: 'sla', icon: Clock, label: 'SLA Settings' }] : []),
                    ].map((tab) => (
                        <Tabs.Trigger
                            key={tab.value}
                            value={tab.value}
                            className="group flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white hover:shadow-sm transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-primary data-[state=active]:shadow-md text-left outline-none"
                        >
                            <tab.icon className="w-5 h-5 group-data-[state=active]:text-primary transition-colors" />
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                <div className="flex-1">
                    {/* ... other tabs ... */}
                    <Tabs.Content value="profile" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Profile Information</h2>
                            <ProfileSettingsForm user={user} />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="security" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Security Settings</h2>
                            <SecuritySettingsForm />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="notifications" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Notification Preferences</h2>
                            <NotificationSettings />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="telegram" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Telegram Integration</h2>
                            <TelegramSettingsForm />
                        </div>
                    </Tabs.Content>

                    <Tabs.Content value="appearance" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 max-w-2xl">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Theme Preference</h2>
                            <div className="grid grid-cols-2 gap-6">
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`p-6 rounded-[2rem] border-2 transition-all text-left space-y-4 group ${theme === 'dark'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                                        <Moon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">High contrast theme</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`p-6 rounded-[2rem] border-2 transition-all text-left space-y-4 group ${theme === 'light'
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-yellow-500 shadow-sm border border-slate-200">
                                        <Sun className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white">Light Mode</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Clean, bright interface</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </Tabs.Content>

                    {user?.role === 'ADMIN' && (
                        <Tabs.Content value="sla" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Suspense fallback={
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            }>
                                <SlaSettingsTab />
                            </Suspense>
                        </Tabs.Content>
                    )}
                </div>
            </Tabs.Root>
        </div>
    );
};
