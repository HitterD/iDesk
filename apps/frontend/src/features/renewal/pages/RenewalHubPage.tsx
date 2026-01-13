import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarClock,
    Key,
    Cloud,
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
import { cn } from '@/lib/utils';
import { FeatureErrorBoundary } from '@/components/ui/FeatureErrorBoundary';

type TabId = 'contracts' | 'vpn' | 'sync';

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
        icon: CalendarClock,
        description: 'Manage renewal contracts and expiry reminders',
    },
    {
        id: 'vpn',
        label: 'VPN Access',
        icon: Key,
        description: 'Track VPN access records and expiry alerts',
    },
    {
        id: 'sync',
        label: 'Sync Settings',
        icon: Cloud,
        description: 'Configure Google Sheets synchronization',
    },
];

export const RenewalHubPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as TabId) || 'contracts';
    const [activeTab, setActiveTab] = useState<TabId>(initialTab);

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
        try {
            await triggerSyncAll.mutateAsync();
            toast.success('Sync jobs queued for all sheets');
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Failed to trigger sync');
        }
    };

    const currentTab = TABS.find(t => t.id === activeTab) || TABS[0];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            {/* Header */}
            <div className="sticky top-0 z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-white/10 transition-colors duration-300">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                <CalendarClock className="w-7 h-7 text-primary" />
                                Renewal Hub
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                {currentTab.description}
                            </p>
                        </div>

                        {/* Sync Status & Actions */}
                        <div className="flex items-center gap-3">
                            {/* Sync Status Indicator */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors",
                                syncStatus?.isAvailable
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400"
                                    : "bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/30 dark:text-yellow-400"
                            )}>
                                {syncStatus?.isAvailable ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Google Connected</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Sync Disabled</span>
                                    </>
                                )}
                            </div>

                            {/* Sync All Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSyncAll}
                                disabled={!syncStatus?.isAvailable || triggerSyncAll.isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-blue-600 text-white rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw className={cn("w-4 h-4", triggerSyncAll.isPending && "animate-spin")} />
                                Sync All
                            </motion.button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            const badgeCount = tabBadges[tab.id];

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "relative flex items-center gap-2 px-5 py-2.5 rounded-t-xl font-medium transition-all",
                                        isActive
                                            ? "text-primary dark:text-white bg-white dark:bg-white/10"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>

                                    {/* Urgency Badge */}
                                    {badgeCount > 0 && (
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full",
                                            tab.id === 'contracts'
                                                ? "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 animate-pulse"
                                                : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 animate-pulse"
                                        )}>
                                            {badgeCount}
                                        </span>
                                    )}

                                    {/* Active indicator */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-blue-500"
                                            initial={false}
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
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
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default RenewalHubPage;
