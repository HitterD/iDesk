import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type * as multer from 'multer';
import { extname, join, relative } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5; // matches the original FilesInterceptor('files', 5, ...) usage

// MIME / extension whitelist applied as the first line of defense.
// Magic-byte validation in `validateFileMagicBytes` runs after upload.
const ALLOWED_EXT = /\.(pdf|png|jpe?g|gif|webp|docx?|xlsx?|txt|csv|zip)$/i;

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
        cb(null, `${stamp}-${rand}${extname(safe)}`);
    },
});

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
): void => {
    if (!ALLOWED_EXT.test(file.originalname)) {
        return cb(new Error(`Unsupported file type: ${file.originalname}`));
    }
    cb(null, true);
};

const limits = { fileSize: MAX_FILE_SIZE, files: MAX_FILES };

/**
 * Drop-in replacement for `FilesInterceptor('files', 5, { storage })` with:
 *   - 10MB per-file size cap (P0: was missing — DoS risk)
 *   - extension whitelist (P0: was missing — arbitrary uploads accepted)
 *   - ticket-scoped subfolder + safer random filename
 *
 * Note: magic-byte validation still runs in the controller via
 * `validateFileMagicBytes`. The extension check is a cheap pre-filter; the
 * byte-level check is the authoritative guard.
 */
export const AttachmentMultiInterceptor = () =>
    FilesInterceptor('files', MAX_FILES, { storage, fileFilter, limits });

/** Single-file variant for endpoints that accept a `file` field. */
export const AttachmentSingleInterceptor = () =>
    FileInterceptor('files', { storage, fileFilter, limits });

/** Helper function to get standardized relative URL path for stored upload file */
export function getRelativeUploadPath(file: Express.Multer.File): string {
    if (file.path) {
        const rel = relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
        return `/uploads/${rel.replace(/^\/+/, '')}`;
    }
    return `/uploads/${file.filename}`;
}

