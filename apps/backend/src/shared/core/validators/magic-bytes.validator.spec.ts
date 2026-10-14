import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateFileMagicBytes } from './magic-bytes.validator';

const asUpload = (originalname: string, bytes: number[] | string): Express.Multer.File =>
    ({
        originalname,
        buffer: typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes),
    }) as Express.Multer.File;

const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00];
const EXE = [0x4d, 0x5a, 0x90, 0x00];
// ISO base media: 4-byte box size, then "ftyp" and a brand
const FTYP = (brand: string) => [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, ...Buffer.from(brand)];
const EBML = [0x1a, 0x45, 0xdf, 0xa3, 0x9f];

describe('validateFileMagicBytes', () => {
    it.each([
        ['report.xlsx', ZIP],
        ['letter.DOCX', ZIP],
        ['slides.pptx', ZIP],
        ['bundle.zip', ZIP],
        ['legacy.xls', [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]],
        ['archive.rar', [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01]],
        ['archive.7z', [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]],
        ['shot.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]],
        ['photo.webp', [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]],
        ['doc.pdf', '%PDF-1.7'],
        ['data.csv', 'a,b\n1,2\n'],
        ['clip.mp4', FTYP('isom')],
        ['iphone.MOV', FTYP('qt  ')],
        ['legacy.mov', [0x00, 0x00, 0x00, 0x08, ...Buffer.from('wide')]],
        ['screen.webm', EBML],
    ])('accepts %s whose content matches the extension', (name, bytes) => {
        expect(validateFileMagicBytes(asUpload(name, bytes))).toBe(true);
    });

    it.each([
        ['invoice.pdf', EXE],
        ['report.xlsx', EXE],
        ['notes.txt', EXE],
        ['photo.webp', [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]],
        ['clip.mp4', EXE],
        ['screen.webm', FTYP('isom')],
    ])('rejects %s whose content does not match', (name, bytes) => {
        expect(validateFileMagicBytes(asUpload(name, bytes))).toBe(false);
    });

    it('rejects extensions outside the whitelist even with valid bytes', () => {
        expect(validateFileMagicBytes(asUpload('setup.exe', EXE))).toBe(false);
        expect(validateFileMagicBytes(asUpload('page.svg', '<svg/>'))).toBe(false);
    });

    it('rejects empty files', () => {
        expect(validateFileMagicBytes(asUpload('empty.txt', ''))).toBe(false);
    });

    it('reads disk uploads by path', () => {
        const dir = mkdtempSync(join(tmpdir(), 'magic-'));
        try {
            const path = join(dir, 'x.zip');
            writeFileSync(path, Buffer.from(ZIP));
            expect(validateFileMagicBytes({ originalname: 'x.zip', path } as Express.Multer.File)).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
