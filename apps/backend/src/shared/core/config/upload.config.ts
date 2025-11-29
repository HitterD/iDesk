import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standardized file upload configuration
 * All upload endpoints should use these settings for consistency
 */

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    IMAGE: 5 * 1024 * 1024,      // 5MB for images
    DOCUMENT: 10 * 1024 * 1024,  // 10MB for documents (PDF, DOC, etc.)
    AVATAR: 2 * 1024 * 1024,     // 2MB for avatars
    ATTACHMENT: 10 * 1024 * 1024, // 10MB for ticket attachments
    CSV: 5 * 1024 * 1024,        // 5MB for CSV imports
    CONTRACT: 20 * 1024 * 1024,  // 20MB for contract PDFs
} as const;

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
    IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENT: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    AVATAR: ['image/jpeg', 'image/png', 'image/webp'],
    ATTACHMENT: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv',
    ],
    CSV: ['text/csv', 'application/csv', 'text/plain'],
    CONTRACT: ['application/pdf'],
} as const;

// File extensions mapping
export const ALLOWED_EXTENSIONS = {
    IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    DOCUMENT: ['.pdf', '.doc', '.docx'],
    AVATAR: ['.jpg', '.jpeg', '.png', '.webp'],
    ATTACHMENT: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'],
    CSV: ['.csv'],
    CONTRACT: ['.pdf'],
} as const;

// Storage configuration factory
export function createStorage(destination: string) {
    return diskStorage({
        destination,
        filename: (req, file, cb) => {
            const uniqueSuffix = uuidv4();
            const ext = extname(file.originalname).toLowerCase();
            cb(null, `${uniqueSuffix}${ext}`);
        },
    });
}

// File filter factory
export function createFileFilter(type: keyof typeof ALLOWED_MIME_TYPES) {
    const allowedMimes: readonly string[] = ALLOWED_MIME_TYPES[type];
    const allowedExts: readonly string[] = ALLOWED_EXTENSIONS[type];
    
    return (req: any, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
        const ext = extname(file.originalname).toLowerCase();
        
        // Check MIME type
        if (!allowedMimes.includes(file.mimetype)) {
            return callback(
                new BadRequestException(`Invalid file type. Allowed types: ${allowedMimes.join(', ')}`),
                false
            );
        }
        
        // Check extension
        if (!allowedExts.includes(ext)) {
            return callback(
                new BadRequestException(`Invalid file extension. Allowed extensions: ${allowedExts.join(', ')}`),
                false
            );
        }
        
        callback(null, true);
    };
}

// Pre-configured multer options
export const MULTER_OPTIONS = {
    avatar: {
        storage: createStorage('./uploads/avatars'),
        fileFilter: createFileFilter('AVATAR'),
        limits: { fileSize: FILE_SIZE_LIMITS.AVATAR },
    },
    image: {
        storage: createStorage('./uploads'),
        fileFilter: createFileFilter('IMAGE'),
        limits: { fileSize: FILE_SIZE_LIMITS.IMAGE },
    },
    attachment: {
        storage: createStorage('./uploads'),
        fileFilter: createFileFilter('ATTACHMENT'),
        limits: { fileSize: FILE_SIZE_LIMITS.ATTACHMENT },
    },
    document: {
        storage: createStorage('./uploads/documents'),
        fileFilter: createFileFilter('DOCUMENT'),
        limits: { fileSize: FILE_SIZE_LIMITS.DOCUMENT },
    },
    csv: {
        storage: createStorage('./uploads/temp'),
        fileFilter: createFileFilter('CSV'),
        limits: { fileSize: FILE_SIZE_LIMITS.CSV },
    },
    contract: {
        storage: createStorage('./uploads/contracts'),
        fileFilter: createFileFilter('CONTRACT'),
        limits: { fileSize: FILE_SIZE_LIMITS.CONTRACT },
    },
} as const;

// Rate limit configurations for file uploads
export const UPLOAD_RATE_LIMITS = {
    avatar: { limit: 5, ttl: 60000 },      // 5 uploads per minute
    attachment: { limit: 20, ttl: 60000 }, // 20 uploads per minute
    import: { limit: 3, ttl: 60000 },      // 3 imports per minute
    contract: { limit: 10, ttl: 60000 },   // 10 uploads per minute
} as const;
