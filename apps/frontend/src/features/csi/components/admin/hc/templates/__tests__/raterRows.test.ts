import { describe, expect, it } from 'vitest';
import type { CsiTemplate, CsiTemplateRater } from '../../../../../hcTypes';
import { groupRaters } from '../raterRows';

const rater = (id: string, status: CsiTemplateRater['status'], userId: string | null = 'u1', raterName = 'BUDI'): CsiTemplateRater =>
    ({ id, status, userId, raterName, raterNik: null, raterJobTitle: null, confirmed: status === 'confirmed' });

function templateWith(raters: CsiTemplateRater[][]): CsiTemplate {
    return {
        id: 't1', scope: 'HC', locationCode: 'SMG', name: 'Semarang', updatedAt: null,
        summary: { pics: raters.length, picsUnmatched: 0, picsWithoutRaters: 0, raters: 0, ratersConfirmed: 0, ratersOk: 0, ratersNoAccount: 0, ratersAmbiguous: 0 },
        pics: raters.map((rows, i) => ({
            id: `p${i}`, area: 'HC Services', serviceCode: 'HCS', picName: i === 0 ? 'ZUL' : 'ANI',
            jobTitle: null, serviceFunction: null, picId: null, teamId: null, raterCount: rows.length, raters: rows,
        })),
    };
}

describe('groupRaters', () => {
    it('merges unresolved names after normalising case and whitespace, without merging linked accounts', () => {
        const rows = groupRaters(templateWith([
            [rater('a', 'no-account', null, '  Budi   Santoso ')],
            [rater('b', 'ambiguous', null, 'budi santoso'), rater('c', 'ok', 'linked', 'Budi Santoso')],
        ]));
        expect(rows.map(({ key, raterIds }) => ({ key, raterIds }))).toEqual([
            { key: 'name:BUDI SANTOSO', raterIds: ['a', 'b'] }, { key: 'linked', raterIds: ['c'] },
        ]);
    });

    it('sorts worst status first then name and applies every adjacent precedence', () => {
        const rows = groupRaters(templateWith([[
            rater('c', 'confirmed', 'c', 'ANI'), rater('o', 'ok', 'o', 'ZUL'),
            rater('a', 'ambiguous', 'a', 'ANI'), rater('n', 'no-account', null, 'ZUL'),
            rater('b', 'ambiguous', 'b', 'BUDI'), rater('o2', 'confirmed', 'o'), rater('a2', 'ok', 'a'),
        ]]));
        expect(rows.map(({ key, status }) => [key, status])).toEqual([
            ['name:ZUL', 'no-account'], ['a', 'ambiguous'], ['b', 'ambiguous'], ['o', 'ok'], ['c', 'confirmed'],
        ]);
        expect(groupRaters(templateWith([]))).toEqual([]);
    });

    it('merges by userId, keeps first non-null NIK, unique sorted PICs and worst status', () => {
        const view = templateWith([
            [rater('a', 'confirmed'), { ...rater('b', 'ok'), raterNik: '0123' }],
            [{ ...rater('c', 'ambiguous', 'u1', 'Budi Santoso'), raterNik: '9999' }, rater('d', 'no-account')],
        ]);
        expect(groupRaters(view)).toEqual([{
            key: 'u1', name: 'BUDI', nik: '0123', userId: 'u1', status: 'no-account',
            raterIds: ['a', 'b', 'c', 'd'], pics: ['ANI', 'ZUL'],
        }]);
    });
});
