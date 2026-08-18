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
}

export interface ZoomTimeSelectProps {
    value: string;
    onChange: (time: string) => void;
    options: TimeSlotOption[];
    placeholder?: string;
    label?: string;
    testId?: string;
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
    onViewBookedTime,
}: ZoomTimeSelectProps) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

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
        <div className="space-y-1.5" ref={containerRef}>
            {label && (
                <label className="text-xs font-semibold inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                </label>
            )}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                data-testid={testId}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <span className={cn('truncate', !value && 'text-slate-400')}>
                    {value || placeholder}
                </span>
                <ChevronDown
                    className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <ul
                    role="listbox"
                    data-testid={`${testId}-options`}
                    className="relative z-50 mt-1 max-h-[260px] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg"
                >
                    {options.length === 0 && (
                        <li className="px-3 py-2 text-xs text-slate-500">Tidak ada waktu tersedia</li>
                    )}
                    {options.map((opt) => {
                        const unavailable = !!opt.isUnavailable;
                        const handleSelect = () => {
                            if (unavailable) {
                                onChange(opt.time);
                                setOpen(false);
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
                                    'px-3 py-1.5 text-sm flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0',
                                    unavailable
                                        ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 cursor-not-allowed'
                                        : 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30',
                                    value === opt.time && !unavailable && 'bg-blue-50 dark:bg-blue-950/30',
                                )}
                            >
                                <span
                                    className={cn(
                                        'font-mono shrink-0',
                                        unavailable && 'line-through text-red-400',
                                    )}
                                >
                                    {opt.time}
                                </span>
                                {unavailable ? (
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                        <span className="text-xs text-red-400 shrink-0">Terpakai</span>
                                        {opt.bookingTitle && (
                                            <span
                                                className="text-xs text-slate-500 truncate"
                                                title={opt.bookingTitle}
                                            >
                                                · {opt.bookingTitle}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="ml-auto text-xs text-slate-400">Tersedia</span>
                                )}
                            </li>
                        );
                    })}
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

