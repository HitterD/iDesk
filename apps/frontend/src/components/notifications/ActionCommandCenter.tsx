import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Loader2, RefreshCw, Settings, Settings2,
    CheckCircle2, X, ListChecks, Check,
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useActionItems } from '../../features/notifications/hooks/useActionItems';
import { useReminderEngine } from '../../features/notifications/hooks/useReminderEngine';
import { useCategorySettings } from '../../features/notifications/hooks/useCategorySettings';
import { useAuth } from '@/stores/useAuth';
import api from '@/lib/api';
import { portalEquivalent } from '@/lib/roleHome';
import { ActionRow } from './ActionRow';
import {
    ENTITY_CONFIG,
    INTENSITIES,
    Intensity,
} from './constants/action-item.constants';

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
        { key: 'TICKET_NOTE', label: 'Catatan Internal' },
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
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
        >
            <div className="p-3.5 space-y-3">
                {/* Title & Close */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pengaturan Cepat Action Items</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Tutup pengaturan"
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
                                    className={`py-1.5 px-1 rounded-md text-center transition-all border ${
                                        active
                                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 shadow-2xs'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <div className="text-[11px] font-medium">{label}</div>
                                    <div className={`text-[10px] mt-0.5 ${active ? 'text-white/80 dark:text-slate-700 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
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
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
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
export const ActionCommandCenter: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const { items, activeItems, counts, isLoading, refetch } = useActionItems();
    useReminderEngine();
    const { user } = useAuth();
    const navigate = useNavigate();

    const isMobile = useMediaQuery('(max-width: 639px)');
    const dragControls = useDragControls();

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
        if (isMobile && isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isMobile, isOpen]);

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
        // Action item links are in staff-portal form; open the same page in this user's portal.
        navigate(portalEquivalent(link, user?.role) ?? link);
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
        { key: 'TICKET_NOTE', label: 'Catatan Internal' },
        { key: 'HARDWARE_REQUEST', label: 'Hardware' },
        { key: 'EFORM', label: 'E-Form' },
        { key: 'ZOOM', label: 'Zoom' },
        { key: 'RENEWAL', label: 'Renewal' },
    ];

    const renderItemsList = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-xs">Memuat action items...</span>
                </div>
            );
        }

        if (filteredItems.length === 0) {
            return (
                <div className="py-12 px-4 flex flex-col items-center gap-2 text-center">
                    <CheckCircle2 className="w-7 h-7 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            Tidak ada tindakan tertunda
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {selectedCategory !== 'ALL'
                                ? `Semua item di kategori ${selectedCategory} sudah selesai`
                                : 'Semua tiket, approval, dan jadwal Anda sudah selesai'}
                        </p>
                    </div>
                </div>
            );
        }

        return (
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
        );
    };

    const renderCategoryTabs = () => (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
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
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                            isSelected
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-2xs border border-slate-200/80 dark:border-slate-700/80'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span className={`text-[11px] ${isSelected ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                            ({count})
                        </span>
                    </button>
                );
            })}
        </div>
    );

    const renderFooter = (isMobileView = false) => (
        <div className={`px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0 ${
            isMobileView ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : ''
        }`}>
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
    );

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

            {/* Mobile View: Bottom Sheet via Portal */}
            {isMobile && typeof document !== 'undefined' ? (
                createPortal(
                    <AnimatePresence>
                        {isOpen && (
                            <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
                                {/* Backdrop Click Dismiss */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsOpen(false)}
                                    className="fixed inset-0 bg-black/40 backdrop-blur-xs"
                                />

                                {/* Mobile Sheet Drawer */}
                                <motion.div
                                    initial={{ y: '100%' }}
                                    animate={{ y: 0 }}
                                    exit={{ y: '100%' }}
                                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                    drag="y"
                                    dragControls={dragControls}
                                    dragListener={false}
                                    dragConstraints={{ top: 0 }}
                                    dragElastic={{ top: 0, bottom: 0.5 }}
                                    onDragEnd={(_, info) => {
                                        if (info.offset.y > 70 || info.velocity.y > 350) {
                                            setIsOpen(false);
                                        }
                                    }}
                                    className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-2xl shadow-2xl overflow-hidden flex flex-col"
                                >
                                    {/* Mobile Drag Handle Bar */}
                                    <div
                                        className="pt-3 pb-1.5 flex justify-center w-full shrink-0 cursor-grab active:cursor-grabbing touch-none bg-slate-50/50 dark:bg-slate-900/50"
                                        onPointerDown={(e) => dragControls.start(e)}
                                    >
                                        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                    </div>

                                    {/* Panel Header */}
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <ListChecks className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                                Action Items
                                            </span>
                                            {counts.total > 0 && (
                                                <div className="flex items-center gap-1.5 ml-1">
                                                    {counts.critical > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                            {counts.critical} kritis
                                                        </span>
                                                    )}
                                                    {counts.high > 0 && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                title="Perbarui daftar"
                                                aria-label="Perbarui daftar"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button
                                                onClick={() => setShowSettings(v => !v)}
                                                className={`p-1.5 rounded-md transition-colors ${
                                                    showSettings
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                }`}
                                                title="Pengaturan cepat"
                                                aria-label="Pengaturan cepat"
                                            >
                                                <Settings2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setIsOpen(false)}
                                                className="p-1.5 ml-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                aria-label="Tutup"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick Settings Drawer */}
                                    <AnimatePresence>
                                        {showSettings && (
                                            <QuickSettingsPanel onClose={() => setShowSettings(false)} />
                                        )}
                                    </AnimatePresence>

                                    {/* Category Filter Tabs */}
                                    {renderCategoryTabs()}

                                    {/* Items Scrollable Container */}
                                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-custom">
                                        {renderItemsList()}
                                    </div>

                                    {/* Panel Footer */}
                                    {renderFooter(true)}
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>,
                    document.body
                )
            ) : (
                /* Desktop View: Floating Popover */
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop Click Dismiss */}
                            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                            {/* Floating Command Panel */}
                            <motion.div
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
                            >
                                {/* Panel Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-2">
                                        <ListChecks className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                            Action Items
                                        </span>
                                        {counts.total > 0 && (
                                            <div className="flex items-center gap-1.5 ml-1">
                                                {counts.critical > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                        {counts.critical} kritis
                                                    </span>
                                                )}
                                                {counts.high > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                            title="Perbarui daftar"
                                            aria-label="Perbarui daftar"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => setShowSettings(v => !v)}
                                            className={`p-1.5 rounded-md transition-colors ${
                                                showSettings
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}
                                            title="Pengaturan cepat"
                                            aria-label="Pengaturan cepat"
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

                                {/* Category Filter Tabs */}
                                {renderCategoryTabs()}

                                {/* Items Scrollable Container */}
                                <div className="max-h-[58vh] overflow-y-auto scrollbar-custom">
                                    {renderItemsList()}
                                </div>

                                {/* Panel Footer */}
                                {renderFooter(false)}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};
