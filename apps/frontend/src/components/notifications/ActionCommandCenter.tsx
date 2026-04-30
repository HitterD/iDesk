import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Ticket, HardDrive, FileText, RotateCcw,
    ChevronRight, Loader2, RefreshCw, Settings, Settings2,
    CheckCircle2, AlertTriangle, Zap, Clock,
    X, ListChecks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useActionItems } from '../../features/notifications/hooks/useActionItems';
import { useReminderEngine } from '../../features/notifications/hooks/useReminderEngine';
import { ActionItem, ActionItemEntityType, ActionItemUrgency, SnoozeDuration } from './types/action-item.types';
import { useSnoozeActionItem } from '../../features/notifications/hooks/useSnoozeActionItem';
import api from '@/lib/api';

// ─── Entity type icons ─────────────────────────────────────────────────────────
const ENTITY_ICONS: Record<ActionItemEntityType, React.ReactNode> = {
    TICKET: <Ticket className="w-3.5 h-3.5" />,
    HARDWARE_REQUEST: <HardDrive className="w-3.5 h-3.5" />,
    EFORM: <FileText className="w-3.5 h-3.5" />,
    RENEWAL: <RotateCcw className="w-3.5 h-3.5" />,
};

// ─── Urgency styling ───────────────────────────────────────────────────────────
const URGENCY_CONFIG: Record<ActionItemUrgency, {
    dot: string;
    label: string;
    sectionBg: string;
    sectionText: string;
    rowLeft: string;
    icon: React.ReactNode;
}> = {
    CRITICAL: {
        dot: 'bg-red-500',
        label: 'Critical',
        sectionBg: 'bg-red-50 dark:bg-red-500/10',
        sectionText: 'text-red-600 dark:text-red-400',
        rowLeft: 'border-l-2 border-l-red-400 dark:border-l-red-500',
        icon: <Zap className="w-3 h-3" />,
    },
    HIGH: {
        dot: 'bg-amber-500',
        label: 'High',
        sectionBg: 'bg-amber-50 dark:bg-amber-500/10',
        sectionText: 'text-amber-600 dark:text-amber-400',
        rowLeft: 'border-l-2 border-l-amber-400 dark:border-l-amber-500',
        icon: <AlertTriangle className="w-3 h-3" />,
    },
    NORMAL: {
        dot: 'bg-blue-500',
        label: 'Normal',
        sectionBg: 'bg-blue-50 dark:bg-blue-500/10',
        sectionText: 'text-blue-600 dark:text-blue-400',
        rowLeft: 'border-l-2 border-l-blue-400 dark:border-l-blue-500',
        icon: <Clock className="w-3 h-3" />,
    },
};

// ─── Reminder intensity ────────────────────────────────────────────────────────
type Intensity = 'OFF' | 'GENTLE' | 'MODERATE' | 'ASSERTIVE';
const INTENSITIES: { value: Intensity; label: string; interval: string }[] = [
    { value: 'OFF', label: 'Off', interval: '—' },
    { value: 'GENTLE', label: 'Gentle', interval: '1 jam' },
    { value: 'MODERATE', label: 'Moderate', interval: '30 mnt' },
    { value: 'ASSERTIVE', label: 'Assertive', interval: '15 mnt' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m} mnt`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam`;
    return `${Math.floor(h / 24)} hari`;
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const SectionLabel = ({ urgency, count }: { urgency: ActionItemUrgency; count: number }) => {
    const cfg = URGENCY_CONFIG[urgency];
    return (
        <div className={`flex items-center gap-1.5 px-4 py-2 ${cfg.sectionBg}`}>
            <span className={`flex items-center gap-1 text-[11px] font-semibold ${cfg.sectionText}`}>
                {cfg.icon}
                {cfg.label}
            </span>
            <span className={`ml-auto text-[11px] font-medium ${cfg.sectionText} opacity-70`}>
                {count} item{count !== 1 ? 's' : ''}
            </span>
        </div>
    );
};

const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration }[] = [
    { label: '30 menit', value: '30m' },
    { label: '2 jam', value: '2h' },
    { label: 'Besok pagi', value: 'tomorrow' },
];

const ActionRow = ({
    item, onClick, index,
}: { item: ActionItem; onClick: () => void; index: number }) => {
    const { snooze, unsnooze, isSnoozePending } = useSnoozeActionItem();
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
    
    const cfg = URGENCY_CONFIG[item.urgency];
    
    const handleSnooze = (duration: SnoozeDuration) => {
        snooze({ entityType: item.entityType, entityId: item.entityId, duration });
        setShowSnoozeMenu(false);
    };

    const handleUnsnooze = (e: React.MouseEvent) => {
        e.stopPropagation();
        unsnooze({ entityType: item.entityType, entityId: item.entityId });
    };

    const snoozeLabel = item.snoozeUntil
        ? `Snoozed · sampai ${new Date(item.snoozeUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
        : null;

    return (
        <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04, duration: 0.2 }}
            onClick={onClick}
            className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group ${cfg.rowLeft} ${item.isSnoozed ? 'opacity-50' : ''}`}
        >
            <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${cfg.sectionBg} ${cfg.sectionText}`}>
                {ENTITY_ICONS[item.entityType]}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-800 dark:text-white truncate leading-snug">
                    {item.title}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.description}
                </p>
                {item.isSnoozed && snoozeLabel && (
                    <button
                        onClick={handleUnsnooze}
                        className="mt-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                    >
                        {snoozeLabel} · batalkan
                    </button>
                )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                {!item.isSnoozed && (
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowSnoozeMenu(v => !v); }}
                            disabled={isSnoozePending}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            title="Tunda reminder"
                        >
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        {showSnoozeMenu && (
                            <div className="absolute right-0 top-7 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-32">
                                {SNOOZE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={(e) => { e.stopPropagation(); handleSnooze(opt.value); }}
                                        className="w-full text-left px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden group-hover:hidden sm:block">{timeAgo(item.createdAt)}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </motion.button>
    );
};

const ReminderSettingsPanel = ({ onClose }: { onClose: () => void }) => {
    const queryClient = useQueryClient();
    const [current, setCurrent] = useState<Intensity>('MODERATE');

    useEffect(() => {
        api.get('/notifications/preferences')
            .then(r => { if (r.data?.reminderIntensity) setCurrent(r.data.reminderIntensity); })
            .catch(() => {});
    }, []);

    const mutation = useMutation({
        mutationFn: (intensity: Intensity) =>
            api.patch('/notifications/preferences', { reminderIntensity: intensity }),
        onSuccess: (_, intensity) => {
            setCurrent(intensity);
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
            toast.success('Reminder diperbarui');
        },
        onError: () => toast.error('Gagal menyimpan'),
    });

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-slate-100 dark:border-slate-800"
        >
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Settings2 className="w-3.5 h-3.5" />
                        Reminder Otomatis
                    </p>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {INTENSITIES.map(({ value, label, interval }) => {
                        const active = current === value;
                        return (
                            <button
                                key={value}
                                onClick={() => mutation.mutate(value)}
                                disabled={mutation.isPending}
                                className={`py-2 px-1 rounded-xl text-center transition-all border ${
                                    active
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/40 hover:text-primary'
                                }`}
                            >
                                <div className="text-[11px] font-semibold">{label}</div>
                                <div className={`text-[10px] mt-0.5 ${active ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {interval}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export const ActionCommandCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { items, activeItems, counts, isLoading, isFetching, refetch } = useActionItems();
    useReminderEngine();
    const navigate = useNavigate();

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

    const grouped = {
        CRITICAL: items.filter(i => i.urgency === 'CRITICAL'),
        HIGH: items.filter(i => i.urgency === 'HIGH'),
        NORMAL: items.filter(i => i.urgency === 'NORMAL'),
    };

    const activeCritical = activeItems.filter(i => i.urgency === 'CRITICAL').length;
    const activeHigh = activeItems.filter(i => i.urgency === 'HIGH').length;
    const hasCritical = activeCritical > 0;
    const hasHigh = activeHigh > 0;
    const activeTotal = activeItems.length;

    return (
        <div className="relative">
            {/* Trigger */}
            <button
                onClick={() => { setIsOpen(!isOpen); setShowSettings(false); }}
                className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                aria-label="Action Command Center"
            >
                <ListChecks className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />

                {/* Badge */}
                {activeTotal > 0 && (
                    <span className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900 text-[10px] font-bold text-white ${
                        hasCritical ? 'bg-red-500' : hasHigh ? 'bg-amber-500' : 'bg-primary'
                    }`}>
                        {activeTotal > 9 ? '9+' : activeTotal}
                    </span>
                )}

                {/* Pulse ring for critical */}
                {hasCritical && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-400 opacity-40 animate-ping pointer-events-none" />
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                            className="absolute right-0 mt-2 w-[360px] sm:w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <ListChecks className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
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
                                                    {counts.high} tinggi
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
                                        title="Refresh"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => setShowSettings(!showSettings)}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            showSettings
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                        title="Pengaturan reminder"
                                    >
                                        <Settings2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Inline reminder settings */}
                            <AnimatePresence>
                                {showSettings && (
                                    <ReminderSettingsPanel onClose={() => setShowSettings(false)} />
                                )}
                            </AnimatePresence>

                            {/* Items list */}
                            <div className="max-h-[60vh] overflow-y-auto scrollbar-custom">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-10 gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-sm text-slate-400">Memuat...</span>
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="py-10 flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Semua selesai!</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tidak ada item yang perlu ditindaklanjuti</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Critical */}
                                        {grouped.CRITICAL.length > 0 && (
                                            <>
                                                <SectionLabel urgency="CRITICAL" count={grouped.CRITICAL.length} />
                                                {grouped.CRITICAL.map((item, i) => (
                                                    <ActionRow key={item.id} item={item} index={i} onClick={() => handleItemClick(item.link)} />
                                                ))}
                                            </>
                                        )}

                                        {/* High */}
                                        {grouped.HIGH.length > 0 && (
                                            <>
                                                {grouped.CRITICAL.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-800" />}
                                                <SectionLabel urgency="HIGH" count={grouped.HIGH.length} />
                                                {grouped.HIGH.map((item, i) => (
                                                    <ActionRow key={item.id} item={item} index={grouped.CRITICAL.length + i} onClick={() => handleItemClick(item.link)} />
                                                ))}
                                            </>
                                        )}

                                        {/* Normal */}
                                        {grouped.NORMAL.length > 0 && (
                                            <>
                                                {(grouped.CRITICAL.length > 0 || grouped.HIGH.length > 0) && (
                                                    <div className="h-px bg-slate-100 dark:bg-slate-800" />
                                                )}
                                                <SectionLabel urgency="NORMAL" count={grouped.NORMAL.length} />
                                                {grouped.NORMAL.map((item, i) => (
                                                    <ActionRow
                                                        key={item.id}
                                                        item={item}
                                                        index={grouped.CRITICAL.length + grouped.HIGH.length + i}
                                                        onClick={() => handleItemClick(item.link)}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {items.length > 0 ? `${counts.total} item · auto-resolve` : 'Diperbarui tiap 60 detik'}
                                </p>
                                <button
                                    onClick={() => { setIsOpen(false); navigate('/settings/notifications'); }}
                                    className="text-[11px] text-slate-400 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1"
                                >
                                    <Settings className="w-3 h-3" />
                                    Pengaturan lengkap
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
