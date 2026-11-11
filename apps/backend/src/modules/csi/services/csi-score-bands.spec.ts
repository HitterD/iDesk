import { CSI_SCORE_BANDS_DEFAULT, bandsOf, scoreBand, scoreWordFor } from './csi-score-bands';

describe('csi score bands', () => {
    it('legacy period keeps 4.0/4.5', () => {
        expect(CSI_SCORE_BANDS_DEFAULT).toEqual({ fairMin: 4.0, goodMin: 4.5 });
        expect(bandsOf({ scoreFairMin: 4.0, scoreGoodMin: 4.5 })).toEqual({ fairMin: 4.0, goodMin: 4.5 });
        // A row read before the migration (or a raw numeric string) still resolves to numbers / defaults.
        expect(bandsOf({} as any)).toEqual(CSI_SCORE_BANDS_DEFAULT);
        expect(bandsOf({ scoreFairMin: '3.8', scoreGoodMin: '4.3' } as any)).toEqual({ fairMin: 3.8, goodMin: 4.3 });
        expect(scoreBand(4.2, bandsOf({ scoreFairMin: 4.0, scoreGoodMin: 4.5 }))).toBe('fair');
    });

    it('custom bands 3.5/4.2', () => {
        const bands = bandsOf({ scoreFairMin: 3.5, scoreGoodMin: 4.2 });
        expect(scoreBand(4.3, bands)).toBe('good');
        expect(scoreBand(3.9, bands)).toBe('fair');
        expect(scoreBand(3.4, bands)).toBe('poor');
        expect(scoreWordFor(4.3, bands)).toBe('Sangat puas');
        expect(scoreWordFor(3.9, bands)).toBe('Puas');
        expect(scoreWordFor(3.4, bands)).toBe('Perlu perbaikan');
    });

    it('boundaries inclusive', () => {
        const bands = { fairMin: 4.0, goodMin: 4.5 };
        expect(scoreBand(4.5, bands)).toBe('good');
        expect(scoreBand(4.49, bands)).toBe('fair');
        expect(scoreBand(4.0, bands)).toBe('fair');
        expect(scoreBand(3.99, bands)).toBe('poor');
        expect(scoreWordFor(4.5, bands)).toBe('Sangat puas');
        expect(scoreWordFor(4.0, bands)).toBe('Puas');
    });

    it('no score has no band or word', () => {
        expect(scoreBand(null, CSI_SCORE_BANDS_DEFAULT)).toBeNull();
        expect(scoreWordFor(null, CSI_SCORE_BANDS_DEFAULT)).toBeNull();
    });
});
