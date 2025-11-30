import { Logger } from '@nestjs/common';
import { Context } from 'telegraf';

/**
 * Media handler utilities for Telegram bot
 */
export class MediaHandler {
    private static readonly logger = new Logger('TelegramMediaHandler');

    private static readonly ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    private static readonly ALLOWED_DOC_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
    ];
    private static readonly MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    /**
     * Extract photo from message
     */
    static extractPhoto(ctx: Context): { fileId: string; width: number; height: number } | null {
        const photos = (ctx.message as any)?.photo;
        if (!photos || photos.length === 0) return null;

        // Get largest photo
        const photo = photos[photos.length - 1];
        return {
            fileId: photo.file_id,
            width: photo.width,
            height: photo.height,
        };
    }

    /**
     * Extract document from message
     */
    static extractDocument(ctx: Context): { fileId: string; fileName: string; mimeType: string; fileSize: number } | null {
        const doc = (ctx.message as any)?.document;
        if (!doc) return null;

        return {
            fileId: doc.file_id,
            fileName: doc.file_name || 'unknown',
            mimeType: doc.mime_type || 'application/octet-stream',
            fileSize: doc.file_size || 0,
        };
    }

    /**
     * Extract voice message from context
     */
    static extractVoice(ctx: Context): { fileId: string; duration: number; fileSize: number } | null {
        const voice = (ctx.message as any)?.voice;
        if (!voice) return null;

        return {
            fileId: voice.file_id,
            duration: voice.duration,
            fileSize: voice.file_size || 0,
        };
    }

    /**
     * Get file URL from Telegram
     */
    static async getFileUrl(ctx: Context, fileId: string): Promise<string | null> {
        try {
            const fileLink = await ctx.telegram.getFileLink(fileId);
            return fileLink.href;
        } catch (error) {
            this.logger.error('Failed to get file link:', error);
            return null;
        }
    }

    /**
     * Validate photo
     */
    static validatePhoto(fileSize: number): { valid: boolean; error?: string } {
        if (fileSize > this.MAX_FILE_SIZE) {
            return { valid: false, error: 'File terlalu besar. Maksimum 20MB.' };
        }
        return { valid: true };
    }

    /**
     * Validate document
     */
    static validateDocument(mimeType: string, fileSize: number): { valid: boolean; error?: string } {
        if (fileSize > this.MAX_FILE_SIZE) {
            return { valid: false, error: 'File terlalu besar. Maksimum 20MB.' };
        }
        
        const allowedTypes = [...this.ALLOWED_PHOTO_TYPES, ...this.ALLOWED_DOC_TYPES];
        if (!allowedTypes.includes(mimeType)) {
            return { valid: false, error: 'Tipe file tidak didukung.' };
        }

        return { valid: true };
    }

    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Get file extension from mime type
     */
    static getExtension(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'text/plain': 'txt',
            'text/csv': 'csv',
            'audio/ogg': 'ogg',
        };
        return mimeToExt[mimeType] || 'bin';
    }
}
