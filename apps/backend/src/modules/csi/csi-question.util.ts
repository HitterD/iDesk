import { CSI_OPTIONS_MAX, CSI_OPTIONS_MIN, CSI_SCORE_MAX, CSI_SCORE_MIN, CsiOption, CsiQuestionType } from './csi.constants';

export const INVALID_OPTIONS_MESSAGE = 'Pilihan tidak valid untuk jenis pertanyaan ini';

const isScorePoint = (points: unknown) =>
    Number.isInteger(points) && (points as number) >= CSI_SCORE_MIN && (points as number) <= CSI_SCORE_MAX;

/**
 * Per-type option rules: SCALE has 2–10 options scored 1–5, CHOICE has 2–10 unscored options (points null),
 * STAR and TEXT have no options. Label shape is validated separately by the option DTO.
 */
export function optionsMatchType(type: CsiQuestionType, options: unknown): boolean {
    if (!Array.isArray(options)) return false;
    if (type === CsiQuestionType.STAR || type === CsiQuestionType.TEXT) return options.length === 0;
    if (options.length < CSI_OPTIONS_MIN || options.length > CSI_OPTIONS_MAX) return false;
    const points = (options as Array<Partial<CsiOption> | null>).map((option) => option?.points);
    if (type === CsiQuestionType.SCALE) return points.every(isScorePoint);
    if (type === CsiQuestionType.CHOICE) return points.every((point) => point === null);
    return false;
}
