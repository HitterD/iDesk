import { CSI_SCORE_MAX, CSI_SCORE_MIN } from '../../../lib/csiAdmin';
import type { CsiOption, CsiQuestionType } from '../../../types';

/** Same labels as the backend CSI 2025 template; scored presets run from CSI_SCORE_MAX down. */
const scored = (labels: string[]): CsiOption[] => labels.map((label, index) => ({
    label, points: Math.max(CSI_SCORE_MAX - index, CSI_SCORE_MIN),
}));
const unscored = (labels: string[]): CsiOption[] => labels.map((label) => ({ label, points: null }));

export const OPTION_PRESETS = {
    satisfaction: scored(['Sangat puas', 'Puas', 'Netral', 'Tidak puas', 'Sangat tidak puas']),
    quality: scored(['Sangat baik', 'Baik', 'Cukup', 'Buruk', 'Sangat buruk']),
    frequency: unscored(['< 5 kali', '5 - 10 kali', '> 10 kali']),
} as const;

export type OptionPresetKey = keyof typeof OPTION_PRESETS;
export const PRESET_LABELS: Readonly<Record<OptionPresetKey, string>> = {
    satisfaction: 'Kepuasan', quality: 'Kualitas', frequency: 'Frekuensi',
};
export const PRESETS_BY_TYPE: Readonly<Record<'SCALE' | 'CHOICE', readonly OptionPresetKey[]>> = {
    SCALE: ['satisfaction', 'quality'],
    CHOICE: ['frequency'],
};

const copy = (options: readonly CsiOption[]): CsiOption[] => options.map((option) => ({ ...option }));

/** Options that fit a newly chosen question type: STAR/TEXT clear, SCALE/CHOICE convert or seed a preset when empty. */
export function optionsForType(type: CsiQuestionType, current: readonly CsiOption[]): CsiOption[] {
    if (type === 'STAR' || type === 'TEXT') return [];
    if (type === 'CHOICE') return current.length ? current.map(({ label }) => ({ label, points: null })) : copy(OPTION_PRESETS.frequency);
    if (!current.length) return copy(OPTION_PRESETS.satisfaction);
    return current.map(({ label, points }, index) => ({ label, points: points ?? Math.max(CSI_SCORE_MAX - index, CSI_SCORE_MIN) }));
}
