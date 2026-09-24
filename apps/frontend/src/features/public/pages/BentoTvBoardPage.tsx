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
    pillColor: string;
    dotColor: string;
    borderAccent: string;
    mascot: string;
}

const DIVISION_CONFIGS: Record<DivisionKey, DivisionConfig> = {
    OPS_SUPPORT: {
        key: 'OPS_SUPPORT',
        label: 'IT Support',
        shortLabel: 'IT Support',
        icon: Headphones,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
        pillColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
        dotColor: 'bg-blue-600',
        borderAccent: 'border-l-2 border-l-blue-500',
        mascot: '/characters/mascot-service.png',
    },
    ORACLE_DEV: {
        key: 'ORACLE_DEV',
        label: 'Oracle / K2',
        shortLabel: 'Oracle K2',
        icon: Database,
        badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
        pillColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
        dotColor: 'bg-amber-600',
        borderAccent: 'border-l-2 border-l-amber-500',
        mascot: '/characters/mascot-oracle.png',
    },
    WEB_DEV: {
        key: 'WEB_DEV',
        label: 'Web Developer',
        shortLabel: 'Web Dev',
        icon: Globe,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        pillColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotColor: 'bg-emerald-600',
        borderAccent: 'border-l-2 border-l-emerald-500',
        mascot: '/characters/mascot-webdev.png',
    },
    MOBILE_DEV: {
        key: 'MOBILE_DEV',
        label: 'Mobile Developer',
        shortLabel: 'Mobile Dev',
        icon: Smartphone,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
        pillColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
        dotColor: 'bg-purple-600',
        borderAccent: 'border-l-2 border-l-purple-500',
        mascot: '/characters/mascot-mobiledev.png',
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

function resolveCardMascot(card: TvBoardCard, divisionKey: DivisionKey): { src: string; alt: string } {
    const isHardware = (card.category || '').toLowerCase().includes('hardware') || (card.ticketType || '').toLowerCase().includes('hardware');
    if (isHardware && divisionKey === 'OPS_SUPPORT') {
        return { src: '/characters/mascot-hardware.png', alt: 'Hardware IT Support' };
    }
    const cat = (card.category || '').toLowerCase();
    if (cat.includes('lost') || cat.includes('hilang')) {
        return { src: '/characters/mascot-lostitem.png', alt: 'Lost Item' };
    }
    if (cat.includes('access') || cat.includes('akses')) {
        return { src: '/characters/mascot-access.png', alt: 'Access Request' };
    }
    switch (divisionKey) {
        case 'ORACLE_DEV':
            return { src: '/characters/mascot-oracle.png', alt: 'Oracle / K2' };
        case 'WEB_DEV':
            return { src: '/characters/mascot-webdev.png', alt: 'Web Developer' };
        case 'MOBILE_DEV':
            return { src: '/characters/mascot-mobiledev.png', alt: 'Mobile Developer' };
        case 'OPS_SUPPORT':
        default:
            return { src: '/characters/mascot-service.png', alt: 'IT Support' };
    }
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
        badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs',
        iconBg: 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs',
        topAccent: 'border-t-2 border-t-blue-500',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        subtitle: 'Sedang Dikerjakan',
        icon: CircleDot,
        span: 'md:col-span-3',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
        badgeBg: 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs',
        iconBg: 'bg-sky-50 text-sky-600 border border-sky-200 shadow-xs',
        topAccent: 'border-t-2 border-t-sky-500',
    },
];

const AVATAR_TONES = [
    'bg-white/10 text-white border border-white/15',
    'bg-white/15 text-white border border-white/20',
    'bg-white/10 text-slate-200 border border-white/15',
    'bg-white/15 text-slate-100 border border-white/20',
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
    const isUrgent = card.priority === 'CRITICAL' || card.priority === 'HIGH';
    const divisionKey = resolveCardDivision(card);
    const division = DIVISION_CONFIGS[divisionKey];
    const DivisionIcon = division.icon;
    const mascot = resolveCardMascot(card, divisionKey);

    const formattedCode = formatTicketNumber(card.ticketNumber, card.id);
    const isHardware = (card.category || '').toLowerCase().includes('hardware') || (card.ticketType || '').toLowerCase().includes('hardware');

    return (
        <div
            data-testid="tv-board-card"
            className={cn(
                "group relative mb-3.5 overflow-hidden rounded-2xl p-4 md:p-5 border transition-all duration-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] motion-safe:animate-[fade-up_500ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none",
                card.isOverdue
                    ? "border-red-600/50 bg-rose-50/50 hover:bg-rose-50/70 shadow-[0_4px_20px_rgba(239,68,68,0.08)]"
                    : "border-slate-200/90 bg-white/95 hover:bg-white hover:border-blue-400/50 hover:shadow-[0_8px_25px_rgba(45,74,140,0.08)]"
            )}
        >
            <div>
                {/* Meta Header: Ticket Number, Division Badge, Special Tag, Priority, SLA */}
                <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex min-w-0 items-center gap-1.5 flex-wrap">
                        {/* Ticket Number */}
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-2.5 py-0.5 rounded-lg shrink-0">
                            {formattedCode}
                        </span>

                        {/* Division Tag */}
                        <span className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold border shrink-0",
                            division.badgeColor
                        )}>
                            <DivisionIcon className="h-3 w-3 shrink-0" />
                            <span>{divisionKey === 'ORACLE_DEV' ? 'ORACLE / K2' : division.shortLabel}</span>
                        </span>

                        {/* Special Tag (e.g. Hardware) */}
                        {isHardware && (
                            <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                                <Cpu className="h-3 w-3 shrink-0" />
                                Hardware
                            </span>
                        )}

                        {/* Priority Badge */}
                        <span className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border shrink-0",
                            isUrgent
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                            <span>{priorityConfig.label}</span>
                        </span>
                    </div>

                    {/* SLA / Overdue Status */}
                    {card.isOverdue ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-100 px-3 py-0.5 rounded-lg border border-rose-200 shadow-2xs">
                            <Clock className="h-3.5 w-3.5 text-rose-600" />
                            <span>
                                Overdue {card.slaTarget ? `(Seharusnya: ${new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} ${new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})` : ''}
                            </span>
                        </span>
                    ) : card.slaTarget ? (
                        <span className="shrink-0 text-xs font-normal text-slate-600 bg-slate-100 px-3 py-0.5 rounded-lg border border-slate-200">
                            Target: {new Date(card.slaTarget).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} {new Date(card.slaTarget).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                </div>

                {/* Middle Content: Title, Description + Mascot Character Illustration */}
                <div className="mb-3.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-base md:text-lg lg:text-xl font-bold leading-snug tracking-tight text-slate-900 break-words">
                            {card.title || card.description}
                        </h3>
                        {card.title && card.description && card.title !== card.description && (
                            <p className="line-clamp-2 text-xs md:text-sm font-normal text-slate-600 leading-relaxed mt-1 break-words">
                                {card.description}
                            </p>
                        )}
                    </div>

                    {/* Mascot Illustration Tile */}
                    <div className="shrink-0 w-13 h-13 md:w-16 md:h-16 rounded-xl bg-slate-50 border border-slate-200/90 p-1.5 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                        <img 
                            src={mascot.src} 
                            alt={mascot.alt} 
                            className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)]" 
                            loading="lazy"
                        />
                    </div>
                </div>

                {/* Requester & PIC Info Footer */}
                <div className="flex min-w-0 items-center justify-between gap-2 py-0.5 border-t border-slate-100 pt-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                            <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="truncate text-xs font-medium text-slate-700" title={card.requesterName}>
                                {card.requesterName}
                            </span>
                            {card.requesterDepartment && (
                                <span
                                    data-testid="tv-board-department"
                                    className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md"
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
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                            >
                                {getInitials(card.assignedToName)}
                            </span>
                            <div className="leading-tight text-right">
                                <span className="text-[9px] font-semibold text-slate-400 block uppercase tracking-wider">PIC</span>
                                <span className="text-xs font-bold text-slate-800 block truncate max-w-[170px]" title={card.assignedToName}>
                                    {card.assignedToName}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
                            <UserCheck className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="text-[11px] font-semibold text-amber-700">Belum ditugaskan</span>
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
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center mb-3">
                        <ColumnIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">{emptyMessage}</p>
                </div>
            )}
        </div>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
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
            <div className="flex h-[100dvh] overflow-hidden flex-col items-center justify-center bg-[#0A0A0C] p-6 text-center text-slate-400">
                <AlertTriangle className="mb-3 h-12 w-12 text-rose-500" />
                <h2 className="text-xl font-bold text-white">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-[100dvh] overflow-hidden items-center justify-center bg-[#F4F6F9] text-slate-500">
                <div className="flex flex-col items-center gap-3 p-8 rounded-3xl bg-white/90 backdrop-blur-2xl border border-slate-200/90 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                    <img src="/idesk-logo.png" alt="iDesk" className="h-8 w-auto object-contain mb-1 drop-shadow-xs" />
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    <p className="text-xs font-medium text-slate-600">
                        {isOffline ? 'Menghubungkan ke TV Monitoring Board...' : 'Memuat TV Monitoring Board...'}
                    </p>
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
            className="relative h-[100dvh] overflow-hidden p-3 md:p-5 font-sans text-slate-800 select-none bg-[#F4F6F9]"
            style={{
                backgroundImage: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(37, 99, 235, 0.05), transparent 75%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(30, 58, 138, 0.03), transparent 70%)'
            }}
        >
            <div className="relative mx-auto flex h-full max-w-[1920px] flex-col gap-3.5 z-10">
                {/* Apple Glass Dynamic Island Header - Light Mode */}
                <header className="flex flex-wrap items-center justify-between gap-3 md:gap-4 rounded-[24px] bg-white/85 backdrop-blur-2xl px-6 py-3.5 md:px-8 md:py-4 border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.04)] motion-safe:animate-[fade-up_500ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none">
                    {/* Site Info Branding with Official iDesk Logo */}
                    <div className="flex items-center gap-4">
                        <img src="/idesk-logo.png" alt="iDesk Logo" className="h-9 md:h-11 w-auto object-contain shrink-0 drop-shadow-xs" />
                        <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                                    {data.siteName}
                                </h1>
                                {data.siteCode && (
                                    <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-700">
                                        {data.siteCode}
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <span>TV Monitoring Board</span>
                                {isOffline ? (
                                    <span
                                        data-testid="tv-board-status-reconnecting"
                                        className="flex items-center gap-1.5 text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 text-[11px]"
                                        title="Koneksi terganggu, mencoba menghubungkan kembali secara otomatis"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                        Menghubungkan kembali...
                                    </span>
                                ) : (
                                    <span
                                        data-testid="tv-board-status-live"
                                        className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Live
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Apple Read-Only Live Metric Distribution Bar (Non-Clickable) */}
                    <div className="flex items-center gap-1.5 bg-slate-100/80 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl border border-slate-200/80 flex-wrap">
                        {/* Total Count Pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-slate-800 border border-slate-200/80 shadow-xs">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-bold">Total</span>
                            <span className="font-mono text-xs font-extrabold bg-slate-100 px-1.5 py-0.2 rounded-md text-slate-900">
                                {divisionCounts.TOTAL}
                            </span>
                        </div>

                        {/* Each Division Read-Only Pill with Mascot & Brand Palette */}
                        {(['OPS_SUPPORT', 'ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV'] as DivisionKey[]).map((key) => {
                            const config = DIVISION_CONFIGS[key];
                            const count = divisionCounts[key] || 0;

                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-colors",
                                        count > 0 ? config.pillColor : "bg-white/60 border-slate-200/60 text-slate-400"
                                    )}
                                >
                                    <img src={config.mascot} alt={config.shortLabel} className="w-3.5 h-3.5 object-contain shrink-0" />
                                    <span>{config.shortLabel}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.2 rounded-md font-mono text-[11px] font-bold",
                                        count > 0 ? "bg-white/80 shadow-2xs" : "text-slate-400"
                                    )}>
                                        {count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Apple Monospace Digital Clock */}
                    <div className="bg-slate-50/90 backdrop-blur-xl border border-slate-200/80 px-5 py-2 rounded-2xl text-center shadow-2xs">
                        <div className="text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums font-mono text-slate-900">
                            {now.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="text-[11px] font-semibold capitalize text-slate-500">{formattedDate}</div>
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
                                className="flex items-center gap-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 px-3.5 py-2 text-xs font-bold text-amber-800 border border-amber-300 transition-colors animate-pulse cursor-pointer shadow-xs"
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
                                className="flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-slate-700 border border-slate-200 text-xs font-semibold cursor-pointer transition-colors"
                            >
                                <Volume2 className="h-4 w-4 text-slate-500" />
                                <span className="text-[11px]">Test Suara</span>
                            </button>
                        )}

                        <span className="rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700">
                            Waiting Vendor: {data.waitingVendorCount}
                        </span>

                        {overdueCount > 0 && (
                            <span className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-700 flex items-center gap-1.5 shadow-2xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                Overdue: {overdueCount}
                            </span>
                        )}
                    </div>
                </header>

                {/* Apple Glass Column Cards Grid - Light Mode */}
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-5 md:gap-4">
                    {COLUMNS.map((column) => {
                        const ColumnIcon = column.icon;
                        const items = column.key === 'open' ? data.open : data.inProgress;

                        return (
                            <section
                                key={column.key}
                                className={cn(
                                    "flex min-h-0 flex-col rounded-[24px] bg-slate-100/70 backdrop-blur-2xl border border-slate-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.03)] overflow-hidden motion-safe:animate-[fade-up_500ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none",
                                    column.span,
                                    column.topAccent
                                )}
                            >
                                <div className="flex min-h-0 flex-1 flex-col h-full overflow-hidden">
                                    {/* Glass Column Header */}
                                    <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 bg-white/70">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", column.iconBg)}>
                                                <ColumnIcon className="h-5 w-5" />
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
                                        <span className={cn("text-2xl md:text-3xl font-mono font-bold tabular-nums px-3.5 py-0.5 rounded-xl", column.badgeBg)}>
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
