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

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] transition-colors duration-300">
            {/* Header */}
            <div className="border-b border-[hsl(var(--border))] transition-colors duration-300">
                <div className="px-4 md:px-8 pt-8 flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CalendarClock className="w-8 h-8 text-primary shrink-0" />
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                    Renewal Hub
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                                    Manage renewal contracts, track VPN expiry, and sync settings
                                </p>
                            </div>
                        </div>

                        {/* Sync Status & Actions */}
                        <div className="flex items-center gap-6">
                            {/* Sync Status Indicator */}
                            <div className={cn(
                                "flex items-center gap-2.5 text-xs font-extrabold transition-colors uppercase tracking-widest",
                                syncStatus?.isAvailable
                                    ? "text-[hsl(var(--success-600))] dark:text-[hsl(var(--success-400))]"
                                    : "text-slate-500 dark:text-slate-400"
                            )}>
                                {syncStatus?.isAvailable ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-[hsl(var(--success-500))] shadow-[0_0_8px_hsl(var(--success-500))] animate-pulse" />
                                        <span>G-SYNC ON</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                                        <span>SYNC DISABLED</span>
                                    </>
                                )}
                            </div>

                            {/* Sync All Button */}
                            <button
                                onClick={handleSyncAll}
                                disabled={!syncStatus?.isAvailable || triggerSyncAll.isPending || isSyncingUI}
                                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-sm font-bold rounded-none hover:bg-slate-800 dark:hover:bg-slate-100 transition-[transform,box-shadow,border-color,opacity,background-color] duration-200 ease-out shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border border-transparent dark:border-slate-200"
                            >
                                <RefreshCw className={cn("w-4 h-4", (triggerSyncAll.isPending || isSyncingUI) && "animate-spin")} />
                                Sync All
                            </button>
                        </div>
                    </div>

                    {/* Minimalist Tabs */}
                    <div className="flex gap-8 relative mt-2 md:mt-0">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const badgeCount = tabBadges[tab.id];

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "relative flex items-center gap-2 pb-4 text-sm font-bold transition-colors group",
                                        isActive
                                            ? "text-primary"
                                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                    )}
                                >
                                    <span>{tab.label}</span>

                                    {/* Urgency Badge */}
                                    {badgeCount > 0 && (
                                        <span className={cn(
                                            "ml-1 px-1.5 py-0.5 text-[10px] font-extrabold rounded-md flex items-center justify-center min-w-[20px]",
                                            isActive
                                                ? "bg-[hsl(var(--error-50))] text-[hsl(var(--error-600))] dark:bg-[hsl(var(--error-900))]/30 dark:text-[hsl(var(--error-400))]"
                                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
                                        )}>
                                            {badgeCount}
                                        </span>
                                    )}
                                    
                                    {/* Active Indicator Underline */}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 md:p-6 min-h-[calc(100vh-180px)]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
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
