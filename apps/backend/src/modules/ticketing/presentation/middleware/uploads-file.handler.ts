import * as fs from 'fs';
import * as path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { TICKET_UPLOAD_DIR, TicketAttachmentAccessService } from '../../services/ticket-attachment-access.service';

/** Shown inline (the chat renders them in <img>); every other ticket file is forced to download. */
const INLINE_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

type AttachmentAccessChecker = Pick<TicketAttachmentAccessService, 'authenticate' | 'authorize'>;

const isFile = (p: string): boolean => {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
};

/** Path relative to the root with forward slashes, or null when it escapes the root. */
function relativeInside(root: string, target: string): string | null {
    const rel = path.relative(root, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
}

const isTicketPath = (rel: string): boolean =>
    rel.split('/')[0].toLowerCase() === TICKET_UPLOAD_DIR;

/** Legacy flat URLs (`/uploads/<file>`) for files that now live in `tickets/<dir>/`. */
function findInTicketDirs(root: string, fileName: string): string | null {
    const ticketsDir = path.join(root, TICKET_UPLOAD_DIR);
    let dirs: string[];
    try {
        dirs = fs.readdirSync(ticketsDir);
    } catch {
        return null;
    }
    const preferred = ['unscoped', ...dirs.filter((d) => d !== 'unscoped')];
    for (const dir of preferred) {
        const candidate = path.join(ticketsDir, dir, fileName);
        if (isFile(candidate)) return candidate;
    }
    return null;
}

/**
 * GET/HEAD handler for `/uploads`. Non-ticket files are served as before. Ticket
 * chat attachments require a signed-in user who can open the ticket, are never
 * left to the static fallbacks (which would skip that check), and are sent with
 * `Content-Disposition: attachment` unless they are plain images.
 */
export function createUploadsFileHandler(uploadRoot: string, access: AttachmentAccessChecker) {
    const root = path.resolve(uploadRoot);

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        let decoded: string;
        try {
            decoded = decodeURIComponent(req.path).replace(/^[/\\]+/, '');
        } catch {
            res.status(400).send('Bad Request');
            return;
        }
        if (decoded.includes('\0')) {
            res.status(400).send('Bad Request');
            return;
        }

        const target = path.resolve(root, decoded);
        const rel = relativeInside(root, target);
        if (rel === null) {
            res.status(403).send('Forbidden');
            return;
        }

        let filePath: string | null = isFile(target) ? target : null;
        if (!filePath && !rel.includes('/')) filePath = findInTicketDirs(root, rel);

        if (!filePath) {
            // Let the static middlewares answer 404s, but never for ticket paths.
            if (isTicketPath(rel)) {
                res.status(404).send('Not Found');
                return;
            }
            return next();
        }

        const fileRel = relativeInside(root, filePath) ?? '';
        if (!isTicketPath(fileRel)) {
            res.sendFile(filePath);
            return;
        }

        const viewer = access.authenticate(req);
        if (!viewer) {
            res.status(401).send('Unauthorized');
            return;
        }
        try {
            const result = await access.authorize(viewer, fileRel);
            if (!result.ok) {
                res.status(result.status).send(result.status === 403 ? 'Forbidden' : 'Not Found');
                return;
            }
            const fileName = path.basename(filePath);
            if (!INLINE_IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())) {
                res.attachment(result.downloadName ?? fileName);
            }
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, no-cache');
            res.sendFile(filePath);
        } catch (error) {
            next(error);
        }
    };
}
