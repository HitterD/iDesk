import { INK } from '../../reports/generators/report-pdf-canvas';
import { CsiScoreBand, CsiScoreBands, scoreBand } from './csi-score-bands';

/** PDF ink per score band (report PDF, HC recap pages and memo share the same three colours). */
export const SCORE_BAND_INK: Record<CsiScoreBand, string> = { good: INK.green, fair: INK.amber, poor: INK.red };

/** Ink of an average under the survey bands; `none` when there is no score. */
export function scoreInk(value: number | null | undefined, bands: CsiScoreBands, none: string = INK.secondary): string {
    const band = scoreBand(value ?? null, bands);
    return band ? SCORE_BAND_INK[band] : none;
}
