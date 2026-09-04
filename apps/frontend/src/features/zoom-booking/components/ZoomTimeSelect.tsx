import { useState, useMemo, useRef, useEffect } from 'react';
import { Clock, ExternalLink, Video, ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface TimeSlotOption {
    time: string;
    isUnavailable?: boolean;
    bookingTitle?: string;
    joinUrl?: string;
    accountName?: string;
    bookedByName?: string;
    availableAccountsCount?: number;
    totalAccountsCount?: number;
    reason?: string;
    exceedsOperatingHours?: boolean;
}

export interface ZoomTimeSelectProps {
    value: string;
    onChange: (time: string) => void;
    options: TimeSlotOption[];
    placeholder?: string;
    label?: string;
    testId?: string;
    isLoading?: boolean;
    disableUnavailable?: boolean;
    align?: 'left' | 'right';
    dropdownClassName?: string;
    /** Called when the user clicks "Lihat detail" on the info card
     *  for an unavailable slot. Should open an info card / detail view. */
    onViewBookedTime?: (opt: TimeSlotOption) => void;
}

/**
 * Popover-based time picker. Unavailable options show the meeting title
 * inline (no auto-redirect). When the user picks an unavailable time,
 * an info card appears below the trigger with explicit Copy / Join /
 * View actions so the user is in control of opening the Zoom URL.
 */
export function ZoomTimeSelect({
    value,
    onChange,
    options,
    placeholder = 'Pilih waktu',
    label,
    testId = 'zoom-time-select',
    isLoading = false,
    disableUnavailable = false,
    align = 'left',
    dropdownClassName,
    onViewBookedTime,
}: ZoomTimeSelectProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
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

    useEffect(() => {
        setCopied(false);
    }, [value]);

    const selected = useMemo(() => options.find((o) => o.time === value), [options, value]);

    const copyJoinUrl = async (url: string) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const ta = document.createElement('textarea');
                ta.value = url;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopied(true);
            toast.success('Link Zoom disalin ke clipboard');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.error('Gagal menyalin link');
        }
    };

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
                onClick={() => setOpen((o) => !o)}
                data-testid={testId}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full h-9 px-3 flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition-colors"
            >
                <span className={cn('truncate', !value && 'text-slate-400 font-normal')}>
                    {isLoading ? 'Memuat ketersediaan jam...' : (value || placeholder)}
                </span>
                <ChevronDown
                    className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <ul
                    ref={listRef}
                    role="listbox"
                    data-testid={`${testId}-options`}
                    className={cn(
                        "absolute top-full z-50 mt-1 max-h-[270px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xl p-1 divide-y divide-slate-100 dark:divide-slate-800/60 backdrop-blur-sm max-w-[calc(100vw-2rem)]",
                        align === 'right' ? 'right-0' : 'left-0',
                        dropdownClassName || "w-full min-w-[280px] sm:min-w-[320px]"
                    )}
                >
                    {isLoading ? (
                        <li className="px-3 py-3 text-xs text-muted-foreground flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span>Memeriksa ketersediaan jam...</span>
                        </li>
                    ) : options.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-slate-500">Tidak ada waktu tersedia</li>
                    ) : (
                        options.map((opt) => {
                            const unavailable = !!opt.isUnavailable;
                            const isPast = unavailable && opt.reason === 'Waktu sudah terlewat';

                            const handleSelect = (e: React.MouseEvent) => {
                                if (unavailable && disableUnavailable) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toast.error(
                                        opt.exceedsOperatingHours
                                            ? `Jam ${opt.time} melebihi batas jam operasional sistem.`
                                            : `Jam ${opt.time} tidak tersedia (${opt.reason || 'seluruh akun Zoom sedang terpakai'}). Silakan pilih jam lain.`
                                    );
                                    return;
                                }
                                onChange(opt.time);
                                setOpen(false);
                            };

                            return (
                                <li
                                    key={opt.time}
                                    role="option"
                                    aria-selected={value === opt.time}
                                    aria-disabled={unavailable}
                                    onClick={handleSelect}
                                    data-testid={`${testId}-option-${opt.time}`}
                                    className={cn(
                                        'px-2.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors rounded-lg',
                                        isPast
                                            ? 'bg-slate-50/60 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none'
                                            : unavailable
                                                ? 'bg-rose-500/5 text-muted-foreground cursor-not-allowed select-none'
                                                : 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 text-foreground',
                                        value === opt.time && !unavailable && 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold',
                                        value === opt.time && unavailable && 'bg-slate-100 dark:bg-slate-800 font-bold',
                                    )}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className={cn(
                                                'font-mono shrink-0 text-xs',
                                                isPast
                                                    ? 'text-slate-400 dark:text-slate-500 line-through'
                                                    : unavailable
                                                        ? 'font-semibold text-rose-500/90 dark:text-rose-400/90 line-through'
                                                        : 'font-semibold text-foreground',
                                            )}
                                        >
                                            {opt.time}
                                        </span>
                                        {opt.bookingTitle && (
                                            <span
                                                className="text-xs text-muted-foreground truncate max-w-[140px]"
                                                title={opt.bookingTitle}
                                            >
                                                · {opt.bookingTitle}
                                            </span>
                                        )}
                                    </div>

                                    {unavailable ? (
                                        <div className="shrink-0 flex items-center gap-1">
                                            <span className={cn(
                                                "text-[10px] px-2 py-0.5 rounded-full border shadow-2xs",
                                                isPast
                                                    ? "font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                                    : opt.exceedsOperatingHours
                                                        ? "font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                                        : "font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                            )}>
                                                {isPast
                                                    ? 'Terlewat'
                                                    : opt.exceedsOperatingHours
                                                        ? 'Melebihi jam tutup'
                                                        : opt.totalAccountsCount
                                                            ? `Penuh (${opt.totalAccountsCount} akun)`
                                                            : 'Penuh'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="shrink-0 flex items-center gap-1">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                {opt.availableAccountsCount !== undefined
                                                    ? `Tersedia · ${opt.availableAccountsCount} akun`
                                                    : 'Tersedia'}
                                            </span>
                                        </div>
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}

            {/* Info card — only when the user picked an unavailable time
                and the dropdown is closed. No auto-redirect; user must
                explicitly choose Copy / Join / View. */}
            {selected?.isUnavailable && !open && (
                <div
                    data-testid={`${testId}-info-card`}
                    className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2.5 space-y-1.5"
                >
                    <div className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            Jam {selected.time} sudah terisi
                        </span>
                    </div>
                    {selected.bookingTitle && (
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {selected.bookingTitle}
                        </div>
                    )}
                    {selected.accountName && (
                        <div className="text-xs text-slate-500">
                            Akun: {selected.accountName}
                        </div>
                    )}
                    {selected.joinUrl ? (
                        <>
                            <code
                                data-testid={`${testId}-join-url`}
                                className="block text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded font-mono truncate"
                            >
                                {selected.joinUrl}
                            </code>
                            <div className="flex items-center gap-1.5 pt-1">
                                <button
                                    type="button"
                                    onClick={() => copyJoinUrl(selected.joinUrl!)}
                                    data-testid={`${testId}-copy`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
                                    {copied ? 'Tersalin' : 'Copy'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.open(selected.joinUrl, '_blank', 'noopener,noreferrer')}
                                    data-testid={`${testId}-join`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                    Join Zoom
                                </button>
                                {onViewBookedTime && (
                                    <button
                                        type="button"
                                        onClick={() => onViewBookedTime(selected)}
                                        data-testid={`${testId}-view`}
                                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
                                    >
                                        Lihat detail
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-xs text-slate-500 italic">
                            Link Zoom akan tersedia setelah meeting dibuat.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

