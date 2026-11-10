import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { expandZip, matchPhotoFiles, normalizePhotoName } from '../photoMatch';

const SUBJECTS = [
    { key: 'pic:p1', name: 'Rara Kurnia' },
    { key: 'team:t1', name: 'Tim Payroll KRW' },
    { key: 'pic:p2', name: 'Budi Santoso' },
    { key: 'user:u9', name: 'budi  santoso' },
];

describe('photoMatch', () => {
    it('matches normalised file names', () => {
        expect(normalizePhotoName('Tim_Payroll-KRW.png')).toBe('TIM PAYROLL KRW');
        const result = matchPhotoFiles([{ name: 'rara  kurnia.JPG' }, { name: 'Tim_Payroll-KRW.png' }, { name: 'nobody.webp' }], SUBJECTS);
        expect(result.map(({ key, candidates }) => ({ key, candidates }))).toEqual([
            { key: 'pic:p1', candidates: [] },
            { key: 'team:t1', candidates: [] },
            { key: null, candidates: [] },
        ]);
        expect(result[0].file).toEqual({ name: 'rara  kurnia.JPG' });
    });

    it('ambiguous not auto-assigned', () => {
        const [row] = matchPhotoFiles([{ name: 'Budi.Santoso.jpeg' }], SUBJECTS);
        expect(row.key).toBeNull();
        expect(row.candidates).toEqual(['pic:p2', 'user:u9']);
    });

    it('ignores non-images', async () => {
        const zip = zipSync({
            'foto/Rara Kurnia.jpg': strToU8('jpg'),
            'Tim Payroll.PNG': strToU8('png'),
            'x.webp': strToU8('webp'),
            'notes.txt': strToU8('text'),
            '__MACOSX/foto/._Rara Kurnia.jpg': strToU8('junk'),
            'foto/.hidden.jpg': strToU8('junk'),
        });
        const file = new File([zip], 'foto.zip', { type: 'application/zip' });
        const files = await expandZip(file);
        expect(files.map((item) => [item.name, item.type])).toEqual([
            ['Rara Kurnia.jpg', 'image/jpeg'],
            ['Tim Payroll.PNG', 'image/png'],
            ['x.webp', 'image/webp'],
        ]);
    });
});
