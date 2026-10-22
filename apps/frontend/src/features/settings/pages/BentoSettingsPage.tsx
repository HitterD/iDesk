import React, { lazy, Suspense } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { User, Lock, Palette, Moon, Sun, MessageCircle, Bell, Clock, Loader2, HardDrive, Shield, Video, Volume2, MonitorPlay, Mail, Zap, Boxes, Radio, Settings } from 'lucide-react';
import { ResHead } from '@/components/resources/ResourceParts';
import '@/components/management/management.css';
import { useAuth } from '../../../stores/useAuth';
import { ProfileSettingsForm } from '../components/ProfileSettingsForm';
import { SecuritySettingsForm } from '../components/SecuritySettingsForm';
import { NotificationSettings } from '../components/NotificationSettings';
import { CannedResponsesManager } from '../../../components/ui/CannedResponses';
import { useTheme } from '../../../components/theme-provider';

// Lazy load SLA settings (admin only)
const SlaSettingsTab = lazy(() => import('../../admin/pages/BentoSlaSettingsPage').then(m => ({ default: m.BentoSlaSettingsPage })));
const TicketModulesSettingsTab = lazy(() => import('./TicketModulesSettingsTab').then(m => ({ default: m.TicketModulesSettingsTab })));
const StorageSettingsTab = lazy(() => import('./StorageSettingsPage').then(m => ({ default: m.StorageSettingsPage })));
const IpWhitelistSettingsTab = lazy(() => import('./IpWhitelistSettings').then(m => ({ default: m.IpWhitelistSettings })));
const ZoomSettingsTab = lazy(() => import('../../zoom-booking/pages/ZoomSettingsPage').then(m => ({ default: m.ZoomSettingsPage })));
const SoundSettingsTab = lazy(() => import('./SoundSettingsPage').then(m => ({ default: m.SoundSettingsPage })));
const TvBoardSettingsTab = lazy(() => import('../components/TvBoardSettings').then(m => ({ default: m.TvBoardSettings })));
const MailSettingsTab = lazy(() => import('./MailSettingsPage').then(m => ({ default: m.MailSettingsPage })));
const WebhookIntegrationHubTab = lazy(() => import('../components/WebhookIntegrationHub'));


export const BentoSettingsPage: React.FC = () => {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const { tab: pathTab } = useParams<{ tab?: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const queryTab = searchParams.get('tab');
    const currentTab = pathTab || queryTab || 'profile';

    const handleTabChange = (newTab: string) => {
        navigate(`/settings/${newTab}`, { replace: true });
    };

    return (
        <div className="res-page mg-page settings-page">
            <ResHead icon={Settings} tone="slate" title="Settings" description="Kelola preferensi akun dan konfigurasi sistem" />
            <div>
                <Tabs.Root value={currentTab} onValueChange={handleTabChange} className="settings-layout">

                    {/* Sidebar Navigation */}
                    <div className="settings-nav">

                        {/* Personal Settings Section */}
                        <div className="space-y-1">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-2">
                                Personal
                            </h3>
                            <Tabs.List className="flex flex-col w-full gap-1">
                                {[
                                    { value: 'profile', icon: User, label: 'Profile' },
                                    { value: 'quick-replies', icon: Zap, label: 'Quick Reply' },
                                    { value: 'security', icon: Lock, label: 'Security' },
                                    { value: 'notifications', icon: Bell, label: 'Notifications' },
                                    { value: 'sound', icon: Volume2, label: 'Sound Settings' },
                                    { value: 'appearance', icon: Palette, label: 'Appearance' },
                                ].map((tab) => (
                                    <Tabs.Trigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="settings-tab"
                                    >
                                        <div className="settings-tab-icon">
                                            <tab.icon className="h-4 w-4" />
                                        </div>
                                        {tab.label}
                                    </Tabs.Trigger>
                                ))}
                            </Tabs.List>
                        </div>

                        {/* Administration Settings Section */}
                        {user?.role === 'ADMIN' && (
                            <div className="space-y-1">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 px-2">
                                    Administration
                                </h3>
                                <Tabs.List className="flex flex-col w-full gap-1">
                                    {[
                                        { value: 'ticket-modules', icon: Boxes, label: 'Modul Tiket' },
                                        { value: 'sla', icon: Clock, label: 'SLA Settings' },
                                        { value: 'storage', icon: HardDrive, label: 'Storage' },
                                        { value: 'ip-whitelist', icon: Shield, label: 'IP Whitelist' },
                                        { value: 'zoom', icon: Video, label: 'Zoom Settings' },
                                        { value: 'mail', icon: Mail, label: 'Email' },
                                        { value: 'tv-board', icon: MonitorPlay, label: 'TV Board' },
                                        { value: 'desktop-webhook', icon: Radio, label: 'Desktop & Webhook Hub' },
                                    ].map((tab) => (
                                        <Tabs.Trigger
                                            key={tab.value}
                                            value={tab.value}
                                            className="settings-tab"
                                        >
                                            <div className="settings-tab-icon">
                                                <tab.icon className="h-4 w-4" />
                                            </div>
                                            {tab.label}
                                        </Tabs.Trigger>
                                    ))}
                                </Tabs.List>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="settings-content dash-panel">
                        {/* ... other tabs ... */}
                        <Tabs.Content value="profile" className="settings-tab-panel">
                            <div className="max-w-4xl">
                                <h2 className="settings-section-title">Profile Information</h2>
                                <ProfileSettingsForm user={user} />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="quick-replies" className="settings-tab-panel">
                            <div className="max-w-4xl">
                                <CannedResponsesManager />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="security" className="settings-tab-panel">
                            <div className="max-w-4xl">
                                <h2 className="settings-section-title">Security Settings</h2>
                                <SecuritySettingsForm />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="notifications" className="settings-tab-panel">
                            <div className="max-w-4xl">
                                <h2 className="settings-section-title">Notification Preferences</h2>
                                <NotificationSettings />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="appearance" className="settings-tab-panel">
                            <div className="max-w-2xl">
                                <h2 className="settings-section-title">Theme Preference</h2>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-4 rounded-2xl border transition-colors duration-150 text-left space-y-4 group hover-lift ${theme === 'dark'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-sm">
                                            <Moon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kontras tinggi, nyaman malam hari</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-4 rounded-2xl border transition-colors duration-150 text-left space-y-4 group hover-lift ${theme === 'light'
                                            ? 'border-primary bg-primary/5'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-white dark:hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-500 shadow-sm border border-slate-200">
                                            <Sun className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-white">Light Mode</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bersih dan terang</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </Tabs.Content>

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="sla" className="settings-tab-panel">
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
                            <Tabs.Content value="storage" className="settings-tab-panel">
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

                        <Tabs.Content value="sound" className="settings-tab-panel">
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

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="ip-whitelist" className="settings-tab-panel">
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
                            <Tabs.Content value="zoom" className="settings-tab-panel">
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

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="mail" className="settings-tab-panel">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <MailSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="tv-board" className="settings-tab-panel">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <TvBoardSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="ticket-modules" className="settings-tab-panel">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <TicketModulesSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="desktop-webhook" className="settings-tab-panel">
                                <Suspense fallback={
                                    <div className="flex items-center justify-center h-64">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                            <p className="text-sm text-slate-400">Memuat...</p>
                                        </div>
                                    </div>
                                }>
                                    <WebhookIntegrationHubTab />
                                </Suspense>
                            </Tabs.Content>
                        )}
                    </div>
                </Tabs.Root>
            </div>
        </div>
    );
};
