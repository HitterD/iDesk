import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface UploadedFile {
    id: string;
    originalName: string;
    filename: string;
    path: string;
    url: string;
    mimeType: string;
    size: number;
    createdAt: Date;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);
    private readonly uploadDir: string;
    private readonly baseUrl: string;

    constructor(
        private configService: ConfigService,
        @Optional() private readonly eventEmitter?: EventEmitter2,
    ) {
        // Default upload directory
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
        this.baseUrl = this.configService.get<string>('UPLOAD_BASE_URL', '/uploads');
        
        // Ensure upload directory exists
        this.ensureDirectory(this.uploadDir);
        this.ensureDirectory(path.join(this.uploadDir, 'attachments'));
        this.ensureDirectory(path.join(this.uploadDir, 'avatars'));
    }

    private ensureDirectory(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            this.logger.log(`Created directory: ${dir}`);
        }
    }

    /**
     * Save a buffer to file
     */
    async saveBuffer(
        buffer: Buffer,
        originalName: string,
        folder = 'attachments'
    ): Promise<UploadedFile> {
        const fileId = randomUUID();
        const extension = path.extname(originalName) || '';
        const filename = `${fileId}${extension}`;
        const folderPath = path.join(this.uploadDir, folder);
        const filePath = path.join(folderPath, filename);
        
        this.ensureDirectory(folderPath);
        
        await fs.promises.writeFile(filePath, buffer);
        
        const mimeType = this.getMimeType(extension);
        
        const result: UploadedFile = {
            id: fileId,
            originalName,
            filename,
            path: filePath,
            url: `${this.baseUrl}/${folder}/${filename}`,
            mimeType,
            size: buffer.length,
            createdAt: new Date(),
        };

        if (this.eventEmitter) {
            this.eventEmitter.emit('file.uploaded', {
                filePath,
                relativePath: `${folder}/${filename}`,
                folder,
                filename,
                originalName,
                size: buffer.length,
            });
        }

        return result;
    }

    /**
     * Delete a file
     */
    async deleteFile(filePath: string): Promise<boolean> {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
                this.logger.log(`Deleted file: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error(`Failed to delete file: ${filePath}`, error);
            return false;
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(filePath: string): Promise<fs.Stats | null> {
        try {
            return await fs.promises.stat(filePath);
        } catch {
            return null;
        }
    }

    private getMimeType(extension: string): string {
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
        };
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
}
