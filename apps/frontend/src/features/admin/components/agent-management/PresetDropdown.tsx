import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ChevronDown, CheckCircle, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/types/admin.types';
import { getFilteredPresetsByRole } from '../EditUserDialog';
import { PermissionPreset } from './agent-types';
import { PRESET_COLORS } from './agent-utils';

/** Height the dropdown is laid out for; used to decide whether it opens up or down. */
const DROPDOWN_H = 280;
const DROPDOWN_W = 210;
/** Keeps the panel off the very edge of the viewport when it has to flip or clamp. */
const VIEWPORT_MARGIN = 8;

export const PresetDropdown: React.FC<{
    user: User;
    presets: PermissionPreset[];
    onApplyPreset: (userId: string, presetId: string, presetName: string) => void;
    isApplying?: boolean;
    onManagePresets?: () => void;
    bulkCount?: number;
}> = ({ user, presets, onApplyPreset, isApplying, onManagePresets, bulkCount = 0 }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const badgeRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    // Filtering ran twice per render (length check + map); once is enough.
    const availablePresets = useMemo(
        () => getFilteredPresetsByRole(user.role, presets),
        [user.role, presets]
    );
    // Find color for current preset
    const currentPresetIdx = presets.findIndex(p => p.id === user.appliedPresetId);
    const currentColor = currentPresetIdx >= 0 ? PRESET_COLORS[currentPresetIdx % PRESET_COLORS.length] : null;
    const currentPresetName = user.appliedPresetName || (currentPresetIdx >= 0 ? presets[currentPresetIdx].name : null);

    const handleOpen = () => {
        if (!open && badgeRef.current) {
            const rect = badgeRef.current.getBoundingClientRect();
            const scrollTop = window.scrollY ?? document.documentElement.scrollTop;
            const scrollLeft = window.scrollX ?? document.documentElement.scrollLeft;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow >= DROPDOWN_H
                ? rect.bottom + scrollTop + 6
                : rect.top + scrollTop - DROPDOWN_H - 6;
            // The badge sits in the rightmost table column, so an unclamped left
            // pushed the panel past the viewport edge and cut off the preset names.
            const maxLeft = window.innerWidth - DROPDOWN_W - VIEWPORT_MARGIN;
            const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)) + scrollLeft;
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

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                close();
                badgeRef.current?.focus();
            }
        };

        // The panel is portaled to the end of <body>, so Tab from the badge lands on
        // the next table cell instead of the options. Move focus in explicitly.
        dropdownRef.current?.querySelector<HTMLElement>('button')?.focus();

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', close);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', close);
            window.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    return (
        <div className="relative">
            {isApplying ? (
                <div role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-xs border border-violet-200 dark:border-violet-800/50">
                    <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin motion-reduce:animate-none flex-shrink-0" aria-hidden="true" />
                    <span className="text-violet-700 dark:text-violet-300 font-medium">Applying…</span>
                </div>
            ) : (
                <button
                    ref={badgeRef}
                    type="button"
                    onClick={handleOpen}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={currentPresetName
                        ? `Permission preset for ${user.fullName}: ${currentPresetName}`
                        : `Assign a permission preset to ${user.fullName}`}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] rounded-lg text-xs font-semibold cursor-pointer select-none",
                        "transition-colors duration-150 btn-feedback",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        "ring-1",
                        currentColor
                            ? `${currentColor.bg} ${currentColor.text} ${currentColor.ring} hover:brightness-95`
                            : "bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    )}
                    title={currentPresetName ? `Preset: ${currentPresetName}` : 'No preset assigned'}
                >
                    {currentColor
                        ? <span className={cn("w-2 h-2 rounded-full flex-shrink-0", currentColor.dot)} aria-hidden="true" />
                        : <Sparkles className="w-3 h-3 flex-shrink-0 opacity-50 text-amber-500" aria-hidden="true" />
                    }
                    <span className="max-w-[100px] truncate leading-none">
                        {currentPresetName || 'No Preset'}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 flex-shrink-0 opacity-60 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
                </button>
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
                                <Sparkles className="w-3 h-3 text-white" aria-hidden="true" />
                            </div>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                {bulkCount > 1 ? `Assign Preset to ${bulkCount} Users` : 'Assign Preset'}
                            </p>
                        </div>

                        <div className="py-1.5 max-h-56 overflow-y-auto" role="listbox" aria-label="Permission presets">
                            {availablePresets.length === 0 ? (
                                <div className="px-4 py-5 flex flex-col items-center gap-1.5 text-center">
                                    <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
                                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">No presets available</p>
                                </div>
                            ) : (
                                availablePresets.map((preset, idx) => {
                                    const color = PRESET_COLORS[idx % PRESET_COLORS.length];
                                    const isActive = user.appliedPresetId === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive}
                                            onClick={() => {
                                                onApplyPreset(user.id, preset.id, preset.name);
                                                setOpen(false);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3.5 py-2 min-h-[44px] text-sm transition-colors duration-150 flex items-center justify-between gap-2 btn-feedback",
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
                                                )} aria-hidden="true" />
                                                <span className="truncate font-medium">{preset.name}</span>
                                                {preset.isDefault && (
                                                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 leading-none flex-shrink-0">
                                                        default
                                                    </span>
                                                )}
                                            </span>
                                            {isActive && (
                                                <CheckCircle className={cn("w-3.5 h-3.5 flex-shrink-0", color.text)} aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {user.appliedPresetId && (
                            <div className="px-3.5 py-2 border-t border-white/10 dark:border-slate-700/60">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onApplyPreset(user.id, '', '');
                                        setOpen(false);
                                    }}
                                    aria-label={`Remove permission preset from ${user.fullName}`}
                                    className="w-full text-left text-xs min-h-[44px] text-slate-400 hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400 transition-colors flex items-center gap-1.5 py-0.5"
                                >
                                    <X className="w-3 h-3" aria-hidden="true" />
                                    Remove preset
                                </button>
                            </div>
                        )}

                        {onManagePresets && (
                            <div className="px-3.5 py-2 border-t border-white/10 dark:border-slate-700/60">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        onManagePresets();
                                    }}
                                    className="w-full text-left text-xs min-h-[44px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center gap-1.5 py-0.5"
                                >
                                    <Settings className="w-3 h-3" aria-hidden="true" />
                                    Manage presets
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
