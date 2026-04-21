import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ChevronDown, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/types/admin.types';
import { PermissionPreset } from './agent-types';
import { PRESET_COLORS } from './agent-utils';

export const PresetDropdown: React.FC<{
    user: User;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    isApplying?: boolean;
}> = ({ user, presets, onApplyPreset, isApplying }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const badgeRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const currentPresetName = user.appliedPresetName;

    // Find color for current preset
    const currentPresetIdx = presets.findIndex(p => p.id === user.appliedPresetId);
    const currentColor = currentPresetIdx >= 0 ? PRESET_COLORS[currentPresetIdx % PRESET_COLORS.length] : null;

    const handleOpen = () => {
        if (!open && badgeRef.current) {
            const rect = badgeRef.current.getBoundingClientRect();
            const DROPDOWN_H = 280;
            const scrollTop = window.scrollY ?? document.documentElement.scrollTop;
            const scrollLeft = window.scrollX ?? document.documentElement.scrollLeft;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow >= DROPDOWN_H
                ? rect.bottom + scrollTop + 6
                : rect.top + scrollTop - DROPDOWN_H - 6;
            const left = rect.left + scrollLeft;
            setPos({ top, left });
        }
        setOpen(prev => !prev);
    };

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);

        const handleScroll = (e: Event) => {
            if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
                return;
            }
            close();
        };

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    return (
        <div className="relative">
            {isApplying ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-xs border border-violet-200 dark:border-violet-800/50">
                    <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin flex-shrink-0" />
                    <span className="text-violet-700 dark:text-violet-300 font-medium">Applying…</span>
                </div>
            ) : (
                <div
                    ref={badgeRef}
                    onClick={handleOpen}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none",
                        "transition-colors duration-150 btn-feedback",
                        "ring-1",
                        currentColor
                            ? `${currentColor.bg} ${currentColor.text} ${currentColor.ring} hover:brightness-95`
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                    title={currentPresetName ? `Preset: ${currentPresetName}` : 'No preset assigned'}
                >
                    {currentColor
                        ? <span className={cn("w-2 h-2 rounded-full flex-shrink-0", currentColor.dot)} />
                        : <Sparkles className="w-3 h-3 flex-shrink-0 opacity-50" />
                    }
                    <span className="max-w-[100px] truncate leading-none">
                        {currentPresetName || 'No Preset'}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 flex-shrink-0 opacity-60 transition-transform duration-200", open && "rotate-180")} />
                </div>
            )}

            {open && !isApplying && pos && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
                    <div
                        ref={dropdownRef}
                        className="absolute z-[9999] min-w-[210px] overflow-hidden rounded-2xl"
                        style={{
                            top: pos.top,
                            left: pos.left,
                            background: 'var(--glass-bg-elevated)',
                            backdropFilter: 'var(--glass-blur-elevated)',
                            WebkitBackdropFilter: 'var(--glass-blur-elevated)',
                            border: '1px solid var(--glass-border)',
                            boxShadow: 'var(--glass-shadow-heavy)',
                            animation: 'slideFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                        }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-white/10 dark:border-slate-700/60">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm">
                                <Sparkles className="w-3 h-3 text-white" />
                            </div>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                Assign Preset
                            </p>
                        </div>

                        <div className="py-1.5 max-h-56 overflow-y-auto">
                            {presets.length === 0 ? (
                                <div className="px-4 py-5 flex flex-col items-center gap-1.5 text-center">
                                    <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">No presets available</p>
                                </div>
                            ) : (
                                presets.map((preset, idx) => {
                                    const color = PRESET_COLORS[idx % PRESET_COLORS.length];
                                    const isActive = user.appliedPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => {
                                                onApplyPreset(user.id, preset.id, preset.name);
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3.5 py-2 text-sm transition-colors duration-150 flex items-center justify-between gap-2 btn-feedback",
                                                isActive
                                                    ? `${color.bg} ${color.text}`
                                                    : `text-slate-700 dark:text-slate-300 ${color.hover}`
                                            )}
                                        >
                                            <span className="flex items-center gap-2.5 min-w-0">
                                                <span className={cn(
                                                    "w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform",
                                                    color.dot,
                                                    isActive && "ring-2 ring-offset-1 ring-current scale-110"
                                                )} />
                                                <span className="truncate font-medium">{preset.name}</span>
                                                {preset.isDefault && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 leading-none flex-shrink-0">
                                                        default
                                                    </span>
                                                )}
                                            </span>
                                            {isActive && (
                                                <CheckCircle className={cn("w-3.5 h-3.5 flex-shrink-0", color.text)} />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {user.appliedPresetId && (
                            <div className="px-3.5 py-2 border-t border-white/10 dark:border-slate-700/60">
                                <button
                                    onClick={() => {
                                        onApplyPreset(user.id, '', '');
                                        setOpen(false);
                                    }}
                                    className="w-full text-left text-xs text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1.5 py-0.5"
                                >
                                    <X className="w-3 h-3" />
                                    Remove preset
                                </button>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
