import * as fflate from 'fflate';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { expandZip, matchPhotoFiles, normalizePhotoName, ZIP_MAX_BYTES, ZIP_MAX_PHOTOS } from '../photoMatch';

vi.mock('fflate', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fflate')>();
    return { ...actual, unzipSync: vi.fn(actual.unzipSync) };
});
const zipFile = (entries: Record<string, Uint8Array>) => new File([zipSync(entries, { level: 1 })], 'foto.zip', { type: 'application/zip' });
const MB = 1024 * 1024;

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

    it('does not decompress non-images, hidden or oversized entries', async () => {
        const files = await expandZip(zipFile({ 'a.jpg': strToU8('a'), 'big.png': new Uint8Array(5 * MB + 1), 'notes.txt': strToU8('t') }));
        expect(files.map((item) => item.name)).toEqual(['a.jpg']);
        const filter = vi.mocked(fflate.unzipSync).mock.calls.at(-1)?.[1]?.filter;
        expect(filter).toBeTypeOf('function');
        const info = (name: string, originalSize = 10) => ({ name, size: 5, originalSize, compression: 8 });
        expect(filter!(info('notes.txt'))).toBe(false);
        expect(filter!(info('__MACOSX/._a.jpg'))).toBe(false);
        expect(filter!(info('dir/.hidden.jpg'))).toBe(false);
        expect(filter!(info('huge.jpg', 5 * MB + 1))).toBe(false);
    });

    it('rejects a ZIP with too many photos or one that is too big', async () => {
        const many = Object.fromEntries(Array.from({ length: ZIP_MAX_PHOTOS + 1 }, (_, index) => [`p${index}.jpg`, strToU8('x')]));
        await expect(expandZip(zipFile(many))).rejects.toThrow('ZIP berisi lebih dari 300 foto');

        const large = zipFile({ 'a.jpg': strToU8('a') });
        Object.defineProperty(large, 'size', { value: ZIP_MAX_BYTES + 1 });
        const read = vi.spyOn(large, 'arrayBuffer');
        await expect(expandZip(large)).rejects.toThrow('ZIP terlalu besar (maks 50 MB)');
        expect(read).not.toHaveBeenCalled();
    });

    it('rejects a ZIP whose photos together exceed 50 MB once unpacked', async () => {
        const entries = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`p${index}.jpg`, new Uint8Array(5 * MB - 1)]));
        await expect(expandZip(zipFile(entries))).rejects.toThrow('ZIP terlalu besar (maks 50 MB)');
    });
});
