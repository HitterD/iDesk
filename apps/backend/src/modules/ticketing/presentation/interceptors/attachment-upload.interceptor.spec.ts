import { BadRequestException } from '@nestjs/common';
import { assertValidAttachments } from './attachment-upload.interceptor';

const MB = 1024 * 1024;
const MP4 = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const PDF = Buffer.from('%PDF-1.7');

// In-memory uploads: `size` is what multer reports, `buffer` is what the content check reads.
const upload = (originalname: string, buffer: Buffer, sizeMb: number) =>
    ({ originalname, buffer, size: sizeMb * MB }) as Express.Multer.File;

const problemOf = (files: Express.Multer.File[]): string | null => {
    try {
        assertValidAttachments(files);
        return null;
    } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        return (error as BadRequestException).message;
    }
};

describe('assertValidAttachments', () => {
    it('accepts a 50 MB video next to a 25 MB document', () => {
        expect(problemOf([upload('clip.mp4', MP4, 50), upload('doc.pdf', PDF, 25)])).toBeNull();
    });

    it('rejects a video over 50 MB', () => {
        expect(problemOf([upload('clip.mp4', MP4, 51)])).toBe('File "clip.mp4" melebihi batas 50 MB');
    });

    it('keeps the 25 MB cap for non-video files', () => {
        expect(problemOf([upload('doc.pdf', PDF, 26)])).toBe('File "doc.pdf" melebihi batas 25 MB');
    });

    it('rejects a request whose files add up to more than 95 MB', () => {
        expect(problemOf([upload('a.mp4', MP4, 50), upload('b.mp4', MP4, 46)]))
            .toBe('Total lampiran melebihi 95 MB per kiriman');
    });

    it('still rejects a video whose content does not match its extension', () => {
        expect(problemOf([upload('clip.mp4', PDF, 1)]))
            .toBe('File "clip.mp4" rusak atau isinya tidak sesuai dengan ekstensinya');
    });
});
