import React, { lazy, Suspense } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, CalendarClock, Loader2, HardDrive, Shield, Video, Volume2 } from 'lucide-react';
import { useAuth } from '../../../stores/useAuth';
import { ProfileSettingsForm } from '../components/ProfileSettingsForm';
import { SecuritySettingsForm } from '../components/SecuritySettingsForm';
import { TelegramSettingsForm } from '../components/TelegramSettingsForm';
import { NotificationSettings } from '../components/NotificationSettings';
import { useTheme } from '../../../components/theme-provider';

// Lazy load SLA settings (admin only)
const SlaSettingsTab = lazy(() => import('../../admin/pages/BentoSlaSettingsPage').then(m => ({ default: m.BentoSlaSettingsPage })));
const StorageSettingsTab = lazy(() => import('./StorageSettingsPage').then(m => ({ default: m.StorageSettingsPage })));
const IpWhitelistSettingsTab = lazy(() => import('./IpWhitelistSettings').then(m => ({ default: m.IpWhitelistSettings })));
const ZoomSettingsTab = lazy(() => import('../../zoom-booking/pages/ZoomSettingsPage').then(m => ({ default: m.ZoomSettingsPage })));
const BusinessHoursTab = lazy(() => import('../components/BusinessHoursSettings').then(m => ({ default: m.BusinessHoursSettings })));
const SoundSettingsTab = lazy(() => import('./SoundSettingsPage').then(m => ({ default: m.SoundSettingsPage })));

export const BentoSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* ... header ... */}
            <div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your account preferences and system configurations</p>
            </div>

            <div className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden min-h-[700px]">
                <Tabs.Root defaultValue="profile" className="flex flex-col md:flex-row h-full">

                    {/* Sidebar Navigation */}
                    <div className="w-full md:w-72 bg-white/80 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-700/80 p-5 flex flex-col gap-6 flex-shrink-0">

                        {/* Personal Settings Section */}
                        <div className="space-y-1">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-2">
                                Personal
                            </h3>
                            <Tabs.List className="flex flex-col w-full gap-1">
                                {[
                                    { value: 'profile', icon: User, label: 'Profile' },
                                    { value: 'security', icon: Lock, label: 'Security' },
                                    { value: 'notifications', icon: Bell, label: 'Notifications' },
                                    { value: 'telegram', icon: MessageCircle, label: 'Telegram' },
                                    { value: 'appearance', icon: Palette, label: 'Appearance' },
                                ].map((tab) => (
                                    <Tabs.Trigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors duration-150 border-l-2 border-transparent data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-500 data-[state=active]:font-semibold text-left outline-none"
                                    >
                                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-blue-100 dark:group-data-[state=active]:bg-blue-900/50 transition-colors duration-150">
                                            <tab.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-data-[state=active]:text-blue-600 dark:group-data-[state=active]:text-blue-400 transition-colors duration-150" />
                                        </div>
                                        {tab.label}
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>
                        </div>

                        {/* Administration Settings Section */}
                        {user?.role === 'ADMIN' && (
                            <div className="space-y-1">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-2">
                                    Administration
                                </h3>
                                <Tabs.List className="flex flex-col w-full gap-1">
                                    {[
                                        { value: 'sla', icon: Clock, label: 'SLA Settings' },
                                        { value: 'storage', icon: HardDrive, label: 'Storage' },
                                        { value: 'business-hours', icon: CalendarClock, label: 'Business Hours' },
                                        { value: 'sound', icon: Volume2, label: 'Sound Settings' },
                                        { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
                                        { value: 'zoom', icon: Video, label: 'Zoom Settings' },
                                    ].map((tab) => (
                                        <Tabs.Trigger
                                            key={tab.value}
                                            value={tab.value}
                                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-colors duration-150 border-l-2 border-transparent data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400 data-[state=active]:border-blue-600 dark:data-[state=active]:border-blue-500 data-[state=active]:font-semibold text-left outline-none"
                                        >
                                            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 group-data-[state=active]:bg-blue-100 dark:group-data-[state=active]:bg-blue-900/50 transition-colors duration-150">
                                                <tab.icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-data-[state=active]:text-blue-600 dark:group-data-[state=active]:text-blue-400 transition-colors duration-150" />
                                            </div>
                                            {tab.label}
                                        </Tabs.Trigger>
                                    ))}
                                </Tabs.List>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-6 lg:p-8 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/10">
                        {/* ... other tabs ... */}
                        <Tabs.Content value="profile" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-4xl">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Profile Information</h2>
                                <ProfileSettingsForm user={user} />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="security" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-4xl">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Security Settings</h2>
                                <SecuritySettingsForm />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="notifications" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-4xl">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Notification Preferences</h2>
                                <NotificationSettings />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="telegram" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-4xl">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Telegram Integration</h2>
                                <TelegramSettingsForm />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="appearance" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="max-w-2xl">
                                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Theme Preference</h2>
                                <div className="grid grid-cols-2 gap-6">
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-6 rounded-[2rem] border-2 transition-colors duration-150 text-left space-y-4 group hover-lift ${theme === 'dark'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-sm">
                                            <Moon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">High contrast theme</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-6 rounded-[2rem] border-2 transition-colors duration-150 text-left space-y-4 group hover-lift ${theme === 'light'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-white dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm border border-slate-200">
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
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <SlaSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="storage" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <StorageSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="business-hours" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <BusinessHoursTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="sound" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <SoundSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="ip-whitelist" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700">
                                    <Suspense fallback={
                                        <div className="flex items-center justify-center h-64">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                                <p className="text-sm text-slate-400">Memuat...</p>
                                            </div>
                                        </div>
                                    }>
                                        <IpWhitelistSettingsTab />
                                    </Suspense>
                                </div>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="zoom" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <ZoomSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}
                    </div>
                </Tabs.Root>
            </div>
        </div>
    );
};
