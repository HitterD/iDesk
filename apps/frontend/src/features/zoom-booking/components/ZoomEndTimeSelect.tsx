import { useState, useMemo, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface EndTimeOption {
    value: string;
    time: string;
    durationMinutes: number;
    label?: string;
    isUnavailable?: boolean;
    reason?: string;
    availableAccountsCount?: number;
    totalAccountsCount?: number;
    exceedsOperatingHours?: boolean;
}

export interface ZoomEndTimeSelectProps {
    value: string;
    onChange: (time: string) => void;
    options: EndTimeOption[];
    disabled?: boolean;
    placeholder?: string;
    label?: string;
    testId?: string;
    align?: 'left' | 'right';
    dropdownClassName?: string;
}

export function ZoomEndTimeSelect({
    value,
    onChange,
    options,
    disabled = false,
    placeholder = 'Pilih jam selesai',
    label,
    testId = 'zoom-end-time-select',
    align = 'right',
    dropdownClassName,
}: ZoomEndTimeSelectProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onClickOutside);
        document.addEventListener('keydown', onEsc);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            document.removeEventListener('keydown', onEsc);
        };
    }, [open]);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const targetEl =
            listRef.current.querySelector('[aria-selected="true"]') ||
            listRef.current.querySelector('[aria-disabled="false"]');
        if (targetEl && typeof (targetEl as HTMLElement).scrollIntoView === 'function') {
            (targetEl as HTMLElement).scrollIntoView({ block: 'nearest' });
        }
    }, [open]);

    const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

    const formatDurationText = (mins: number) => {
        if (mins < 60) return `${mins} menit`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
    };

    const displayText = useMemo(() => {
        if (disabled) return 'Pilih jam mulai dahulu';
        if (!value) return placeholder;
        if (selected) {
            return `${selected.value} (${formatDurationText(selected.durationMinutes)})`;
        }
        return value;
    }, [disabled, value, selected, placeholder]);

    return (
        <div className="relative space-y-1.5" ref={containerRef}>
            {label && (
                <label className="text-xs font-semibold inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {label}
                </label>
            )}

            <button
                type="button"
                role="combobox"
                aria-label={typeof label === 'string' ? label.replace('*', '').trim() : 'Jam Selesai'}
                onClick={() => {
                    if (!disabled) setOpen((o) => !o);
                }}
                disabled={disabled}
                data-testid={testId}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={cn(
                    "w-full h-9 px-3 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition-colors",
                    disabled && "cursor-not-allowed opacity-50 hover:bg-white dark:hover:bg-slate-900"
                )}
            >
                <span className={cn('truncate', (!value || disabled) && 'text-slate-400 font-normal')}>
                    {displayText}
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0',
                        open && 'rotate-180'
                    )}
                    aria-hidden="true"
                />
            </button>

            {open && !disabled && (
                <ul
                    ref={listRef}
                    role="listbox"
                    data-testid={`${testId}-options`}
                    className={cn(
                        "absolute top-full z-50 mt-1 max-h-[270px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xl p-1 divide-y divide-slate-100 dark:divide-slate-800/60 backdrop-blur-sm max-w-[calc(100vw-2rem)]",
                        align === 'left' ? 'left-0' : 'right-0',
                        dropdownClassName || "w-full min-w-[260px] sm:min-w-[300px]"
                    )}
                >
                    {options.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-slate-500">Tidak ada jam selesai tersedia</li>
                    ) : (
                        options.map((opt) => {
                            const unavailable = !!opt.isUnavailable;

                            const handleSelect = (e: React.MouseEvent) => {
                                if (unavailable) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toast.error(
                                        opt.exceedsOperatingHours
                                            ? `Jam selesai ${opt.value} melebihi batas jam operasional sistem.`
                                            : `Jam selesai ${opt.value} tidak tersedia (${opt.reason || 'seluruh akun Zoom penuh'}). Silakan pilih jam lain.`
                                    );
                                    return;
                                }
                                onChange(opt.value);
                                setOpen(false);
                            };

                            return (
                                <li
                                    key={opt.value}
                                    role="option"
                                    aria-selected={value === opt.value}
                                    aria-disabled={unavailable}
                                    onClick={handleSelect}
                                    data-testid={`${testId}-option-${opt.value}`}
                                    className={cn(
                                        'px-2.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors rounded-lg',
                                        unavailable
                                            ? 'bg-rose-500/5 text-muted-foreground cursor-not-allowed select-none'
                                            : 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-foreground',
                                        value === opt.value && !unavailable && 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold',
                                        value === opt.value && unavailable && 'bg-slate-100 dark:bg-slate-800 font-bold',
                                    )}
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            className={cn(
                                                'font-mono shrink-0 text-xs',
                                                unavailable
                                                    ? 'font-semibold text-rose-500/90 dark:text-rose-400/90 line-through'
                                                    : 'font-semibold text-foreground'
                                            )}
                                        >
                                            {opt.value}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-xs truncate',
                                                unavailable
                                                    ? 'text-rose-400/70 dark:text-rose-400/60 line-through'
                                                    : 'text-muted-foreground'
                                            )}
                                        >
                                            ({formatDurationText(opt.durationMinutes)})
                                        </span>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1">
                                        {unavailable ? (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs">
                                                {opt.reason || 'Penuh'}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                Tersedia
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
