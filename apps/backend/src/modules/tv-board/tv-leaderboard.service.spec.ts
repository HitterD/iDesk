import { assignBadges, isLeaderboardTime, LeaderboardAgent, rankLeaderboard, TvLeaderboardService } from './tv-leaderboard.service';
import { BusinessSchedule } from '../sla-config/business-hours.calc';

const WEEKDAYS: BusinessSchedule = { workDays: [1, 2, 3, 4, 5], startTime: 480, endTime: 1020, timezone: 'Asia/Jakarta', holidays: ['2026-11-10'] };
/** WIB is UTC+7: 12:00 WIB = 05:00Z. 2026-11-06 is a Friday. */
const at = (iso: string) => new Date(iso);

const agent = (over: Partial<LeaderboardAgent>): LeaderboardAgent => ({
    agentId: over.name ?? 'a', name: 'A', avatarUrl: null, resolved: 0, slaRate: null, avgResolutionMinutes: null,
    avgResponseMinutes: null, rating: null, ratingCount: 0, criticalResolved: 0, badges: [], ...over,
});

describe('isLeaderboardTime', () => {
    it('is on from 12:00 up to 13:00 WIB on a working day', () => {
        expect(isLeaderboardTime(at('2026-11-06T04:59:00Z'), WEEKDAYS)).toBe(false); // 11:59
        expect(isLeaderboardTime(at('2026-11-06T05:00:00Z'), WEEKDAYS)).toBe(true);  // 12:00
        expect(isLeaderboardTime(at('2026-11-06T05:59:00Z'), WEEKDAYS)).toBe(true);  // 12:59
        expect(isLeaderboardTime(at('2026-11-06T06:00:00Z'), WEEKDAYS)).toBe(false); // 13:00
    });

    it('follows WIB, not the server or TV clock', () => {
        // 12:30 UTC is 19:30 WIB.
        expect(isLeaderboardTime(at('2026-11-06T12:30:00Z'), WEEKDAYS)).toBe(false);
    });

    it('stays off on weekends and holidays', () => {
        expect(isLeaderboardTime(at('2026-11-07T05:30:00Z'), WEEKDAYS)).toBe(false); // Saturday
        expect(isLeaderboardTime(at('2026-11-10T05:30:00Z'), WEEKDAYS)).toBe(false); // holiday
    });
});

describe('rankLeaderboard', () => {
    it('ranks by resolved tickets, then SLA, then name', () => {
        const ranked = rankLeaderboard([
            agent({ name: 'Citra', resolved: 8, slaRate: 90 }),
            agent({ name: 'Budi', resolved: 10, slaRate: 70 }),
            agent({ name: 'Andi', resolved: 8, slaRate: 95 }),
        ]);
        expect(ranked.map((a) => a.name)).toEqual(['Budi', 'Andi', 'Citra']);
    });
});

describe('assignBadges', () => {
    it('gives each badge to the best agent that meets its minimum', () => {
        const agents = assignBadges(rankLeaderboard([
            agent({ name: 'Budi', resolved: 12, slaRate: 100, avgResolutionMinutes: 90, avgResponseMinutes: 20, rating: 4.6, ratingCount: 5, criticalResolved: 4 }),
            agent({ name: 'Andi', resolved: 6, slaRate: 80, avgResolutionMinutes: 40, avgResponseMinutes: 5, rating: 4.9, ratingCount: 3, criticalResolved: 1 }),
            agent({ name: 'Dewi', resolved: 2, slaRate: 100, avgResolutionMinutes: 10, avgResponseMinutes: 1, rating: 5, ratingCount: 1 }),
        ]));
        const byName = Object.fromEntries(agents.map((a) => [a.name, a.badges]));

        expect(byName.Budi).toEqual(expect.arrayContaining(['champion', 'perfectSla', 'criticalSolver']));
        expect(byName.Andi).toEqual(expect.arrayContaining(['fastest', 'favorite', 'responsive']));
        // Two tickets and one rating are below every minimum.
        expect(byName.Dewi).toEqual([]);
    });

    it('awards nothing on an empty month', () => {
        expect(assignBadges([agent({ resolved: 0 })])[0].badges).toEqual([]);
    });
});

describe('TvLeaderboardService', () => {
    const site = { id: 'site-1', tvShowsDevTickets: false };
    const row = (name: string, resolved: number) => ({
        agentId: name, name, avatarUrl: null, resolved: String(resolved), slaEvaluated: String(resolved),
        slaCompliant: String(resolved), resolutionMinutes: '60', responseMinutes: '10', criticalResolved: '0',
    });

    function build(queries: (sql: string, params: unknown[]) => unknown[]) {
        const dataSource = { query: jest.fn(async (sql: string, params: unknown[]) => queries(sql, params)) };
        const service = new TvLeaderboardService(
            { findOne: jest.fn(async () => site) } as any,
            dataSource as any,
            { getSchedule: jest.fn(async () => WEEKDAYS) } as any,
        );
        return { service, dataSource };
    }

    it('shows the month ranking and today\'s best agent while it is leaderboard time', async () => {
        const { service } = build((sql, params) => {
            if (sql.includes('agent_ratings')) return [];
            const from = params[0] as Date;
            // Month query starts on the 1st; the today query starts at today's midnight WIB.
            return from.getUTCDate() === 31 ? [row('Budi', 9), row('Andi', 4)] : [row('Andi', 2)];
        });
        const data = await service.getLeaderboard('site-1', at('2026-11-06T05:30:00Z'));

        expect(data.active).toBe(true);
        expect(data.topAgents.map((a) => a.name)).toEqual(['Budi', 'Andi']);
        expect(data.agentOfTheDay).toMatchObject({ period: 'today', agent: { name: 'Andi' } });
        expect(data.dateKey).toBe('2026-11-06');
    });

    it('falls back to the last working day when nobody resolved a ticket today yet', async () => {
        const { service } = build((sql, params) => {
            if (sql.includes('agent_ratings')) return [];
            const from = params[0] as Date;
            // Monday 2026-11-09: today empty, the weekend is skipped, Friday the 6th has a winner.
            return from.toISOString().startsWith('2026-11-05T17:00') ? [row('Citra', 3)] : [];
        });
        const data = await service.getLeaderboard('site-1', at('2026-11-09T05:10:00Z'));

        expect(data.agentOfTheDay).toMatchObject({ period: 'previous', date: '2026-11-06', agent: { name: 'Citra' } });
    });

    it('counts the developer teams of every site on a dev hub board', async () => {
        site.tvShowsDevTickets = true;
        const { service, dataSource } = build(() => []);
        await service.getLeaderboard('site-1', at('2026-11-06T05:30:00Z'));
        site.tvShowsDevTickets = false;

        const [sql, params] = dataSource.query.mock.calls[0];
        expect(sql).toContain(`t."handlingTeam" = ANY($4)`);
        expect(params[3]).toEqual(['ORACLE_DEV', 'WEB_DEV', 'MOBILE_DEV']);
    });
});
