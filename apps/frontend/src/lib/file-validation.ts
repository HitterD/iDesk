/**
 * File validation utilities for client-side upload validation
 */

export const FILE_SIZE_LIMITS = {
    AVATAR: 2 * 1024 * 1024, // 2MB for avatars
    ATTACHMENT: 25 * 1024 * 1024, // 25MB per ticket attachment; mirrors backend MAX_ATTACHMENT_SIZE
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
    // Browsers report zip inconsistently across platforms; accept the known variants.
    'application/zip',
    'application/x-zip-compressed',
];

/** Mirrors backend `MAX_FILES` in attachment-upload.interceptor.ts */
export const MAX_ATTACHMENTS_PER_TICKET = 5;
export const ALLOWED_ATTACHMENT_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

/**
 * Ticket attachment whitelist, mirroring backend `ATTACHMENT_EXTENSIONS`. Checked by
 * extension because browsers report MIME types for zip/rar/7z/csv inconsistently;
 * the backend verifies the actual file content.
 */
export const ATTACHMENT_EXTENSIONS = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.txt',
    '.zip', '.rar', '.7z',
] as const;
/** Value for `<input type="file" accept>`. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.join(',');

const extensionOf = (name: string): string => {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

export const isAllowedAttachmentName = (name: string): boolean =>
    (ATTACHMENT_EXTENSIONS as readonly string[]).includes(extensionOf(name));

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

/** Axios upload progress as a 0-100 integer; 0 when the total is unknown. */
export const toUploadPercent = (loaded: number, total?: number): number =>
    total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

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
            error: `Ukuran file (${formatFileSize(file.size)}) melebihi batas ${formatFileSize(maxSize)}`,
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
    if (!isAllowedAttachmentName(file.name)) {
        return { valid: false, error: `Tipe file tidak didukung. Yang diizinkan: ${ATTACHMENT_EXTENSIONS.join(', ')}` };
    }

    const sizeResult = validateFileSize(file, maxSize);
    if (!sizeResult.valid) return sizeResult;

    return { valid: true };
};

/**
 * Validate a batch of ticket attachments (count + each file's extension and size).
 * Errors name the offending file.
 */
export const validateFiles = (
    files: File[],
    options: {
        maxSize?: number;
        maxFiles?: number;
    } = {}
): FileValidationResult => {
    const { maxSize = FILE_SIZE_LIMITS.ATTACHMENT, maxFiles = MAX_ATTACHMENTS_PER_TICKET } = options;

    if (files.length > maxFiles) {
        return { valid: false, error: `Maksimal ${maxFiles} file per kirim` };
    }

    for (const file of files) {
        const result = validateAttachmentFile(file, maxSize);
        if (!result.valid) return { valid: false, error: `${file.name}: ${result.error}` };
    }

    return { valid: true };
};
