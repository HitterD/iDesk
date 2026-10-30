import { describe, expect, it } from 'vitest';
import { questionTone, scoreTone, scoreWord, siteTone, STAR_EMOJI, STAR_LABELS, toneClasses } from '../csiTone';

describe('scoreTone', () => {
    it('memakai batas 4,5 hijau dan 4,0 amber', () => {
        expect(scoreTone(4.5)).toBe('green');
        expect(scoreTone(4.49)).toBe('amber');
        expect(scoreTone(4)).toBe('amber');
        expect(scoreTone(3.99)).toBe('red');
        expect(scoreTone(null)).toBe('neutral');
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
