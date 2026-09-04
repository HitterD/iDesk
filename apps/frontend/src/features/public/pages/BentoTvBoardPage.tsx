import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Clock, 
    Inbox, 
    CircleDot, 
    AlertTriangle, 
    User, 
    UserCheck, 
    VolumeX,
    Volume2,
    Database,
    Globe,
    Smartphone,
    Headphones,
    Layers,
    Cpu,
} from 'lucide-react';
import api from '@/lib/api';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useColumnAutoScroll } from '../hooks/useColumnAutoScroll';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';
import { detectBoardSounds, detectBoardSoundDetails, type BoardSnapshot } from '../hooks/detectBoardSounds';
import { shouldPlayClosing, toDateKey } from '../hooks/shouldPlayClosing';
import { useRingtone } from '../hooks/useRingtone';
import { cn } from '@/lib/utils';

type DivisionKey = 'OPS_SUPPORT' | 'ORACLE_DEV' | 'WEB_DEV' | 'MOBILE_DEV';

interface DivisionConfig {
    key: DivisionKey;
    label: string;
    shortLabel: string;
    icon: React.ElementType;
    badgeColor: string;
    dotColor: string;
    borderAccent: string;
}

const DIVISION_CONFIGS: Record<DivisionKey, DivisionConfig> = {
    OPS_SUPPORT: {
        key: 'OPS_SUPPORT',
        label: 'IT Support',
        shortLabel: 'IT Support',
        icon: Headphones,
        badgeColor: 'bg-blue-500/15 text-blue-900 border-blue-400/30 backdrop-blur-md shadow-2xs',
        dotColor: 'bg-blue-600',
        borderAccent: 'border-l-blue-500',
    },
    ORACLE_DEV: {
        key: 'ORACLE_DEV',
        label: 'Oracle / K2',
        shortLabel: 'Oracle K2',
        icon: Database,
        badgeColor: 'bg-slate-900 text-white border-slate-800 shadow-2xs',
        dotColor: 'bg-slate-800',
        borderAccent: 'border-l-slate-800',
    },
    WEB_DEV: {
        key: 'WEB_DEV',
        label: 'Web Developer',
        shortLabel: 'Web Dev',
        icon: Globe,
        badgeColor: 'bg-emerald-500/15 text-emerald-900 border-emerald-400/30 backdrop-blur-md shadow-2xs',
        dotColor: 'bg-emerald-600',
        borderAccent: 'border-l-emerald-500',
    },
    MOBILE_DEV: {
        key: 'MOBILE_DEV',
        label: 'Mobile Developer',
        shortLabel: 'Mobile Dev',
        icon: Smartphone,
        badgeColor: 'bg-violet-500/15 text-violet-900 border-violet-400/30 backdrop-blur-md shadow-2xs',
        dotColor: 'bg-violet-600',
        borderAccent: 'border-l-violet-500',
    },
};

function resolveCardDivision(card: TvBoardCard): DivisionKey {
    const team = card.handlingTeam?.toUpperCase();
    if (team === 'ORACLE_DEV' || card.isOracleRequest) return 'ORACLE_DEV';
    if (team === 'WEB_DEV') return 'WEB_DEV';
    if (team === 'MOBILE_DEV') return 'MOBILE_DEV';

    const cat = (card.category || '').toLowerCase();
    const type = (card.ticketType || '').toLowerCase();

    if (cat.includes('oracle') || cat.includes('k2') || type.includes('oracle')) return 'ORACLE_DEV';
    if (cat.includes('web') || cat.includes('api') || type.includes('web')) return 'WEB_DEV';
    if (cat.includes('mobile') || cat.includes('android') || cat.includes('ios') || type.includes('mobile')) return 'MOBILE_DEV';

    return 'OPS_SUPPORT';
}

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
        badgeBg: 'bg-slate-900 text-white shadow-sm',
        iconBg: 'bg-white/80 text-slate-800 border border-white/90 shadow-2xs',
        topAccent: 'border-t-2 border-slate-400',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        subtitle: 'Sedang Dikerjakan',
        icon: CircleDot,
        span: 'md:col-span-3',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
        badgeBg: 'bg-blue-600 text-white shadow-sm',
        iconBg: 'bg-blue-500/20 text-blue-800 border border-blue-400/40 shadow-2xs',
        topAccent: 'border-t-2 border-blue-600',
    },
];

const AVATAR_TONES = [
    'bg-slate-800 text-white',
    'bg-zinc-800 text-white',
    'bg-slate-900 text-white',
    'bg-slate-700 text-white',
    'bg-zinc-700 text-white',
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

function formatTicketNumber(ticketNumber?: string | null, fallbackId?: string): string {
    if (!ticketNumber) return `#${fallbackId ? fallbackId.slice(0, 8) : '---'}`;
    // Normalize any duplicated spaces or messy hyphen spacing: e.g. "#270826-IT  -0014" -> "#270826-IT-0014"
    const cleaned = ticketNumber.replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();
    return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

function TvBoardCardView({ card }: { card: TvBoardCard }) {
    const priorityConfig = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConfig.icon;
    const divisionKey = resolveCardDivision(card);
    const division = DIVISION_CONFIGS[divisionKey];
    const DivisionIcon = division.icon;

    const formattedCode = formatTicketNumber(card.ticketNumber, card.id);
    const isHardware = (card.category || '').toLowerCase().includes('hardware') || (card.ticketType || '').toLowerCase().includes('hardware');

    return (
        <div
            data-testid="tv-board-card"
            className={cn(
                "relative mb-3.5 overflow-hidden rounded-2xl bg-white/70 hover:bg-white/85 backdrop-blur-2xl p-4 md:p-5 border transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.08)] motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none",
                card.isOverdue
                    ? "border-red-600 bg-rose-50/70 shadow-[0_6px_25px_rgba(239,68,68,0.14),inset_0_1px_1px_rgba(255,255,255,0.95)]"
                    : "border-white/90 hover:border-blue-300/70"
            )}
        >
            {/* Division Left Pill Accent */}
            <div className={cn("absolute inset-y-0 left-0 w-1.5", division.borderAccent)} />

            <div className="pl-2">
                {/* Meta Header: Ticket Number, Division Badge, Special Tag, Priority, SLA */}
                <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                        {/* Ticket Number */}
                        <span className="font-mono text-xs font-black text-slate-800 bg-white/90 backdrop-blur-md border border-slate-200/80 px-2.5 py-0.5 rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,1)] shrink-0">
                            {formattedCode}
                        </span>

                        {/* Division Tag */}
                        <span className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-bold border shrink-0 shadow-2xs",
                            division.badgeColor
                        )}>
                            <DivisionIcon className="h-3 w-3 shrink-0" />
                            <span>{divisionKey === 'ORACLE_DEV' ? 'ORACLE / K2' : division.shortLabel}</span>
                        </span>

                        {/* Special Tag (e.g. Hardware) */}
                        {isHardware && (
                            <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-900 border border-amber-400/30 shadow-2xs shrink-0">
                                <Cpu className="h-3 w-3 shrink-0 text-amber-700" />
                                Hardware
                            </span>
                        )}

                        {/* Priority Badge */}
                        <span className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border border-transparent shadow-2xs",
                            priorityConfig.badgeColor
                        )}>
                            {PriorityIcon && <PriorityIcon className="h-3 w-3 shrink-0" />}
                            <span>{priorityConfig.label}</span>
                        </span>
                    </div>

                    {/* SLA / Overdue Status */}
                    {card.isOverdue ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100/90 backdrop-blur-md px-3 py-0.5 rounded-lg border border-rose-300 shadow-2xs animate-pulse">
                            <Clock className="h-3.5 w-3.5 text-rose-600" />
                            <span>
                                Overdue {card.slaTarget ? `(Seharusnya: ${new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}
                            </span>
                        </span>
                    ) : card.slaTarget ? (
                        <span className="shrink-0 text-xs font-semibold text-slate-700 bg-white/85 backdrop-blur-md px-3 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                            Target: {new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                </div>

                {/* Primary Ticket Title & Description */}
                <div className="mb-3.5">
                    <h3 className="line-clamp-2 text-base md:text-lg lg:text-xl font-extrabold leading-snug tracking-tight text-slate-900 break-words">
                        {card.title || card.description}
                    </h3>
                    {card.title && card.description && card.title !== card.description && (
                        <p className="line-clamp-2 text-xs md:text-sm font-medium text-slate-600 leading-relaxed mt-1 break-words">
                            {card.description}
                        </p>
                    )}
                </div>

                {/* Requester & PIC Info Footer */}
                <div className="flex min-w-0 items-center justify-between gap-2 py-0.5 border-t border-slate-200/60 pt-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-white/90 border border-slate-200/70 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
                            <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="truncate text-xs font-semibold text-slate-800" title={card.requesterName}>
                                {card.requesterName}
                            </span>
                            {card.requesterDepartment && (
                                <span
                                    data-testid="tv-board-department"
                                    className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-white/90 border border-slate-200/70 px-1.5 py-0.5 rounded-md shadow-2xs"
                                >
                                    {card.requesterDepartment}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* PIC Agent */}
                    {card.assignedToName ? (
                        <div className="flex items-center gap-2 shrink-0">
                            <span
                                className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black shadow-2xs",
                                    getAvatarColor(card.assignedToName)
                                )}
                            >
                                {getInitials(card.assignedToName)}
                            </span>
                            <div className="leading-tight text-right">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">PIC</span>
                                <span className="text-xs font-bold text-slate-800 block truncate max-w-[170px]" title={card.assignedToName}>
                                    {card.assignedToName}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50/90 border border-amber-200/80 text-amber-700 shrink-0 shadow-2xs">
                            <UserCheck className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="text-[11px] font-bold text-amber-600">Belum ditugaskan</span>
                        </div>
                    )}
                </div>
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
    const scrollRef = useColumnAutoScroll<HTMLDivElement>(items);

    return (
        <div 
            ref={scrollRef} 
            className="min-h-0 flex-1 h-full overflow-y-auto p-4 md:p-5 custom-scrollbar"
        >
            {items.length > 0 ? (
                items.map((card) => <TvBoardCardView key={card.id} card={card} />)
            ) : (
                <div className="flex h-full min-h-[180px] flex-col items-center justify-center p-6 text-center text-slate-400">
                    <div className="w-14 h-14 rounded-2xl bg-white/80 border border-white shadow-xs flex items-center justify-center mb-3">
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
    const { enqueue, blocked, unlockAudio, playTestSound } = useRingtone();
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
        if (!data) return { OPS_SUPPORT: 0, ORACLE_DEV: 0, WEB_DEV: 0, MOBILE_DEV: 0, TOTAL: 0 };
        const allCards = [...data.open, ...data.inProgress];
        const counts: Record<DivisionKey | 'TOTAL', number> = {
            TOTAL: allCards.length,
            OPS_SUPPORT: 0,
            ORACLE_DEV: 0,
            WEB_DEV: 0,
            MOBILE_DEV: 0,
        };

        allCards.forEach((card) => {
            const div = resolveCardDivision(card);
            counts[div] = (counts[div] || 0) + 1;
        });

        return counts;
    }, [data]);

    if (error) {
        return (
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-6 text-center text-slate-600">
                <AlertTriangle className="mb-3 h-12 w-12 text-rose-600" />
                <h2 className="text-xl font-bold text-slate-900">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-[100dvh] overflow-hidden items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 text-slate-600">
                <div className="flex flex-col items-center gap-3 p-8 rounded-3xl bg-white/75 backdrop-blur-3xl border border-white/80 shadow-[0_12px_40px_rgba(31,38,135,0.08)]">
                    <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
                    <p className="text-sm font-bold text-slate-800">Memuat TV Monitoring Board...</p>
                </div>
            </div>
        );
    }

    const overdueCount = [...data.open, ...data.inProgress].filter((card) => card.isOverdue).length;
    const formattedDate = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div 
            onClick={unlockAudio}
            className="relative h-[100dvh] overflow-hidden p-3 md:p-5 font-sans text-slate-900 select-none"
            style={{
                backgroundColor: '#f1f5f9',
                backgroundImage: `
                    radial-gradient(at 10% 10%, rgba(56, 189, 248, 0.45) 0px, transparent 50%),
                    radial-gradient(at 90% 10%, rgba(168, 85, 247, 0.35) 0px, transparent 50%),
                    radial-gradient(at 50% 40%, rgba(251, 191, 36, 0.25) 0px, transparent 50%),
                    radial-gradient(at 85% 85%, rgba(99, 102, 241, 0.35) 0px, transparent 50%),
                    radial-gradient(at 15% 90%, rgba(52, 211, 153, 0.35) 0px, transparent 50%),
                    linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)
                `
            }}
        >
            {/* Dynamic Ambient Apple Glow Spheres for Visible Glass Refraction */}
            <div className="absolute -top-32 -left-32 w-[34rem] h-[34rem] bg-sky-400/30 rounded-full blur-[110px] pointer-events-none" />
            <div className="absolute top-1/4 -right-32 w-[32rem] h-[32rem] bg-purple-400/25 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-32 left-1/4 w-[36rem] h-[36rem] bg-amber-300/20 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[28rem] h-[28rem] bg-emerald-400/20 rounded-full blur-[110px] pointer-events-none" />

            <div className="relative mx-auto flex h-full max-w-[1920px] flex-col gap-3.5 z-10">
                {/* Apple Glass Dynamic Island Header */}
                <header className="flex flex-wrap items-center justify-between gap-3 md:gap-4 rounded-[28px] bg-white/50 backdrop-blur-3xl px-6 py-3.5 md:px-8 md:py-4 border border-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.06),inset_0_1.5px_1px_rgba(255,255,255,0.95)] motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none">
                    {/* Site Info Branding */}
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                                {data.siteName}
                            </h1>
                            {data.siteCode && (
                                <span className="rounded-xl bg-white/85 border border-slate-200/80 px-3 py-0.5 font-mono text-xs font-black text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,1)]">
                                    {data.siteCode}
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-600">
                            <span>TV Monitoring Board</span>
                            <span className="flex items-center gap-1.5 text-emerald-800 font-extrabold bg-emerald-500/15 px-3 py-0.5 rounded-full border border-emerald-500/30 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Live
                            </span>
                        </div>
                    </div>

                    {/* Apple Read-Only Live Metric Distribution Bar (Non-Clickable) */}
                    <div className="flex items-center gap-2 bg-white/40 backdrop-blur-2xl px-3 py-1.5 rounded-2xl border border-white/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_10px_rgba(0,0,0,0.02)] flex-wrap">
                        {/* Total Count Pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 text-white shadow-xs">
                            <Layers className="w-3.5 h-3.5" />
                            <span className="text-xs font-bold">Total</span>
                            <span className="font-mono text-xs font-black bg-white/20 px-1.5 py-0.2 rounded-md">
                                {divisionCounts.TOTAL}
                            </span>
                        </div>

                        {/* Each Division Read-Only Pill */}
                        {(['OPS_SUPPORT', 'ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV'] as DivisionKey[]).map((key) => {
                            const config = DIVISION_CONFIGS[key];
                            const Icon = config.icon;
                            const count = divisionCounts[key] || 0;

                            return (
                                <div
                                    key={key}
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/70 border border-white/80 shadow-2xs text-slate-800"
                                >
                                    <Icon className="w-3.5 h-3.5 text-slate-600" />
                                    <span className="text-xs font-bold">{config.shortLabel}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.2 rounded-md font-mono text-[11px] font-black",
                                        count > 0 ? "bg-slate-100 text-slate-900 font-extrabold" : "text-slate-400"
                                    )}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Apple Monospace Digital Clock */}
                    <div className="bg-white/50 backdrop-blur-2xl border border-white/80 shadow-[0_2px_10px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] px-5 py-2 rounded-2xl text-center">
                        <div className="text-2xl md:text-3xl font-black tracking-tight tabular-nums font-mono text-slate-900">
                            {now.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="text-[11px] font-bold capitalize text-slate-500">{formattedDate}</div>
                    </div>

                    {/* Badges & Audio Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {blocked ? (
                            <button
                                type="button"
                                data-testid="tv-board-audio-blocked"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    playTestSound();
                                }}
                                title="Klik untuk mengaktifkan suara TV Board"
                                className="flex items-center gap-1.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 px-3.5 py-2 text-xs font-black text-amber-900 border border-amber-300/80 shadow-xs transition-all animate-bounce cursor-pointer"
                            >
                                <VolumeX className="h-4 w-4 text-amber-700" />
                                <span>Aktifkan Audio</span>
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
                                className="flex items-center gap-1.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-2 text-emerald-800 border border-emerald-500/30 shadow-2xs cursor-pointer transition-all hover:scale-105 active:scale-95"
                            >
                                <Volume2 className="h-4 w-4" />
                                <span className="text-[11px] font-bold">Test Suara</span>
                            </button>
                        )}

                        <span className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-xs px-4 py-2 text-xs font-bold text-slate-800">
                            Waiting Vendor: {data.waitingVendorCount}
                        </span>

                        {overdueCount > 0 && (
                            <span className="rounded-2xl bg-rose-500/15 backdrop-blur-xl border border-rose-300/80 px-4 py-2 text-xs font-black text-rose-800 flex items-center gap-1.5 shadow-xs animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Overdue: {overdueCount}
                            </span>
                        )}
                    </div>
                </header>

                {/* Apple Glass Column Cards Grid */}
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-5 md:gap-4">
                    {COLUMNS.map((column) => {
                        const ColumnIcon = column.icon;
                        const items = column.key === 'open' ? data.open : data.inProgress;

                        return (
                            <section
                                key={column.key}
                                className={cn(
                                    "flex min-h-0 flex-col rounded-[28px] bg-white/45 backdrop-blur-3xl border border-white/80 shadow-[0_12px_40px_rgba(0,0,0,0.05),inset_0_1.5px_1px_rgba(255,255,255,0.9)] overflow-hidden motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none",
                                    column.span,
                                    column.topAccent
                                )}
                            >
                                <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
                                    {/* Glass Column Header */}
                                    <div className="flex items-center justify-between border-b border-white/60 px-6 py-4 bg-white/35 backdrop-blur-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs", column.iconBg)}>
                                                <ColumnIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
                                                    {column.title}
                                                </h2>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                    {column.subtitle}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn("text-2xl md:text-3xl font-mono font-black tabular-nums px-4 py-1 rounded-2xl shadow-xs", column.badgeBg)}>
                                            {items.length}
                                        </span>
                                    </div>

                                    {/* Column Content with Continuous Smooth Auto-Scroll */}
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

export default BentoTvBoardPage;
