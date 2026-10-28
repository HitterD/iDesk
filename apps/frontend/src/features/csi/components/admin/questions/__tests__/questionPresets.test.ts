import { describe, expect, it } from 'vitest';
import { OPTION_PRESETS, optionsForType } from '../questionPresets';

describe('questionPresets', () => {
    it('Kepuasan has 5 options scored 5..1', () => {
        expect(OPTION_PRESETS.satisfaction.map((option) => option.points)).toEqual([5, 4, 3, 2, 1]);
        expect(OPTION_PRESETS.satisfaction[0].label).toBe('Sangat puas');
    });

    it('Kualitas has 5 options scored 5..1 and Frekuensi 3 unscored options', () => {
        expect(OPTION_PRESETS.quality.map((option) => option.points)).toEqual([5, 4, 3, 2, 1]);
        expect(OPTION_PRESETS.frequency.map((option) => option.points)).toEqual([null, null, null]);
    });

    it('STAR and TEXT clear the options', () => {
        expect(optionsForType('STAR', OPTION_PRESETS.quality)).toEqual([]);
        expect(optionsForType('TEXT', OPTION_PRESETS.quality)).toEqual([]);
    });

    it('seeds Kepuasan for SCALE and Frekuensi for CHOICE when the options are empty', () => {
        expect(optionsForType('SCALE', [])).toEqual(OPTION_PRESETS.satisfaction);
        expect(optionsForType('CHOICE', [])).toEqual(OPTION_PRESETS.frequency);
    });

    it('converts existing options between SCALE and CHOICE keeping the labels', () => {
        expect(optionsForType('CHOICE', OPTION_PRESETS.quality).map((option) => option.points)).toEqual([null, null, null, null, null]);
        const scored = optionsForType('SCALE', OPTION_PRESETS.frequency);
        expect(scored.map((option) => option.label)).toEqual(['< 5 kali', '5 - 10 kali', '> 10 kali']);
        expect(scored.map((option) => option.points)).toEqual([5, 4, 3]);
    });
});
