import { describe, expect, it } from 'vitest';
import {
    CSI_SCORE_BANDS_DEFAULT, questionTone, scoreBandsPreview, scoreTone, scoreWord, siteTone, STAR_EMOJI, STAR_LABELS, starTone, toneClasses, toneColor,
} from '../csiTone';

describe('starTone', () => {
    it('1–2 merah, 3 amber, 4–5 hijau, kosong netral', () => {
        expect([1, 2, 3, 4, 5].map(starTone)).toEqual(['red', 'red', 'amber', 'green', 'green']);
        expect(starTone(undefined)).toBe('neutral');
        expect(starTone(null)).toBe('neutral');
    });
});

describe('scoreTone', () => {
    it('memakai batas 4,5 hijau dan 4,0 amber', () => {
        expect(scoreTone(4.5)).toBe('green');
        expect(scoreTone(4.49)).toBe('amber');
        expect(scoreTone(4)).toBe('amber');
        expect(scoreTone(3.99)).toBe('red');
        expect(scoreTone(null)).toBe('neutral');
    });

    it('custom bands: batas per survei menggeser warna', () => {
        const bands = { fairMin: 3.5, goodMin: 4.2 };
        expect(scoreTone(4.2, bands)).toBe('green');
        expect(scoreTone(4.19, bands)).toBe('amber');
        expect(scoreTone(3.5, bands)).toBe('amber');
        expect(scoreTone(3.49, bands)).toBe('red');
        expect(scoreTone(null, bands)).toBe('neutral');
    });

    it('default bands 4,0 / 4,5', () => {
        expect(CSI_SCORE_BANDS_DEFAULT).toEqual({ fairMin: 4, goodMin: 4.5 });
    });
});

describe('siteTone', () => {
    it('memetakan kode site ke warnanya; site lain netral', () => {
        expect(siteTone('SPJ')).toBe('teal');
        expect(siteTone('KRW')).toBe('brown');
        expect(siteTone('SMG')).toBe('green');
        expect(siteTone('JKT')).toBe('sky');
        expect(siteTone('XYZ')).toBe('neutral');
        expect(siteTone(null)).toBe('neutral');
    });
});

describe('questionTone', () => {
    it('berputar sky, teal, brown, amber', () => {
        expect([0, 1, 2, 3, 4].map(questionTone)).toEqual(['sky', 'teal', 'brown', 'amber', 'sky']);
        expect(questionTone(5)).toBe('teal');
    });
});

describe('bintang dan kata skor', () => {
    it('emoji dan label per bintang', () => {
        expect(STAR_EMOJI[5]).toBe('🤩');
        expect(STAR_EMOJI[1]).toBe('😞');
        expect(STAR_LABELS[1]).toBe('Sangat kurang');
        expect(STAR_LABELS[5]).toBe('Luar biasa!');
    });
    it('scoreWord mengikuti batas scoreTone', () => {
        expect(scoreWord(4.5)).toBe('Sangat puas');
        expect(scoreWord(4.2)).toBe('Puas');
        expect(scoreWord(3.5)).toBe('Perlu perbaikan');
    });
    it('custom bands: scoreWord mengikuti batas survei', () => {
        const bands = { fairMin: 3.5, goodMin: 4.2 };
        expect(scoreWord(4.3, bands)).toBe('Sangat puas');
        expect(scoreWord(3.6, bands)).toBe('Puas');
        expect(scoreWord(3.4, bands)).toBe('Perlu perbaikan');
    });
    it('scoreBandsPreview: tiga rentang warna dengan satu desimal', () => {
        expect(scoreBandsPreview(CSI_SCORE_BANDS_DEFAULT)).toEqual([
            { tone: 'red', label: '< 4,0 merah' }, { tone: 'amber', label: '4,0–4,4 oranye' }, { tone: 'green', label: '≥ 4,5 hijau' },
        ]);
        expect(scoreBandsPreview({ fairMin: 4.3, goodMin: 4.4 })[1]).toEqual({ tone: 'amber', label: '4,3 oranye' });
    });
});

describe('toneClasses', () => {
    it('memakai token --ticket-* sebagai class literal', () => {
        expect(toneClasses('brown')).toEqual({
            fill: 'bg-[hsl(var(--ticket-brown))]',
            ink: 'text-[hsl(var(--ticket-brown-ink))]',
            soft: 'bg-[hsl(var(--ticket-brown)/var(--ticket-tint))]',
            ring: 'ring-[hsl(var(--ticket-brown))]',
        });
        expect(toneClasses('teal').ink).toBe('text-[hsl(var(--ticket-teal-ink))]');
    });
});

describe('toneColor', () => {
    it('memberi nilai warna CSS dari token --ticket-*', () => {
        expect(toneColor('green')).toBe('hsl(var(--ticket-green))');
        expect(toneColor('amber')).toBe('hsl(var(--ticket-amber))');
    });
});
