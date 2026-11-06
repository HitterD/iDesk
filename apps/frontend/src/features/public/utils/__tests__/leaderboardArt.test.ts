import { describe, expect, it } from 'vitest';
import { boxStyle, LEADERBOARD_ARTS, type Box } from '../leaderboardArt';

describe('supplied leaderboard art layouts', () => {
    it('keeps every live-text slot inside the original artwork', () => {
        for (const art of Object.values(LEADERBOARD_ARTS)) {
            const boxes: readonly Box[] = [art.title, art.clock, art.site, art.aotdLabel, art.aotdAvatar,
                art.aotdName, art.aotdSub, ...art.stats, ...art.aotdBadges, ...art.podiumAvatars,
                ...art.podiumNames, ...art.podiumBadges.map((p) => p.box), art.listTitle, ...art.rows, art.queue];
            for (const [left, top, right, bottom] of boxes) {
                expect(left).toBeGreaterThanOrEqual(0);
                expect(top).toBeGreaterThanOrEqual(0);
                expect(right).toBeLessThanOrEqual(art.width);
                expect(bottom).toBeLessThanOrEqual(art.height);
                expect(right).toBeGreaterThan(left);
                expect(bottom).toBeGreaterThan(top);
            }
        }
    });

    it('leaves room for the rank number before the initials chip in every row', () => {
        for (const art of Object.values(LEADERBOARD_ARTS)) {
            for (const row of art.rows) {
                expect(art.rowChip[0] - row[0]).toBeGreaterThan(30);
                expect(row[2] - art.rowChip[1]).toBeGreaterThan(200);
            }
        }
    });

    it('scales slots with the artwork rather than fixed screen pixels', () => {
        expect(boxStyle([10, 20, 30, 60], { width: 100, height: 200 }))
            .toEqual({ left: '10%', top: '10%', width: '20%', height: '20%' });
    });
});
