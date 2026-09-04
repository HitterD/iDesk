import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { TicketMessage } from '../ticketing/entities/ticket-message.entity';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { SettingsService, StorageSettings } from './settings.service';
import { UploadService } from '../../shared/upload/upload.service';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export interface CleanupPreview {
    attachments: { count: number; sizeBytes: number; files: string[] };
    notes: { count: number };
    discussions: { count: number };
}

export interface ImageCompressionResult {
    totalScanned: number;
    compressedCount: number;
    skippedCount: number;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    freedBytes: number;
    savingsPercentage: number;
    errors: string[];
    executedAt: Date;
}

export interface ImageCompressionPreview {
    eligibleCount: number;
    totalSizeBytes: number;
    estimatedSavingsBytes: number;
    files: Array<{ url: string; sizeBytes: number; createdAt: string }>;
}

export interface CleanupResult {
    attachments: { deleted: number; freedBytes: number; errors: string[] };
    notes: { deleted: number };
    discussions: { deleted: number };
    imageCompression?: ImageCompressionResult;
    executedAt: Date;
    executedBy?: string;
}

export interface ManualCleanupOptions {
    fromDate: Date;
    toDate: Date;
    deleteAttachments: boolean;
    deleteNotes: boolean;
    deleteDiscussions: boolean;
    onlyResolvedTickets: boolean;
}

@Injectable()
export class StorageCleanupService {
    private readonly logger = new Logger(StorageCleanupService.name);
    private readonly uploadDir: string;

    constructor(
        @InjectRepository(TicketMessage)
        private readonly messageRepo: Repository<TicketMessage>,
        @InjectRepository(Ticket)
        private readonly ticketRepo: Repository<Ticket>,
        private readonly settingsService: SettingsService,
        private readonly uploadService: UploadService,
    ) {
        this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    }

    // Run daily at 2 AM
    @Cron('0 2 * * *')
    async runScheduledCleanup(): Promise<void> {
        const settings = await this.settingsService.getStorageSettings();

        if (!settings.autoCleanupEnabled) {
            this.logger.debug('Auto cleanup is disabled, skipping');
            return;
        }

        this.logger.log('Starting scheduled storage cleanup...');

        try {
            const result = await this.performAutoCleanup(settings);
            this.logger.log(`Scheduled cleanup completed: ${JSON.stringify(result)}`);
        } catch (error) {
            this.logger.error('Scheduled cleanup failed:', error);
        }
    }

    async performAutoCleanup(settings: StorageSettings): Promise<CleanupResult> {
        const result: CleanupResult = {
            attachments: { deleted: 0, freedBytes: 0, errors: [] },
            notes: { deleted: 0 },
            discussions: { deleted: 0 },
            executedAt: new Date(),
        };

        const now = new Date();

        // Cleanup attachments
        if (settings.attachments.enabled && settings.attachments.retentionDays > 0) {
            const cutoffDate = new Date(now.getTime() - settings.attachments.retentionDays * 24 * 60 * 60 * 1000);
            const attachResult = await this.cleanupAttachments(cutoffDate, settings.attachments.onlyResolvedTickets);
            result.attachments = attachResult;
        }

        // Cleanup notes (internal messages)
        if (settings.notes.enabled && settings.notes.retentionDays > 0) {
            const cutoffDate = new Date(now.getTime() - settings.notes.retentionDays * 24 * 60 * 60 * 1000);
            const notesResult = await this.cleanupNotes(cutoffDate, settings.notes.onlyResolvedTickets);
            result.notes = notesResult;
        }

        // Cleanup discussions (non-internal, non-system messages)
        if (settings.discussions.enabled && settings.discussions.retentionDays > 0) {
            const cutoffDate = new Date(now.getTime() - settings.discussions.retentionDays * 24 * 60 * 60 * 1000);
            const discussResult = await this.cleanupDiscussions(cutoffDate, settings.discussions.onlyResolvedTickets);
            result.discussions = discussResult;
        }

        // Compress old images (>90 days by default)
        if (settings.imageCompression?.enabled && settings.imageCompression.retentionDays > 0) {
            const compressionResult = await this.compressImages({
                olderThanDays: settings.imageCompression.retentionDays,
                onlyResolvedTickets: settings.imageCompression.onlyResolvedTickets,
                quality: settings.imageCompression.quality,
                maxWidth: settings.imageCompression.maxWidth,
            });
            result.imageCompression = compressionResult;
        }

        return result;
    }

    async previewCleanup(options: ManualCleanupOptions): Promise<CleanupPreview> {
        const preview: CleanupPreview = {
            attachments: { count: 0, sizeBytes: 0, files: [] },
            notes: { count: 0 },
            discussions: { count: 0 },
        };

        const ticketFilter = options.onlyResolvedTickets
            ? await this.getResolvedTicketIds()
            : null;

        if (options.deleteAttachments) {
            const messages = await this.getMessagesWithAttachments(options.fromDate, options.toDate, ticketFilter);
            for (const msg of messages) {
                if (msg.attachments && msg.attachments.length > 0) {
                    for (const attachment of msg.attachments) {
                        preview.attachments.count++;
                        preview.attachments.files.push(attachment);
                        // Try to get file size
                        const filePath = this.getFilePath(attachment);
                        if (filePath && fs.existsSync(filePath)) {
                            const stats = fs.statSync(filePath);
                            preview.attachments.sizeBytes += stats.size;
                        }
                    }
                }
            }
        }

        if (options.deleteNotes) {
            preview.notes.count = await this.countNotes(options.fromDate, options.toDate, ticketFilter);
        }

        if (options.deleteDiscussions) {
            preview.discussions.count = await this.countDiscussions(options.fromDate, options.toDate, ticketFilter);
        }

        return preview;
    }

    async executeManualCleanup(options: ManualCleanupOptions, userId?: string): Promise<CleanupResult> {
        const result: CleanupResult = {
            attachments: { deleted: 0, freedBytes: 0, errors: [] },
            notes: { deleted: 0 },
            discussions: { deleted: 0 },
            executedAt: new Date(),
            executedBy: userId,
        };

        const ticketFilter = options.onlyResolvedTickets
            ? await this.getResolvedTicketIds()
            : null;

        if (options.deleteAttachments) {
            result.attachments = await this.cleanupAttachmentsInRange(
                options.fromDate, options.toDate, ticketFilter
            );
        }

        if (options.deleteNotes) {
            result.notes = await this.cleanupNotesInRange(
                options.fromDate, options.toDate, ticketFilter
            );
        }

        if (options.deleteDiscussions) {
            result.discussions = await this.cleanupDiscussionsInRange(
                options.fromDate, options.toDate, ticketFilter
            );
        }

        this.logger.log(`Manual cleanup by ${userId}: ${JSON.stringify(result)}`);
        return result;
    }

    async getStorageStats(): Promise<{
        total: { count: number; sizeBytes: number };
        attachments: { count: number; sizeBytes: number };
        byFolder: Record<string, { count: number; sizeBytes: number }>;
    }> {
        const stats = {
            total: { count: 0, sizeBytes: 0 },
            attachments: { count: 0, sizeBytes: 0 },
            byFolder: {} as Record<string, { count: number; sizeBytes: number }>,
        };

        try {
            const folders = ['attachments', 'avatars', 'telegram'];
            for (const folder of folders) {
                const folderPath = path.join(this.uploadDir, folder);
                if (fs.existsSync(folderPath)) {
                    const folderStats = this.getFolderStats(folderPath);
                    stats.byFolder[folder] = folderStats;
                    stats.total.count += folderStats.count;
                    stats.total.sizeBytes += folderStats.sizeBytes;

                    if (folder === 'attachments') {
                        stats.attachments = folderStats;
                    }
                }
            }
        } catch (error) {
            this.logger.error('Error getting storage stats:', error);
        }

        return stats;
    }

    private getFolderStats(folderPath: string): { count: number; sizeBytes: number } {
        let count = 0;
        let sizeBytes = 0;

        try {
            const files = fs.readdirSync(folderPath);
            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    count++;
                    sizeBytes += stat.size;
                }
            }
        } catch (error) {
            this.logger.error(`Error reading folder ${folderPath}:`, error);
        }

        return { count, sizeBytes };
    }

    private async getResolvedTicketIds(): Promise<string[]> {
        const tickets = await this.ticketRepo.find({
            where: { status: In(['RESOLVED', 'CANCELLED']) },
            select: ['id'],
        });
        return tickets.map(t => t.id);
    }

    private async getMessagesWithAttachments(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<TicketMessage[]> {
        const qb = this.messageRepo.createQueryBuilder('msg')
            .where('msg.createdAt >= :fromDate', { fromDate })
            .andWhere('msg.createdAt <= :toDate', { toDate })
            .andWhere('msg.attachments IS NOT NULL');

        if (ticketIds) {
            qb.andWhere('msg.ticketId IN (:...ticketIds)', { ticketIds });
        }

        return qb.getMany();
    }

    private async countNotes(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<number> {
        const qb = this.messageRepo.createQueryBuilder('msg')
            .where('msg.createdAt >= :fromDate', { fromDate })
            .andWhere('msg.createdAt <= :toDate', { toDate })
            .andWhere('msg.isInternal = true');

        if (ticketIds) {
            qb.andWhere('msg.ticketId IN (:...ticketIds)', { ticketIds });
        }

        return qb.getCount();
    }

    private async countDiscussions(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<number> {
        const qb = this.messageRepo.createQueryBuilder('msg')
            .where('msg.createdAt >= :fromDate', { fromDate })
            .andWhere('msg.createdAt <= :toDate', { toDate })
            .andWhere('msg.isInternal = false')
            .andWhere('msg.isSystemMessage = false');

        if (ticketIds) {
            qb.andWhere('msg.ticketId IN (:...ticketIds)', { ticketIds });
        }

        return qb.getCount();
    }

    private async cleanupAttachments(
        cutoffDate: Date, onlyResolved: boolean
    ): Promise<{ deleted: number; freedBytes: number; errors: string[] }> {
        return this.cleanupAttachmentsInRange(
            new Date(0), cutoffDate,
            onlyResolved ? await this.getResolvedTicketIds() : null
        );
    }

    private async cleanupAttachmentsInRange(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<{ deleted: number; freedBytes: number; errors: string[] }> {
        const result = { deleted: 0, freedBytes: 0, errors: [] as string[] };

        const messages = await this.getMessagesWithAttachments(fromDate, toDate, ticketIds);

        for (const msg of messages) {
            if (!msg.attachments) continue;

            for (const attachment of msg.attachments) {
                const filePath = this.getFilePath(attachment);
                if (filePath && fs.existsSync(filePath)) {
                    try {
                        const stats = fs.statSync(filePath);
                        fs.unlinkSync(filePath);
                        result.deleted++;
                        result.freedBytes += stats.size;
                    } catch (error) {
                        result.errors.push(`Failed to delete ${filePath}: ${error.message}`);
                    }
                }
            }

            // Clear attachments array in DB
            await this.messageRepo.update(msg.id, { attachments: [] });
        }

        return result;
    }

    private async cleanupNotes(
        cutoffDate: Date, onlyResolved: boolean
    ): Promise<{ deleted: number }> {
        return this.cleanupNotesInRange(
            new Date(0), cutoffDate,
            onlyResolved ? await this.getResolvedTicketIds() : null
        );
    }

    private async cleanupNotesInRange(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<{ deleted: number }> {
        const qb = this.messageRepo.createQueryBuilder()
            .delete()
            .where('createdAt >= :fromDate', { fromDate })
            .andWhere('createdAt <= :toDate', { toDate })
            .andWhere('isInternal = true');

        if (ticketIds && ticketIds.length > 0) {
            qb.andWhere('ticketId IN (:...ticketIds)', { ticketIds });
        }

        const result = await qb.execute();
        return { deleted: result.affected || 0 };
    }

    private async cleanupDiscussions(
        cutoffDate: Date, onlyResolved: boolean
    ): Promise<{ deleted: number }> {
        return this.cleanupDiscussionsInRange(
            new Date(0), cutoffDate,
            onlyResolved ? await this.getResolvedTicketIds() : null
        );
    }

    private async cleanupDiscussionsInRange(
        fromDate: Date, toDate: Date, ticketIds: string[] | null
    ): Promise<{ deleted: number }> {
        const qb = this.messageRepo.createQueryBuilder()
            .delete()
            .where('createdAt >= :fromDate', { fromDate })
            .andWhere('createdAt <= :toDate', { toDate })
            .andWhere('isInternal = false')
            .andWhere('isSystemMessage = false');

        if (ticketIds && ticketIds.length > 0) {
            qb.andWhere('ticketId IN (:...ticketIds)', { ticketIds });
        }

        const result = await qb.execute();
        return { deleted: result.affected || 0 };
    }

    private getFilePath(attachmentUrl: string): string | null {
        // attachmentUrl is like /uploads/attachments/uuid.ext
        if (!attachmentUrl) return null;

        try {
            // Remove leading slash and replace /uploads with uploadDir
            const relativePath = attachmentUrl.replace(/^\/uploads\//, '');
            return path.join(this.uploadDir, relativePath);
        } catch {
            return null;
        }
    }

    private isImageFile(filePathOrUrl: string): boolean {
        if (!filePathOrUrl) return false;
        const ext = path.extname(filePathOrUrl).toLowerCase();
        return ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext);
    }

    /**
     * Preview image compression for images older than specified days
     */
    async previewImageCompression(options: {
        olderThanDays?: number;
        onlyResolvedTickets?: boolean;
    }): Promise<ImageCompressionPreview> {
        const olderThanDays = options.olderThanDays ?? 90;
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const ticketFilter = options.onlyResolvedTickets !== false
            ? await this.getResolvedTicketIds()
            : null;

        const messages = await this.getMessagesWithAttachments(new Date(0), cutoffDate, ticketFilter);
        const files: Array<{ url: string; sizeBytes: number; createdAt: string }> = [];
        let totalSizeBytes = 0;

        for (const msg of messages) {
            if (!msg.attachments || msg.attachments.length === 0) continue;
            for (const att of msg.attachments) {
                if (this.isImageFile(att)) {
                    const filePath = this.getFilePath(att);
                    if (filePath && fs.existsSync(filePath)) {
                        const stat = fs.statSync(filePath);
                        totalSizeBytes += stat.size;
                        files.push({
                            url: att,
                            sizeBytes: stat.size,
                            createdAt: msg.createdAt ? msg.createdAt.toISOString() : new Date().toISOString(),
                        });
                    }
                }
            }
        }

        // Estimated ~75% savings when converting to WebP
        const estimatedSavingsBytes = Math.round(totalSizeBytes * 0.75);

        return {
            eligibleCount: files.length,
            totalSizeBytes,
            estimatedSavingsBytes,
            files: files.slice(0, 100),
        };
    }

    /**
     * Compress eligible images older than specified days into high-quality WebP
     */
    async compressImages(options: {
        olderThanDays?: number;
        onlyResolvedTickets?: boolean;
        quality?: number;
        maxWidth?: number;
    }): Promise<ImageCompressionResult> {
        const olderThanDays = options.olderThanDays ?? 90;
        const quality = options.quality ?? 80;
        const maxWidth = options.maxWidth ?? 1600;
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const ticketFilter = options.onlyResolvedTickets !== false
            ? await this.getResolvedTicketIds()
            : null;

        const messages = await this.getMessagesWithAttachments(new Date(0), cutoffDate, ticketFilter);

        let totalScanned = 0;
        let compressedCount = 0;
        let skippedCount = 0;
        let originalSizeBytes = 0;
        let compressedSizeBytes = 0;
        const errors: string[] = [];

        for (const msg of messages) {
            if (!msg.attachments || msg.attachments.length === 0) continue;

            let messageUpdated = false;
            const updatedAttachments: string[] = [];

            for (const att of msg.attachments) {
                totalScanned++;

                if (!this.isImageFile(att)) {
                    updatedAttachments.push(att);
                    skippedCount++;
                    continue;
                }

                const filePath = this.getFilePath(att);
                if (!filePath || !fs.existsSync(filePath)) {
                    updatedAttachments.push(att);
                    skippedCount++;
                    continue;
                }

                try {
                    const origStat = fs.statSync(filePath);
                    originalSizeBytes += origStat.size;

                    // Prepare WebP destination
                    const dir = path.dirname(filePath);
                    const ext = path.extname(filePath);
                    const baseName = path.basename(filePath, ext);
                    const webpFilename = `${baseName}.webp`;
                    const webpFilePath = path.join(dir, webpFilename);

                    // Compress using Sharp
                    const buffer = await sharp(filePath)
                        .resize({ width: maxWidth, withoutEnlargement: true })
                        .webp({ quality })
                        .toBuffer();

                    fs.writeFileSync(webpFilePath, buffer);
                    const newStat = fs.statSync(webpFilePath);
                    compressedSizeBytes += newStat.size;

                    // Delete original file if it had a different extension (png, jpg, etc.)
                    if (filePath !== webpFilePath && fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }

                    // Update URL extension in attachments
                    const newUrl = att.replace(new RegExp(`\\${ext}$`, 'i'), '.webp');
                    updatedAttachments.push(newUrl);
                    compressedCount++;
                    messageUpdated = true;
                } catch (err: any) {
                    this.logger.error(`Error compressing image ${filePath}: ${err.message}`);
                    errors.push(`Failed to compress ${att}: ${err.message}`);
                    updatedAttachments.push(att);
                }
            }

            if (messageUpdated) {
                await this.messageRepo.update(msg.id, { attachments: updatedAttachments });
            }
        }

        const freedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
        const savingsPercentage = originalSizeBytes > 0 ? Math.round((freedBytes / originalSizeBytes) * 100) : 0;

        const result: ImageCompressionResult = {
            totalScanned,
            compressedCount,
            skippedCount,
            originalSizeBytes,
            compressedSizeBytes,
            freedBytes,
            savingsPercentage,
            errors,
            executedAt: new Date(),
        };

        this.logger.log(`Image compression completed: ${JSON.stringify(result)}`);
        return result;
    }
}
