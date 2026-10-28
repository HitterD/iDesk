import { averageOfAverages, pengisiPct, responseAverage, round2, slaTarget } from './csi-score.util';
import { formatLocation, formatTimestampWib } from './csi-format.util';

describe('csi-score.util', () => {
    it('responseAverage ignores null', () => {
        expect(responseAverage([4, null, 5])).toBe(4.5);
        expect(responseAverage([null, null])).toBeNull();
        expect(responseAverage([])).toBeNull();
    });

    it('overall average uses all scored items (titi yusliyanti fixture)', () => {
        expect(responseAverage([4, 5, 4, 4, 4, 5, 4, 4])).toBe(4.25);
    });

    it('averageOfAverages ignores null and rounds to 2 decimals', () => {
        expect(averageOfAverages([4.5, 3, null])).toBe(3.75);
        expect(averageOfAverages([null])).toBeNull();
        expect(averageOfAverages([4, 5, 5])).toBe(4.67);
        expect(round2(2.005 + 1e-9)).toBe(2.01);
    });

    it('SLA target ceil and pengisi capped at 100', () => {
        expect(slaTarget(81, 80)).toBe(65);
        expect(pengisiPct(81, 216, 65)).toBe(100);
        expect(pengisiPct(81, 30, 65)).toBe(46);
        expect(pengisiPct(0, 5, 0)).toBeNull();
    });
});

describe('csi-format.util', () => {
    it('formats WIB timestamps like the 2025 export', () => {
        expect(formatTimestampWib(new Date('2025-11-03T08:14:32Z'))).toBe('2025/11/03 3:14:32 PM GMT+7');
        expect(formatTimestampWib(new Date('2025-11-03T17:05:09Z'))).toBe('2025/11/04 12:05:09 AM GMT+7');
    });

    it('formatLocation joins site names ordered by code', () => {
        expect(formatLocation([{ code: 'SMG', name: 'Semarang' }, { code: 'SPJ', name: 'Sepanjang' }])).toBe('Semarang & Sepanjang');
        expect(formatLocation([{ code: 'SPJ', name: 'Sepanjang' }, { code: 'KRW', name: 'Karawang' }])).toBe('Karawang & Sepanjang');
        expect(formatLocation([])).toBe('');
    });
});
