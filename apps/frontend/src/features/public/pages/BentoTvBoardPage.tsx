import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CircleDot, Inbox, Volume2, VolumeX } from 'lucide-react';
import api from '@/lib/api';
import { useColumnAutoScroll } from '../hooks/useColumnAutoScroll';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';
import { detectBoardSoundDetails, type BoardSnapshot } from '../hooks/detectBoardSounds';
import { shouldPlayClosing, toDateKey } from '../hooks/shouldPlayClosing';
import { useRingtone } from '../hooks/useRingtone';
import { APPLE_RED, TvBoardTicketRow } from '../components/TvBoardCard';
import { sortByUrgency } from '../utils/tvBoardTime';
import { DIVISION_CONFIGS, DIVISION_ORDER, resolveCardDivision, type DivisionKey } from '../utils/tvBoardDivisions';
import { cn } from '@/lib/utils';

/**
 * The whole board is sized in rem, so scaling the root font size with the viewport keeps
 * the same layout legible from a 1080p 44" TV up to a 4K 75" panel. vh guards ultra-wide screens.
 */
const TV_ROOT_FONT_SIZE = 'clamp(14px, min(0.95vw, 1.7vh), 40px)';
const TV_BACKGROUND = '#F5F5F7';
const PILL = 'rounded-full bg-white px-4 py-1.5 text-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)]';

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
}: {
    items: TvBoardCard[];
    now: Date;
    ColumnIcon: React.ElementType;
    emptyMessage: string;
}) {
    const sorted = useMemo(() => sortByUrgency(items), [items]);
    const scrollRef = useColumnAutoScroll<HTMLDivElement>(items);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)]">
            {sorted.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[#86868B]">
                    <ColumnIcon className="h-12 w-12" aria-hidden="true" />
                    <p className="text-xl font-medium">{emptyMessage}</p>
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <ul className="divide-y divide-[#E8E8ED]">
                        {sorted.map((card) => <TvBoardTicketRow key={card.id} card={card} now={now} />)}
                    </ul>
                </div>
            )}
        </div>
    );
}

function LiveStatus({ isOffline }: { isOffline: boolean }) {
    return isOffline ? (
        <span
            data-testid="tv-board-status-reconnecting"
            className="flex items-center gap-2 text-lg font-semibold text-[#FF9500]"
            title="Koneksi terganggu, mencoba menghubungkan kembali secara otomatis"
        >
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#FF9500]" />
            Menghubungkan kembali...
        </span>
    ) : (
        <span data-testid="tv-board-status-live" className="flex items-center gap-2 text-lg font-semibold text-[#248A3D]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#34C759]" />
            Live
        </span>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    useTvRootFontSize();
    const [initialData, setInitialData] = useState<TvBoardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [now, setNow] = useState(new Date());
    const { boardData: liveData, isConnected } = useTvBoardSocket(token);
    const { enqueue, blocked, unlockAudio, playTestSound } = useRingtone();
    const prevSnapshotRef = useRef<BoardSnapshot | null>(null);
    const lastClosingDateRef = useRef<string | null>(null);
    const hasEverLoadedRef = useRef(false);
    const disconnectedSinceRef = useRef<number | null>(null);

    const isOffline = !isConnected || isReconnecting;

    useEffect(() => {
        if (!isOffline) {
            disconnectedSinceRef.current = null;
        } else if (!disconnectedSinceRef.current) {
            disconnectedSinceRef.current = Date.now();
        }
    }, [isOffline]);

    useEffect(() => {
        if (!token) {
            setError('Link tidak valid, hubungi admin.');
            return;
        }

        const fetchBoardData = () => {
            api.get(`/tv/board/${token}`, { skipToast: true })
                .then((res) => {
                    hasEverLoadedRef.current = true;
                    setInitialData(res.data);
                    setIsReconnecting(false);
                    setError(null);
                    disconnectedSinceRef.current = null;
                })
                .catch((err) => {
                    const status = err?.response?.status;
                    // Only show fatal "Link tidak valid" if 404 AND we have never loaded board data before
                    if (status === 404 && !hasEverLoadedRef.current) {
                        setError('Link tidak valid, hubungi admin.');
                    } else {
                        // Keep existing board data on screen; do not crash UI during network blips
                        setIsReconnecting(true);
                        if (!disconnectedSinceRef.current) {
                            disconnectedSinceRef.current = Date.now();
                        }
                    }
                });
        };

        fetchBoardData();

        const pollIntervalMs = isConnected ? 30000 : 15000;
        const interval = setInterval(fetchBoardData, pollIntervalMs);

        return () => clearInterval(interval);
    }, [token, isConnected]);

    useEffect(() => {
        if (liveData) {
            hasEverLoadedRef.current = true;
            setIsReconnecting(false);
            setError(null);
            disconnectedSinceRef.current = null;
        }
    }, [liveData]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());

            // 15-minute fail-safe watchdog: reload page if disconnected continuously for > 15 minutes
            if (disconnectedSinceRef.current) {
                const elapsedMs = Date.now() - disconnectedSinceRef.current;
                if (elapsedMs > 15 * 60 * 1000) {
                    window.location.reload();
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!isConnected) {
            prevSnapshotRef.current = null;
        }
    }, [isConnected]);

    const board = liveData ?? initialData;

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

        const soundUrls: string[] = [];
        for (const ev of events) {
            if (ev.event === 'inProgress') {
                soundUrls.push(board.ringtones.inProgress || '/sounds/default/assigned.mp3');
            } else if (ev.division === 'ORACLE_DEV') {
                soundUrls.push(
                    board.ringtones.newTicketOracle ||
                    board.ringtones.newTicket ||
                    '/sounds/divisions/new-ticket-oracle.mp3'
                );
            } else if (ev.division === 'WEB_DEV') {
                soundUrls.push(
                    board.ringtones.newTicketWebDev ||
                    board.ringtones.newTicket ||
                    '/sounds/divisions/new-ticket-web-dev.mp3'
                );
            } else if (ev.division === 'MOBILE_DEV') {
                soundUrls.push(
                    board.ringtones.newTicketMobileDev ||
                    board.ringtones.newTicket ||
                    '/sounds/divisions/new-ticket-mobile-dev.mp3'
                );
            } else {
                // OPS_SUPPORT
                soundUrls.push(
                    board.ringtones.newTicketSupport ||
                    board.ringtones.newTicket ||
                    '/sounds/divisions/new-ticket-it-support.mp3'
                );
            }
        }

        if (soundUrls.length > 0) {
            enqueue(soundUrls);
        }
    }, [board, enqueue]);

    useEffect(() => {
        if (!board) return;
        if (!shouldPlayClosing(now, board.ringtones.closingTime, lastClosingDateRef.current)) return;

        lastClosingDateRef.current = toDateKey(now);
        enqueue([board.ringtones.closing || '/sounds/default/new-ticket.mp3']);
    }, [board, now, enqueue]);

    const data = board;

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
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: TV_BACKGROUND }}>
                <AlertTriangle className="mb-4 h-16 w-16" style={{ color: APPLE_RED }} />
                <h2 className="text-3xl font-semibold text-[#1D1D1F]">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center gap-5 text-[#6E6E73]" style={{ backgroundColor: TV_BACKGROUND }}>
                <img src="/idesk-logo.png" alt="iDesk" className="h-12 w-auto object-contain" />
                <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#007AFF] border-t-transparent" />
                <p className="text-lg font-medium">
                    {isOffline ? 'Menghubungkan ke TV Monitoring Board...' : 'Memuat TV Monitoring Board...'}
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
            className="relative h-[100dvh] overflow-hidden select-none px-8 py-6 font-sans text-[#1D1D1F] antialiased"
            style={{ backgroundColor: TV_BACKGROUND }}
        >
            <div className="mx-auto flex h-full max-w-[160rem] flex-col gap-5">
                {/* Top bar: site | clock */}
                <header className="flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-5">
                        <img src="/idesk-logo.png" alt="iDesk Logo" className="h-12 w-auto shrink-0 object-contain" />
                        <span className="h-10 w-px shrink-0 bg-black/10" aria-hidden="true" />
                        <div className="min-w-0">
                            <div className="flex items-baseline gap-3">
                                <h1 className="truncate text-4xl font-bold tracking-tight">{data.siteName}</h1>
                                {data.siteCode && <span className="text-xl font-semibold text-[#86868B]">{data.siteCode}</span>}
                            </div>
                            <div className="mt-0.5 flex items-center gap-4 text-lg text-[#6E6E73]">
                                <span>TV Monitoring Board</span>
                                <LiveStatus isOffline={isOffline} />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-6xl font-semibold leading-none tracking-tight tabular-nums">{formattedTime}</div>
                        <div className="mt-1.5 text-lg capitalize text-[#6E6E73]">{formattedDate}</div>
                    </div>
                </header>

                {/* Summary strip: division counts | vendor, overdue, audio */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#1D1D1F] px-4 py-1.5 text-lg font-semibold text-white">
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
                                    <span className="text-[#6E6E73]">{config.shortLabel}</span>
                                    <span className="font-semibold tabular-nums">{count}</span>
                                </span>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(PILL, 'font-medium tabular-nums text-[#6E6E73]')}>
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
                        {blocked ? (
                            <button
                                type="button"
                                data-testid="tv-board-audio-blocked"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playTestSound();
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
                                className={cn('flex cursor-pointer items-center gap-2 text-[#6E6E73] transition-colors hover:text-[#1D1D1F]', PILL)}
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
                                        <p className="text-lg text-[#86868B]">{column.subtitle}</p>
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
                                />
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BentoTvBoardPage;
