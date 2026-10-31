import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join, resolve, sep } from 'path';
import { DataSource } from 'typeorm';
import { validateFileMagicBytes } from '../../../shared/core/validators/magic-bytes.validator';
import { MAX_ATTACHMENT_SIZE, UPLOAD_ROOT } from '../presentation/interceptors/attachment-upload.interceptor';
import { TicketNoteAttachment } from './entities/ticket-note-attachment.entity';
import { TicketNoteAccessService } from './ticket-note-access.service';

const IMAGE_MIME: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
};

@Injectable()
export class TicketNoteAttachmentService {
    constructor(private readonly source: DataSource, private readonly access: TicketNoteAccessService) {}

    validate(file: Express.Multer.File): string {
        const mime = IMAGE_MIME[extname(file.originalname).toLowerCase()];
        if (!mime || file.size > MAX_ATTACHMENT_SIZE || !validateFileMagicBytes(file)) {
            throw new BadRequestException('Gambar tidak valid atau melebihi 25 MB.');
        }
        return mime;
    }

    async upload(noteId: string, actorId: string, file: Express.Multer.File) {
        if (!file) throw new BadRequestException('Gambar wajib diisi.');
        const mime = this.validate(file);
        const initial = await this.access.assertMember(noteId, actorId);
        this.access.assertWritable(initial.ticket);
        const id = randomUUID();
        const storageKey = join('ticket-notes', noteId, `${id}${extname(file.originalname).toLowerCase()}`);
        const filePath = join(UPLOAD_ROOT, storageKey);
        await fs.mkdir(join(UPLOAD_ROOT, 'ticket-notes', noteId), { recursive: true });
        await fs.writeFile(filePath, file.buffer, { flag: 'wx' });
        try {
            return await this.source.transaction(async manager => {
                await this.access.assertMember(noteId, actorId, manager, true);
                await manager.save(TicketNoteAttachment, manager.create(TicketNoteAttachment, {
                    id, noteId, uploaderId: actorId, storageKey, mime, size: file.size,
                    originalName: file.originalname.slice(0, 255),
                }));
                return { id, mime, size: file.size };
            });
        } catch (error) {
            await fs.unlink(filePath);
            throw error;
        }
    }

    async download(noteId: string, actorId: string, attachmentId: string) {
        await this.access.assertMember(noteId, actorId);
        const attachment = await this.source.manager.findOne(TicketNoteAttachment, { where: { id: attachmentId, noteId } });
        if (!attachment) throw new NotFoundException();
        const root = resolve(UPLOAD_ROOT, 'ticket-notes');
        const filePath = resolve(UPLOAD_ROOT, attachment.storageKey);
        if (!filePath.startsWith(root + sep)) throw new NotFoundException();
        return { filePath, mime: attachment.mime };
    }
}
