import { describe, it, expect } from 'vitest';
import { FILE_SIZE_LIMITS, toUploadPercent, validateAttachmentFile, validateFiles } from './file-validation';

const fileOf = (name: string, size = 10, type = '') => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};

describe('validateAttachmentFile', () => {
    it.each(['Data.XLSX', 'arsip.zip', 'arsip.rar', 'arsip.7z', 'slide.pptx', 'memo.doc', 'data.csv'])(
        'accepts %s by extension regardless of the reported MIME type',
        (name) => {
            expect(validateAttachmentFile(fileOf(name, 10, 'application/octet-stream')).valid).toBe(true);
        },
    );

    it.each(['setup.exe', 'image.svg', 'script.js', 'noextension'])('rejects %s', (name) => {
        expect(validateAttachmentFile(fileOf(name)).valid).toBe(false);
    });

    it('allows videos up to 50MB but not other files', () => {
        expect(validateAttachmentFile(fileOf('clip.MP4', FILE_SIZE_LIMITS.VIDEO)).valid).toBe(true);
        expect(validateAttachmentFile(fileOf('iphone.mov', 40 * 1024 * 1024)).valid).toBe(true);
        expect(validateAttachmentFile(fileOf('clip.webm', FILE_SIZE_LIMITS.VIDEO + 1)).valid).toBe(false);
        expect(validateAttachmentFile(fileOf('big.pdf', 40 * 1024 * 1024)).valid).toBe(false);
    });

    it('rejects files over 25MB', () => {
        const result = validateAttachmentFile(fileOf('big.zip', FILE_SIZE_LIMITS.ATTACHMENT + 1));
        expect(result.valid).toBe(false);
        expect(result.error).toContain('25 MB');
    });
});

describe('validateFiles', () => {
    it('rejects more than five files', () => {
        const files = Array.from({ length: 6 }, (_, i) => fileOf(`f${i}.txt`));
        expect(validateFiles(files)).toEqual({ valid: false, error: 'Maksimal 5 file per kirim' });
    });

    it('rejects a send whose files add up to more than the total limit', () => {
        const files = [fileOf('a.mp4', FILE_SIZE_LIMITS.VIDEO), fileOf('b.mp4', FILE_SIZE_LIMITS.VIDEO)];
        expect(validateFiles(files)).toEqual({ valid: false, error: 'Total lampiran melebihi 95 MB per kiriman' });
    });

    it('names the offending file', () => {
        const result = validateFiles([fileOf('ok.pdf'), fileOf('bad.exe')]);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/^bad\.exe: /);
    });
});

describe('toUploadPercent', () => {
    it('rounds and clamps, and returns 0 when the total is unknown', () => {
        expect(toUploadPercent(50, 200)).toBe(25);
        expect(toUploadPercent(300, 200)).toBe(100);
        expect(toUploadPercent(50, undefined)).toBe(0);
    });
});
