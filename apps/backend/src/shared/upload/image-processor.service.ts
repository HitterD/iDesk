import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

let sharp: any;
try {
    sharp = require('sharp');
} catch {
    sharp = null;
}

interface CompressOptions {
    maxWidth?: number;
    quality?: number;
}

interface ImageMetadata {
    width?: number;
    height?: number;
    format?: string;
}

@Injectable()
export class ImageProcessorService {
    private readonly logger = new Logger(ImageProcessorService.name);
    private readonly sharpAvailable: boolean;

    constructor() {
        this.sharpAvailable = sharp !== null;
        if (!this.sharpAvailable) {
            this.logger.warn('Sharp library not available. Image processing features disabled. Install with: npm install sharp');
        }
    }

    async compressImage(
        inputPath: string,
        outputPath?: string,
        options: CompressOptions = {}
    ): Promise<string> {
        if (!this.sharpAvailable) {
            this.logger.warn('Image compression skipped - sharp not installed');
            return inputPath;
        }

        const { maxWidth = 1920, quality = 80 } = options;
        const finalOutputPath = outputPath || inputPath;

        try {
            const tempPath = `${inputPath}.tmp`;
            
            await sharp(inputPath)
                .resize(maxWidth, null, { withoutEnlargement: true })
                .jpeg({ quality, mozjpeg: true })
                .toFile(tempPath);

            if (outputPath && outputPath !== inputPath) {
                fs.renameSync(tempPath, outputPath);
            } else {
                fs.unlinkSync(inputPath);
                fs.renameSync(tempPath, inputPath);
            }

            this.logger.log(`Image compressed: ${finalOutputPath}`);
            return finalOutputPath;
        } catch (error) {
            this.logger.error(`Failed to compress image: ${error.message}`);
            throw error;
        }
    }

    async generateThumbnail(
        inputPath: string,
        outputPath?: string,
        size: number = 200
    ): Promise<string> {
        if (!this.sharpAvailable) {
            this.logger.warn('Thumbnail generation skipped - sharp not installed');
            return inputPath;
        }

        const ext = path.extname(inputPath);
        const baseName = path.basename(inputPath, ext);
        const dir = path.dirname(inputPath);
        const finalOutputPath = outputPath || path.join(dir, `${baseName}_thumb${ext}`);

        try {
            await sharp(inputPath)
                .resize(size, size, { fit: 'cover' })
                .jpeg({ quality: 70 })
                .toFile(finalOutputPath);

            this.logger.log(`Thumbnail generated: ${finalOutputPath}`);
            return finalOutputPath;
        } catch (error) {
            this.logger.error(`Failed to generate thumbnail: ${error.message}`);
            throw error;
        }
    }

    async getImageMetadata(inputPath: string): Promise<ImageMetadata> {
        if (!this.sharpAvailable) {
            return {};
        }
        return sharp(inputPath).metadata();
    }

    isImage(mimetype: string): boolean {
        return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimetype);
    }

    isSharpAvailable(): boolean {
        return this.sharpAvailable;
    }
}
