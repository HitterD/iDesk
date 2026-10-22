import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarClock,
    Files,
    ShieldCheck,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';
import { RenewalDashboardPage } from './RenewalDashboardPage';
import VpnAccessPage from '../../vpn-access/pages/VpnAccessPage';
import GoogleSyncSettingsPage from '../../google-sync/pages/GoogleSyncSettingsPage';
import { useGoogleSyncStatus, useTriggerSyncAll } from '../../google-sync/hooks/useGoogleSync';
import { useRenewalStats } from '../hooks/useRenewalApi';
import { useVpnStats } from '../../vpn-access/hooks/useVpnAccess';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import { ResBub, ResHead } from '@/components/resources/ResourceParts';
import { MgPanel, MgTabs, useTabDirection } from '@/components/management/MgmtParts';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';
import { useMarkNotificationsRead } from '@/features/notifications/hooks/useMarkNotificationsRead';
import { NotificationCategory } from '@/components/notifications/types/notification.types';

/** Opening this page counts as reading its notifications. */
const RENEWAL_NOTIFICATIONS = { category: NotificationCategory.CATEGORY_RENEWAL };

type TabId = 'contracts' | 'vpn' | 'sync';
const TAB_ORDER: readonly TabId[] = ['contracts', 'vpn', 'sync'];

interface Tab {
    id: TabId;
    label: string;
    icon: React.ElementType;
    description: string;
}

const TABS: Tab[] = [
    {
        id: 'contracts',
        label: 'Contracts',
        icon: Files,
        description: 'Manage renewal contracts and expiry reminders',
    },
    {
        id: 'vpn',
        label: 'VPN Access',
        icon: ShieldCheck,
        description: 'Track VPN access records and expiry alerts',
    },
    {
        id: 'sync',
        label: 'Sync Settings',
        icon: RefreshCw,
        description: 'Configure Google Sheets synchronization',
    },
];

export const RenewalHubPage = () => {
    useMarkNotificationsRead(RENEWAL_NOTIFICATIONS);
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const initialTab: TabId = TAB_ORDER.includes(rawTab as TabId) ? (rawTab as TabId) : 'contracts';
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);
    const tabDir = useTabDirection(TAB_ORDER, activeTab);
    const [isSyncingUI, setIsSyncingUI] = useState(false);

    const { data: syncStatus } = useGoogleSyncStatus();
    const triggerSyncAll = useTriggerSyncAll();

    // Fetch stats for badge counts
    const { data: renewalStats } = useRenewalStats();
    const { data: vpnStats } = useVpnStats();

    // Calculate badge counts for urgency
    const tabBadges: Record<TabId, number> = {
        contracts: (renewalStats?.expiringSoon ?? 0) + (renewalStats?.expired ?? 0),
        vpn: vpnStats?.expiringSoon ?? 0,
        sync: 0,
    };

    // Sync URL with tab state
    useEffect(() => {
        if (activeTab !== 'contracts') {
            setSearchParams({ tab: activeTab });
        } else {
            setSearchParams({});
        }
    }, [activeTab, setSearchParams]);

    const handleSyncAll = async () => {
        setIsSyncingUI(true);
        try {
            await triggerSyncAll.mutateAsync();
            toast.success('Sync jobs queued for all sheets');

            // Minimum artificial delay to ensure the user actually
            // sees the animation since the backend queues instantly
            setTimeout(() => {
                setIsSyncingUI(false);
            }, 2500);
        } catch (e: any) {
            setIsSyncingUI(false);
            toast.error(e.response?.data?.message || 'Failed to trigger sync');
        }
    };

    const currentTab = TABS.find(t => t.id === activeTab) || TABS[0];

    const tabOptions: SegmentedOption<TabId>[] = TABS.map((t) => ({
        value: t.id,
        icon: t.icon,
        label: <>{t.label}{tabBadges[t.id] > 0 && <span className="res-tab-count is-alert" aria-label={`${tabBadges[t.id]} perlu perhatian`}>{tabBadges[t.id]}</span>}</>,
    }));

    return (
        <div className="res-page mg-page">
            <ResHead icon={CalendarClock} tone="orange" title="Renewal Hub" description="Kelola kontrak renewal dan pengingat masa berlaku"
                actions={(
                    <>
                        {/* Real availability from /google-sync status, not a decorative pulse */}
                        <ResBub color={syncStatus?.isAvailable ? 'var(--dash-green)' : 'var(--dash-gray)'} ink={syncStatus?.isAvailable ? 'var(--dash-ink-green)' : undefined}>
                            {syncStatus?.isAvailable ? 'G-SYNC ON' : 'SYNC DISABLED'}
                        </ResBub>
                        <Button variant="soft" onClick={handleSyncAll} disabled={!syncStatus?.isAvailable || triggerSyncAll.isPending || isSyncingUI}
                            loading={triggerSyncAll.isPending || isSyncingUI}>
                            {!(triggerSyncAll.isPending || isSyncingUI) && <RefreshCw aria-hidden="true" />}Sync All
                        </Button>
                    </>
                )} />

            <div className="mb-4"><MgTabs label="Renewal Hub" options={tabOptions} value={activeTab} onChange={setActiveTab} /></div>

            <MgPanel key={activeTab} dir={tabDir} label={currentTab.label}>
                {activeTab === 'contracts' && (
                    <FeatureErrorBoundary featureName="Contracts">
                        <RenewalDashboardPage />
                    </FeatureErrorBoundary>
                )}
                {activeTab === 'vpn' && (
                    <FeatureErrorBoundary featureName="VPN Access">
                        <VpnAccessPage />
                    </FeatureErrorBoundary>
                )}
                {activeTab === 'sync' && (
                    <FeatureErrorBoundary featureName="Google Sync">
                        <GoogleSyncSettingsPage />
                    </FeatureErrorBoundary>
                )}
            </MgPanel>

            {/* Sync Loading Overlay */}
            <AnimatePresence>
                {(triggerSyncAll.isPending || isSyncingUI) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center mx-4 border border-[hsl(var(--border))]"
                        >
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 relative overflow-hidden">
                                <RefreshCw className="w-8 h-8 text-primary animate-spin relative z-10" />
                                <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                Menyinkronkan Data
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                                Mohon tunggu sebentar. Sistem sedang menarik dan memperbarui data dari Google Sheets. Proses ini mungkin memakan waktu beberapa saat.
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RenewalHubPage;
