import { FileValidator, Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';

const ALLOWED_MIME_TYPES: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4b, 0x03, 0x04],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4b, 0x03, 0x04],
    'text/plain': [],
};

@Injectable()
export class MagicBytesValidator extends FileValidator {
    constructor(options?: Record<string, any>) {
        super(options || {});
    }

    isValid(file: Express.Multer.File): boolean {
        if (!file) return false;

        let buffer: Buffer;
        
        if (file.buffer) {
            buffer = file.buffer;
        } else if (file.path) {
            try {
                buffer = readFileSync(file.path);
            } catch {
                return false;
            }
        } else {
            return false;
        }

        if (buffer.length === 0) return false;

        return Object.entries(ALLOWED_MIME_TYPES).some(([, bytes]) => {
            if (bytes.length === 0) return true;
            return bytes.every((byte, i) => buffer[i] === byte);
        });
    }

    buildErrorMessage(): string {
        return 'File type not allowed or file is corrupted';
    }
}

export function validateFileMagicBytes(file: Express.Multer.File): boolean {
    const validator = new MagicBytesValidator();
    return validator.isValid(file);
}
