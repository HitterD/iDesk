import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { ActionItem, SnoozeDuration } from './types/action-item.types';
import { useSnoozeActionItem } from '../../features/notifications/hooks/useSnoozeActionItem';
import { ENTITY_CONFIG, URGENCY_CONFIG, SNOOZE_OPTIONS } from './constants/action-item.constants';

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m} mnt lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.floor(h / 24)} hr lalu`;
}

interface ActionRowProps {
    item: ActionItem;
    onClick: () => void;
    index: number;
}

export const ActionRow: React.FC<ActionRowProps> = ({ item, onClick, index }) => {
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
        ? `Ditunda s/d ${new Date(item.snoozeUntil).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
        : null;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: index * 0.02, duration: 0.15 }}
            onClick={onClick}
            className={`group relative px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex items-start gap-3 ${
                item.isSnoozed ? 'opacity-60' : ''
            }`}
        >
            {/* Entity Icon (Neutral Slate) */}
            <div className="mt-0.5 text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                {entityCfg.icon}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                {/* Meta Header: Category, Urgency Indicator, Time */}
                <div className="flex items-center gap-1.5 text-[11px] leading-none">
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                        {entityCfg.label}
                    </span>

                    {item.urgency !== 'NORMAL' && (
                        <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className={`inline-flex items-center gap-1 font-medium ${urgencyCfg.textColor}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${urgencyCfg.dot}`} />
                                {urgencyCfg.label}
                            </span>
                        </>
                    )}

                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-slate-400 dark:text-slate-500">
                        {timeAgo(item.createdAt)}
                    </span>
                </div>

                {/* Title */}
                <h4 className="text-[13px] font-medium text-slate-900 dark:text-slate-100 leading-snug truncate mt-1 group-hover:text-primary transition-colors">
                    {item.title}
                </h4>

                {/* Subtitle / Description */}
                {item.description && (
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {item.description}
                    </p>
                )}

                {/* Snooze Status Banner */}
                {item.isSnoozed && snoozeLabel && (
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
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

            {/* Quick Actions (Right-aligned) */}
            <div
                className="flex items-center gap-1 shrink-0 self-center"
                onClick={e => e.stopPropagation()}
            >
                {/* Snooze Button */}
                {!item.isSnoozed && (
                    <div className="relative">
                        <button
                            onClick={() => setShowSnoozeMenu(v => !v)}
                            disabled={isSnoozing}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Tunda reminder"
                            aria-label="Tunda reminder"
                        >
                            <Clock className="w-3.5 h-3.5" />
                        </button>

                        {showSnoozeMenu && (
                            <div className="absolute right-0 top-8 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 w-32 animate-in fade-in zoom-in-95">
                                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/80 mb-0.5">
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

                {/* Direct Action Button */}
                <button
                    onClick={onClick}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white transition-colors"
                >
                    {item.entityType === 'ZOOM' ? 'Join' : 'Buka'}
                </button>
            </div>
        </motion.div>
    );
};
