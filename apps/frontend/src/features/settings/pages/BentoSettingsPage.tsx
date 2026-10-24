import React, { lazy, Suspense } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { User, Lock, Palette, Bell, Clock, Loader2, HardDrive, Shield, Video, Volume2, MonitorPlay, Mail, Zap, Boxes, Radio, Settings, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetHead } from '../components/SettingsParts';
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
const IntegrationAppsTab = lazy(() => import('../integration-apps/IntegrationAppsTab'));


const TabFallback: React.FC = () => (
    <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--idesk-sapphire))]" aria-hidden="true" />
        <span className="ml-2 text-sm text-[var(--td-text-3)]">Memuat…</span>
    </div>
);

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
                            <h3 className="settings-group">
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
                                <h3 className="settings-group">
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
                                        { value: 'integration-apps', icon: Plug, label: 'Integrasi Aplikasi' },
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
                                <SecuritySettingsForm />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="notifications" className="settings-tab-panel">
                            <div className="max-w-4xl">
                                <NotificationSettings />
                            </div>
                        </Tabs.Content>

                        <Tabs.Content value="appearance" className="settings-tab-panel">
                            <SetHead title="Theme Preference" sub="Pilih tampilan yang nyaman untuk mata Anda." />
                            <div className="mg-theme-cards set-narrow">
                                {([['light', 'Light Mode', 'Bersih dan terang'], ['dark', 'Dark Mode', 'Kontras tinggi, nyaman malam hari']] as const).map(([value, name, sub]) => (
                                    <button key={value} type="button" onClick={() => setTheme(value)} aria-pressed={theme === value}
                                        className={cn('mg-theme-card', value === 'dark' && 'is-dark', theme === value && 'is-on')}>
                                        <span className="mg-pv" aria-hidden="true" />
                                        <span><b>{name}</b><small>{sub}</small></span>
                                    </button>
                                ))}
                            </div>
                        </Tabs.Content>

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="sla" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <SlaSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="storage" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <StorageSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        <Tabs.Content value="sound" className="settings-tab-panel">
                            <Suspense fallback={<TabFallback />}>
                                <SoundSettingsTab />
                            </Suspense>
                        </Tabs.Content>

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="ip-whitelist" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <IpWhitelistSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="zoom" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <ZoomSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="mail" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <MailSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="tv-board" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <TvBoardSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="ticket-modules" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <TicketModulesSettingsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="integration-apps" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
                                    <IntegrationAppsTab />
                                </Suspense>
                            </Tabs.Content>
                        )}

                        {user?.role === 'ADMIN' && (
                            <Tabs.Content value="desktop-webhook" className="settings-tab-panel">
                                <Suspense fallback={<TabFallback />}>
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
