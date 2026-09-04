import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Ticket, HardDrive, FileText, RotateCcw, Video,
    ChevronRight, Loader2, RefreshCw, Settings, Settings2,
    CheckCircle2, AlertTriangle, Zap, Clock,
    X, ListChecks, ArrowUpRight, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActionItems } from '../../features/notifications/hooks/useActionItems';
import { useReminderEngine } from '../../features/notifications/hooks/useReminderEngine';
import { useCategorySettings } from '../../features/notifications/hooks/useCategorySettings';
import { ActionItem, ActionItemEntityType, ActionItemUrgency, SnoozeDuration } from './types/action-item.types';
import { useSnoozeActionItem } from '../../features/notifications/hooks/useSnoozeActionItem';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';

// ─── Entity Visual Configuration ──────────────────────────────────────────────
const ENTITY_CONFIG: Record<ActionItemEntityType, {
    icon: React.ReactNode;
    label: string;
    badgeBg: string;
    badgeText: string;
    actionLabel: string;
}> = {
    TICKET: {
        icon: <Ticket className="w-4 h-4" />,
        label: 'Tiket',
        badgeBg: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20',
        badgeText: 'text-blue-600 dark:text-blue-400',
        actionLabel: 'Buka Tiket',
    },
    HARDWARE_REQUEST: {
        icon: <HardDrive className="w-4 h-4" />,
        label: 'Hardware',
        badgeBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-500/20',
        badgeText: 'text-amber-600 dark:text-amber-400',
        actionLabel: 'Tinjau Request',
    },
    EFORM: {
        icon: <FileText className="w-4 h-4" />,
        label: 'E-Form',
        badgeBg: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-500/20',
        badgeText: 'text-purple-600 dark:text-purple-400',
        actionLabel: 'Tinjau E-Form',
    },
    RENEWAL: {
        icon: <RotateCcw className="w-4 h-4" />,
        label: 'Renewal',
        badgeBg: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20',
        badgeText: 'text-rose-600 dark:text-rose-400',
        actionLabel: 'Cek Kontrak',
    },
    ZOOM: {
        icon: <Video className="w-4 h-4" />,
        label: 'Zoom',
        badgeBg: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-500/20',
        badgeText: 'text-cyan-600 dark:text-cyan-400',
        actionLabel: 'Buka Zoom',
    },
};

// ─── Urgency Styling ──────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<ActionItemUrgency, {
    dot: string;
    label: string;
    badgeBg: string;
    badgeText: string;
    borderAccent: string;
    icon: React.ReactNode;
}> = {
    CRITICAL: {
        dot: 'bg-red-500',
        label: 'Kritis',
        badgeBg: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30',
        badgeText: 'text-red-600 dark:text-red-400',
        borderAccent: 'border-l-red-500 dark:border-l-red-400',
        icon: <Zap className="w-3 h-3 text-red-500" />,
    },
    HIGH: {
        dot: 'bg-amber-500',
        label: 'Tinggi',
        badgeBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30',
        badgeText: 'text-amber-600 dark:text-amber-400',
        borderAccent: 'border-l-amber-500 dark:border-l-amber-400',
        icon: <AlertTriangle className="w-3 h-3 text-amber-500" />,
    },
    NORMAL: {
        dot: 'bg-blue-500',
        label: 'Normal',
        badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        badgeText: 'text-blue-600 dark:text-blue-400',
        borderAccent: 'border-l-slate-400 dark:border-l-slate-600',
        icon: <Clock className="w-3 h-3 text-slate-400" />,
    },
};

// ─── Reminder Intensity Presets ───────────────────────────────────────────────
type Intensity = 'OFF' | 'GENTLE' | 'MODERATE' | 'ASSERTIVE';
const INTENSITIES: { value: Intensity; label: string; interval: string }[] = [
    { value: 'OFF', label: 'Off', interval: '—' },
    { value: 'GENTLE', label: 'Santai', interval: '1 jam' },
    { value: 'MODERATE', label: 'Sedang', interval: '30 mnt' },
    { value: 'ASSERTIVE', label: 'Ketat', interval: '15 mnt' },
];

const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration }[] = [
    { label: '30 menit', value: '30m' },
    { label: '2 jam', value: '2h' },
    { label: 'Besok pagi', value: 'tomorrow' },
];

// ─── Helper: Relative Time ───────────────────────────────────────────────────
function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m} mnt lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.floor(h / 24)} hr lalu`;
}

// ─── Subcomponent: Action Card ───────────────────────────────────────────────
const ActionRow = ({
    item,
    onClick,
    index,
}: {
    item: ActionItem;
    onClick: () => void;
    index: number;
}) => {
    const { snooze, unsnooze, isSnoozing } = useSnoozeActionItem();
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

    const entityCfg = ENTITY_CONFIG[item.entityType] || ENTITY_CONFIG.TICKET;
    const urgencyCfg = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.NORMAL;

    const handleSnooze = (duration: SnoozeDuration) => {
        snooze({ entityType: item.entityType, entityId: item.entityId, duration });
        setShowSnoozeMenu(false);
    };

    const handleUnsnooze = (e: React.MouseEvent) => {
        e.stopPropagation();
        unsnooze({ entityType: item.entityType, entityId: item.entityId });
    };

    const snoozeLabel = item.snoozeUntil
        ? `Snoozed s/d ${new Date(item.snoozeUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
        : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.03, duration: 0.18 }}
            onClick={onClick}
            className={`group relative mx-3 my-2 p-3 rounded-xl border bg-white dark:bg-slate-900/90 hover:bg-slate-50/90 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-xs border-l-4 ${urgencyCfg.borderAccent} ${item.isSnoozed ? 'opacity-55' : ''}`}
        >
            <div className="flex items-start gap-2.5">
                {/* Entity Icon Badge */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${entityCfg.badgeBg}`}>
                    {entityCfg.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {entityCfg.label}
                        </span>

                        {item.urgency === 'CRITICAL' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                                Kritis
                            </span>
                        )}

                        <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto flex-shrink-0">
                            {timeAgo(item.createdAt)}
                        </span>
                    </div>

                    <h4 className="text-[13px] font-semibold text-slate-900 dark:text-white mt-1 leading-snug truncate">
                        {item.title}
                    </h4>

                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
                        {item.description}
                    </p>

                    {/* Snooze Status Banner */}
                    {item.isSnoozed && snoozeLabel && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{snoozeLabel}</span>
                            <button
                                onClick={handleUnsnooze}
                                className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium ml-1 hover:underline"
                            >
                                Batalkan
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Klik untuk membuka
                </span>

                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {/* Snooze Button */}
                    {!item.isSnoozed && (
                        <div className="relative">
                            <button
                                onClick={() => setShowSnoozeMenu(v => !v)}
                                disabled={isSnoozing}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px]"
                                title="Tunda reminder"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Tunda</span>
                            </button>

                            {showSnoozeMenu && (
                                <div className="absolute right-0 bottom-8 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 w-32 animate-in fade-in zoom-in-95">
                                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 mb-0.5">
                                        Tunda selama
                                    </div>
                                    {SNOOZE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleSnooze(opt.value)}
                                            className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Primary Direct Action Button */}
                    <button
                        onClick={onClick}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 group-hover:bg-primary group-hover:text-white transition-all shadow-2xs"
                    >
                        <span>{item.entityType === 'ZOOM' ? 'Join' : 'Buka'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Subcomponent: Quick Settings Panel ──────────────────────────────────────
const QuickSettingsPanel = ({ onClose }: { onClose: () => void }) => {
    const queryClient = useQueryClient();
    const [currentIntensity, setCurrentIntensity] = useState<Intensity>('MODERATE');
    const { settings: categorySettings, updateSettings: updateCategorySettings, isUpdating } = useCategorySettings();

    useEffect(() => {
        api.get('/notifications/preferences')
            .then(r => { if (r.data?.reminderIntensity) setCurrentIntensity(r.data.reminderIntensity); })
            .catch(() => {});
    }, []);

    const intensityMutation = useMutation({
        mutationFn: (intensity: Intensity) =>
            api.patch('/notifications/preferences', { reminderIntensity: intensity }),
        onSuccess: (_, intensity) => {
            setCurrentIntensity(intensity);
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
            toast.success('Intensitas reminder berhasil diperbarui');
        },
        onError: () => toast.error('Gagal menyimpan intensitas reminder'),
    });

    const categoryList: { key: keyof typeof ENTITY_CONFIG; label: string }[] = [
        { key: 'TICKET', label: 'Tiket' },
        { key: 'HARDWARE_REQUEST', label: 'Hardware' },
        { key: 'EFORM', label: 'E-Form' },
        { key: 'ZOOM', label: 'Zoom' },
        { key: 'RENEWAL', label: 'Renewal' },
    ];

    const toggleCategory = async (key: keyof typeof ENTITY_CONFIG) => {
        if (!categorySettings) return;
        const currentVal = categorySettings[key] !== false;
        try {
            await updateCategorySettings({ [key]: !currentVal });
            toast.success(`Kategori ${key} ${!currentVal ? 'diaktifkan' : 'dinonaktifkan'}`);
        } catch {
            toast.error('Gagal memperbarui kategori');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
        >
            <div className="p-3.5 space-y-3">
                {/* Title & Close */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Settings2 className="w-3.5 h-3.5 text-primary" />
                        <span>Pengaturan Cepat Action Items</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Reminder Intensity */}
                <div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        Frekuensi Pengingat Otomatis
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                        {INTENSITIES.map(({ value, label, interval }) => {
                            const active = currentIntensity === value;
                            return (
                                <button
                                    key={value}
                                    onClick={() => intensityMutation.mutate(value)}
                                    disabled={intensityMutation.isPending}
                                    className={`py-1.5 px-1 rounded-xl text-center transition-all border ${
                                        active
                                            ? 'bg-primary text-white border-primary shadow-xs'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/40'
                                    }`}
                                >
                                    <div className="text-[11px] font-semibold">{label}</div>
                                    <div className={`text-[10px] mt-0.5 ${active ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                                        {interval}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Category Toggles */}
                <div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        Kategori Ditampilkan
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {categoryList.map(({ key, label }) => {
                            const active = categorySettings ? categorySettings[key] !== false : true;
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleCategory(key)}
                                    disabled={isUpdating}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                        active
                                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-2xs'
                                            : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 border-transparent'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                    <span>{label}</span>
                                    {active && <Check className="w-3 h-3 text-primary ml-0.5" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main ActionCommandCenter Component ──────────────────────────────────────
export const ActionCommandCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { items, activeItems, counts, isLoading, refetch } = useActionItems();
    useReminderEngine();
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleOpenSettings = () => {
        setIsOpen(false);
        if (user?.role === 'USER') {
            navigate('/client/profile?tab=notifications');
        } else {
            navigate('/settings/notifications');
        }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    }, [refetch]);

    const handleItemClick = (link: string) => {
        setIsOpen(false);
        navigate(link);
    };

    // Filter items based on active category tab
    const filteredItems = selectedCategory === 'ALL'
        ? items
        : items.filter(i => i.entityType === selectedCategory);

    // Active counts for trigger badge
    const activeCritical = activeItems.filter(i => i.urgency === 'CRITICAL').length;
    const activeHigh = activeItems.filter(i => i.urgency === 'HIGH').length;
    const hasCritical = activeCritical > 0;
    const hasHigh = activeHigh > 0;
    const activeTotal = activeItems.length;

    const tabs: { key: string; label: string }[] = [
        { key: 'ALL', label: 'Semua' },
        { key: 'TICKET', label: 'Tiket' },
        { key: 'HARDWARE_REQUEST', label: 'Hardware' },
        { key: 'EFORM', label: 'E-Form' },
        { key: 'ZOOM', label: 'Zoom' },
        { key: 'RENEWAL', label: 'Renewal' },
    ];

    return (
        <div className="relative">
            {/* Header Trigger Icon */}
            <button
                onClick={() => { setIsOpen(!isOpen); setShowSettings(false); }}
                className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                aria-label="Action Command Center"
            >
                <ListChecks className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />

                {/* Badge Notification */}
                {activeTotal > 0 && (
                    <span className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-[10px] font-bold text-white shadow-xs ${
                        hasCritical ? 'bg-red-500' : hasHigh ? 'bg-amber-500' : 'bg-primary'
                    }`}>
                        {activeTotal > 9 ? '9+' : activeTotal}
                    </span>
                )}

                {/* Pulse Ring for Critical Items */}
                {hasCritical && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-400 opacity-40 animate-ping pointer-events-none" />
                )}
            </button>

            {/* Popover Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop Click Dismiss */}
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                        {/* Floating Command Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.96 }}
                            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
                            className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[420px] sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                        >
                            {/* Panel Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        <ListChecks className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        Action Items
                                    </span>
                                    {counts.total > 0 && (
                                        <div className="flex items-center gap-1 ml-1">
                                            {counts.critical > 0 && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                                    {counts.critical} kritis
                                                </span>
                                            )}
                                            {counts.high > 0 && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                                    {counts.high} penting
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        title="Perbarui daftar"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => setShowSettings(v => !v)}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            showSettings
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                        title="Pengaturan cepat"
                                    >
                                        <Settings2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Quick Settings Drawer */}
                            <AnimatePresence>
                                {showSettings && (
                                    <QuickSettingsPanel onClose={() => setShowSettings(false)} />
                                )}
                            </AnimatePresence>

                            {/* Category Filter Pills Tab */}
                            <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar bg-slate-50/30 dark:bg-slate-900/30">
                                {tabs.map(tab => {
                                    const count = tab.key === 'ALL'
                                        ? items.length
                                        : items.filter(i => i.entityType === tab.key).length;
                                    
                                    // Don't show tab if 0 items (except 'ALL')
                                    if (tab.key !== 'ALL' && count === 0) return null;

                                    const isSelected = selectedCategory === tab.key;
                                    return (
                                        <button
                                            key={tab.key}
                                            onClick={() => setSelectedCategory(tab.key)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                                                isSelected
                                                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs border border-slate-200 dark:border-slate-700'
                                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                                isSelected
                                                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                            }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Items Scrollable Container */}
                            <div className="max-h-[58vh] overflow-y-auto scrollbar-custom py-1">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                        <span className="text-xs">Memuat action items...</span>
                                    </div>
                                ) : filteredItems.length === 0 ? (
                                    <div className="py-12 px-4 flex flex-col items-center gap-2.5 text-center">
                                        <div className="w-11 h-11 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-500">
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                Tidak ada tindakan tertunda
                                            </p>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                {selectedCategory !== 'ALL'
                                                    ? `Semua item di kategori ${selectedCategory} sudah beres`
                                                    : 'Semua tiket, approval, dan jadwal Anda sudah selesai'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {filteredItems.map((item, i) => (
                                            <ActionRow
                                                key={item.id}
                                                item={item}
                                                index={i}
                                                onClick={() => handleItemClick(item.link)}
                                            />
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>

                            {/* Panel Footer */}
                            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {items.length > 0 ? `${items.length} item · auto-resolve aktif` : 'Real-time sync aktif'}
                                </p>
                                <button
                                    onClick={handleOpenSettings}
                                    className="text-[11px] font-medium text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors flex items-center gap-1"
                                >
                                    <Settings className="w-3 h-3" />
                                    <span>Pengaturan lengkap</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
