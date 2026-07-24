import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock, Inbox, CircleDot, CheckCircle2, AlertTriangle, User, UserCheck } from 'lucide-react';
import api from '@/lib/api';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';

const COLUMNS: Array<{
    key: 'open' | 'inProgress' | 'resolved';
    title: string;
    icon: React.ElementType;
    headerAccent: string;
    emptyMessage: string;
}> = [
    {
        key: 'open',
        title: 'Open',
        icon: Inbox,
        headerAccent: 'border-t-4 border-slate-400',
        emptyMessage: 'Tidak ada tiket dalam antrean Open',
    },
    {
        key: 'inProgress',
        title: 'In Progress',
        icon: CircleDot,
        headerAccent: 'border-t-4 border-blue-500',
        emptyMessage: 'Tidak ada tiket sedang dikerjakan',
    },
    {
        key: 'resolved',
        title: 'Resolved',
        icon: CheckCircle2,
        headerAccent: 'border-t-4 border-emerald-500',
        emptyMessage: 'Belum ada tiket selesai hari ini',
    },
];

function TvBoardCardView({ card }: { card: TvBoardCard }) {
    const priorityConfig = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.MEDIUM;
    const PriorityIcon = priorityConfig.icon;

    return (
        <div
            data-testid="tv-board-card"
            className={`relative mb-3 overflow-hidden rounded-[18px] bg-white p-5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.32)] ring-1 ring-slate-200/80 motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${
                card.isOverdue ? 'border-2 border-red-600 ring-2 ring-red-600 bg-red-50/40' : ''
            }`}
        >
            <div className={`absolute inset-y-0 left-0 w-1.5 ${priorityConfig.barColor}`} />
            <div className="pl-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        {card.isOracleRequest && (
                            <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white">
                                ORACLE / K2
                            </span>
                        )}
                        <span className={`inline-flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${priorityConfig.badgeColor}`}>
                            {PriorityIcon && <PriorityIcon className="h-3 w-3 shrink-0" />}
                            {priorityConfig.label}
                        </span>
                    </div>
                    {card.isOverdue ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-red-700">
                            <Clock className="h-3.5 w-3.5" /> Overdue
                        </span>
                    ) : card.slaTarget ? (
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">
                            Target {new Date(card.slaTarget).toLocaleDateString('id-ID')}
                        </span>
                    ) : null}
                </div>
                <p className="mb-5 line-clamp-3 text-lg font-bold leading-snug tracking-[-0.01em] text-slate-900">
                    {card.description}
                </p>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                    <span className="flex min-w-0 items-center gap-1.5 truncate" title={card.requesterName}>
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {card.requesterName}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-600" title={card.assignedToName ?? 'Unassigned'}>
                        <UserCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                        {card.assignedToName ?? 'Unassigned'}
                    </span>
                </div>
            </div>
        </div>
    );
}

export const BentoTvBoardPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [initialData, setInitialData] = useState<TvBoardData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());
    const { boardData: liveData } = useTvBoardSocket(token);

    useEffect(() => {
        if (!token) {
            setError('Link tidak valid, hubungi admin.');
            return;
        }
        api.get(`/tv/board/${token}`)
            .then((res) => setInitialData(res.data))
            .catch(() => setError('Link tidak valid, hubungi admin.'));
    }, [token]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const data = liveData ?? initialData;

    if (error) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#edf2f7] p-6 text-center text-slate-600">
                <AlertTriangle className="mb-3 h-12 w-12 text-red-600" />
                <h2 className="text-xl font-bold text-slate-900">{error}</h2>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-[#edf2f7] text-slate-600">
                <p className="text-lg font-medium">Memuat TV Board...</p>
            </div>
        );
    }

    const columnData: Record<'open' | 'inProgress' | 'resolved', TvBoardCard[]> = {
        open: data.open,
        inProgress: data.inProgress,
        resolved: data.resolved,
    };
    const overdueCount = [...data.open, ...data.inProgress].filter((card) => card.isOverdue).length;
    const formattedDate = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="min-h-[100dvh] bg-[#edf2f7] p-4 font-sans text-slate-900 md:p-6">
            <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1920px] flex-col gap-4 md:min-h-[calc(100dvh-3rem)] md:gap-6">
                <header className="flex flex-wrap items-center justify-between gap-5 rounded-[24px] bg-white px-6 py-5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none md:px-8">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.siteName}</h1>
                            {data.siteCode && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">
                                    {data.siteCode}
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-500">TV Monitoring Board</p>
                    </div>

                    <div className="order-last w-full text-center sm:order-none sm:w-auto">
                        <div className="text-4xl font-bold tracking-[-0.04em] tabular-nums text-slate-900">
                            {now.toLocaleTimeString('id-ID')}
                        </div>
                        <div className="mt-1 text-xs font-medium capitalize text-slate-500">{formattedDate}</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
                            Waiting Vendor: {data.waitingVendorCount}
                        </span>
                        {overdueCount > 0 && (
                            <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-bold text-red-700 ring-1 ring-red-200">
                                Overdue: {overdueCount}
                            </span>
                        )}
                    </div>
                </header>

                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                    {COLUMNS.map((column) => {
                        const ColumnIcon = column.icon;
                        const items = columnData[column.key];

                        return (
                            <section
                                key={column.key}
                                className={`flex min-h-[280px] flex-col rounded-[24px] bg-slate-100/80 p-1 ring-1 ring-slate-200/80 motion-safe:animate-[fade-up_700ms_cubic-bezier(0.32,0.72,0,1)_both] motion-reduce:animate-none ${column.headerAccent}`}
                            >
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white">
                                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 md:px-5">
                                        <div className="flex items-center gap-2">
                                            <ColumnIcon className="h-4 w-4 text-slate-500" />
                                            <h2 className="text-base font-bold text-slate-900">{column.title}</h2>
                                            {column.key === 'resolved' && (
                                                <span className="text-xs text-slate-400">(Hari ini)</span>
                                            )}
                                        </div>
                                        <span className="text-2xl font-bold tabular-nums text-slate-900">{items.length}</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 md:p-5">
                                        {items.length > 0 ? (
                                            items.map((card) => <TvBoardCardView key={card.id} card={card} />)
                                        ) : (
                                            <div className="flex h-full min-h-[160px] flex-col items-center justify-center p-6 text-center text-slate-400">
                                                <ColumnIcon className="mb-2 h-8 w-8 opacity-40" />
                                                <p className="text-xs font-medium">{column.emptyMessage}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
