import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import api from '@/lib/api';
import { PRIORITY_CONFIG } from '@/lib/constants/ticket.constants';
import { useTvBoardSocket, type TvBoardCard, type TvBoardData } from '../hooks/useTvBoardSocket';

const COLUMNS: Array<{ key: 'open' | 'inProgress' | 'resolved'; title: string }> = [
    { key: 'open', title: 'Open' },
    { key: 'inProgress', title: 'In Progress' },
    { key: 'resolved', title: 'Resolved' },
];

function TvBoardCardView({ card }: { card: TvBoardCard }) {
    const priorityConfig = PRIORITY_CONFIG[card.priority] ?? PRIORITY_CONFIG.MEDIUM;
    return (
        <div
            data-testid="tv-board-card"
            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden mb-3 ${card.isOverdue ? 'border-2 border-red-600' : 'border border-slate-200 dark:border-slate-700'}`}
        >
            <div className={`h-1.5 ${priorityConfig.barColor}`} />
            <div className="p-4">
                <p className="font-semibold text-slate-800 dark:text-white line-clamp-2">{card.description}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{card.requesterName}</p>
                <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">→ {card.assignedToName ?? 'Unassigned'}</span>
                    {card.slaTarget && (
                        <span className="text-slate-400 flex items-center gap-1">
                            {card.isOverdue && <Clock className="w-3.5 h-3.5 text-red-500" />}
                            Target: {new Date(card.slaTarget).toLocaleDateString('id-ID')}
                        </span>
                    )}
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
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <p className="text-2xl text-slate-300">{error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <p className="text-xl text-slate-400">Memuat...</p>
            </div>
        );
    }

    const columnData: Record<'open' | 'inProgress' | 'resolved', TvBoardCard[]> = {
        open: data.open,
        inProgress: data.inProgress,
        resolved: data.resolved,
    };

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
            <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{data.siteName}</h1>
                <span className="text-2xl font-mono text-slate-600 dark:text-slate-300">
                    {now.toLocaleTimeString('id-ID')}
                </span>
                <span className="px-4 py-2 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-semibold">
                    Waiting Vendor: {data.waitingVendorCount}
                </span>
            </header>

            <div className="flex-1 grid grid-cols-3 gap-4 p-6 overflow-hidden">
                {COLUMNS.map((col) => (
                    <div key={col.key} className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                            {col.title} ({columnData[col.key].length})
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {columnData[col.key].map((card) => (
                                <TvBoardCardView key={card.id} card={card} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
