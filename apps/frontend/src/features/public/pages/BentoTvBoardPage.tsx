import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CircleDot, Inbox, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import api from '@/lib/api';
import { useColumnAutoScroll } from '../hooks/useColumnAutoScroll';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData, type TvBoardRingtones } from '../hooks/useTvBoardSocket';
import { detectBoardSoundDetails, type BoardSnapshot, type DivisionSoundKey } from '../hooks/detectBoardSounds';
import { shouldPlayClosing, toDateKey } from '../hooks/shouldPlayClosing';
import { useRingtone, type RingtoneSound } from '../hooks/useRingtone';
import { APPLE_RED, TvBoardTicketRow } from '../components/TvBoardCard';
import { sortByUrgency } from '../utils/tvBoardTime';
import { DIVISION_CONFIGS, DIVISION_ORDER, resolveCardDivision, type DivisionKey } from '../utils/tvBoardDivisions';
import { readThemeOverride, TV_THEME_VARS, writeThemeOverride, type TvTheme } from '../utils/tvBoardTheme';
import { setSlaClockInfo } from '@/lib/slaCountdown';
import { cn } from '@/lib/utils';

/**
 * The whole board is sized in rem, so scaling the root font size with the viewport keeps
 * the same layout legible from a 1080p 44" TV up to a 4K 75" panel. vh guards ultra-wide screens.
 */
const TV_ROOT_FONT_SIZE = 'clamp(14px, min(0.95vw, 1.7vh), 40px)';
const PILL = 'rounded-full bg-[var(--tv-surface)] px-4 py-1.5 text-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)]';

const COLUMNS: Array<{
    key: 'open' | 'inProgress';
    title: string;
    subtitle: string;
    icon: React.ElementType;
    span: string;
    emptyMessage: string;
    accent: string;
}> = [
    {
        key: 'open',
        title: 'Open',
        subtitle: 'Antrean masuk',
        icon: Inbox,
        span: 'md:col-span-2',
        emptyMessage: 'Tidak ada tiket dalam antrean',
        accent: '#007AFF',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        subtitle: 'Sedang dikerjakan',
        icon: CircleDot,
        span: 'md:col-span-3',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
        accent: '#5AC8FA',
    },
];

const TV_ROOT_STYLE_ID = 'tv-board-root-font-size';

/** Scales rem for this page only; the style is removed when leaving the board. */
function useTvRootFontSize() {
    useEffect(() => {
        const style = document.createElement('style');
        style.id = TV_ROOT_STYLE_ID;
        style.textContent = `html { font-size: ${TV_ROOT_FONT_SIZE}; }`;
        document.head.appendChild(style);
        return () => style.remove();
    }, []);
}

function TvBoardColumnContent({
    items,
    now,
    ColumnIcon,
    emptyMessage,
    boardSiteCode,
}: {
    items: TvBoardCard[];
    now: Date;
    ColumnIcon: React.ElementType;
    emptyMessage: string;
    boardSiteCode?: string;
}) {
    const sorted = useMemo(() => sortByUrgency(items), [items]);
    const scrollRef = useColumnAutoScroll<HTMLDivElement>(items);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-[var(--tv-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
            {sorted.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--tv-text-tertiary)]">
                    <ColumnIcon className="h-12 w-12" aria-hidden="true" />
                    <p className="text-xl font-medium">{emptyMessage}</p>
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <ul className="divide-y divide-[var(--tv-divider)]">
                        {sorted.map((card) => <TvBoardTicketRow key={card.id} card={card} now={now} boardSiteCode={boardSiteCode} />)}
                    </ul>
                </div>
            )}
        </div>
    );
}

type ConnectionState = 'live' | 'polling' | 'offline';

/** Reload the page after the live connection has been down this long, as a last resort. */
const WATCHDOG_RELOAD_MS = 15 * 60 * 1000;
const POLL_INTERVAL_LIVE_MS = 30000;
const POLL_INTERVAL_FALLBACK_MS = 15000;
const INVALID_LINK_MESSAGE = 'Link tidak valid, hubungi admin.';

const DEFAULT_IN_PROGRESS_SOUND = '/sounds/default/assigned.mp3';
const DEFAULT_CLOSING_SOUND = '/sounds/default/new-ticket.mp3';
const DEFAULT_NEW_TICKET_SOUND: Record<DivisionSoundKey, string> = {
    OPS_SUPPORT: '/sounds/divisions/new-ticket-it-support.mp3',
    ORACLE_DEV: '/sounds/divisions/new-ticket-oracle.mp3',
    WEB_DEV: '/sounds/divisions/new-ticket-web-dev.mp3',
    MOBILE_DEV: '/sounds/divisions/new-ticket-mobile-dev.mp3',
};
const NEW_TICKET_RINGTONE_KEY: Record<DivisionSoundKey, keyof TvBoardRingtones> = {
    OPS_SUPPORT: 'newTicketSupport',
    ORACLE_DEV: 'newTicketOracle',
    WEB_DEV: 'newTicketWebDev',
    MOBILE_DEV: 'newTicketMobileDev',
};

/** Custom uploads can disappear (e.g. lost volume); the built-in sound covers that case. */
const withFallback = (custom: string | null | undefined, builtIn: string): RingtoneSound =>
    custom ? { src: custom, fallback: builtIn } : { src: builtIn };

function LiveStatus({ state }: { state: ConnectionState }) {
    if (state === 'offline') {
        return (
            <span
                data-testid="tv-board-status-reconnecting"
                className="flex items-center gap-2 text-lg font-semibold text-[#FF9500]"
                title="Koneksi terganggu, mencoba menghubungkan kembali secara otomatis"
            >
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#FF9500]" />
                Menghubungkan kembali...
            </span>
        );
    }
    return state === 'polling' ? (
        <span
            data-testid="tv-board-status-polling"
            className="flex items-center gap-2 text-lg font-semibold text-[var(--tv-text-secondary)]"
            title="Koneksi realtime terputus; data tetap diperbarui berkala sambil menyambung ulang"
        >
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--tv-text-tertiary)]" />
            Sinkron berkala
        </span>
    ) : (
        <span data-testid="tv-board-status-live" className="flex items-center gap-2 text-lg font-semibold text-[var(--tv-live)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#34C759]" />
            Live
        </span>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    useTvRootFontSize();
    // Latest board from either source; the socket and the REST poll both overwrite it.
    const [board, setBoard] = useState<TvBoardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPollFailing, setIsPollFailing] = useState(false);
    const [now, setNow] = useState(new Date());
    const { boardData: liveData, isConnected, isTokenInvalid } = useTvBoardSocket(token);
    const { enqueue, blocked, unlockAudio, playTestSound } = useRingtone();
    const prevSnapshotRef = useRef<BoardSnapshot | null>(null);
    const lastClosingDateRef = useRef<string | null>(null);
    const hasEverLoadedRef = useRef(false);
    const disconnectedSinceRef = useRef<number | null>(null);

    const connectionState: ConnectionState = isConnected ? 'live' : isPollFailing ? 'offline' : 'polling';

    // The watchdog tracks the live connection only: a working REST poll must not hide a dead socket forever.
    useEffect(() => {
        if (isConnected) {
            disconnectedSinceRef.current = null;
        } else if (!disconnectedSinceRef.current) {
            disconnectedSinceRef.current = Date.now();
        }
    }, [isConnected]);

    useEffect(() => {
        if (!token || isTokenInvalid) {
            setError(INVALID_LINK_MESSAGE);
            return;
        }

        const fetchBoardData = () => {
            api.get(`/tv/board/${token}`, { skipToast: true })
                .then((res) => {
                    hasEverLoadedRef.current = true;
                    setBoard(res.data);
                    setIsPollFailing(false);
                    setError(null);
                })
                .catch((err) => {
                    const status = err?.response?.status;
                    // Only show fatal "Link tidak valid" if 404 AND we have never loaded board data before
                    if (status === 404 && !hasEverLoadedRef.current) {
                        setError(INVALID_LINK_MESSAGE);
                    } else {
                        // Keep existing board data on screen; do not crash UI during network blips
                        setIsPollFailing(true);
                    }
                });
        };

        fetchBoardData();

        const pollIntervalMs = isConnected ? POLL_INTERVAL_LIVE_MS : POLL_INTERVAL_FALLBACK_MS;
        const interval = setInterval(fetchBoardData, pollIntervalMs);

        return () => clearInterval(interval);
    }, [token, isConnected, isTokenInvalid]);

    useEffect(() => {
        if (liveData) {
            hasEverLoadedRef.current = true;
            setBoard(liveData);
            setIsPollFailing(false);
            setError(null);
        }
    }, [liveData]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());

            if (disconnectedSinceRef.current && Date.now() - disconnectedSinceRef.current > WATCHDOG_RELOAD_MS) {
                window.location.reload();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!board) return;

        const snapshot: BoardSnapshot = {
            open: board.open.map((card) => ({
                id: card.id,
                division: resolveCardDivision(card),
            })),
            inProgress: board.inProgress.map((card) => card.id),
        };
        const events = detectBoardSoundDetails(prevSnapshotRef.current, snapshot);
        prevSnapshotRef.current = snapshot;

        const sounds = events.map((ev) =>
            ev.event === 'inProgress'
                ? withFallback(board.ringtones.inProgress, DEFAULT_IN_PROGRESS_SOUND)
                : withFallback(
                    board.ringtones[NEW_TICKET_RINGTONE_KEY[ev.division ?? 'OPS_SUPPORT']] || board.ringtones.newTicket,
                    DEFAULT_NEW_TICKET_SOUND[ev.division ?? 'OPS_SUPPORT'],
                ),
        );

        if (sounds.length > 0) {
            enqueue(sounds);
        }
    }, [board, enqueue]);

    useEffect(() => {
        if (!board) return;
        if (!shouldPlayClosing(now, board.ringtones.closingTime, lastClosingDateRef.current)) return;

        lastClosingDateRef.current = toDateKey(now);
        enqueue([withFallback(board.ringtones.closing, DEFAULT_CLOSING_SOUND)]);
    }, [board, now, enqueue]);

    const data = board;

    // Admin picks the board default; a screen can override it locally with the toggle.
    const [themeOverride, setThemeOverride] = useState<TvTheme | null>(() => readThemeOverride(token));
    const boardTheme: TvTheme = board?.theme ?? 'light';
    const theme: TvTheme = themeOverride ?? boardTheme;
    const themeStyle = { ...TV_THEME_VARS[theme], backgroundColor: 'var(--tv-bg)' };
    const toggleTheme = () => {
        const next: TvTheme = theme === 'dark' ? 'light' : 'dark';
        writeThemeOverride(token, next, boardTheme);
        setThemeOverride(next === boardTheme ? null : next);
    };

    // TV runs without a login; the board payload carries the working schedule.
    useEffect(() => setSlaClockInfo(board?.slaClock), [board?.slaClock]);

    // Division Counts for Read-Only Metrics in Header
    const divisionCounts = useMemo(() => {
        const counts: Record<DivisionKey | 'TOTAL', number> = { TOTAL: 0, OPS_SUPPORT: 0, ORACLE_DEV: 0, WEB_DEV: 0, MOBILE_DEV: 0 };
        if (!data) return counts;
        const allCards = [...data.open, ...data.inProgress];
        counts.TOTAL = allCards.length;
        allCards.forEach((card) => {
            counts[resolveCardDivision(card)] += 1;
        });
        return counts;
    }, [data]);

    if (error) {
        return (
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center p-6 text-center" style={themeStyle}>
                <AlertTriangle className="mb-4 h-16 w-16" style={{ color: APPLE_RED }} />
                <h2 className="text-3xl font-semibold text-[var(--tv-text)]">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center gap-5 text-[var(--tv-text-secondary)]" style={themeStyle}>
                <img src="/idesk-logo.png" alt="iDesk" className="h-12 w-auto object-contain" />
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#007AFF] border-t-transparent" />
                <p className="text-lg font-medium">
                    {isPollFailing ? 'Menghubungkan ke TV Monitoring Board...' : 'Memuat TV Monitoring Board...'}
                </p>
            </div>
        );
    }

    const overdueCount = [...data.open, ...data.inProgress].filter((card) => card.isOverdue).length;
    const formattedDate = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    return (
        <div
            onClick={unlockAudio}
            data-testid="tv-board-root"
            data-theme={theme}
            className="relative h-[100dvh] overflow-hidden select-none px-8 py-6 font-sans text-[var(--tv-text)] antialiased"
            style={themeStyle}
        >
            <div className="mx-auto flex h-full max-w-[160rem] flex-col gap-5">
                {/* Top bar: site | clock */}
                <header className="flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-5">
                        <img src="/idesk-logo.png" alt="iDesk Logo" className="h-12 w-auto shrink-0 object-contain" />
                        <span className="h-10 w-px shrink-0 bg-[var(--tv-hairline)]" aria-hidden="true" />
                        <div className="min-w-0">
                            <div className="flex items-baseline gap-3">
                                <h1 className="truncate text-4xl font-bold tracking-tight">{data.siteName}</h1>
                                {data.siteCode && <span className="text-xl font-semibold text-[var(--tv-text-tertiary)]">{data.siteCode}</span>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-4 text-lg text-[var(--tv-text-secondary)]">
                                <span>{data.showsDevTickets ? 'TV Monitoring Board · Hub Tim Dev semua site' : 'TV Monitoring Board'}</span>
                                <LiveStatus state={connectionState} />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-6xl font-semibold leading-none tracking-tight tabular-nums">{formattedTime}</div>
                        <div className="mt-1.5 text-lg capitalize text-[var(--tv-text-secondary)]">{formattedDate}</div>
                    </div>
                </header>

                {/* Summary strip: division counts | vendor, overdue, audio */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--tv-inverse-bg)] px-4 py-1.5 text-lg font-semibold text-[var(--tv-inverse-text)]">
                            Total <span className="ml-1 tabular-nums">{divisionCounts.TOTAL}</span>
                        </span>
                        {DIVISION_ORDER.map((key) => {
                            const config = DIVISION_CONFIGS[key];
                            const count = divisionCounts[key];
                            return (
                                <span
                                    key={key}
                                    className={cn('flex items-center gap-2', PILL, count === 0 && 'opacity-40')}
                                >
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: config.color }} aria-hidden="true" />
                                    <span className="text-[var(--tv-text-secondary)]">{config.shortLabel}</span>
                                    <span className="font-semibold tabular-nums">{count}</span>
                                </span>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(PILL, 'font-medium tabular-nums text-[var(--tv-text-secondary)]')}>
                            Waiting Vendor: {data.waitingVendorCount}
                        </span>
                        {overdueCount > 0 && (
                            <span
                                className="flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-semibold"
                                style={{ color: APPLE_RED, backgroundColor: `${APPLE_RED}1A` }}
                            >
                                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                                Overdue <span className="tabular-nums">{overdueCount}</span>
                            </span>
                        )}
                        <button
                            type="button"
                            data-testid="tv-board-theme-toggle"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleTheme();
                            }}
                            title={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                            aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                            className={cn('flex cursor-pointer items-center gap-2 text-[var(--tv-text-secondary)] transition-colors hover:text-[var(--tv-text)]', PILL)}
                        >
                            {theme === 'dark' ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
                            {theme === 'dark' ? 'Terang' : 'Gelap'}
                        </button>
                        {blocked ? (
                            <button
                                type="button"
                                data-testid="tv-board-audio-blocked"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    unlockAudio();
                                }}
                                title="Klik untuk mengaktifkan suara TV Board"
                                className="flex animate-pulse cursor-pointer items-center gap-2 rounded-full bg-[#FF9500] px-4 py-1.5 text-lg font-semibold text-white"
                            >
                                <VolumeX className="h-5 w-5" aria-hidden="true" />
                                Aktifkan Audio
                            </button>
                        ) : (
                            <button
                                type="button"
                                data-testid="tv-board-test-audio"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playTestSound();
                                }}
                                title="Klik untuk menguji suara speaker TV"
                                className={cn('flex cursor-pointer items-center gap-2 text-[var(--tv-text-secondary)] transition-colors hover:text-[var(--tv-text)]', PILL)}
                            >
                                <Volume2 className="h-5 w-5" aria-hidden="true" />
                                Test Suara
                            </button>
                        )}
                    </div>
                </div>

                {/* Columns */}
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-5">
                    {COLUMNS.map((column) => {
                        const ColumnIcon = column.icon;
                        const items = column.key === 'open' ? data.open : data.inProgress;

                        return (
                            <section key={column.key} className={cn('flex min-h-0 flex-col overflow-hidden', column.span)}>
                                <div className="mb-3 flex items-end justify-between gap-3 px-1">
                                    <div className="flex items-baseline gap-3">
                                        <h2 className="text-3xl font-bold tracking-tight">{column.title}</h2>
                                        <p className="text-lg text-[var(--tv-text-tertiary)]">{column.subtitle}</p>
                                    </div>
                                    <span className="text-5xl font-semibold leading-none tabular-nums" style={{ color: column.accent }}>
                                        {items.length}
                                    </span>
                                </div>
                                <TvBoardColumnContent
                                    items={items}
                                    now={now}
                                    ColumnIcon={ColumnIcon}
                                    emptyMessage={column.emptyMessage}
                                    boardSiteCode={data.siteCode}
                                />
                            </section>
                        );
                    })}
                </div>
            </div>

            {blocked && (
                <div
                    data-testid="tv-board-audio-banner"
                    className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"
                >
                    <span className="flex items-center gap-3 rounded-full bg-[var(--tv-inverse-bg)]/90 px-6 py-3 text-xl font-semibold text-[var(--tv-inverse-text)] shadow-lg">
                        <VolumeX className="h-6 w-6" aria-hidden="true" />
                        Suara diblokir browser. Klik di mana saja untuk mengaktifkan suara.
                    </span>
                </div>
            )}
        </div>
    );
};

export default BentoTvBoardPage;
