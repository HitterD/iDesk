import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from '@/types/admin.types';
import { ROLE_CONFIG, ROLE_ORDER, getRoleConfig, getRoleLabel } from './agent-types';

const DROPDOWN_H = 320;
const DROPDOWN_W = 220;
const VIEWPORT_MARGIN = 8;

export interface RoleDropdownProps {
    user: User;
    onApplyRole: (userId: string, role: string) => void;
    isApplying?: boolean;
    bulkCount?: number;
}

export const RoleDropdown: React.FC<RoleDropdownProps> = ({
    user,
    onApplyRole,
    isApplying,
    bulkCount = 0,
}) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const badgeRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentRoleConfig = getRoleConfig(user.role);

    const handleOpen = () => {
        if (!open && badgeRef.current) {
            const rect = badgeRef.current.getBoundingClientRect();
            const scrollTop = window.scrollY ?? document.documentElement.scrollTop;
            const scrollLeft = window.scrollX ?? document.documentElement.scrollLeft;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow >= DROPDOWN_H
                ? rect.bottom + scrollTop + 6
                : rect.top + scrollTop - DROPDOWN_H - 6;
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

    const handleSelectRole = (roleKey: string) => {
        if (roleKey === user.role && bulkCount <= 1) {
            setOpen(false);
            return;
        }
        onApplyRole(user.id, roleKey);
        setOpen(false);
    };

    return (
        <div className="relative">
            {isApplying ? (
                <div role="status" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-xs border border-blue-200 dark:border-blue-800/50">
                    <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin motion-reduce:animate-none flex-shrink-0" aria-hidden="true" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Updating…</span>
                </div>
            ) : (
                <button
                    ref={badgeRef}
                    type="button"
                    onClick={handleOpen}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-label={`Role for ${user.fullName}: ${getRoleLabel(user.role)}`}
                    className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[44px] rounded-lg text-xs font-bold cursor-pointer select-none",
                        "transition-all duration-150 btn-feedback hover:brightness-95 hover:ring-2 hover:ring-primary/30",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        currentRoleConfig.badgeColor
                    )}
                    title={`Role: ${getRoleLabel(user.role)}`}
                >
                    <span className="max-w-[110px] truncate leading-none uppercase">
                        {getRoleLabel(user.role)}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 flex-shrink-0 opacity-70 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
                </button>
            )}

            {open && !isApplying && pos && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onMouseDown={() => setOpen(false)} />
                    <div
                        ref={dropdownRef}
                        className="absolute z-[9999] min-w-[220px] max-w-[280px] overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 text-slate-900 dark:text-white animate-in fade-in zoom-in-95 duration-150"
                        style={{
                            top: `${pos.top}px`,
                            left: `${pos.left}px`,
                        }}
                    >
                        {bulkCount > 1 && (
                            <div className="mb-1 px-2 py-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800/60 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                Ubah role untuk <b>{bulkCount} user</b> terpilih
                            </div>
                        )}

                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1">
                            PILIH ROLE USER
                        </div>

                        <div className="space-y-0.5 max-h-[260px] overflow-y-auto custom-scrollbar" role="listbox" aria-label="User roles">
                            {ROLE_ORDER.map((roleKey) => {
                                const isSelected = roleKey === user.role;
                                const conf = ROLE_CONFIG[roleKey];
                                const IconComp = conf.icon;

                                return (
                                    <button
                                        key={roleKey}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelectRole(roleKey)}
                                        className={cn(
                                            "w-full min-h-[44px] flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors text-left",
                                            isSelected
                                                ? "bg-slate-100 dark:bg-slate-800/80 font-bold"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={cn("p-1 rounded-lg shrink-0", conf.badgeColor)}>
                                                <IconComp className="w-3.5 h-3.5" aria-hidden="true" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                                                    {conf.label}
                                                </div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                                    {conf.description}
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-1" aria-hidden="true" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};
