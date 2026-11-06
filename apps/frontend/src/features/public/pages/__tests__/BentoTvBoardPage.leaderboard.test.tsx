import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BentoTvBoardPage } from '../BentoTvBoardPage';
import { themeForDate, type TvLeaderboardData } from '../../utils/tvLeaderboard';

const card = (id: string, over: Record<string, unknown> = {}) => ({
    id, title: `Tiket ${id}`, description: '', requesterName: 'Nur', requesterDepartment: null, assignedToName: null,
    priority: 'MEDIUM', slaTarget: null, isOverdue: false, isOracleRequest: false, handlingTeam: 'OPS_SUPPORT', ...over,
});
const board = (open: ReturnType<typeof card>[]) => ({
    siteName: 'Sampoerna Jaya', siteCode: 'SPJ', open, inProgress: [], waitingVendorCount: 0,
    ringtones: { newTicket: null, inProgress: null, closing: null, closingTime: null },
});

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => undefined)) } }));

const socketState = { boardData: board([card('t1')]) as any, isConnected: true, isTokenInvalid: false };
vi.mock('../../hooks/useTvBoardSocket', () => ({ useTvBoardSocket: () => socketState }));

const ringtoneState = { blocked: false, enqueue: vi.fn(), unlockAudio: vi.fn(), playTestSound: vi.fn(), playSynth: vi.fn(() => true) };
vi.mock('../../hooks/useRingtone', () => ({ useRingtone: () => ringtoneState }));

const agent = (name: string, resolved: number) => ({
    agentId: name, name, avatarUrl: null, resolved, slaRate: 100, avgResolutionMinutes: 60, avgResponseMinutes: 5,
    rating: 4.8, ratingCount: 4, criticalResolved: 1, badges: ['champion' as const],
});
let leaderboard: TvLeaderboardData | null = null;
vi.mock('../../hooks/useTvLeaderboard', () => ({ useTvLeaderboard: () => leaderboard }));

const renderBoard = () => render(
    <MemoryRouter initialEntries={['/tv/abc']}>
        <Routes><Route path="/tv/:token" element={<BentoTvBoardPage />} /></Routes>
    </MemoryRouter>,
);

describe('TV board leaderboard hour', () => {
    beforeEach(() => {
        socketState.boardData = board([card('t1')]);
        ringtoneState.enqueue.mockClear();
        ringtoneState.playSynth.mockClear();
        leaderboard = {
            active: true, dateKey: '2026-11-09', monthLabel: 'November 2026',
            agentOfTheDay: { agent: agent('ANDI WIJAYA', 3), period: 'today', date: '2026-11-09' },
            topAgents: [agent('BUDI SANTOSO', 12), agent('ANDI WIJAYA', 9), agent('CITRA DEWI', 7), agent('DONI', 2)],
        };
    });

    it('swaps to the leaderboard on the same link while it is active, with the day theme', () => {
        renderBoard();
        const view = screen.getByTestId('tv-leaderboard');
        expect(view).toHaveAttribute('data-lb-theme', themeForDate('2026-11-09'));
        expect(screen.getByText('Agent of the Day')).toBeInTheDocument();
        expect(screen.getAllByText('Budi Santoso').length).toBeGreaterThan(0);
        expect(screen.getByText('Doni')).toBeInTheDocument(); // rank 4 in the list
    });

    it('plays the congratulation fanfare once for the day', () => {
        const { rerender } = renderBoard();
        rerender(
            <MemoryRouter initialEntries={['/tv/abc']}>
                <Routes><Route path="/tv/:token" element={<BentoTvBoardPage />} /></Routes>
            </MemoryRouter>,
        );
        expect(ringtoneState.playSynth).toHaveBeenCalledTimes(1);
    });

    it('still rings and announces a new ticket over the leaderboard', () => {
        const { rerender } = renderBoard();
        socketState.boardData = board([card('t1'), card('t2', { title: 'Printer lantai 3 mati' })]);
        act(() => {
            rerender(
                <MemoryRouter initialEntries={['/tv/abc']}>
                    <Routes><Route path="/tv/:token" element={<BentoTvBoardPage />} /></Routes>
                </MemoryRouter>,
            );
        });
        expect(ringtoneState.enqueue).toHaveBeenCalled();
        expect(screen.getByTestId('tv-leaderboard-ticket-banner')).toHaveTextContent('Printer lantai 3 mati');
    });

    it('shows the queue board outside the leaderboard hour', () => {
        leaderboard = { ...leaderboard!, active: false };
        renderBoard();
        expect(screen.queryByTestId('tv-leaderboard')).not.toBeInTheDocument();
        expect(ringtoneState.playSynth).not.toHaveBeenCalled();
    });
});
