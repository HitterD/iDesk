/**
 * File validation utilities for client-side upload validation
 */

export const FILE_SIZE_LIMITS = {
    AVATAR: 2 * 1024 * 1024, // 2MB for avatars
    ATTACHMENT: 10 * 1024 * 1024, // 10MB for general attachments
    DOCUMENT: 20 * 1024 * 1024, // 20MB for documents
};

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
];
export const ALLOWED_ATTACHMENT_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Format bytes to human-readable string
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate file size
 */
export const validateFileSize = (
    file: File,
    maxSize: number = FILE_SIZE_LIMITS.ATTACHMENT
): FileValidationResult => {
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(maxSize)})`,
        };
    }
    return { valid: true };
};

/**
 * Validate file type
 */
export const validateFileType = (
    file: File,
    allowedTypes: string[] = ALLOWED_ATTACHMENT_TYPES
): FileValidationResult => {
    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: `File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        };
    }
    return { valid: true };
};

/**
 * Validate image file (size + type)
 */
export const validateImageFile = (
    file: File,
    maxSize: number = FILE_SIZE_LIMITS.AVATAR
): FileValidationResult => {
    const typeResult = validateFileType(file, ALLOWED_IMAGE_TYPES);
    if (!typeResult.valid) return typeResult;

    const sizeResult = validateFileSize(file, maxSize);
    if (!sizeResult.valid) return sizeResult;

    return { valid: true };
};

/**
 * Validate attachment file (size + type)
 */
export const validateAttachmentFile = (
    file: File,
    maxSize: number = FILE_SIZE_LIMITS.ATTACHMENT
): FileValidationResult => {
    const typeResult = validateFileType(file, ALLOWED_ATTACHMENT_TYPES);
    if (!typeResult.valid) return typeResult;

    const sizeResult = validateFileSize(file, maxSize);
    if (!sizeResult.valid) return sizeResult;

    return { valid: true };
};

/**
 * Validate multiple files
 */
export const validateFiles = (
    files: File[],
    options: {
        maxSize?: number;
        maxFiles?: number;
        allowedTypes?: string[];
    } = {}
): FileValidationResult => {
    const { maxSize = FILE_SIZE_LIMITS.ATTACHMENT, maxFiles = 5, allowedTypes = ALLOWED_ATTACHMENT_TYPES } = options;

    if (files.length > maxFiles) {
        return { valid: false, error: `Maximum ${maxFiles} files allowed` };
    }

    for (const file of files) {
        const typeResult = validateFileType(file, allowedTypes);
        if (!typeResult.valid) return typeResult;

        const sizeResult = validateFileSize(file, maxSize);
        if (!sizeResult.valid) return sizeResult;
    }

    return { valid: true };
};
