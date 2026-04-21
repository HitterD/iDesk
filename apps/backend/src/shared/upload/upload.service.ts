import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
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

export interface DownloadOptions {
    url: string;
    originalName?: string;
    folder?: string;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);
    private readonly uploadDir: string;
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        // Default upload directory
        this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
        this.baseUrl = this.configService.get<string>('UPLOAD_BASE_URL', '/uploads');
        
        // Ensure upload directory exists
        this.ensureDirectory(this.uploadDir);
        this.ensureDirectory(path.join(this.uploadDir, 'telegram'));
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
     * Download a file from URL and save to local storage
     */
    async downloadFromUrl(options: DownloadOptions): Promise<UploadedFile> {
        const { url, originalName, folder = 'telegram' } = options;
        
        return new Promise((resolve, reject) => {
            const fileId = randomUUID();
            const extension = this.getExtensionFromUrl(url) || this.guessExtension(url);
            const filename = `${fileId}${extension}`;
            const folderPath = path.join(this.uploadDir, folder);
            const filePath = path.join(folderPath, filename);
            
            this.ensureDirectory(folderPath);
            
            const file = fs.createWriteStream(filePath);
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        file.close();
                        fs.unlinkSync(filePath);
                        this.downloadFromUrl({ ...options, url: redirectUrl })
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }
                
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filePath);
                    reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                    return;
                }
                
                const mimeType = response.headers['content-type'] || 'application/octet-stream';
                let size = 0;
                
                response.on('data', (chunk) => {
                    size += chunk.length;
                });
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    
                    const result: UploadedFile = {
                        id: fileId,
                        originalName: originalName || filename,
                        filename,
                        path: filePath,
                        url: `${this.baseUrl}/${folder}/${filename}`,
                        mimeType,
                        size,
                        createdAt: new Date(),
                    };
                    
                    this.logger.log(`Downloaded file: ${filename} (${size} bytes)`);
                    resolve(result);
                });
            });
            
            request.on('error', (err) => {
                file.close();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                this.logger.error(`Download error: ${err.message}`);
                reject(err);
            });
            
            // Set timeout
            request.setTimeout(30000, () => {
                request.destroy();
                file.close();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                reject(new Error('Download timeout'));
            });
        });
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
        
        return {
            id: fileId,
            originalName,
            filename,
            path: filePath,
            url: `${this.baseUrl}/${folder}/${filename}`,
            mimeType,
            size: buffer.length,
            createdAt: new Date(),
        };
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

    private getExtensionFromUrl(url: string): string {
        try {
            const urlPath = new URL(url).pathname;
            const ext = path.extname(urlPath);
            return ext || '';
        } catch {
            return '';
        }
    }

    private guessExtension(url: string): string {
        // Try to guess from URL pattern
        if (url.includes('photo') || url.includes('image')) {
            return '.jpg';
        }
        if (url.includes('document') || url.includes('file')) {
            return '.bin';
        }
        return '';
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
