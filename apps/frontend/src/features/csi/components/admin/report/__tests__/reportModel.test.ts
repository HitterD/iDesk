import { describe, expect, it } from 'vitest';
import { questionColumns, questionDisplayLabel, questionFullText } from '../reportModel';
import { question, ratee } from './reportFixture';

const PREFIX = 'Tolong ungkapkan tingkat kepuasan Anda terhadap hal-hal berikut ini';

describe('questionDisplayLabel', () => {
    it('the short label wins over everything else', () => {
        expect(questionDisplayLabel({ name: PREFIX, shortLabel: 'Kecepatan', description: '[Kecepatan respon IT Support]' })).toBe('Kecepatan');
    });

    it('a generic name with a bracketed description shows the description without brackets', () => {
        expect(questionDisplayLabel({ name: PREFIX, shortLabel: null, description: ' [Kecepatan respon IT Support] ' })).toBe('Kecepatan respon IT Support');
        expect(questionDisplayLabel({ name: PREFIX, shortLabel: '  ', description: '[Kemampuan diagnosa]' })).toBe('Kemampuan diagnosa');
    });

    it('otherwise the name (no description, or one that is not bracketed)', () => {
        expect(questionDisplayLabel({ name: 'Keramahan petugas', shortLabel: null })).toBe('Keramahan petugas');
        expect(questionDisplayLabel({ name: 'Keramahan petugas', shortLabel: null, description: 'Sikap saat melayani' })).toBe('Keramahan petugas');
        expect(questionDisplayLabel({ name: 'Keramahan petugas', shortLabel: null, description: '[]' })).toBe('Keramahan petugas');
    });
});

describe('questionColumns', () => {
    it('keeps questions sharing one generic name apart by description, with the full text as name', () => {
        const speed = { ...question(PREFIX, 4), description: '[Kecepatan respon]' };
        const diagnosis = { ...question(PREFIX, 3), description: '[Kemampuan diagnosa]' };
        const columns = questionColumns([ratee({ periodRateeId: 'r1', displayName: 'Dimas', questions: [speed, diagnosis] })]);
        expect(columns.map((column) => column.label)).toEqual(['Kecepatan respon', 'Kemampuan diagnosa']);
        expect(columns.map((column) => column.average)).toEqual([4, 3]);
        expect(columns[0].name).toBe(questionFullText(speed));
        expect(columns[0].name).toBe(`${PREFIX} [Kecepatan respon]`);
    });
});
