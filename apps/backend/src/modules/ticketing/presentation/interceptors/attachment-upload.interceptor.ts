import { BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type * as multer from 'multer';
import { extname, join, relative } from 'path';
import { existsSync, mkdirSync, unlink } from 'fs';
import type { Request } from 'express';
import { ATTACHMENT_EXTENSIONS, VIDEO_EXTENSIONS, validateFileMagicBytes } from '../../../../shared/core/validators/magic-bytes.validator';
import type { AttachmentInfo } from '../../entities/ticket-message.entity';

export const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
const MB = 1024 * 1024;
/** Mirrored by frontend `FILE_SIZE_LIMITS` (ATTACHMENT, VIDEO, ATTACHMENT_TOTAL). */
export const MAX_ATTACHMENT_SIZE = 25 * MB;
export const MAX_VIDEO_SIZE = 50 * MB;
/** Kept under the edge nginx client_max_body_size (100M) with room for the multipart overhead. */
export const MAX_ATTACHMENT_TOTAL_SIZE = 95 * MB;
export const MAX_ATTACHMENT_FILES = 5;
const MAX_NAME_LENGTH = 200;

function ensureDir(dir: string): void {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const storage = diskStorage({
    destination: (req: Request, _file, cb) => {
        // Belt + suspenders: even though routes already validate UUID, never let a
        // crafted :id escape the tickets directory (path traversal via ../).
        // Anything that isn't a plain UUID lands in 'unscoped' instead of failing.
        const raw = (req.params?.id as string) || '';
        const ticketId = UUID_RE.test(raw) ? raw : 'unscoped';
        const dest = join(UPLOAD_ROOT, 'tickets', ticketId);
        ensureDir(dest);
        cb(null, dest);
    },
    filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^\w.\-]/g, '_');
        const stamp = Date.now().toString(36);
        const rand = Math.random().toString(36).slice(2, 10);
        cb(null, `${stamp}-${rand}${extname(safe).toLowerCase()}`);
    },
});

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
): void => {
    if (!ATTACHMENT_EXTENSIONS.includes(extname(file.originalname).toLowerCase())) {
        return cb(new BadRequestException(
            `Tipe file "${file.originalname}" tidak didukung. Yang diizinkan: ${ATTACHMENT_EXTENSIONS.join(', ')}`,
        ));
    }
    cb(null, true);
};

// multer has one cap for every file; the per-type caps are enforced in assertValidAttachments.
const limits = { fileSize: MAX_VIDEO_SIZE, files: MAX_ATTACHMENT_FILES };

/**
 * Drop-in replacement for `FilesInterceptor('files', 5, { storage })` with:
 *   - per-file size cap and extension whitelist
 *   - ticket-scoped subfolder + safer random filename
 *
 * The extension check is a cheap pre-filter; `assertValidAttachments` checks the
 * bytes after upload and is the authoritative guard.
 */
export const AttachmentMultiInterceptor = () =>
    FilesInterceptor('files', MAX_ATTACHMENT_FILES, { storage, fileFilter, limits, defParamCharset: 'utf8' });

/** Single-file variant for endpoints that accept a `file` field. */
export const AttachmentSingleInterceptor = () =>
    FileInterceptor('files', { storage, fileFilter, limits, defParamCharset: 'utf8' });

/** Helper function to get standardized relative URL path for stored upload file */
export function getRelativeUploadPath(file: Express.Multer.File): string {
    if (file.path) {
        const rel = relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
        return `/uploads/${rel.replace(/^\/+/, '')}`;
    }
    return `/uploads/${file.filename}`;
}

/** Deletes uploaded files that will not be attached (rejected or failed request). */
export function discardUploads(files: Express.Multer.File[] | undefined): void {
    for (const file of files ?? []) {
        if (file.path) unlink(file.path, () => undefined);
    }
}

const isVideo = (file: Express.Multer.File): boolean =>
    VIDEO_EXTENSIONS.includes(extname(file.originalname).toLowerCase());

/** Indonesian reason the upload must be refused, or null when every file is acceptable. */
function findAttachmentProblem(files: Express.Multer.File[]): string | null {
    const oversized = files.find((file) => file.size > (isVideo(file) ? MAX_VIDEO_SIZE : MAX_ATTACHMENT_SIZE));
    if (oversized) {
        const cap = (isVideo(oversized) ? MAX_VIDEO_SIZE : MAX_ATTACHMENT_SIZE) / MB;
        return `File "${oversized.originalname}" melebihi batas ${cap} MB`;
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_ATTACHMENT_TOTAL_SIZE) {
        return `Total lampiran melebihi ${MAX_ATTACHMENT_TOTAL_SIZE / MB} MB per kiriman`;
    }
    const invalid = files.find((file) => !validateFileMagicBytes(file));
    if (invalid) return `File "${invalid.originalname}" rusak atau isinya tidak sesuai dengan ekstensinya`;
    return null;
}

/**
 * Rejects the whole upload when a file is over its type's size cap, the files
 * together exceed the per-request total, or a file's content does not match its
 * extension (e.g. an .exe renamed to .pdf). Every file of the request is deleted.
 */
export function assertValidAttachments(files: Express.Multer.File[] | undefined): void {
    const problem = findAttachmentProblem(files ?? []);
    if (!problem) return;
    discardUploads(files);
    throw new BadRequestException(problem);
}

export function toAttachmentInfo(file: Express.Multer.File): AttachmentInfo {
    return {
        path: getRelativeUploadPath(file),
        name: file.originalname.slice(0, MAX_NAME_LENGTH),
        size: file.size,
        mime: file.mimetype,
    };
}
