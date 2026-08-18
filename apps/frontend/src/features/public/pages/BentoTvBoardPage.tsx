import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Inbox, CircleDot, AlertTriangle, User, UserCheck, VolumeX } from 'lucide-react';
import api from '@/lib/api';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useColumnAutoScroll } from '../hooks/useColumnAutoScroll';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';
import { detectBoardSounds, type BoardSnapshot } from '../hooks/detectBoardSounds';
import { shouldPlayClosing, toDateKey } from '../hooks/shouldPlayClosing';
import { useRingtone } from '../hooks/useRingtone';

const COLUMNS: Array<{
    key: 'open' | 'inProgress';
    title: string;
    subtitle: string;
    icon: React.ElementType;
    span: string;
    emptyMessage: string;
    badgeBg: string;
    iconBg: string;
    topAccent: string;
}> = [
    {
        key: 'open',
        title: 'Open',
        subtitle: 'Antrean Masuk',
        icon: Inbox,
        span: 'md:col-span-2',
        emptyMessage: 'Tidak ada tiket dalam antrean Open',
        badgeBg: 'bg-slate-900 text-white',
        iconBg: 'bg-slate-100 text-slate-700',
        topAccent: 'border-t-2 border-slate-400',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        subtitle: 'Sedang Dikerjakan',
        icon: CircleDot,
        span: 'md:col-span-3',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
        badgeBg: 'bg-blue-600 text-white',
        iconBg: 'bg-blue-50 text-blue-700 border border-blue-200/60',
        topAccent: 'border-t-2 border-blue-600',
    },
];

// Refined, high-contrast monochrome avatar tones (Anti-AI color slop)
const AVATAR_TONES = [
    'bg-slate-800 text-white',
    'bg-zinc-800 text-white',
    'bg-slate-900 text-white',
    'bg-slate-700 text-white',
    'bg-zinc-700 text-white',
    'bg-slate-800 text-white',
];

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
        hash = (hash * 31 + name.charCodeAt(i)) % 2147483647;
    }
    return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function TvBoardCardView({ card }: { card: TvBoardCard }) {
    const priorityConfig = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConfig.icon;

    return (
        <div
            data-testid="tv-board-card"
            className={`relative mb-3.5 overflow-hidden rounded-xl bg-white p-4 md:p-5 border transition-all duration-200 shadow-xs motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${
                card.isOverdue
                    ? 'border-red-600 bg-rose-50/20'
                    : 'border-slate-200/80 hover:border-slate-300'
            }`}
        >
            {/* Priority Side Bar */}
            <div className={`absolute inset-y-0 left-0 w-1 ${priorityConfig.barColor}`} />

            <div className="pl-2.5">
                {/* Meta Header */}
                <div className="mb-2.5 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                        {card.isOracleRequest && (
                            <span className="shrink-0 rounded bg-slate-900 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white">
                                ORACLE / K2
                            </span>
                        )}
                        <span className={`inline-flex min-w-0 items-center gap-1 rounded px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${priorityConfig.badgeColor}`}>
                            {PriorityIcon && <PriorityIcon className="h-3 w-3 shrink-0" />}
                            {priorityConfig.label}
                        </span>
                    </div>

                    {card.isOverdue ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                            <Clock className="h-3.5 w-3.5 text-rose-600" />
                            <span>
                                Overdue {card.slaTarget ? `(Seharusnya: ${new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}
                            </span>
                        </span>
                    ) : card.slaTarget ? (
                        <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200/70">
                            Target: {new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                </div>

                {/* Description Body */}
                <p className="mb-3.5 line-clamp-3 text-base md:text-lg font-bold leading-snug tracking-tight text-slate-900 break-words">
                    {card.description}
                </p>

                {/* Requester Info */}
                <div className="flex min-w-0 items-center gap-2 py-0.5">
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <User className="h-3 w-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="truncate text-xs font-semibold text-slate-700" title={card.requesterName}>
                                {card.requesterName}
                            </p>
                            {card.requesterDepartment && (
                                <span
                                    data-testid="tv-board-department"
                                    className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded"
                                >
                                    {card.requesterDepartment}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* PIC Agent Footer */}
                {card.assignedToName ? (
                    <div className="mt-3 flex min-w-0 items-center gap-2.5 border-t border-slate-100 pt-2.5">
                        <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(card.assignedToName)}`}
                        >
                            {getInitials(card.assignedToName)}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">PIC Agent</span>
                            <span className="min-w-0 truncate text-sm font-bold text-slate-900 block" title={card.assignedToName}>
                                {card.assignedToName}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-amber-300 text-amber-600 bg-amber-50/50">
                            <UserCheck className="h-3.5 w-3.5" />
                        </span>
                        <div className="leading-tight">
                            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">PIC Agent</span>
                            <span className="text-xs font-bold text-amber-600">Belum ditugaskan</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TvBoardColumnContent({
    items,
    ColumnIcon,
    emptyMessage,
}: {
    items: TvBoardCard[];
    ColumnIcon: React.ElementType;
    emptyMessage: string;
}) {
    const scrollRef = useColumnAutoScroll<HTMLDivElement>();

    return (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {items.length > 0 ? (
                items.map((card) => <TvBoardCardView key={card.id} card={card} />)
            ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center p-6 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-xl bg-slate-100/80 flex items-center justify-center mb-2.5">
                        <ColumnIcon className="h-6 w-6 opacity-40 text-slate-500" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">{emptyMessage}</p>
                </div>
            )}
        </div>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [initialData, setInitialData] = useState<TvBoardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());
    const { boardData: liveData, isConnected } = useTvBoardSocket(token);
    const { enqueue, blocked } = useRingtone();
    const prevSnapshotRef = useRef<BoardSnapshot | null>(null);
    const lastClosingDateRef = useRef<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError('Link tidak valid, hubungi admin.');
            return;
        }

        const fetchBoardData = () => {
            api.get(`/tv/board/${token}`)
                .then((res) => setInitialData(res.data))
                .catch(() => setError('Link tidak valid, hubungi admin.'));
        };

        fetchBoardData();

        const pollIntervalMs = isConnected ? 30000 : 15000;
        const interval = setInterval(fetchBoardData, pollIntervalMs);

        return () => clearInterval(interval);
    }, [token, isConnected]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
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
            open: board.open.map((card) => card.id),
            inProgress: board.inProgress.map((card) => card.id),
        };
        const events = detectBoardSounds(prevSnapshotRef.current, snapshot);
        prevSnapshotRef.current = snapshot;

        enqueue(events.map((event) => (
            event === 'newTicket' ? board.ringtones.newTicket : board.ringtones.inProgress
        )));
    }, [board, enqueue]);

    useEffect(() => {
        if (!board) return;
        if (!shouldPlayClosing(now, board.ringtones.closingTime, lastClosingDateRef.current)) return;

        lastClosingDateRef.current = toDateKey(now);
        enqueue([board.ringtones.closing]);
    }, [board, now, enqueue]);

    const data = board;

    if (error) {
        return (
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center bg-[#f4f6f8] p-6 text-center text-slate-600">
                <AlertTriangle className="mb-3 h-12 w-12 text-rose-600" />
                <h2 className="text-xl font-bold text-slate-900">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-[100dvh] overflow-hidden items-center justify-center bg-[#f4f6f8] text-slate-600">
                <p className="text-lg font-medium animate-pulse">Memuat TV Board...</p>
            </div>
        );
    }

    const columnData: Record<'open' | 'inProgress', TvBoardCard[]> = {
        open: data.open,
        inProgress: data.inProgress,
    };
    const overdueCount = [...data.open, ...data.inProgress].filter((card) => card.isOverdue).length;
    const formattedDate = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="h-[100dvh] overflow-hidden bg-[#f4f6f8] p-4 font-sans text-slate-900 md:p-5 select-none">
            <div className="mx-auto flex h-full max-w-[1920px] flex-col gap-3.5 md:gap-4">
                {/* Top Board Header */}
                <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-6 py-4 border border-slate-200/90 shadow-xs motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none md:px-8">
                    {/* Site Info */}
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">{data.siteName}</h1>
                            {data.siteCode && (
                                <span className="rounded bg-slate-100 border border-slate-200/90 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                                    {data.siteCode}
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <span>TV Monitoring Board</span>
                            <span className="flex items-center gap-1 text-slate-700 font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Live
                            </span>
                        </div>
                    </div>

                    {/* Big Monospace Clock */}
                    <div className="order-last w-full text-center sm:order-none sm:w-auto">
                        <div className="text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums font-mono text-slate-900">
                            {now.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold capitalize text-slate-500">{formattedDate}</div>
                    </div>

                    {/* Badges & Metrics */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {blocked && (
                            <span
                                data-testid="tv-board-audio-blocked"
                                title="Suara diblokir browser. Jalankan browser dengan --autoplay-policy=no-user-gesture-required."
                                className="rounded bg-amber-50 p-2 text-amber-700 border border-amber-200"
                            >
                                <VolumeX className="h-4 w-4" />
                            </span>
                        )}
                        <span className="rounded bg-slate-100 border border-slate-200/80 px-3.5 py-1.5 text-xs md:text-sm font-bold text-slate-800">
                            Waiting Vendor: {data.waitingVendorCount}
                        </span>
                        {overdueCount > 0 && (
                            <span className="rounded bg-rose-50 border border-rose-200 px-3.5 py-1.5 text-xs md:text-sm font-bold text-rose-700 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Overdue: {overdueCount}
                            </span>
                        )}
                    </div>
                </header>

                {/* Grid Columns */}
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-5 md:gap-4">
                    {COLUMNS.map((column) => {
                        const ColumnIcon = column.icon;
                        const items = columnData[column.key];

                        return (
                            <section
                                key={column.key}
                                className={`flex min-h-0 flex-col rounded-xl bg-white border border-slate-200/90 shadow-xs overflow-hidden motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${column.span} ${column.topAccent}`}
                            >
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                                    {/* High-Visibility Clean Column Header */}
                                    <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3.5 bg-slate-50/70">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-lg ${column.iconBg} flex items-center justify-center shrink-0`}>
                                                <ColumnIcon className="h-4.5 w-4.5" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                                                    {column.title}
                                                </h2>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                    {column.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-2xl md:text-3xl font-mono font-black tabular-nums px-3 py-0.5 rounded-lg ${column.badgeBg}`}>
                                            {items.length}
                                        </span>
                                    </div>

                                    {/* Column Content */}
                                    <TvBoardColumnContent
                                        items={items}
                                        ColumnIcon={ColumnIcon}
                                        emptyMessage={column.emptyMessage}
                                    />
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
