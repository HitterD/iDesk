import { BadRequestException } from '@nestjs/common';
import { CSI_SCORE_FAIR_MIN_DEFAULT, CSI_SCORE_GOOD_MIN_DEFAULT } from '../csi.constants';

/** Per-survey score colour bands: < fairMin red, fairMin..goodMin orange, >= goodMin green (both inclusive lower bounds). */
export type CsiScoreBands = { fairMin: number; goodMin: number };
export type CsiScoreBand = 'good' | 'fair' | 'poor';
export type CsiScoreWord = 'Sangat puas' | 'Puas' | 'Perlu perbaikan';

export const CSI_SCORE_BANDS_DEFAULT: CsiScoreBands = Object.freeze({
    fairMin: CSI_SCORE_FAIR_MIN_DEFAULT, goodMin: CSI_SCORE_GOOD_MIN_DEFAULT,
});
export const CSI_SCORE_BANDS_ORDER_MESSAGE = 'Batas oranye harus lebih kecil dari batas hijau';

const SCORE_WORDS: Record<CsiScoreBand, CsiScoreWord> = { good: 'Sangat puas', fair: 'Puas', poor: 'Perlu perbaikan' };

const toNumber = (value: unknown, fallback: number) => {
    const parsed = value === null || value === undefined || value === '' ? NaN : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

/** The bands of a period; a row without them (or with numeric strings) falls back to / is read as numbers. */
export function bandsOf(period: { scoreFairMin?: number | null; scoreGoodMin?: number | null }): CsiScoreBands {
    return {
        fairMin: toNumber(period.scoreFairMin, CSI_SCORE_BANDS_DEFAULT.fairMin),
        goodMin: toNumber(period.scoreGoodMin, CSI_SCORE_BANDS_DEFAULT.goodMin),
    };
}

export function scoreBand(avg: number | null, bands: CsiScoreBands): CsiScoreBand | null {
    if (avg === null || avg === undefined) return null;
    if (avg >= bands.goodMin) return 'good';
    return avg >= bands.fairMin ? 'fair' : 'poor';
}

export function scoreWordFor(avg: number | null, bands: CsiScoreBands): CsiScoreWord | null {
    const band = scoreBand(avg, bands);
    return band ? SCORE_WORDS[band] : null;
}

/** Cross-field rule (the DTO checks each bound alone): fair must stay strictly below good. */
export function assertBandOrder(bands: CsiScoreBands): void {
    if (!(bands.fairMin < bands.goodMin)) throw new BadRequestException(CSI_SCORE_BANDS_ORDER_MESSAGE);
}
