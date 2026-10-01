import { FileValidator, Injectable } from '@nestjs/common';
import { closeSync, openSync, readSync } from 'fs';
import { extname } from 'path';

/** Bytes read from the start of a file: enough for every signature and the text check. */
const HEADER_BYTES = 8192;

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const GIF = [0x47, 0x49, 0x46, 0x38];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8, after the RIFF size
const PDF = [0x25, 0x50, 0x44, 0x46];
const OLE2 = [0xd0, 0xcf, 0x11, 0xe0]; // legacy .doc/.xls/.ppt
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // also .docx/.xlsx/.pptx
const ZIP_EMPTY = [0x50, 0x4b, 0x05, 0x06];
const RAR = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07];
const SEVEN_ZIP = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];

const startsWith = (buf: Buffer, sig: number[], offset = 0) =>
    buf.length >= offset + sig.length && sig.every((byte, i) => buf[offset + i] === byte);

/** Plain text has no NUL bytes; binaries renamed to .txt/.csv almost always do. */
const isText = (buf: Buffer) => !buf.includes(0x00);

/**
 * Accepted extensions and the content each must actually have. The extension alone
 * is client-controlled, so a file only passes when its bytes match its extension.
 */
const CONTENT_CHECKS: Record<string, (buf: Buffer) => boolean> = {
    '.jpg': (b) => startsWith(b, JPEG),
    '.jpeg': (b) => startsWith(b, JPEG),
    '.png': (b) => startsWith(b, PNG),
    '.gif': (b) => startsWith(b, GIF),
    '.webp': (b) => startsWith(b, RIFF) && startsWith(b, WEBP_TAG, 8),
    '.pdf': (b) => startsWith(b, PDF),
    '.doc': (b) => startsWith(b, OLE2),
    '.xls': (b) => startsWith(b, OLE2),
    '.ppt': (b) => startsWith(b, OLE2),
    '.docx': (b) => startsWith(b, ZIP),
    '.xlsx': (b) => startsWith(b, ZIP),
    '.pptx': (b) => startsWith(b, ZIP),
    '.zip': (b) => startsWith(b, ZIP) || startsWith(b, ZIP_EMPTY),
    '.rar': (b) => startsWith(b, RAR),
    '.7z': (b) => startsWith(b, SEVEN_ZIP),
    '.txt': isText,
    '.csv': isText,
};

/** Lower-case extensions (with dot) accepted for ticket attachments. */
export const ATTACHMENT_EXTENSIONS: readonly string[] = Object.keys(CONTENT_CHECKS);

function readHeader(file: Express.Multer.File): Buffer | null {
    if (file.buffer) return file.buffer.subarray(0, HEADER_BYTES);
    if (!file.path) return null;
    let fd: number | undefined;
    try {
        fd = openSync(file.path, 'r');
        const buf = Buffer.alloc(HEADER_BYTES);
        const read = readSync(fd, buf, 0, HEADER_BYTES, 0);
        return buf.subarray(0, read);
    } catch {
        return null;
    } finally {
        if (fd !== undefined) closeSync(fd);
    }
}

@Injectable()
export class MagicBytesValidator extends FileValidator {
    constructor(options?: Record<string, any>) {
        super(options || {});
    }

    isValid(file: Express.Multer.File): boolean {
        if (!file) return false;
        const check = CONTENT_CHECKS[extname(file.originalname || '').toLowerCase()];
        if (!check) return false;

        const header = readHeader(file);
        if (!header || header.length === 0) return false;
        return check(header);
    }

    buildErrorMessage(): string {
        return 'File type not allowed or file is corrupted';
    }
}

export function validateFileMagicBytes(file: Express.Multer.File): boolean {
    const validator = new MagicBytesValidator();
    return validator.isValid(file);
}
